/**
 * SRS (Spaced Repetition System) 常數
 * 修改評分間隔只需要改這裡，不需要到處找程式碼
 */

export const SRS = {
  /** Again：3 分鐘後再看（同一天重複出現） */
  AGAIN_MINUTES: 3,
  /** Hard：7 天後再看 */
  HARD_DAYS: 7,
  /** Good：下次啟動學習時再排入 */
  GOOD_DAYS: 1,
  /** Easy：從今日佇列移除，明天以後再說 */
  EASY_REMOVE_TODAY: true,
} as const;

/**
 * 每日新卡片上限（超過不排入今日佇列）
 */
export const DAILY_NEW_CARD_LIMIT = 30;

/**
 * 每日複習卡片上限
 */
export const DAILY_REVIEW_CARD_LIMIT = 100;

/**
 * 四位家庭成員 ID（固定，不允許動態新增）
 */
export const USER_IDS = ["brother1", "brother2", "mom", "dad"] as const;
export type UserId = typeof USER_IDS[number];

/**
 * 預設使用者名稱
 */
export const DEFAULT_USER_NAMES: Record<UserId, string> = {
  brother1: "哥哥",
  brother2: "弟弟",
  mom: "媽媽",
  dad: "爸爸",
};

/**
 * 管理者 ID（可使用後台管理）
 */
export const ADMIN_USER_IDS: UserId[] = ["mom", "dad"];

/**
 * LocalStorage key 前綴
 */
export const STORAGE_KEYS = {
  CARD_PROGRESS: (userId: string) => `anki_${userId}_card_progress`,
  DAILY_STATS: (userId: string, date: string) => `anki_${userId}_stats_${date}`,
  SESSION: (userId: string, deckId: string) => `anki_${userId}_session_${deckId}`,
  USER_CONFIG: (userId: string) => `anki_user_config_${userId}`,
  SETTINGS: "anki_settings",
  SHEET_ID: "anki_sheet_id",
  CARD_CACHE: "anki_card_cache",
  CARD_CACHE_DATE: "anki_card_cache_date",
  PIN: (userId: string) => `anki_pin_${userId}`,
} as const;

/**
 * 教材快取有效時間（小時）
 * 預設：快取 6 小時，之後重新 fetch
 */
export const CACHE_HOURS = 6;

/**
 * 測驗相關（Sprint 5）
 */
export const QUIZ = {
  /** 每次測驗最多幾題 */
  MAX_QUESTIONS: 20,
  /** 最少需要幾個選項才能出選擇題 */
  MIN_OPTIONS: 4,
  /** 通過分數 */
  PASS_SCORE: 60,
} as const;
