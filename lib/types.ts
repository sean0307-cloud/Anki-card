// ============================================================
// 全域 TypeScript 型別定義
// ============================================================

export type UserId = "brother1" | "brother2" | "mom" | "dad";
export type UserRole = "admin" | "learner";
export type ReviewAnswer = "again" | "hard" | "good" | "easy";
export type CardMode = "en-to-zh" | "zh-to-en";
export type QuizType = "context-fill" | "en-to-zh" | "zh-to-en";

// ── 單字卡片 ──────────────────────────────────────────────
export interface Card {
  word: string;          // 英文單字（作為唯一 ID）
  meaning: string;       // 中文翻譯
  partOfSpeech: string;  // 詞性
  example: string;       // 英文例句
  exampleChinese: string;// 例句中文翻譯
  synonyms: string;      // 同義字（逗號分隔）
  root: string;          // 字根分析
  level: string;         // 難度（A1/A2/B1/B2/C1）
  deck: string;          // 所屬牌組
}

// ── 用戶設定 ──────────────────────────────────────────────
export interface UserConfig {
  id: UserId;
  name: string;          // 哥哥 / 弟弟 / 媽媽 / 爸爸
  role: UserRole;
  photoUrl: string;      // Google Drive 公開連結 或 /avatars/xxx.jpg
  assignedDecks: string[];
  pinHash?: string;      // 父母後台 PIN（僅 admin）
}

// ── 卡片學習進度 ──────────────────────────────────────────
export interface CardProgress {
  word_id: string;
  next_review: string;   // "2026-07-15"（隔天 Easy 卡恢復）
  last_review: string;   // "2026-07-14"
  again_count: number;
  hard_count: number;
  good_count: number;
  easy_count: number;
  completed: boolean;
}

// ── 每日統計 ──────────────────────────────────────────────
export interface DailyStats {
  studied: number;
  completed: number;
  again: number;
  hard: number;
  good: number;
  easy: number;
  quiz_score?: number;   // 測驗成績（0-100）
}

export type UserStatistics = {
  [date: string]: DailyStats; // key: "2026-07-14"
};

// ── 學習 Session（中斷恢復用）────────────────────────────
export interface SessionState {
  date: string;          // "2026-07-14"
  deckId: string;
  queue: string[];       // word_id 排列順序（含 Again/Hard 插入位置）
  currentIndex: number;  // 中斷點（關閉前讀到哪張）
  todayEasy: string[];   // 今日 Easy 卡片（不再出現）
  mode: CardMode;        // 當前學習方向
}

// ── 語音設定 ──────────────────────────────────────────────
export interface SpeechSettings {
  voiceName: string;
  rate: number;          // 0.5 - 2.0
  pitch: number;         // 0.5 - 2.0
  volume: number;        // 0.0 - 1.0
}

// ── 測驗題目 ──────────────────────────────────────────────
export interface QuizQuestion {
  type: QuizType;
  wordId: string;
  sentence?: string;          // 含空格的英文句子（context-fill 用）
  sentenceChinese?: string;   // 句子中文翻譯
  prompt: string;             // 題目提示文字
  answer: string;             // 正確答案
  options: string[];          // 四個選項（已 shuffle）
}

export interface QuizResult {
  questionIndex: number;
  wordId: string;
  userAnswer: string;
  correct: boolean;
  timeTaken?: number;
}

// ── Assignments（Google Sheets 格式）─────────────────────
export interface Assignment {
  user: string;
  deck: string;
  enabled: boolean;
  order: number;
}
