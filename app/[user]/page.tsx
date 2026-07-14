"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { getUserConfig } from "@/storage/users";
import { getDailyStats, getStreak } from "@/storage/progress";
import { getSession } from "@/storage/cards";
import { getUserDecks, getDeckCards, getCardStoreSnapshot, subscribeCardStore } from "@/lib/cardStore";
import { getTodayDate } from "@/lib/scheduler";
import type { UserConfig } from "@/lib/types";

interface DeckInfo {
  id: string;
  name: string;
  total: number;
  studied: number;
  hasSession: boolean;
}

export default function UserPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params.user as string;

  const [user, setUser] = useState<UserConfig | null>(null);
  const [decks, setDecks] = useState<DeckInfo[]>([]);
  const [todayStats, setTodayStats] = useState({ studied: 0, completed: 0 });
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const cfg = getUserConfig(userId);
    if (!cfg) { router.replace("/"); return; }
    setUser(cfg);
  }, [userId, router]);

  // 訂閱 CardStore 更新
  useEffect(() => {
    const unsub = subscribeCardStore(() => forceUpdate((n) => n + 1));
    return unsub;
  }, []);

  // 計算牌組資訊（從 CardStore，不 fetch）
  useEffect(() => {
    if (!user) return;
    const today = getTodayDate();
    const assignments = getUserDecks(user.name);

    const deckInfos: DeckInfo[] = assignments.map((a) => {
      const cards = getDeckCards(a.deck);
      const session = getSession(userId, a.deck);
      const hasSession = !!(session && session.date === today && session.currentIndex > 0);
      return {
        id: a.deck,
        name: a.deck,
        total: cards.length,
        studied: hasSession ? session!.currentIndex : 0,
        hasSession,
      };
    });

    // 如果沒有指派，顯示示範牌組
    if (deckInfos.length === 0) {
      deckInfos.push({ id: "demo", name: "示範牌組（未設定 Sheet ID）", total: 4, studied: 0, hasSession: false });
    }

    setDecks(deckInfos);
    setTodayStats(getDailyStats(userId));
  }, [user, userId, forceUpdate]);

  const { isLoading } = getCardStoreSnapshot();

  if (!user) return null;

  const streak = getStreak(userId);

  return (
    <div className="page">
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
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", textAlign: "center" }}>
            <div>
              <div style={{ fontSize: "2rem", fontWeight: 800, color: "var(--blue)", lineHeight: 1 }}>{todayStats.studied}</div>
              <div className="text-xs text-muted mt-1">今日學習</div>
            </div>
            <div>
              <div style={{ fontSize: "2rem", fontWeight: 800, color: "var(--good)", lineHeight: 1 }}>{streak}</div>
              <div className="text-xs text-muted mt-1">連續天數 🔥</div>
            </div>
          </div>
        </div>

        <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: "12px" }}>
          我的牌組
        </div>

        {isLoading ? (
          Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: "80px", marginBottom: "12px", borderRadius: "var(--r-lg)" }} />
          ))
        ) : decks.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: "40px 24px" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "12px" }}>📭</div>
            <div style={{ fontWeight: 600 }}>尚未指派牌組</div>
            <div className="text-sm text-muted mt-2">請讓爸爸或媽媽在後台管理中指派牌組</div>
          </div>
        ) : (
          decks.map((deck, i) => {
            const pct = deck.total > 0 ? Math.round((deck.studied / deck.total) * 100) : 0;
            return (
              <button
                key={deck.id}
                className="animate-slide-up"
                style={{
                  animationDelay: `${i * 60}ms`,
                  width: "100%",
                  display: "block",
                  background: "var(--surface)",
                  borderRadius: "var(--r-lg)",
                  boxShadow: "var(--shadow-sm)",
                  padding: "16px 20px",
                  marginBottom: "12px",
                  cursor: "pointer",
                  border: "1px solid var(--border)",
                  textAlign: "left",
                  transition: "all 200ms ease",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-md)"; (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-sm)"; (e.currentTarget as HTMLElement).style.transform = ""; }}
                onClick={() => router.push(`/${userId}/study?deck=${deck.id}`)}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "1rem" }}>{deck.name}</div>
                    <div className="text-sm text-muted mt-1">共 {deck.total} 張 · {deck.hasSession ? `繼續第 ${deck.studied + 1} 張` : "從頭開始"}</div>
                  </div>
                  <span style={{
                    fontSize: "0.75rem", fontWeight: 600, padding: "4px 10px", borderRadius: "var(--r-full)",
                    background: deck.hasSession ? "var(--blue-light)" : "var(--surface-2)",
                    color: deck.hasSession ? "var(--blue)" : "var(--text-muted)",
                  }}>
                    {deck.hasSession ? "繼續" : "開始"}
                  </span>
                </div>
                <div className="progress-bar">
                  <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
                </div>
                <div className="text-xs text-muted" style={{ marginTop: "6px" }}>{pct}% 完成</div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
