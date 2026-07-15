"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUserConfigs } from "@/storage/users";
import { getStreak, getDailyStats } from "@/storage/progress";
import { getSettings, saveSettings } from "@/storage/settings";
import { useCardStoreStatus } from "@/hooks/useCards";
import { syncCardStore } from "@/lib/cardStore";
import { saveLastSyncDate } from "@/storage/settings";
import type { UserConfig } from "@/lib/types";

const EMOJIS: Record<string, string> = {
  brother1: "👦",
  brother2: "👦",
  mom: "👩",
  dad: "👨",
};

function formatSyncDate(iso: string): string {
  if (!iso) return "尚未同步";
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

export default function HomePage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserConfig[]>([]);
  const [todayStudied, setTodayStudied] = useState<Record<string, number>>({});
  const [streaks, setStreaks] = useState<Record<string, number>>({});
  const [syncing, setSyncing] = useState(false);

  // 主題狀態 (light, dark, system)
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");

  const { isLoading, isLoaded, error, lastFetchDate, cardCount } = useCardStoreStatus();

  useEffect(() => {
    const configs = getUserConfigs();
    setUsers(configs);
    const studied: Record<string, number> = {};
    const streak: Record<string, number> = {};
    configs.forEach((u) => {
      studied[u.id] = getDailyStats(u.id).studied;
      streak[u.id] = getStreak(u.id);
    });
    setTodayStudied(studied);
    setStreaks(streak);

    // 載入當前設定的主題
    const currentTheme = getSettings().theme ?? "system";
    setTheme(currentTheme);
    applyTheme(currentTheme);
  }, []);

  const applyTheme = (t: "light" | "dark" | "system") => {
    const root = document.documentElement;
    if (t === "dark") {
      root.classList.add("dark");
      root.classList.remove("light");
    } else if (t === "light") {
      root.classList.add("light");
      root.classList.remove("dark");
    } else {
      root.classList.remove("dark");
      root.classList.remove("light");
    }
  };

  const handleThemeChange = (newTheme: "light" | "dark" | "system") => {
    setTheme(newTheme);
    saveSettings({ theme: newTheme });
    applyTheme(newTheme);
  };

  const handleSync = async () => {
    const settings = getSettings();
    if (!settings.sheetId) {
      alert("請先在後台管理中設定 Google Sheets ID");
      return;
    }
    setSyncing(true);
    try {
      await syncCardStore(settings.sheetId);
      saveLastSyncDate(new Date().toISOString());
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="page" style={{ background: "var(--bg)" }}>
      {/* 頂部 Header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "56px 20px 8px",
        maxWidth: "480px",
        margin: "0 auto",
        width: "100%",
      }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 800, letterSpacing: "-0.04em", color: "var(--text)" }}>
            家庭單字卡
          </h1>
          <div className="text-xs text-muted mt-1">
            {isLoading || syncing ? (
              <span style={{ color: "var(--blue)" }}>⏳ 同步中...</span>
            ) : error ? (
              <span style={{ color: "var(--again)" }}>⚠️ 載入失敗</span>
            ) : isLoaded ? (
              <span>📚 {cardCount} 張單字卡 · {formatSyncDate(lastFetchDate)}</span>
            ) : (
              <span>等待同步...</span>
            )}
          </div>
        </div>

        {/* 同步教材按鈕 */}
        <button
          onClick={handleSync}
          disabled={isLoading || syncing}
          className="btn btn-secondary"
          style={{
            padding: "8px 16px",
            fontSize: "0.8125rem",
            fontWeight: 600,
            borderRadius: "var(--r-full)",
            opacity: isLoading || syncing ? 0.6 : 1,
            transition: "all 200ms ease",
          }}
          aria-label="同步教材"
          title="重新從 Google Sheets 下載最新教材"
        >
          {isLoading || syncing ? "⏳ 同步中" : "↻ 同步教材"}
        </button>
      </div>

      {/* 用戶 2×2 卡片 */}
      <div className="user-grid" style={{ maxWidth: "480px", margin: "16px auto 0", width: "100%" }}>
        {users.map((user, idx) => {
          const streak = streaks[user.id] ?? 0;
          const studied = todayStudied[user.id] ?? 0;
          return (
            <button
              key={user.id}
              className="user-card animate-fade-in"
              style={{ animationDelay: `${idx * 80}ms` }}
              onClick={() => router.push(`/${user.id}`)}
              aria-label={`進入 ${user.name} 的學習`}
            >
              {user.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.photoUrl} alt={user.name} className="user-card-photo" />
              ) : (
                <div className="user-card-placeholder">{EMOJIS[user.id] || "👤"}</div>
              )}
              <div className="user-card-overlay" />
              <div className="user-card-info">
                <div className="user-card-name">{user.name}</div>
                <div className="user-card-streak">
                  {streak > 0
                    ? `🔥 ${streak} 天`
                    : studied > 0
                    ? `📖 ${studied} 張`
                    : "開始學習"}
                  {user.role === "admin" && " ⚙️"}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* 底部 主題切換與管理入口 */}
      <div style={{
        textAlign: "center",
        padding: "20px 24px 40px",
        maxWidth: "480px",
        margin: "0 auto",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "16px"
      }}>
        {/* Apple 風格極簡主題切換器 */}
        <div style={{
          display: "inline-flex",
          background: "var(--surface-2)",
          padding: "4px",
          borderRadius: "var(--r-full)",
          border: "1px solid var(--border)",
        }}>
          {([
            ["light", "☀️ 亮色"],
            ["dark", "🌙 暗色"],
            ["system", "💻 系統"],
          ] as const).map(([t, label]) => (
            <button
              key={t}
              onClick={() => handleThemeChange(t)}
              style={{
                padding: "6px 12px",
                fontSize: "0.75rem",
                fontWeight: 600,
                borderRadius: "var(--r-full)",
                background: theme === t ? "var(--surface)" : "transparent",
                color: theme === t ? "var(--text)" : "var(--text-muted)",
                boxShadow: theme === t ? "var(--shadow-sm)" : "none",
                transition: "all 150ms ease",
                cursor: "pointer",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <button
          className="btn btn-ghost text-sm"
          style={{ color: "var(--text-muted)" }}
          onClick={() => router.push("/admin")}
        >
          ⚙️ 後台管理
        </button>
      </div>
    </div>
  );
}
