"use client";
import { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { Card, QuizQuestion, QuizResult } from "@/lib/types";
import { getSheetId, saveQuizScore, getUserConfig } from "@/lib/storage";
import { fetchVocabulary } from "@/lib/sheets";
import { generateQuiz, calcScore } from "@/lib/quiz";
import { speakWord, stopSpeech } from "@/lib/speech";

const DEMO_CARDS: Card[] = [
  { word: "abandon", meaning: "放棄；遺棄", partOfSpeech: "vt.", example: "He abandoned the car by the road.", exampleChinese: "他把車遺棄在路邊。", synonyms: "desert, forsake", root: "ab-(離開)+don(給予)", level: "B1", deck: "demo" },
  { word: "abduct", meaning: "綁架；劫持", partOfSpeech: "vt.", example: "The criminal abducted the child.", exampleChinese: "犯人綁架了那個孩子。", synonyms: "kidnap", root: "ab-(脫離)+duct(帶領)", level: "B2", deck: "demo" },
  { word: "abolish", meaning: "廢除；廢止", partOfSpeech: "vt.", example: "They decided to abolish the old law.", exampleChinese: "他們決定廢除這條舊法律。", synonyms: "eliminate, annul", root: "ab-(去除)+olere(生長)", level: "B2", deck: "demo" },
  { word: "absorb", meaning: "吸收；吸引", partOfSpeech: "vt.", example: "The sponge absorbs water quickly.", exampleChinese: "海綿很快吸收水分。", synonyms: "soak up, take in", root: "ab-(to)+sorbere(suck)", level: "B1", deck: "demo" },
];

const OPTION_LABELS = ["A", "B", "C", "D"];
type QuizPhase = "quiz" | "result";

function QuizInner() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const userId = params.user as string;
  const deckId = searchParams.get("deck") ?? "demo";

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [results, setResults] = useState<QuizResult[]>([]);
  const [phase, setPhase] = useState<QuizPhase>("quiz");
  const [loading, setLoading] = useState(true);
  const [showChinese, setShowChinese] = useState(false);

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
      const qs = generateQuiz(allCards, allCards);
      setQuestions(qs.slice(0, Math.min(qs.length, 20)));
      setLoading(false);
    })();
  }, [deckId]);

  const handleSelect = useCallback((option: string) => {
    if (selected !== null) return;
    setSelected(option);
    const q = questions[currentQ];
    const correct = option === q.answer;
    setResults((prev) => [...prev, { questionIndex: currentQ, wordId: q.wordId, userAnswer: option, correct }]);
    if (correct) speakWord(q.wordId);
  }, [selected, questions, currentQ]);

  const handleNext = useCallback(() => {
    stopSpeech();
    const newResults = [...results];
    if (currentQ + 1 >= questions.length) {
      const score = calcScore(newResults.filter(r => r.correct).length, newResults.length);
      saveQuizScore(userId, score);
      setPhase("result");
    } else {
      setCurrentQ((q) => q + 1);
      setSelected(null);
      setShowChinese(false);
    }
  }, [currentQ, questions, results, userId]);

  if (loading) {
    return (
      <div className="page" style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: "2rem", animation: "pulse 1.5s infinite" }}>📝</div>
        <div className="text-muted mt-2">準備測驗...</div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="page" style={{ alignItems: "center", justifyContent: "center", padding: "40px" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "3rem" }}>📭</div>
          <h2 style={{ fontWeight: 700, marginTop: "16px" }}>無法生成測驗</h2>
          <p className="text-muted mt-2">單字數量不足，請確保至少有 4 張卡片</p>
          <button className="btn btn-primary mt-4" onClick={() => router.push(`/${userId}`)}>返回</button>
        </div>
      </div>
    );
  }

  // ── 結果頁面 ─────────────────────────────────────────
  if (phase === "result") {
    const correctCount = results.filter((r) => r.correct).length;
    const total = results.length;
    const score = calcScore(correctCount, total);
    const wrongOnes = results.filter((r) => !r.correct);

    return (
      <div className="page">
        <div className="page-header">
          <button className="btn-icon" onClick={() => router.push(`/${userId}`)}>←</button>
          <div style={{ flex: 1, fontWeight: 700 }}>測驗結果</div>
        </div>
        <div className="page-content">
          <div className="card animate-fade-in" style={{ textAlign: "center", padding: "40px 24px", marginBottom: "20px" }}>
            <div style={{ fontSize: "3rem", marginBottom: "12px" }}>
              {score >= 80 ? "🎉" : score >= 60 ? "👍" : "💪"}
            </div>
            <div style={{ fontSize: "3rem", fontWeight: 800, color: score >= 80 ? "var(--good)" : score >= 60 ? "var(--hard)" : "var(--again)", lineHeight: 1 }}>
              {score}分
            </div>
            <div className="text-muted mt-2">{correctCount} / {total} 題正確</div>
          </div>

          {wrongOnes.length > 0 && (
            <div>
              <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "12px" }}>
                需要加強的單字
              </div>
              {wrongOnes.map((r) => {
                const q = questions[r.questionIndex];
                return (
                  <div key={r.questionIndex} className="card" style={{ marginBottom: "10px", padding: "14px 16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontWeight: 700 }}>{q.wordId}</div>
                        <div className="text-xs text-muted mt-1">
                          你答：<span style={{ color: "var(--again)" }}>{r.userAnswer}</span>
                          {" · "}正確：<span style={{ color: "var(--good)" }}>{q.answer}</span>
                        </div>
                      </div>
                      <span className="badge badge-red">✗</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "20px" }}>
            <button className="btn btn-primary" onClick={() => { setPhase("quiz"); setCurrentQ(0); setSelected(null); setResults([]); setShowChinese(false); }}>
              🔁 再測一次
            </button>
            <button className="btn btn-secondary" onClick={() => router.push(`/${userId}/study?deck=${deckId}`)}>
              📖 繼續學習
            </button>
            <button className="btn btn-ghost" onClick={() => router.push(`/${userId}`)}>
              返回牌組選擇
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── 題目頁面 ─────────────────────────────────────────
  const q = questions[currentQ];
  const pct = Math.round((currentQ / questions.length) * 100);

  return (
    <div className="page">
      <div className="page-header">
        <button className="btn-icon" onClick={() => { stopSpeech(); router.push(`/${userId}`); }}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: "0.9375rem" }}>測驗模式</div>
          <div className="text-xs text-muted">{currentQ + 1} / {questions.length}</div>
        </div>
        <span className="badge badge-blue">
          {q.type === "context-fill" ? "情境填空" : q.type === "en-to-zh" ? "英→中" : "中→英"}
        </span>
      </div>

      <div style={{ padding: "0 16px" }}>
        <div className="progress-bar">
          <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="page-content" style={{ paddingTop: "20px" }}>
        <div className="card animate-fade-in" style={{ marginBottom: "20px" }}>
          {q.type === "context-fill" ? (
            <div>
              <div className="text-xs text-muted" style={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "12px" }}>
                填入最適合的單字
              </div>
              <div style={{ fontSize: "1.0625rem", lineHeight: 1.7, color: "var(--text)", fontStyle: "italic" }}>
                {q.sentence}
              </div>
              {showChinese && q.sentenceChinese && (
                <div className="text-sm text-muted mt-2 animate-fade-in">{q.sentenceChinese}</div>
              )}
              {!showChinese && q.sentenceChinese && (
                <button className="btn btn-ghost text-sm mt-3" style={{ padding: "4px 12px", fontSize: "0.8rem" }} onClick={() => setShowChinese(true)}>
                  查看中文提示
                </button>
              )}
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "8px 0" }}>
              <div className="text-xs text-muted" style={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "12px" }}>
                {q.type === "en-to-zh" ? "選出中文翻譯" : "選出對應英文"}
              </div>
              <div style={{ fontSize: q.type === "en-to-zh" ? "2rem" : "1.25rem", fontWeight: 700, letterSpacing: "-0.02em" }}>
                {q.prompt}
              </div>
              {q.type === "en-to-zh" && (
                <button className="btn-icon mt-3" style={{ margin: "12px auto 0", fontSize: "1.25rem" }} onClick={() => speakWord(q.wordId)} aria-label="播放發音">
                  🔊
                </button>
              )}
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {q.options.map((opt, idx) => {
            let extraClass = "";
            if (selected !== null) {
              if (opt === q.answer) extraClass = "correct";
              else if (opt === selected) extraClass = "wrong";
            }
            return (
              <button
                key={idx}
                className={`quiz-option ${extraClass}`}
                onClick={() => handleSelect(opt)}
                disabled={selected !== null}
              >
                <span className="quiz-option-label" style={{
                  background: selected !== null && opt === q.answer ? "var(--good)" : selected !== null && opt === selected && opt !== q.answer ? "var(--again)" : undefined,
                  color: selected !== null && (opt === q.answer || (opt === selected && opt !== q.answer)) ? "white" : undefined,
                }}>
                  {OPTION_LABELS[idx]}
                </span>
                <span>{opt}</span>
                {selected !== null && opt === q.answer && <span style={{ marginLeft: "auto" }}>✓</span>}
                {selected !== null && opt === selected && opt !== q.answer && <span style={{ marginLeft: "auto" }}>✗</span>}
              </button>
            );
          })}
        </div>

        {selected !== null && (
          <button
            className="btn btn-primary w-full animate-slide-up mt-4"
            style={{ borderRadius: "var(--r-lg)", padding: "16px" }}
            onClick={handleNext}
          >
            {currentQ + 1 >= questions.length ? "查看結果 🎉" : "下一題 →"}
          </button>
        )}
      </div>
    </div>
  );
}

export default function QuizPage() {
  return (
    <Suspense fallback={
      <div className="page" style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: "2rem" }}>📝</div>
      </div>
    }>
      <QuizInner />
    </Suspense>
  );
}
