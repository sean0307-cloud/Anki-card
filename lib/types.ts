/**
 * types/index.ts（同時作為 lib/types.ts 的主型別檔案）
 * 所有跨模組共用的 TypeScript 型別
 */

// ── 單字卡 ──────────────────────────────────────────

/** 單一單字卡資料結構（對應 Google Sheets Vocabulary 工作表） */
export interface Card {
  word: string;          // 英文單字（主鍵）
  meaning: string;       // 中文翻譯
  partOfSpeech: string;  // 詞性（n., vt., adj., ...）
  example: string;       // 英文例句
  exampleChinese: string; // 中文例句
  synonyms: string;      // 同義字
  root: string;          // 字根字源
  level: string;         // 難度（A1~C2 或 B1/B2）
  deck: string;          // 所屬牌組名稱
}

/** 指派記錄（對應 Google Sheets Assignments 工作表） */
export interface Assignment {
  user: string;    // 用戶名稱（哥哥/弟弟/媽媽/爸爸）
  deck: string;    // 牌組名稱
  enabled: boolean; // 是否啟用
  order: number;   // 排序
}

// ── 用戶 ────────────────────────────────────────────

export type UserRole = "admin" | "learner";
export type CardMode = "en-to-zh" | "zh-to-en";
export type ThemeMode = "light" | "dark" | "system";

export interface UserConfig {
  id: string;
  name: string;
  photoUrl: string;
  role: UserRole;
  assignedDecks: string[];
}

// ── SRS 進度 ─────────────────────────────────────────

/** 每張卡片的 SRS 學習進度 */
export interface CardProgress {
  word: string;
  interval: number;     // 複習間隔（天）
  easeFactor: number;   // 熟悉度係數
  reviews: number;      // 總複習次數
  nextReview: string;   // 下次複習日期（ISO date string, e.g. "2024-01-15"）
  lastAnswer?: "again" | "hard" | "good" | "easy";
}

/** 今日學習 session 狀態（用於中斷後繼續） */
export interface SessionState {
  date: string;          // 今日日期（ISO）
  deckId: string;
  queue: string[];       // 今日待學習的 word 列表（有序）
  currentIndex: number;  // 目前學到第幾張
  todayEasy: string[];   // 今日標記為 Easy 的 words
  mode: CardMode;        // 正面顯示語言
}

/** 每日統計 */
export interface DailyStats {
  studied: number;    // 今日看過幾張
  completed: number;  // 完整完成幾輪
  again: number;      // Again 按了幾次
  hard: number;       // Hard 按了幾次
  good: number;       // Good 按了幾次
  easy: number;       // Easy 按了幾次
  quiz_score?: number; // 當日測驗分數（Sprint 5）
}

// ── 設定 ────────────────────────────────────────────

/** 語音設定 */
export interface SpeechSettings {
  voiceName: string;
  rate: number;
  pitch: number;
  volume: number;
}

/** 全域 App 設定 */
export interface AppSettings {
  sheetId: string;
  theme: ThemeMode;
  speech: SpeechSettings;
  cardMode: CardMode;
  autoPlaySpeech: boolean;  // 翻面時自動播放例句
  gesture: boolean;         // 手勢翻卡（Sprint 3）
  lastSyncDate: string;     // 最後一次同步時間
  appsScriptUrl?: string;   // Google Apps Script Web App URL for writing data
}

// ── 測驗（Sprint 5）────────────────────────────────

export type QuizType = "context-fill" | "en-to-zh" | "zh-to-en";

export interface QuizQuestion {
  type: QuizType;
  wordId: string;
  prompt: string;
  sentence?: string;
  sentenceChinese?: string;
  options: string[];
  answer: string;
}

export interface QuizResult {
  questionIndex: number;
  wordId: string;
  userAnswer: string;
  correct: boolean;
}
