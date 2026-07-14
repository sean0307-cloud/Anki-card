"use client";
import { useEffect, useState, useCallback, useRef, Suspense } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { Card, SessionState, CardMode } from "@/lib/types";
import {
  getSession, saveSession, clearSession,
  updateCardReview, incrementStat,
  getSheetId, getCardMode, saveCardMode,
  getSpeechSettings, saveSpeechSettings,
  getUserConfig,
} from "@/lib/storage";
import { fetchVocabulary } from "@/lib/sheets";
import {
  processReview, buildDailyQueue, getTodayDate, getTomorrowDate,
} from "@/lib/scheduler";
import { speakWord, speakSentence, getAvailableVoices, onVoicesReady, stopSpeech } from "@/lib/speech";

const DEMO_CARDS: Card[] = [
  { word: "abandon", meaning: "放棄；遺棄", partOfSpeech: "vt.", example: "He abandoned the car by the road.", exampleChinese: "他把車遺棄在路邊。", synonyms: "desert, forsake", root: "ab-(離開) + don(給予)", level: "B1", deck: "demo" },
  { word: "abduct", meaning: "綁架；劫持", partOfSpeech: "vt.", example: "The criminal abducted the child.", exampleChinese: "犯人綁架了那個孩子。", synonyms: "kidnap", root: "ab-(脫離) + duct(帶領)", level: "B2", deck: "demo" },
  { word: "abolish", meaning: "廢除；廢止", partOfSpeech: "vt.", example: "They decided to abolish the old law.", exampleChinese: "他們決定廢除這條舊法律。", synonyms: "eliminate, annul", root: "ab-(去除) + olere(生長)", level: "B2", deck: "demo" },
];

function StudyInner() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const userId = params.user as string;
  const deckId = searchParams.get("deck") ?? "demo";

  const [cards, setCards] = useState<Card[]>([]);
  const [session, setSession] = useState<SessionState | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<CardMode>("en-to-zh");
  const [showSpeech, setShowSpeech] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [speechSettings, setSpeechSettings] = useState(getSpeechSettings());
  const [autoPlayDone, setAutoPlayDone] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // 取得當前卡片
  const currentCard = session && cards.length > 0
    ? cards.find((c) => c.word === session.queue[session.currentIndex])
    : null;

  const totalInQueue = session?.queue.length ?? 0;
  const progress = session ? session.currentIndex : 0;
  const pct = totalInQueue > 0 ? Math.round((progress / totalInQueue) * 100) : 0;

  // 載入卡片資料
  useEffect(() => {
    (async () => {
      setLoading(true);
      let allCards: Card[] = [];
      const sheetId = getSheetId();
      if (sheetId) {
        const all = await fetchVocabulary(sheetId);
        allCards = all.filter((c) => c.deck === deckId);
      }
      if (allCards.length === 0) allCards = DEMO_CARDS;
      setCards(allCards);

      // 恢復或建立 session
      const today = getTodayDate();
      const saved = getSession(userId, deckId);
      let sess: SessionState;

      if (saved && saved.date === today) {
        // 同一天：繼續
        sess = saved;
      } else {
        // 新的一天：建立新佇列
        const queue = buildDailyQueue(
          allCards.map((c) => c.word),
          saved?.todayEasy ?? [],
          today
        );
        sess = {
          date: today,
          deckId,
          queue,
          currentIndex: 0,
          todayEasy: [],
          mode: getCardMode(userId, deckId),
        };
        saveSession(userId, sess);
      }
      setSession(sess);
      setMode(sess.mode);
      setLoading(false);
    })();
  }, [userId, deckId]);

  // 語音清單
  useEffect(() => {
    onVoicesReady(() => setVoices(getAvailableVoices()));
  }, []);

  // 翻面後自動播放例句
  useEffect(() => {
    if (flipped && currentCard && !autoPlayDone) {
      setAutoPlayDone(true);
      setTimeout(() => speakSentence(currentCard.example), 300);
    }
    if (!flipped) setAutoPlayDone(false);
  }, [flipped, currentCard, autoPlayDone]);

  const handleFlip = useCallback(() => {
    setFlipped((f) => !f);
  }, []);

  const handleReview = useCallback((answer: "again" | "hard" | "good" | "easy") => {
    if (!session || !currentCard) return;
    stopSpeech();

    const remaining = session.queue.slice(session.currentIndex + 1);
    const { newQueue, markEasy } = processReview(remaining, currentCard.word, answer);

    const nextReview = answer === "easy" ? getTomorrowDate() : getTodayDate();
    updateCardReview(userId, currentCard.word, answer, nextReview);
    incrementStat(userId, "studied");
    incrementStat(userId, answer as "again" | "hard" | "good" | "easy");

    let newEasy = [...session.todayEasy];
    if (markEasy) newEasy = [...newEasy, currentCard.word];

    const newCurrentIndex = session.currentIndex + 1;
    const fullQueue = [
      ...session.queue.slice(0, session.currentIndex),
      ...newQueue,
    ];
    // 如果 Easy，把它從佇列移除
    const finalQueue = markEasy
      ? fullQueue.filter((id) => id !== currentCard.word)
      : [...session.queue.slice(0, session.currentIndex + 1), ...newQueue];

    if (newCurrentIndex >= finalQueue.length || (markEasy && newCurrentIndex > finalQueue.length - 1)) {
      // 本輪學習完成 → 進入測驗
      clearSession(userId, deckId);
      incrementStat(userId, "completed");
      router.push(`/${userId}/quiz?deck=${deckId}`);
      return;
    }

    const newSession: SessionState = {
      ...session,
      queue: finalQueue,
      currentIndex: newCurrentIndex,
      todayEasy: newEasy,
    };
    saveSession(userId, newSession);
    setSession(newSession);
    setFlipped(false);
  }, [session, currentCard, userId, deckId, router]);

  const switchMode = () => {
    const newMode: CardMode = mode === "en-to-zh" ? "zh-to-en" : "en-to-zh";
    setMode(newMode);
    saveCardMode(userId, deckId, newMode);
    if (session) {
      const updated = { ...session, mode: newMode };
      setSession(updated);
      saveSession(userId, updated);
    }
  };

  if (loading) {
    return (
      <div className="page" style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: "2rem", animation: "pulse 1.5s infinite" }}>📚</div>
        <div className="text-muted mt-2">載入中...</div>
      </div>
    );
  }

  if (!currentCard) {
    return (
      <div className="page" style={{ alignItems: "center", justifyContent: "center", padding: "40px" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "3rem", marginBottom: "16px" }}>🎉</div>
          <h2 style={{ fontSize: "1.5rem", fontWeight: 700 }}>今日學習完成！</h2>
          <p className="text-muted mt-2">所有卡片已完成一輪學習</p>
          <button className="btn btn-primary mt-4" onClick={() => router.push(`/${userId}/quiz?deck=${deckId}`)}>
            進入測驗 →
          </button>
          <br />
          <button className="btn btn-ghost mt-2" onClick={() => router.push(`/${userId}`)}>
            返回首頁
          </button>
        </div>
      </div>
    );
  }

  const frontText = mode === "en-to-zh" ? currentCard.word : currentCard.meaning;
  const frontSub = mode === "en-to-zh" ? "" : `(${currentCard.partOfSpeech})`;

  return (
    <div className="page">
      {/* 頂部導航 */}
      <div className="page-header">
        <button className="btn-icon" onClick={() => { stopSpeech(); router.push(`/${userId}`); }} aria-label="返回">
          ←
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: "0.9375rem" }}>{deckId}</div>
          <div className="text-xs text-muted">{progress + 1} / {totalInQueue}</div>
        </div>
        <button className="btn-icon" onClick={switchMode} aria-label="切換模式" title={mode === "en-to-zh" ? "正面：英文" : "正面：中文"}>
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
      </div>

      {/* 語音設定面板 */}
      {showSpeech && (
        <div className="card animate-fade-in" style={{ margin: "12px 16px", padding: "16px" }}>
          <div style={{ fontWeight: 600, marginBottom: "12px" }}>🔊 語音設定</div>
          <label className="text-sm text-muted">語音</label>
          <select
            value={speechSettings.voiceName}
            onChange={(e) => {
              const s = { ...speechSettings, voiceName: e.target.value };
              setSpeechSettings(s);
              saveSpeechSettings(s);
            }}
            style={{ width: "100%", padding: "8px", borderRadius: "var(--r-sm)", border: "1px solid var(--border)", background: "var(--surface-2)", marginBottom: "8px", marginTop: "4px" }}
          >
            <option value="">預設</option>
            {voices.map((v) => <option key={v.name} value={v.name}>{v.name}</option>)}
          </select>
          {([["rate", "語速", 0.5, 2.0], ["pitch", "音調", 0.5, 2.0], ["volume", "音量", 0, 1]] as const).map(([field, label, min, max]) => (
            <div key={field} style={{ marginBottom: "8px" }}>
              <div className="flex justify-between text-sm">
                <span className="text-muted">{label}</span>
                <span>{(speechSettings[field as keyof typeof speechSettings] as number).toFixed(1)}</span>
              </div>
              <input type="range" min={min} max={max} step={0.1}
                value={speechSettings[field as keyof typeof speechSettings] as number}
                onChange={(e) => {
                  const s = { ...speechSettings, [field]: parseFloat(e.target.value) };
                  setSpeechSettings(s);
                  saveSpeechSettings(s);
                }}
                style={{ width: "100%", accentColor: "var(--blue)" }}
              />
            </div>
          ))}
          <button className="btn btn-ghost text-sm mt-2" onClick={() => speakWord(currentCard.word)}>
            🔊 試聽
          </button>
        </div>
      )}

      {/* 翻轉卡片 */}
      <div className="page-content" style={{ paddingTop: "16px", paddingBottom: "0" }}>
        <div
          className="flip-card-container"
          ref={cardRef}
          onClick={handleFlip}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === " " && handleFlip()}
          aria-label={flipped ? "點擊回正面" : "點擊翻面"}
          style={{ minHeight: "320px" }}
        >
          <div className={`flip-card-inner ${flipped ? "flipped" : ""}`}>
            {/* 正面 */}
            <div className="flip-card-face" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 28px", minHeight: "320px" }}>
              {frontSub && <div className="text-sm text-muted" style={{ marginBottom: "8px" }}>{frontSub}</div>}
              <div style={{ fontSize: mode === "en-to-zh" ? "2.5rem" : "1.75rem", fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text)", textAlign: "center", lineHeight: 1.2 }}>
                {frontText}
              </div>
              {mode === "en-to-zh" && (
                <button
                  className="btn btn-icon mt-4"
                  style={{ fontSize: "1.5rem", width: "52px", height: "52px" }}
                  onClick={(e) => { e.stopPropagation(); speakWord(currentCard.word); }}
                  aria-label="播放單字發音"
                >
                  🔊
                </button>
              )}
              <div className="text-muted mt-4 text-sm animate-fade-in" style={{ opacity: 0.6 }}>
                點擊翻面
              </div>
            </div>

            {/* 背面 */}
            <div className="flip-card-face flip-card-back" style={{ padding: "24px", minHeight: "320px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <div>
                  <div style={{ fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.02em" }}>
                    {mode === "en-to-zh" ? currentCard.word : currentCard.meaning}
                  </div>
                  <div className="badge badge-blue mt-1">{currentCard.partOfSpeech}</div>
                </div>
                <button
                  className="btn-icon"
                  style={{ fontSize: "1.25rem" }}
                  onClick={(e) => { e.stopPropagation(); speakWord(currentCard.word); }}
                  aria-label="播放單字發音"
                >
                  🔊
                </button>
              </div>
              <div style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "16px", color: "var(--text)" }}>
                {mode === "en-to-zh" ? currentCard.meaning : currentCard.word}
              </div>

              {currentCard.example && (
                <div style={{ background: "var(--surface-2)", borderRadius: "var(--r-md)", padding: "12px 14px", marginBottom: "12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "0.875rem", fontStyle: "italic", color: "var(--text-2)" }}>{currentCard.example}</div>
                      <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)", marginTop: "4px" }}>{currentCard.exampleChinese}</div>
                    </div>
                    <button
                      className="btn-icon"
                      style={{ flexShrink: 0, fontSize: "1rem" }}
                      onClick={(e) => { e.stopPropagation(); speakSentence(currentCard.example); }}
                      aria-label="播放例句"
                    >
                      🔊
                    </button>
                  </div>
                </div>
              )}

              {currentCard.synonyms && (
                <div style={{ marginBottom: "8px" }}>
                  <span className="text-xs text-muted" style={{ fontWeight: 600 }}>同義字 </span>
                  <span className="text-sm">{currentCard.synonyms}</span>
                </div>
              )}
              {currentCard.root && (
                <div>
                  <span className="text-xs text-muted" style={{ fontWeight: 600 }}>字根 </span>
                  <span className="text-sm">{currentCard.root}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 翻面按鈕（正面時顯示） */}
        {!flipped && (
          <div style={{ padding: "16px 0" }}>
            <button className="btn btn-secondary w-full" onClick={handleFlip} style={{ borderRadius: "var(--r-lg)", padding: "16px" }}>
              翻面查看答案
            </button>
          </div>
        )}
      </div>

      {/* 評分按鈕（背面時顯示） */}
      {flipped && (
        <div style={{ padding: "0 16px 32px" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textAlign: "center", marginBottom: "8px", fontWeight: 600 }}>
            選擇熟悉程度
          </div>
          <div className="review-buttons" style={{ padding: "0" }}>
            {([
              ["again", "🔁", "Again", "再看"],
              ["hard", "😓", "Hard", "困難"],
              ["good", "👍", "Good", "熟悉"],
              ["easy", "⭐", "Easy", "很熟"],
            ] as const).map(([ans, emoji, label, sub]) => (
              <button
                key={ans}
                className={`review-btn review-btn-${ans}`}
                onClick={() => handleReview(ans)}
              >
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
    <Suspense fallback={
      <div className="page" style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: "2rem" }}>📚</div>
      </div>
    }>
      <StudyInner />
    </Suspense>
  );
}
