"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { getUserConfig } from "@/storage/users";
import { getDailyStats, getStreak } from "@/storage/progress";
import { getSession } from "@/storage/cards";
import { getUserDecks, getDeckCards, getCardStoreSnapshot, subscribeCardStore, initCardStore } from "@/lib/cardStore";
import { getTodayDate } from "@/lib/scheduler";
import { getSheetId } from "@/storage/settings";
import type { UserConfig } from "@/lib/types";
import { Suspense } from "react";
import { useSearchParams as useNextSearchParams } from "next/navigation";

interface DeckInfo {
  id: string;
  name: string;
  total: number;
  studied: number;
  hasSession: boolean;
  sessionProgress: number; // 0-100%
}

function DoneToast({ deckId, onClose }: { deckId: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className="animate-slide-up" style={{
      position: "fixed", bottom: "32px", left: "50%", transform: "translateX(-50%)",
      background: "var(--good)", color: "white", borderRadius: "var(--r-full)",
      padding: "12px 24px", fontWeight: 700, fontSize: "0.9375rem",
      boxShadow: "var(--shadow-xl)", zIndex: 999, whiteSpace: "nowrap",
    }}>
      🎉 {deckId} 今日完成！
    </div>
  );
}

function UserPageInner() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const userId = params.user as string;
  const doneDeck = searchParams.get("done") ?? "";

  const [user, setUser] = useState<UserConfig | null>(null);
  const [decks, setDecks] = useState<DeckInfo[]>([]);
  const [todayStats, setTodayStats] = useState({ studied: 0, completed: 0 });
  const [showDone, setShowDone] = useState(!!doneDeck);
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const cfg = getUserConfig(userId);
    if (!cfg) { router.replace("/"); return; }
    setUser(cfg);

    // 如果有 done 參數，清除 URL（避免 refresh 重顯）
    if (doneDeck) {
      window.history.replaceState({}, "", `/${userId}`);
    }
  }, [userId, router, doneDeck]);

  // 初始化 cardStore（如果尚未載入）
  useEffect(() => {
    const sheetId = getSheetId();
    if (sheetId) initCardStore(sheetId);
  }, []);

  // 訂閱 CardStore 更新
  useEffect(() => {
    const unsub = subscribeCardStore(() => forceUpdate((n) => n + 1));
    return unsub;
  }, []);

  // 計算牌組資訊
  const refreshDecks = useCallback(() => {
    if (!user) return;
    const today = getTodayDate();
    const assignments = getUserDecks(user.name);

    const deckInfos: DeckInfo[] = assignments.map((a) => {
      const cards = getDeckCards(a.deck);
      const session = getSession(userId, a.deck);
      const hasSession = !!(session && session.date === today && session.currentIndex > 0 && session.currentIndex < session.queue.length);
      const pct = hasSession && session!.queue.length > 0
        ? Math.round((session!.currentIndex / session!.queue.length) * 100) : 0;
      return {
        id: a.deck,
        name: a.deck,
        total: session?.queue.length ?? cards.length,
        studied: hasSession ? session!.currentIndex : 0,
        hasSession,
        sessionProgress: pct,
      };
    });

    if (deckInfos.length === 0) {
      deckInfos.push({ id: "demo", name: "示範牌組（未設定 Sheet ID）", total: 4, studied: 0, hasSession: false, sessionProgress: 0 });
    }

    setDecks(deckInfos);
    setTodayStats(getDailyStats(userId));
  }, [user, userId]);

  useEffect(() => {
    refreshDecks();
  }, [refreshDecks, forceUpdate]);

  const { isLoading } = getCardStoreSnapshot();

  if (!user) return null;

  const streak = getStreak(userId);

  return (
    <div className="page">
      {/* 完成提示 Toast */}
      {showDone && doneDeck && <DoneToast deckId={doneDeck} onClose={() => setShowDone(false)} />}

      <div className="page-header">
        <button className="btn-icon" onClick={() => router.push("/")} aria-label="返回首頁">←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: "1.0625rem" }}>{user.name}</div>
          <div className="text-xs text-muted">
            {streak > 0 ? `🔥 ${streak} 天連續` : "選擇要學習的牌組"}
          </div>
        </div>
        <button className="btn-icon" onClick={() => router.push(`/${userId}/stats`)} aria-label="查看統計">📊</button>
      </div>

      <div className="page-content">
        {/* 今日統計 */}
        <div className="card animate-fade-in" style={{ marginBottom: "20px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px", textAlign: "center" }}>
            <div>
              <div style={{ fontSize: "2rem", fontWeight: 800, color: "var(--blue)", lineHeight: 1 }}>{todayStats.studied}</div>
              <div className="text-xs text-muted mt-1">今日學習</div>
            </div>
            <div>
              <div style={{ fontSize: "2rem", fontWeight: 800, color: "var(--good)", lineHeight: 1 }}>{todayStats.completed}</div>
              <div className="text-xs text-muted mt-1">完成輪次</div>
            </div>
            <div>
              <div style={{ fontSize: "2rem", fontWeight: 800, lineHeight: 1 }}>
                {streak > 0 ? `🔥` : "○"}
              </div>
              <div style={{ fontSize: "0.875rem", fontWeight: 700, lineHeight: 1, marginTop: "2px" }}>{streak}</div>
              <div className="text-xs text-muted mt-1">連續天</div>
            </div>
          </div>
        </div>

        <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: "12px" }}>
          我的牌組
        </div>

        {isLoading ? (
          Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: "100px", marginBottom: "12px", borderRadius: "var(--r-lg)" }} />
          ))
        ) : decks.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: "40px 24px" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "12px" }}>📭</div>
            <div style={{ fontWeight: 600 }}>尚未指派牌組</div>
            <div className="text-sm text-muted mt-2">請讓爸爸或媽媽在後台管理中指派牌組</div>
          </div>
        ) : (
          decks.map((deck, i) => (
            <div
              key={deck.id}
              className="animate-slide-up"
              style={{ animationDelay: `${i * 60}ms`, marginBottom: "12px" }}
            >
              {/* 主牌組卡片（點擊學習） */}
              <button
                style={{
                  width: "100%", display: "block",
                  background: "var(--surface)",
                  borderRadius: deck.total > 3 ? "var(--r-lg) var(--r-lg) 0 0" : "var(--r-lg)",
                  boxShadow: "var(--shadow-sm)",
                  padding: "16px 20px",
                  cursor: "pointer",
                  border: "1px solid var(--border)",
                  borderBottom: deck.total > 3 ? "none" : "1px solid var(--border)",
                  textAlign: "left",
                  transition: "all 200ms ease",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-md)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-sm)"; }}
                onClick={() => router.push(`/${userId}/study?deck=${deck.id}`)}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "1rem" }}>{deck.name}</div>
                    <div className="text-sm text-muted mt-1">
                      共 {deck.total} 張
                      {deck.hasSession ? ` · 繼續第 ${deck.studied + 1} 張` : " · 從頭開始"}
                    </div>
                  </div>
                  <span style={{
                    fontSize: "0.75rem", fontWeight: 600, padding: "4px 10px", borderRadius: "var(--r-full)",
                    background: deck.hasSession ? "var(--blue-light)" : "var(--surface-2)",
                    color: deck.hasSession ? "var(--blue)" : "var(--text-muted)",
                    flexShrink: 0,
                  }}>
                    {deck.hasSession ? "繼續 →" : "開始"}
                  </span>
                </div>
                <div className="progress-bar">
                  <div className="progress-bar-fill" style={{ width: `${deck.sessionProgress}%` }} />
                </div>
                <div className="text-xs text-muted" style={{ marginTop: "6px" }}>
                  {deck.sessionProgress > 0 ? `${deck.sessionProgress}% 進度` : "尚未開始"}
                </div>
              </button>

              {/* 測驗按鈕（只有卡片夠多才顯示） */}
              {deck.total >= 4 && (
                <button
                  style={{
                    width: "100%",
                    padding: "10px 20px",
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    borderTop: "none",
                    borderRadius: "0 0 var(--r-lg) var(--r-lg)",
                    cursor: "pointer",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    color: "var(--text-muted)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    transition: "all 150ms ease",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "var(--surface-3)";
                    (e.currentTarget as HTMLElement).style.color = "var(--text)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "var(--surface-2)";
                    (e.currentTarget as HTMLElement).style.color = "var(--text-muted)";
                  }}
                  onClick={() => router.push(`/${userId}/quiz?deck=${deck.id}`)}
                >
                  📝 測驗模式
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function UserPage() {
  return (
    <Suspense fallback={<div className="page" />}>
      <UserPageInner />
    </Suspense>
  );
}
