"use client";
import { useEffect, useState, useCallback, useRef, Suspense } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import type { Card, CardMode, SessionState } from "@/lib/types";
import { DAILY_NEW_CARD_LIMIT } from "@/lib/constants";
import { getDeckCards } from "@/lib/cardStore";
import { useCards } from "@/hooks/useCards";
import { getSession, saveSession, clearSession, updateCardProgress } from "@/storage/cards";
import { incrementStat } from "@/storage/progress";
import { getSettings } from "@/storage/settings";
import { processReview, buildDailyQueue, getTodayDate } from "@/lib/scheduler";
import { speakWord, speakSentence, stopSpeech, onVoicesReady, getAvailableVoices } from "@/lib/speech";
import { saveSettings } from "@/storage/settings";
import type { SpeechSettings } from "@/lib/types";

// Demo cards（Sheet 未設定時使用）
const DEMO_CARDS: Card[] = [
  { word: "abandon", meaning: "放棄；遺棄", partOfSpeech: "vt.", example: "She abandoned her studies to care for her family.", exampleChinese: "她放棄了學業去照顧家人。", synonyms: "desert, forsake", root: "ab-(離開)+don(給予)", level: "B1", deck: "demo" },
  { word: "absorb", meaning: "吸收；全神貫注", partOfSpeech: "vt.", example: "The sponge absorbs water very quickly.", exampleChinese: "海綿很快地吸收水分。", synonyms: "soak up, take in", root: "ab-(to)+sorbere(suck)", level: "B1", deck: "demo" },
  { word: "access", meaning: "進入；使用權", partOfSpeech: "n./vt.", example: "Students can access the library online.", exampleChinese: "學生可以在線上使用圖書館。", synonyms: "entry, approach", root: "ac-(to)+cedere(go)", level: "A2", deck: "demo" },
  { word: "accurate", meaning: "精確的；正確的", partOfSpeech: "adj.", example: "The weather forecast was accurate this time.", exampleChinese: "這次天氣預報很準確。", synonyms: "precise, exact", root: "ac-(to)+cura(care)", level: "B1", deck: "demo" },
];

// ── Session 結構說明 ──────────────────────────────────
// queue: 完整的「今日待學習」列表（含 again/hard 插回的）
// currentIndex: 目前在學第幾張（0-based）
// ─────────────────────────────────────────────────────

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
  const [speechSettings, setSpeechSettingsState] = useState<SpeechSettings>(() => getSettings().speech);
  const [autoPlayDone, setAutoPlayDone] = useState(false);

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

  // ── 進度計算（動態，因為 again/hard 會把卡片放回去）
  // queue.length 是當前總張數（含重複），currentIndex 是已完成張數
  const totalInQueue = session?.queue.length ?? 0;
  const currentPos = (session?.currentIndex ?? 0) + 1; // 顯示用（1-based）
  const pct = totalInQueue > 0 ? Math.round(((session?.currentIndex ?? 0) / totalInQueue) * 100) : 0;

  // ── 建立 / 恢復 session ───────────────────────────
  useEffect(() => {
    if (!isLoaded && rawCards.length === 0) return;

    const today = getTodayDate();
    const saved = getSession(userId, deckId);

    let sess: SessionState;

    if (saved && saved.date === today && saved.queue.length > 0 && saved.currentIndex < saved.queue.length) {
      // ✅ 今天有未完成的 session → 繼續
      sess = saved;
    } else {
      // 新 session（新的一天 or 第一次）
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

  const handleFlip = useCallback(() => setFlipped((f) => !f), []);

  // ── 核心：評分處理（修正版）──────────────────────
  const handleReview = useCallback((answer: "again" | "hard" | "good" | "easy") => {
    if (!session || !currentCard) return;
    stopSpeech();

    // 統計：每次按評分都記
    incrementStat(userId, answer);

    // 更新卡片 SRS 進度（長期記憶）
    updateCardProgress(userId, currentCard.word, {
      lastAnswer: answer,
      reviews: 1, // updateCardProgress 內部會累加
    });

    // ─ 計算新的 remaining（目前卡片之後的卡片）─
    const remaining = session.queue.slice(session.currentIndex + 1);

    const { newRemaining, markEasy } = processReview(remaining, currentCard.word, answer);

    // 新 easy 清單
    const newEasy = markEasy
      ? [...session.todayEasy, currentCard.word]
      : session.todayEasy;

    // 重新拼接完整 queue
    // 已看過的部分（0..currentIndex）保持不變，後面換成 newRemaining
    const seenPart = session.queue.slice(0, session.currentIndex + 1);
    const fullQueue = [...seenPart, ...newRemaining];

    const newIndex = session.currentIndex + 1;

    // 判斷是否完成（newIndex 超過最後）
    if (newIndex >= fullQueue.length) {
      clearSession(userId, deckId);
      incrementStat(userId, "completed");
      router.push(`/${userId}?done=${deckId}`);
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
  }, [session, currentCard, userId, deckId, mode, router]);

  const switchMode = useCallback(() => {
    const newMode: CardMode = mode === "en-to-zh" ? "zh-to-en" : "en-to-zh";
    setMode(newMode);
    if (session) {
      const updated = { ...session, mode: newMode };
      setSession(updated);
      saveSession(userId, updated);
    }
  }, [mode, session, userId]);

  const updateSpeech = (patch: Partial<SpeechSettings>) => {
    const updated = { ...speechSettings, ...patch };
    setSpeechSettingsState(updated);
    saveSettings({ speech: updated });
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

  // ── 完成畫面
  if (session && (session.currentIndex >= session.queue.length || session.queue.length === 0)) {
    return (
      <div className="page" style={{ alignItems: "center", justifyContent: "center", padding: "40px" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "3rem", marginBottom: "16px" }}>🎉</div>
          <h2 style={{ fontSize: "1.5rem", fontWeight: 700 }}>今日完成！</h2>
          <p className="text-muted mt-2">所有卡片學習完畢</p>
          <button className="btn btn-primary mt-4" style={{ borderRadius: "var(--r-lg)", padding: "14px 32px" }} onClick={() => router.push(`/${userId}`)}>
            返回首頁
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
    <div className="page">
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
        <button className="btn-icon" onClick={() => setShowSpeech(!showSpeech)} aria-label="語音設定">
          🔊
        </button>
      </div>

      {/* 進度條 */}
      <div style={{ padding: "0 16px" }}>
        <div className="progress-bar">
          <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
        </div>
        {/* 顯示「繼續學習」提示 */}
        {session && session.currentIndex > 0 && (
          <div className="text-xs text-muted" style={{ textAlign: "right", marginTop: "2px" }}>
            已學 {session.currentIndex} 張
          </div>
        )}
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
                <span>{(speechSettings[field as keyof SpeechSettings] as number).toFixed(1)}</span>
              </div>
              <input type="range" min={min} max={max} step={0.1}
                value={speechSettings[field as keyof SpeechSettings] as number}
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
