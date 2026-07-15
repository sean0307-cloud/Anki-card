"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { getAllStats, getDailyStats, getStreak } from "@/storage/progress";
import { getUserConfig } from "@/storage/users";
import type { DailyStats } from "@/lib/types";

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
  return `${d.getMonth() + 1}/${d.getDate()} (${weekdays[d.getDay()]})`;
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

const ANSWER_COLORS = {
  again: "var(--again)",
  hard: "var(--hard)",
  good: "var(--good)",
  easy: "var(--blue)",
};

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
  const totalCompleted = allDates.reduce((s, d) => s + (stats[d]?.completed ?? 0), 0);
  const streak = getStreak(userId);
  const today = new Date().toISOString().split("T")[0];

  // 計算本週答題分布
  const weekTotal = weekDates.reduce((s, d) => {
    const st = stats[d] ?? {};
    return s + ((st.again ?? 0) + (st.hard ?? 0) + (st.good ?? 0) + (st.easy ?? 0));
  }, 0);

  const weekAnswers = {
    again: weekDates.reduce((s, d) => s + (stats[d]?.again ?? 0), 0),
    hard: weekDates.reduce((s, d) => s + (stats[d]?.hard ?? 0), 0),
    good: weekDates.reduce((s, d) => s + (stats[d]?.good ?? 0), 0),
    easy: weekDates.reduce((s, d) => s + (stats[d]?.easy ?? 0), 0),
  };

  return (
    <div className="page">
      <div className="page-header">
        <button className="btn-icon" onClick={() => router.push(`/${userId}`)}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700 }}>{user?.name ?? ""} 的學習統計</div>
        </div>
      </div>
      <div className="page-content">

        {/* 總覽 3格 */}
        <div className="card animate-fade-in" style={{ marginBottom: "16px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", textAlign: "center" }}>
            <div>
              <div style={{ fontSize: "2rem", fontWeight: 800, color: "var(--blue)", lineHeight: 1 }}>{totalStudied}</div>
              <div className="text-xs text-muted mt-1">累積學習</div>
            </div>
            <div>
              <div style={{ fontSize: "2rem", fontWeight: 800, lineHeight: 1 }}>
                {streak > 0 ? "🔥" : "—"}
                <span style={{ color: "var(--again)", fontSize: "1.5rem" }}>{streak > 0 ? streak : 0}</span>
              </div>
              <div className="text-xs text-muted mt-1">連續天</div>
            </div>
            <div>
              <div style={{ fontSize: "2rem", fontWeight: 800, color: "var(--good)", lineHeight: 1 }}>{totalCompleted}</div>
              <div className="text-xs text-muted mt-1">完成輪次</div>
            </div>
          </div>
        </div>

        {/* 週學習長條圖 */}
        <div className="card animate-slide-up" style={{ marginBottom: "16px" }}>
          <div style={{ fontWeight: 700, marginBottom: "16px", fontSize: "0.9375rem" }}>📈 本週學習</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: "6px", height: "80px", marginBottom: "8px" }}>
            {weekDates.map((d) => {
              const s = stats[d]?.studied ?? 0;
              const h = Math.max((s / maxStudied) * 72, s > 0 ? 8 : 3);
              const isToday = d === today;
              return (
                <div key={d} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                  {s > 0 && <div style={{ fontSize: "0.55rem", color: "var(--text-muted)", fontWeight: 600 }}>{s}</div>}
                  <div style={{
                    width: "100%", height: `${h}px`,
                    background: isToday ? "var(--blue)" : s > 0 ? "var(--blue-light)" : "var(--surface-3)",
                    borderRadius: "4px 4px 0 0",
                    border: !isToday && s > 0 ? "1px solid var(--blue)" : "none",
                    transition: "height 0.5s ease",
                  }} />
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: "6px" }}>
            {weekDates.map((d) => {
              const isToday = d === today;
              const day = new Date(d + "T00:00:00");
              const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
              return (
                <div key={d} style={{ flex: 1, textAlign: "center" }}>
                  <div className="text-xs text-muted" style={{
                    fontSize: "0.6rem",
                    fontWeight: isToday ? 700 : 400,
                    color: isToday ? "var(--blue)" : undefined,
                  }}>
                    {weekdays[day.getDay()]}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 今日詳情 */}
        <div className="card animate-slide-up" style={{ marginBottom: "16px" }}>
          <div style={{ fontWeight: 700, marginBottom: "12px", fontSize: "0.9375rem" }}>📊 今日詳情</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px", marginBottom: "12px" }}>
            {(["again", "hard", "good", "easy"] as const).map((key) => {
              const emojis = { again: "🔁", hard: "😓", good: "👍", easy: "⭐" };
              const labels = { again: "Again", hard: "Hard", good: "Good", easy: "Easy" };
              return (
                <div key={key} style={{ background: "var(--surface-2)", borderRadius: "var(--r-md)", padding: "10px 6px", textAlign: "center" }}>
                  <div style={{ fontSize: "1.125rem" }}>{emojis[key]}</div>
                  <div style={{ fontSize: "1.25rem", fontWeight: 700, color: ANSWER_COLORS[key], lineHeight: 1.2 }}>
                    {todayStats[key]}
                  </div>
                  <div className="text-xs text-muted">{labels[key]}</div>
                </div>
              );
            })}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
            <div style={{ background: "var(--surface-2)", borderRadius: "var(--r-md)", padding: "12px", textAlign: "center" }}>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--blue)" }}>{todayStats.studied}</div>
              <div className="text-xs text-muted mt-1">今日學習</div>
            </div>
            <div style={{ background: "var(--surface-2)", borderRadius: "var(--r-md)", padding: "12px", textAlign: "center" }}>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--good)" }}>{todayStats.completed}</div>
              <div className="text-xs text-muted mt-1">完成輪次</div>
            </div>
          </div>
        </div>

        {/* 本週答題分布（圓形進度條替代） */}
        {weekTotal > 0 && (
          <div className="card animate-slide-up" style={{ marginBottom: "16px" }}>
            <div style={{ fontWeight: 700, marginBottom: "12px", fontSize: "0.9375rem" }}>🎯 本週答題分布</div>
            {(["good", "easy", "hard", "again"] as const).map((key) => {
              const labels = { again: "Again 再看", hard: "Hard 困難", good: "Good 熟悉", easy: "Easy 很熟" };
              const val = weekAnswers[key];
              const pct = weekTotal > 0 ? Math.round((val / weekTotal) * 100) : 0;
              return (
                <div key={key} style={{ marginBottom: "10px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                    <span className="text-sm" style={{ color: ANSWER_COLORS[key], fontWeight: 600 }}>{labels[key]}</span>
                    <span className="text-xs text-muted">{val} 次 ({pct}%)</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-bar-fill" style={{ width: `${pct}%`, background: ANSWER_COLORS[key], transition: "width 0.6s ease" }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 歷史記錄 */}
        {allDates.length > 0 && (
          <>
            <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "12px" }}>
              歷史記錄
            </div>
            {allDates.slice(0, 14).map((d) => {
              const st = stats[d];
              const total = (st.again ?? 0) + (st.hard ?? 0) + (st.good ?? 0) + (st.easy ?? 0);
              const goodPct = total > 0 ? Math.round(((st.good ?? 0) + (st.easy ?? 0)) / total * 100) : 0;
              return (
                <div key={d} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid var(--border)" }}>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: "0.9375rem" }}>{formatDate(d)}</div>
                    <div className="text-xs text-muted" style={{ marginTop: "2px" }}>
                      學習 {st.studied} · 完成 {st.completed}
                      {total > 0 && ` · 熟悉率 ${goodPct}%`}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                    {st.quiz_score !== undefined && (
                      <span className="badge badge-blue">{st.quiz_score}分</span>
                    )}
                    {total > 0 && (
                      <div style={{
                        width: "40px", height: "40px", borderRadius: "var(--r-full)",
                        background: goodPct >= 70 ? "var(--good-light)" : goodPct >= 40 ? "var(--hard-light)" : "var(--again-light)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "0.75rem", fontWeight: 700,
                        color: goodPct >= 70 ? "var(--good)" : goodPct >= 40 ? "var(--hard)" : "var(--again)",
                      }}>
                        {goodPct}%
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </>
        )}

        {allDates.length === 0 && (
          <div className="card" style={{ textAlign: "center", padding: "40px 24px" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "12px" }}>📊</div>
            <div style={{ fontWeight: 600 }}>尚無學習記錄</div>
            <div className="text-sm text-muted mt-2">開始學習後就會在這裡看到統計！</div>
          </div>
        )}
      </div>
    </div>
  );
}
