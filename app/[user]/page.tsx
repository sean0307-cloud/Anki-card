"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { Card } from "@/lib/types";
import {
  getUserConfig,
  getSession,
  saveSession,
  getDailyStats,
  getSheetId,
  getCardMode,
} from "@/lib/storage";
import { fetchVocabulary, fetchAssignments } from "@/lib/sheets";
import { buildDailyQueue, getTodayDate } from "@/lib/scheduler";

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

  const [user, setUser] = useState(getUserConfig(userId));
  const [decks, setDecks] = useState<DeckInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [todayStats, setTodayStats] = useState({ studied: 0, completed: 0 });

  const loadDecks = useCallback(async () => {
    setLoading(true);
    const sheetId = getSheetId();
    let allCards: Card[] = [];

    if (sheetId) {
      allCards = await fetchVocabulary(sheetId);
      const assignments = await fetchAssignments(sheetId);
      const myAssignments = assignments
        .filter((a) => a.user === user?.name && a.enabled)
        .sort((a, b) => a.order - b.order);

      const deckMap: Record<string, Card[]> = {};
      allCards.forEach((c) => {
        if (!deckMap[c.deck]) deckMap[c.deck] = [];
        deckMap[c.deck].push(c);
      });

      const today = getTodayDate();
      const deckInfos: DeckInfo[] = myAssignments
        .filter((a) => deckMap[a.deck])
        .map((a) => {
          const session = getSession(userId, a.deck);
          const hasSession = !!(session && session.date === today && session.currentIndex > 0);
          return {
            id: a.deck,
            name: a.deck,
            total: deckMap[a.deck]?.length ?? 0,
            studied: hasSession ? session!.currentIndex : 0,
            hasSession,
          };
        });

      setDecks(deckInfos);
    } else {
      // 沒有設定 Sheet ID，顯示示範牌組
      setDecks([{ id: "demo", name: "示範牌組", total: 10, studied: 0, hasSession: false }]);
    }

    setTodayStats(getDailyStats(userId));
    setLoading(false);
  }, [userId, user?.name]);

  useEffect(() => {
    const cfg = getUserConfig(userId);
    if (!cfg) {
      router.replace("/");
      return;
    }
    setUser(cfg);
  }, [userId, router]);

  useEffect(() => {
    loadDecks();
  }, [loadDecks]);

  if (!user) return null;

  return (
    <div className="page">
      {/* 頂部導航 */}
      <div className="page-header">
        <button className="btn-icon" onClick={() => router.push("/")} aria-label="返回首頁">
          ←
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: "1.0625rem" }}>{user.name}</div>
          <div className="text-xs text-muted">選擇要學習的牌組</div>
        </div>
        <button
          className="btn-icon"
          onClick={() => router.push(`/${userId}/stats`)}
          aria-label="查看統計"
        >
          📊
        </button>
      </div>

      <div className="page-content">
        {/* 今日統計卡片 */}
        <div className="card animate-fade-in" style={{ marginBottom: "20px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "2rem", fontWeight: 700, color: "var(--blue)", lineHeight: 1 }}>
                {todayStats.studied}
              </div>
              <div className="text-xs text-muted mt-1">今日學習</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "2rem", fontWeight: 700, color: "var(--good)", lineHeight: 1 }}>
                {todayStats.completed}
              </div>
              <div className="text-xs text-muted mt-1">已完成</div>
            </div>
          </div>
        </div>

        {/* 牌組列表 */}
        <div style={{ marginBottom: "12px", color: "var(--text-muted)", fontSize: "0.8125rem", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>
          我的牌組
        </div>

        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: "80px", marginBottom: "12px", borderRadius: "var(--r-lg)" }} />
          ))
        ) : decks.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: "48px 24px" }}>
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
                  transition: "all 200ms ease",
                  border: "1px solid var(--border)",
                  textAlign: "left",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-md)";
                  (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-sm)";
                  (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
                }}
                onClick={() => router.push(`/${userId}/study?deck=${deck.id}`)}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "1rem" }}>{deck.name}</div>
                    <div className="text-sm text-muted mt-1">
                      共 {deck.total} 張 · {deck.hasSession ? `繼續第 ${deck.studied + 1} 張` : "從頭開始"}
                    </div>
                  </div>
                  <span style={{
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    padding: "4px 10px",
                    borderRadius: "var(--r-full)",
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
