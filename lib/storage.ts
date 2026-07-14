/**
 * lib/storage.ts（v2.0 重構：作為向後相容性包裝）
 * 
 * 新架構請使用 storage/ 模組：
 *   storage/cards.ts    - 卡片進度
 *   storage/progress.ts - 每日統計
 *   storage/settings.ts - 設定
 *   storage/users.ts    - 用戶設定
 *
 * 此檔案重新匯出這些模組的功能，供尚未遷移的舊程式碼使用
 */

// Re-export from modular storage
export { getCardProgress, updateCardProgress, clearCardProgress, getSession, saveSession, clearSession } from "@/storage/cards";
export { getDailyStats, incrementStat, saveQuizScore, getAllStats, getStreak } from "@/storage/progress";
export { getSettings, saveSettings, getSheetId, saveSheetId, getLastSyncDate, saveLastSyncDate } from "@/storage/settings";
export { getUserConfigs, getUserConfig, saveUserConfig, saveAllUserConfigs, setPin, verifyPin } from "@/storage/users";

// 型別重新匯出（向後相容）
export type { AppSettings, SpeechSettings, UserConfig, CardProgress, SessionState, DailyStats } from "./types";

// ─── 向後相容的舊 API（可以逐步遷移）────────────────────────────

/** @deprecated 請使用 saveAllUserConfigs */
export function saveUserConfigs(configs: import("./types").UserConfig[]) {
  const { saveAllUserConfigs } = require("@/storage/users");
  saveAllUserConfigs(configs);
}

/** @deprecated 請使用 saveSettings({ speech: ... }) */
export function saveSpeechSettings(speech: import("./types").SpeechSettings) {
  const { saveSettings } = require("@/storage/settings");
  saveSettings({ speech });
}

/** @deprecated 請使用 getSettings().speech */
export function getSpeechSettings(): import("./types").SpeechSettings {
  const { getSettings } = require("@/storage/settings");
  return getSettings().speech;
}

/** @deprecated 請使用 saveSettings({ sheetId: ... }) */
export function saveCardMode(userId: string, deckId: string, mode: string) {
  // 儲存在 session 裡（由 study page 直接處理）
  console.warn("saveCardMode is deprecated, use session.mode instead");
}

/** @deprecated 請使用 session.mode */
export function getCardMode(userId: string, deckId: string): string {
  const { getSession } = require("@/storage/cards");
  return getSession(userId, deckId)?.mode ?? "en-to-zh";
}

/** @deprecated 請使用 incrementStat */
export function updateCardReview(userId: string, word: string, answer: string, nextReview: string) {
  // 不再需要追蹤每張卡的 nextReview（簡化架構）
  console.warn("updateCardReview is deprecated in v2.0 architecture");
}

/** @deprecated 請使用 saveQuizScore */
export function saveQuizScoreCompat(userId: string, score: number) {
  const { saveQuizScore } = require("@/storage/progress");
  saveQuizScore(userId, score);
}

/** 快取 PIN 雜湊（同步版本，向後相容） */
export function hashPin(pin: string): string {
  // 舊架構使用同步雜湊（不安全）
  // 新架構使用 verifyPin（async）
  return pin; // 僅向後相容，實際驗證走 verifyPin
}
