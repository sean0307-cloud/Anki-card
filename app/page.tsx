"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UserConfig } from "@/lib/types";
import { getUserConfigs, getDailyStats, getAllStats } from "@/lib/storage";

const EMOJIS: Record<string, string> = {
  brother1: "👦",
  brother2: "👦",
  mom: "👩",
  dad: "👨",
};

function getStreak(userId: string): number {
  const stats = getAllStats(userId);
  const dates = Object.keys(stats).sort().reverse();
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < dates.length; i++) {
    const d = new Date(dates[i]);
    const diffDays = Math.floor((today.getTime() - d.getTime()) / 86400000);
    if (diffDays === i || diffDays === i + 1) {
      if (stats[dates[i]].studied > 0) streak++;
      else break;
    } else break;
  }
  return streak;
}

export default function HomePage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserConfig[]>([]);
  const [todayStats, setTodayStats] = useState<Record<string, { studied: number }>>({});

  useEffect(() => {
    const configs = getUserConfigs();
    setUsers(configs);
    const stats: Record<string, { studied: number }> = {};
    configs.forEach((u) => {
      stats[u.id] = getDailyStats(u.id);
    });
    setTodayStats(stats);
  }, []);

  return (
    <div className="page" style={{ background: "var(--bg)" }}>
      {/* 頂部標題 */}
      <div style={{ textAlign: "center", padding: "48px 24px 24px" }}>
        <div style={{ fontSize: "2.5rem", marginBottom: "8px" }}>📚</div>
        <h1 style={{
          fontSize: "1.75rem",
          fontWeight: 700,
          letterSpacing: "-0.04em",
          color: "var(--text)",
          lineHeight: 1.2,
        }}>
          家庭單字卡
        </h1>
        <p style={{ color: "var(--text-muted)", marginTop: "6px", fontSize: "0.9375rem" }}>
          Family Flashcard System
        </p>
      </div>

      {/* 用戶卡片 2×2 */}
      <div className="user-grid" style={{ maxWidth: "480px", margin: "0 auto", width: "100%" }}>
        {users.map((user, idx) => {
          const streak = getStreak(user.id);
          const studied = todayStats[user.id]?.studied ?? 0;
          return (
            <button
              key={user.id}
              className="user-card animate-fade-in"
              style={{ animationDelay: `${idx * 80}ms` }}
              onClick={() => router.push(`/${user.id}`)}
              aria-label={`進入 ${user.name} 的學習頁面`}
            >
              {user.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.photoUrl}
                  alt={user.name}
                  className="user-card-photo"
                />
              ) : (
                <div className="user-card-placeholder">
                  {EMOJIS[user.id] || "👤"}
                </div>
              )}
              <div className="user-card-overlay" />
              <div className="user-card-info">
                <div className="user-card-name">{user.name}</div>
                <div className="user-card-streak">
                  {streak > 0 ? `🔥 ${streak} 天連續` : studied > 0 ? `📖 今日 ${studied} 張` : "開始學習"}
                  {user.role === "admin" && " ⚙️"}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* 底部按鈕 */}
      <div style={{ textAlign: "center", padding: "12px 24px 40px" }}>
        <button
          className="btn btn-ghost text-sm"
          onClick={() => router.push("/admin")}
          style={{ color: "var(--text-muted)" }}
        >
          ⚙️ 後台管理
        </button>
      </div>
    </div>
  );
}
