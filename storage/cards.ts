/**
 * storage/cards.ts
 * 卡片學習進度的讀寫（LocalStorage）
 * 職責：每張卡片的複習次數、下次複習時間、熟悉度
 */

import { STORAGE_KEYS } from "@/lib/constants";
import type { CardProgress } from "@/lib/types";

/** 取得單一用戶的所有卡片進度 */
export function getCardProgress(userId: string): Record<string, CardProgress> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CARD_PROGRESS(userId));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/** 更新單張卡片的進度 */
export function updateCardProgress(
  userId: string,
  word: string,
  patch: Partial<CardProgress>
): void {
  if (typeof window === "undefined") return;
  const all = getCardProgress(userId);
  all[word] = { ...(all[word] ?? { word, interval: 1, easeFactor: 2.5, reviews: 0, nextReview: "" }), ...patch };
  localStorage.setItem(STORAGE_KEYS.CARD_PROGRESS(userId), JSON.stringify(all));
}

/** 清除單一用戶的所有卡片進度（重置學習） */
export function clearCardProgress(userId: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEYS.CARD_PROGRESS(userId));
}

/** 取得今日學習 session 狀態 */
export function getSession(userId: string, deckId: string): import("@/lib/types").SessionState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SESSION(userId, deckId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** 儲存今日學習 session */
export function saveSession(userId: string, session: import("@/lib/types").SessionState): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEYS.SESSION(userId, session.deckId), JSON.stringify(session));
}

/** 清除 session（學習完成後） */
export function clearSession(userId: string, deckId: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEYS.SESSION(userId, deckId));
}
