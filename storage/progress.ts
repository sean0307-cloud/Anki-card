/**
 * storage/progress.ts
 * 每日學習統計的讀寫（LocalStorage）
 * 職責：今日學了幾張、連續幾天、Again/Hard/Good/Easy 各幾次
 */

import { STORAGE_KEYS } from "@/lib/constants";
import type { DailyStats } from "@/lib/types";

function todayKey(): string {
  return new Date().toISOString().split("T")[0];
}

const EMPTY_STATS: DailyStats = { studied: 0, completed: 0, again: 0, hard: 0, good: 0, easy: 0 };

/** 取得某天的統計 */
export function getDailyStats(userId: string, date?: string): DailyStats {
  if (typeof window === "undefined") return { ...EMPTY_STATS };
  const key = STORAGE_KEYS.DAILY_STATS(userId, date ?? todayKey());
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...EMPTY_STATS, ...JSON.parse(raw) } : { ...EMPTY_STATS };
  } catch {
    return { ...EMPTY_STATS };
  }
}

/** 遞增統計中的某個計數器 */
export function incrementStat(
  userId: string,
  field: keyof Omit<DailyStats, "quiz_score">
): void {
  if (typeof window === "undefined") return;
  const key = STORAGE_KEYS.DAILY_STATS(userId, todayKey());
  const stats = getDailyStats(userId);
  stats[field] = (stats[field] as number) + 1;
  localStorage.setItem(key, JSON.stringify(stats));
}

/** 儲存測驗分數 */
export function saveQuizScore(userId: string, score: number): void {
  if (typeof window === "undefined") return;
  const key = STORAGE_KEYS.DAILY_STATS(userId, todayKey());
  const stats = getDailyStats(userId);
  stats.quiz_score = score;
  localStorage.setItem(key, JSON.stringify(stats));
}

/** 取得所有歷史統計（用於統計儀錶板） */
export function getAllStats(userId: string): Record<string, DailyStats> {
  if (typeof window === "undefined") return {};
  const prefix = `anki_${userId}_stats_`;
  const result: Record<string, DailyStats> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(prefix)) {
      const date = key.replace(prefix, "");
      try {
        const raw = localStorage.getItem(key);
        if (raw) result[date] = { ...EMPTY_STATS, ...JSON.parse(raw) };
      } catch { /* skip */ }
    }
  }
  return result;
}

/** 計算連續學習天數 */
export function getStreak(userId: string): number {
  const stats = getAllStats(userId);
  const dates = Object.keys(stats).sort().reverse();
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < dates.length; i++) {
    const d = new Date(dates[i]);
    const diffDays = Math.floor((today.getTime() - d.getTime()) / 86400000);
    if ((diffDays === i || diffDays === i + 1) && (stats[dates[i]].studied > 0)) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

/** 取得特定牌組的學習完成次數 */
export function getDeckCompletedCount(userId: string, deckId: string): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DECK_COMPLETED(userId, deckId));
    return raw ? parseInt(raw, 10) : 0;
  } catch {
    return 0;
  }
}

/** 增加特定牌組的學習完成次數 */
export function incrementDeckCompletedCount(userId: string, deckId: string): void {
  if (typeof window === "undefined") return;
  try {
    const current = getDeckCompletedCount(userId, deckId);
    localStorage.setItem(STORAGE_KEYS.DECK_COMPLETED(userId, deckId), (current + 1).toString());
  } catch { /* ignore */ }
}
