"use client";
import { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import type { Card, CardMode, SessionState } from "@/lib/types";
import { DAILY_NEW_CARD_LIMIT } from "@/lib/constants";
import { getDeckCards } from "@/lib/cardStore";
import { useCards } from "@/hooks/useCards";
import { getSession, saveSession, clearSession, updateCardProgress } from "@/storage/cards";
import { incrementStat, incrementDeckCompletedCount } from "@/storage/progress";
import { getSettings, saveSettings } from "@/storage/settings";
import { processReview, buildDailyQueue, getTodayDate } from "@/lib/scheduler";
import { speakWord, speakSentence, stopSpeech, onVoicesReady, getAvailableVoices } from "@/lib/speech";

// Demo cards（Sheet 未設定時使用）
const DEMO_CARDS: Card[] = [
  { word: "abandon", meaning: "放棄；遺棄", partOfSpeech: "vt.", example: "She abandoned her studies to care for her family.", exampleChinese: "她放棄了學業去照顧家人。", synonyms: "desert, forsake", root: "ab-(離開)+don(給予)", level: "B1", deck: "demo" },
  { word: "absorb", meaning: "吸收；全神貫注", partOfSpeech: "vt.", example: "The sponge absorbs water very quickly.", exampleChinese: "海綿很快地吸收水分。", synonyms: "soak up, take in", root: "ab-(to)+sorbere(suck)", level: "B1", deck: "demo" },
  { word: "access", meaning: "進入；使用權", partOfSpeech: "n./vt.", example: "Students can access the library online.", exampleChinese: "學生可以在線上使用圖書館。", synonyms: "entry, approach", root: "ac-(to)+cedere(go)", level: "A2", deck: "demo" },
  { word: "accurate", meaning: "精確的；正確的", partOfSpeech: "adj.", example: "The weather forecast was accurate this time.", exampleChinese: "這次天氣預報很準確。", synonyms: "precise, exact", root: "ac-(to)+cura(care)", level: "B1", deck: "demo" },
];

interface SessionSummary {
  totalStudied: number;
  againList: string[];
  hardList: string[];
  goodCount: number;
  easyCount: number;
}

function StudyInner() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const userId = params.user as string;
  const deckId = searchParams.get("deck") ?? "demo";

  const [session, setSession] = useState<SessionState | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [mode, setMode] = useState<CardMode>("en-to-zh");
  const [showSpeech, setShowSpeech] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [speechSettings, setSpeechSettingsState] = useState(() => getSettings().speech);
  const [autoPlayDone, setAutoPlayDone] = useState(false);

  // 🫳 手勢控制設定狀態
  const [gestureEnabled, setGestureEnabled] = useState(() => getSettings().gesture ?? true);

  // 🏁 學習回顧階段狀態
  const [summary, setSummary] = useState<SessionSummary | null>(null);

  // 觸控手勢座標追蹤
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);

  // ── 取得卡片（來自 CardStore，不再直接 fetch）
  const { isLoaded, isLoading } = useCards(deckId);
  const rawCards = isLoaded ? getDeckCards(deckId) : [];
  const cards = rawCards.length > 0 ? rawCards : DEMO_CARDS;

  // 建立 word → Card 的快查表
  const cardMap = Object.fromEntries(cards.map((c) => [c.word, c]));

  // 目前卡片
  const currentCard = session
    ? (cardMap[session.queue[session.currentIndex]] ?? null)
    : null;

  // ── 進度計算
  const totalInQueue = session?.queue.length ?? 0;
  const currentPos = (session?.currentIndex ?? 0) + 1;
  const pct = totalInQueue > 0 ? Math.round(((session?.currentIndex ?? 0) / totalInQueue) * 100) : 0;

  // 初始化 summary
  const [localSummaryState, setLocalSummaryState] = useState<SessionSummary>({
    totalStudied: 0,
    againList: [],
    hardList: [],
    goodCount: 0,
    easyCount: 0,
  });

  // ── 建立 / 恢復 session
  useEffect(() => {
    if (!isLoaded && rawCards.length === 0) return;

    const today = getTodayDate();
    const saved = getSession(userId, deckId);
    let sess: SessionState;

    if (saved && saved.date === today && saved.queue.length > 0 && saved.currentIndex < saved.queue.length) {
      sess = saved;
    } else {
      const queue = buildDailyQueue(
        cards.map((c) => c.word),
        saved?.todayEasy ?? [],
        today
      );
      const limitedQueue = queue.slice(0, DAILY_NEW_CARD_LIMIT);
      sess = {
        date: today,
        deckId,
        queue: limitedQueue,
        currentIndex: 0,
        todayEasy: [],
        mode: "en-to-zh",
      };
      saveSession(userId, sess);
    }

    setSession(sess);
    setMode(sess.mode);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, userId, deckId]);

  // ── 語音清單
  useEffect(() => {
    onVoicesReady(() => setVoices(getAvailableVoices()));
  }, []);

  // ── 翻面自動播例句
  useEffect(() => {
    if (flipped && currentCard && !autoPlayDone && getSettings().autoPlaySpeech) {
      setAutoPlayDone(true);
      setTimeout(() => speakSentence(currentCard.example, speechSettings), 300);
    }
    if (!flipped) setAutoPlayDone(false);
  }, [flipped, currentCard, autoPlayDone, speechSettings]);

  const handleFlip = useCallback(() => {
    setFlipped((f) => {
      if (!f) {
        incrementStat(userId, "studied");
        setLocalSummaryState(s => ({ ...s, totalStudied: s.totalStudied + 1 }));
      }
      return !f;
    });
  }, [userId]);

  // ── 評分處理 ──
  const handleReview = useCallback((answer: "again" | "hard" | "good" | "easy") => {
    if (!session || !currentCard) return;
    stopSpeech();

    incrementStat(userId, answer);
    updateCardProgress(userId, currentCard.word, {
      lastAnswer: answer,
      reviews: 1,
    });

    // 累積本次學習回顧資訊
    setLocalSummaryState(s => {
      const agains = answer === "again" && !s.againList.includes(currentCard.word) ? [...s.againList, currentCard.word] : s.againList;
      const hards = answer === "hard" && !s.hardList.includes(currentCard.word) ? [...s.hardList, currentCard.word] : s.hardList;
      return {
        ...s,
        againList: agains,
        hardList: hards,
        goodCount: s.goodCount + (answer === "good" ? 1 : 0),
        easyCount: s.easyCount + (answer === "easy" ? 1 : 0),
      };
    });

    const remaining = session.queue.slice(session.currentIndex + 1);
    const { newRemaining, markEasy } = processReview(remaining, currentCard.word, answer);
    const newEasy = markEasy ? [...session.todayEasy, currentCard.word] : session.todayEasy;

    const seenPart = session.queue.slice(0, session.currentIndex + 1);
    const fullQueue = [...seenPart, ...newRemaining];
    const newIndex = session.currentIndex + 1;

    // 判斷是否完成
    if (newIndex >= fullQueue.length) {
      clearSession(userId, deckId);
      incrementStat(userId, "completed");
      incrementDeckCompletedCount(userId, deckId);
      // 切換至回顧頁面
      setSummary({
        totalStudied: localSummaryState.totalStudied + 1,
        againList: answer === "again" && !localSummaryState.againList.includes(currentCard.word) ? [...localSummaryState.againList, currentCard.word] : localSummaryState.againList,
        hardList: answer === "hard" && !localSummaryState.hardList.includes(currentCard.word) ? [...localSummaryState.hardList, currentCard.word] : localSummaryState.hardList,
        goodCount: localSummaryState.goodCount + (answer === "good" ? 1 : 0),
        easyCount: localSummaryState.easyCount + (answer === "easy" ? 1 : 0),
      });
      return;
    }

    const newSession: SessionState = {
      ...session,
      queue: fullQueue,
      currentIndex: newIndex,
      todayEasy: newEasy,
      mode,
    };

    saveSession(userId, newSession);
    setSession(newSession);
    setFlipped(false);
  }, [session, currentCard, userId, deckId, mode, localSummaryState]);

  // 🫳 手勢事件綁定
  const onTouchStart = (e: React.TouchEvent) => {
    if (!gestureEnabled) return;
    const touch = e.touches[0];
    setTouchStart({ x: touch.clientX, y: touch.clientY });
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (!gestureEnabled || !touchStart || !currentCard) return;
    const touch = e.changedTouches[0];
    const diffX = touch.clientX - touchStart.x;
    const diffY = touch.clientY - touchStart.y;
    const distanceThreshold = 65;

    // 判斷是橫向還是縱向滑動
    if (Math.abs(diffX) > Math.abs(diffY)) {
      // 橫向滑動
      if (Math.abs(diffX) > distanceThreshold) {
        if (!flipped) {
          // 未翻面：左右滑動皆翻面
          handleFlip();
        } else {
          // 已翻面：右滑 Good，左滑 Again
          if (diffX > 0) handleReview("good");
          else handleReview("again");
        }
      }
    } else {
      // 縱向滑動
      if (Math.abs(diffY) > distanceThreshold && flipped) {
        // 下滑 Hard，上滑 Easy
        if (diffY > 0) handleReview("hard");
        else handleReview("easy");
      }
    }
    setTouchStart(null);
  };

  const switchMode = useCallback(() => {
    const newMode: CardMode = mode === "en-to-zh" ? "zh-to-en" : "en-to-zh";
    setMode(newMode);
    if (session) {
      const updated = { ...session, mode: newMode };
      setSession(updated);
      saveSession(userId, updated);
    }
  }, [mode, session, userId]);

  const updateSpeech = (patch: Partial<typeof speechSettings>) => {
    const updated = { ...speechSettings, ...patch };
    setSpeechSettingsState(updated);
    saveSettings({ speech: updated });
  };

  const toggleGesture = () => {
    const nextVal = !gestureEnabled;
    setGestureEnabled(nextVal);
    saveSettings({ gesture: nextVal });
  };

  // ── Loading 畫面
  if (isLoading && rawCards.length === 0) {
    return (
      <div className="page" style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: "2rem", animation: "pulse 1.5s infinite" }}>📚</div>
        <div className="text-muted mt-2">載入教材中...</div>
      </div>
    );
  }

  // 🏁 學習回顧完成畫面
  if (summary) {
    return (
      <div className="page">
        <div className="page-header">
          <div style={{ fontWeight: 700, flex: 1, textAlign: "center" }}>✨ 學習成果回顧</div>
        </div>
        <div className="page-content" style={{ paddingBottom: "40px" }}>
          <div className="card animate-fade-in" style={{ textAlign: "center", padding: "32px 20px", marginBottom: "20px" }}>
            <div style={{ fontSize: "3.5rem" }}>🎉</div>
            <h2 className="mt-2" style={{ fontWeight: 800 }}>本輪學習完成！</h2>
            <p className="text-muted text-sm mt-1">您今天又往前邁進了一步！</p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px", marginTop: "24px" }}>
              <div style={{ background: "var(--surface-2)", borderRadius: "var(--r-md)", padding: "10px 4px" }}>
                <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--again)" }}>{summary.againList.length}</div>
                <div style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>Again</div>
              </div>
              <div style={{ background: "var(--surface-2)", borderRadius: "var(--r-md)", padding: "10px 4px" }}>
                <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--hard)" }}>{summary.hardList.length}</div>
                <div style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>Hard</div>
              </div>
              <div style={{ background: "var(--surface-2)", borderRadius: "var(--r-md)", padding: "10px 4px" }}>
                <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--good)" }}>{summary.goodCount}</div>
                <div style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>Good</div>
              </div>
              <div style={{ background: "var(--surface-2)", borderRadius: "var(--r-md)", padding: "10px 4px" }}>
                <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--blue)" }}>{summary.easyCount}</div>
                <div style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>Easy</div>
              </div>
            </div>
          </div>

          {/* 需要加強的複習清單 */}
          {(summary.againList.length > 0 || summary.hardList.length > 0) && (
            <div style={{ marginBottom: "24px" }}>
              <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "10px" }}>
                ✍️ 本次不熟的單字，點擊可播音：
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {[...summary.againList, ...summary.hardList].map((word) => {
                  const card = cardMap[word];
                  return (
                    <button
                      key={word}
                      onClick={() => speakWord(word, speechSettings)}
                      style={{
                        width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
                        padding: "14px 18px", borderRadius: "var(--r-md)", background: "var(--surface)",
                        border: "1px solid var(--border)", textAlign: "left", cursor: "pointer",
                        transition: "all 150ms ease"
                      }}
                      onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = "var(--surface-2)"}
                      onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = "var(--surface)"}
                    >
                      <div>
                        <span style={{ fontWeight: 700, fontSize: "1.0625rem" }}>{word}</span>
                        {card && <span className="text-xs text-muted" style={{ marginLeft: "12px" }}>{card.partOfSpeech} {card.meaning}</span>}
                      </div>
                      <span style={{ fontSize: "1.2rem" }}>🔊</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <button className="btn btn-primary w-full" style={{ borderRadius: "var(--r-lg)", padding: "16px" }} onClick={() => router.push(`/${userId}?done=${deckId}`)}>
            確認並回到首頁
          </button>
        </div>
      </div>
    );
  }

  if (!currentCard) {
    return (
      <div className="page" style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: "2rem" }}>⏳</div>
        <div className="text-muted mt-2">準備中...</div>
      </div>
    );
  }

  const frontText = mode === "en-to-zh" ? currentCard.word : currentCard.meaning;

  return (
    <div className="page" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {/* 頂部導航 */}
      <div className="page-header">
        <button className="btn-icon" onClick={() => { stopSpeech(); router.push(`/${userId}`); }} aria-label="返回">←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: "0.9375rem" }}>{deckId}</div>
          <div className="text-xs text-muted">第 {currentPos} 張 / 共 {totalInQueue} 張</div>
        </div>
        <button className="btn-icon" onClick={switchMode} title={mode === "en-to-zh" ? "正面：英文" : "正面：中文"}>
          {mode === "en-to-zh" ? "🇺🇸" : "🇨🇳"}
        </button>
        <button className="btn-icon" onClick={toggleGesture} title={gestureEnabled ? "手勢已啟用" : "手勢已停用"} style={{
          background: gestureEnabled ? "var(--blue-light)" : "var(--surface-2)",
          color: gestureEnabled ? "var(--blue)" : "var(--text-muted)",
        }}>
          🫲
        </button>
        <button className="btn-icon" onClick={() => setShowSpeech(!showSpeech)} aria-label="語音設定">
          🔊
        </button>
      </div>

      {/* 進度條 */}
      <div style={{ padding: "0 16px" }}>
        <div className="progress-bar">
          <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "2px" }} className="text-xs text-muted">
          <span>{gestureEnabled ? "🫳 滑動可操作" : ""}</span>
          {session && session.currentIndex > 0 && (
            <span>已學 {session.currentIndex} 張</span>
          )}
        </div>
      </div>

      {/* 語音設定面板 */}
      {showSpeech && (
        <div className="card animate-fade-in" style={{ margin: "12px 16px", padding: "16px" }}>
          <div style={{ fontWeight: 600, marginBottom: "12px" }}>🔊 語音設定</div>
          <label className="text-xs text-muted">語音</label>
          <select
            value={speechSettings.voiceName}
            onChange={(e) => updateSpeech({ voiceName: e.target.value })}
            style={{ width: "100%", padding: "8px", borderRadius: "var(--r-sm)", border: "1px solid var(--border)", background: "var(--surface-2)", marginBottom: "10px", marginTop: "4px", fontSize: "0.875rem" }}
          >
            <option value="">自動選擇（建議）</option>
            {voices.map((v) => <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>)}
          </select>
          {(([["rate", "語速", 0.5, 2.0], ["pitch", "音調", 0.5, 2.0], ["volume", "音量", 0, 1]] as const)).map(([field, label, min, max]) => (
            <div key={field} style={{ marginBottom: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }} className="text-sm">
                <span className="text-muted">{label}</span>
                <span>{(speechSettings[field as keyof typeof speechSettings] as number).toFixed(1)}</span>
              </div>
              <input type="range" min={min} max={max} step={0.1}
                value={speechSettings[field as keyof typeof speechSettings] as number}
                onChange={(e) => updateSpeech({ [field]: parseFloat(e.target.value) })}
                style={{ width: "100%", accentColor: "var(--blue)" }}
              />
            </div>
          ))}
          <button className="btn btn-ghost text-sm mt-2" onClick={() => speakWord(currentCard.word, speechSettings)}>🔊 試聽</button>
        </div>
      )}

      {/* 翻轉卡片 */}
      <div className="page-content" style={{ paddingTop: "16px", paddingBottom: "0" }}>
        <div
          className="flip-card-container"
          onClick={handleFlip}
          role="button" tabIndex={0}
          onKeyDown={(e) => e.key === " " && handleFlip()}
          aria-label={flipped ? "點擊回正面" : "點擊翻面"}
          style={{ minHeight: "300px" }}
        >
          <div className={`flip-card-inner ${flipped ? "flipped" : ""}`}>
            {/* 正面 */}
            <div className="flip-card-face" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 28px", minHeight: "300px" }}>
              {mode === "zh-to-en" && <div className="text-sm text-muted" style={{ marginBottom: "8px" }}>{currentCard.partOfSpeech}</div>}
              <div style={{ fontSize: mode === "en-to-zh" ? "2.5rem" : "1.625rem", fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text)", textAlign: "center", lineHeight: 1.2 }}>
                {frontText}
              </div>
              {mode === "en-to-zh" && (
                <button
                  className="btn-icon mt-4"
                  style={{ fontSize: "1.5rem", width: "52px", height: "52px" }}
                  onClick={(e) => { e.stopPropagation(); speakWord(currentCard.word, speechSettings); }}
                  aria-label="播放發音"
                >🔊</button>
              )}
              <div className="text-muted mt-4 text-sm" style={{ opacity: 0.5 }}>點擊翻面</div>
            </div>

            {/* 背面 */}
            <div className="flip-card-face flip-card-back" style={{ padding: "24px", minHeight: "300px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                <div>
                  <div style={{ fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.02em" }}>
                    {mode === "en-to-zh" ? currentCard.word : currentCard.meaning}
                  </div>
                  <span className="badge badge-blue" style={{ marginTop: "4px", display: "inline-block" }}>{currentCard.partOfSpeech}</span>
                </div>
                <button className="btn-icon" style={{ fontSize: "1.25rem" }} onClick={(e) => { e.stopPropagation(); speakWord(currentCard.word, speechSettings); }} aria-label="播放">🔊</button>
              </div>
              <div style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "16px" }}>
                {mode === "en-to-zh" ? currentCard.meaning : currentCard.word}
              </div>
              {currentCard.example && (
                <div style={{ background: "var(--surface-2)", borderRadius: "var(--r-md)", padding: "12px 14px", marginBottom: "10px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "0.875rem", fontStyle: "italic", color: "var(--text-2)" }}>{currentCard.example}</div>
                      <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)", marginTop: "4px" }}>{currentCard.exampleChinese}</div>
                    </div>
                    <button className="btn-icon" style={{ flexShrink: 0, fontSize: "1rem" }} onClick={(e) => { e.stopPropagation(); speakSentence(currentCard.example, speechSettings); }}>🔊</button>
                  </div>
                </div>
              )}
              {currentCard.synonyms && <div className="text-sm" style={{ marginBottom: "4px" }}><span className="text-muted" style={{ fontWeight: 600 }}>同義 </span>{currentCard.synonyms}</div>}
              {currentCard.root && <div className="text-sm"><span className="text-muted" style={{ fontWeight: 600 }}>字根 </span>{currentCard.root}</div>}
            </div>
          </div>
        </div>

        {!flipped && (
          <div style={{ padding: "16px 0" }}>
            <button className="btn btn-secondary w-full" style={{ borderRadius: "var(--r-lg)", padding: "16px" }} onClick={handleFlip}>翻面查看答案</button>
          </div>
        )}
      </div>

      {/* 評分按鈕 */}
      {flipped && (
        <div style={{ padding: "0 16px 32px" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textAlign: "center", marginBottom: "8px", fontWeight: 600 }}>選擇熟悉程度</div>
          <div className="review-buttons" style={{ padding: "0" }}>
            {([
              ["again", "🔁", "Again", "再看"],
              ["hard", "😓", "Hard", "困難"],
              ["good", "👍", "Good", "熟悉"],
              ["easy", "⭐", "Easy", "很熟"],
            ] as const).map(([ans, emoji, label, sub]) => (
              <button key={ans} className={`review-btn review-btn-${ans}`} onClick={() => handleReview(ans)}>
                <span style={{ fontSize: "1.25rem" }}>{emoji}</span>
                <span style={{ fontWeight: 700 }}>{label}</span>
                <span style={{ fontSize: "0.65rem", opacity: 0.7 }}>{sub}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function StudyPage() {
  return (
    <Suspense fallback={<div className="page" style={{ alignItems: "center", justifyContent: "center" }}><div style={{ fontSize: "2rem" }}>📚</div></div>}>
      <StudyInner />
    </Suspense>
  );
}
