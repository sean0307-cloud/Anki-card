"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { getAllStats, getDailyStats, getStreak } from "@/storage/progress";
import { getUserConfig } from "@/storage/users";
import type { DailyStats } from "@/lib/types";

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function getWeekDates(): string[] {
  const dates: string[] = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    dates.push(d.toISOString().split("T")[0]);
  }
  return dates;
}

export default function StatsPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params.user as string;

  const [stats, setStats] = useState<Record<string, DailyStats>>({});
  const [todayStats, setTodayStats] = useState<DailyStats>({ studied: 0, completed: 0, again: 0, hard: 0, good: 0, easy: 0 });
  const user = getUserConfig(userId);

  useEffect(() => {
    setStats(getAllStats(userId));
    setTodayStats(getDailyStats(userId));
  }, [userId]);

  const weekDates = getWeekDates();
  const maxStudied = Math.max(...weekDates.map((d) => stats[d]?.studied ?? 0), 1);
  const allDates = Object.keys(stats).sort().reverse();
  const totalStudied = allDates.reduce((s, d) => s + (stats[d]?.studied ?? 0), 0);
  const streak = getStreak(userId);

  return (
    <div className="page">
      <div className="page-header">
        <button className="btn-icon" onClick={() => router.push(`/${userId}`)}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700 }}>{user?.name ?? ""} 的學習統計</div>
        </div>
      </div>
      <div className="page-content">
        {/* 總覽 */}
        <div className="card animate-fade-in" style={{ marginBottom: "20px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", textAlign: "center" }}>
            <div>
              <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--blue)", lineHeight: 1 }}>{totalStudied}</div>
              <div className="text-xs text-muted mt-1">總學習</div>
            </div>
            <div>
              <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--again)", lineHeight: 1 }}>🔥 {streak}</div>
              <div className="text-xs text-muted mt-1">連續天</div>
            </div>
            <div>
              <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--good)", lineHeight: 1 }}>{todayStats.studied}</div>
              <div className="text-xs text-muted mt-1">今日</div>
            </div>
          </div>
        </div>
        {/* 週視圖 */}
        <div className="card animate-slide-up" style={{ marginBottom: "20px" }}>
          <div style={{ fontWeight: 700, marginBottom: "16px", fontSize: "0.9375rem" }}>📈 本週學習</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: "6px", height: "80px" }}>
            {weekDates.map((d) => {
              const s = stats[d]?.studied ?? 0;
              const h = Math.max((s / maxStudied) * 72, s > 0 ? 8 : 2);
              const isToday = d === new Date().toISOString().split("T")[0];
              return (
                <div key={d} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                  <div style={{ width: "100%", height: `${h}px`, background: isToday ? "var(--blue)" : s > 0 ? "var(--blue-light)" : "var(--surface-3)", borderRadius: "4px 4px 0 0", border: !isToday && s > 0 ? "1px solid var(--blue)" : "none", transition: "height 0.5s ease" }} />
                  <div className="text-xs text-muted" style={{ fontSize: "0.65rem", fontWeight: isToday ? 700 : 400, color: isToday ? "var(--blue)" : undefined }}>{formatDate(d)}</div>
                  {s > 0 && <div style={{ fontSize: "0.6rem", color: "var(--text-muted)" }}>{s}</div>}
                </div>
              );
            })}
          </div>
        </div>
        {/* 今日詳情 */}
        <div className="card animate-slide-up" style={{ marginBottom: "20px" }}>
          <div style={{ fontWeight: 700, marginBottom: "12px", fontSize: "0.9375rem" }}>📊 今日詳情</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            {[
              { label: "學習", value: todayStats.studied, color: "var(--blue)" },
              { label: "完成", value: todayStats.completed, color: "var(--good)" },
              { label: "Again 🔁", value: todayStats.again, color: "var(--again)" },
              { label: "Hard 😓", value: todayStats.hard, color: "var(--hard)" },
              { label: "Good 👍", value: todayStats.good, color: "var(--good)" },
              { label: "Easy ⭐", value: todayStats.easy, color: "var(--blue)" },
            ].map((item) => (
              <div key={item.label} style={{ background: "var(--surface-2)", borderRadius: "var(--r-md)", padding: "12px", textAlign: "center" }}>
                <div style={{ fontSize: "1.5rem", fontWeight: 700, color: item.color }}>{item.value}</div>
                <div className="text-xs text-muted mt-1">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
        {/* 歷史 */}
        <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "12px" }}>歷史記錄</div>
        {allDates.slice(0, 14).map((d) => (
          <div key={d} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid var(--border)" }}>
            <div>
              <div style={{ fontWeight: 500 }}>{d}</div>
              <div className="text-xs text-muted">學習 {stats[d].studied} · 完成 {stats[d].completed}</div>
            </div>
            {stats[d].quiz_score !== undefined && (
              <span className="badge badge-blue">{stats[d].quiz_score}分</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
