// ============================================================
// LocalStorage 資料存取層
// key 命名：user_{userId}_{dataType}_{optional_deckId}
// ============================================================
import {
  CardProgress,
  UserStatistics,
  DailyStats,
  SessionState,
  SpeechSettings,
  UserConfig,
  CardMode,
} from "./types";
import { getTodayDate } from "./scheduler";

const PREFIX = "anki_";

function key(...parts: string[]): string {
  return PREFIX + parts.join("_");
}

function save<T>(k: string, data: T): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(k, JSON.stringify(data));
  } catch (e) {
    console.error("localStorage save error:", e);
  }
}

function load<T>(k: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(k);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

// ── 卡片進度 ──────────────────────────────────────────────
export function getCardProgress(userId: string, wordId: string): CardProgress | null {
  const all = getAllCardProgress(userId);
  return all[wordId] ?? null;
}

export function getAllCardProgress(userId: string): Record<string, CardProgress> {
  return load<Record<string, CardProgress>>(key(userId, "progress")) ?? {};
}

export function saveCardProgress(userId: string, progress: CardProgress): void {
  const all = getAllCardProgress(userId);
  all[progress.word_id] = progress;
  save(key(userId, "progress"), all);
}

export function updateCardReview(
  userId: string,
  wordId: string,
  answer: "again" | "hard" | "good" | "easy",
  nextReview: string
): void {
  const existing = getCardProgress(userId, wordId);
  const today = getTodayDate();
  const updated: CardProgress = existing ?? {
    word_id: wordId,
    next_review: nextReview,
    last_review: today,
    again_count: 0,
    hard_count: 0,
    good_count: 0,
    easy_count: 0,
    completed: false,
  };
  updated.last_review = today;
  updated.next_review = nextReview;
  updated[`${answer}_count`]++;
  saveCardProgress(userId, updated);
}

// ── 每日統計 ──────────────────────────────────────────────
export function getDailyStats(userId: string, date?: string): DailyStats {
  const d = date ?? getTodayDate();
  const all = load<UserStatistics>(key(userId, "stats")) ?? {};
  return all[d] ?? { studied: 0, completed: 0, again: 0, hard: 0, good: 0, easy: 0 };
}

export function getAllStats(userId: string): UserStatistics {
  return load<UserStatistics>(key(userId, "stats")) ?? {};
}

export function incrementStat(
  userId: string,
  field: keyof DailyStats,
  value = 1
): void {
  const d = getTodayDate();
  const all = load<UserStatistics>(key(userId, "stats")) ?? {};
  if (!all[d]) {
    all[d] = { studied: 0, completed: 0, again: 0, hard: 0, good: 0, easy: 0 };
  }
  (all[d][field] as number) += value;
  save(key(userId, "stats"), all);
}

export function saveQuizScore(userId: string, score: number): void {
  const d = getTodayDate();
  const all = load<UserStatistics>(key(userId, "stats")) ?? {};
  if (!all[d]) {
    all[d] = { studied: 0, completed: 0, again: 0, hard: 0, good: 0, easy: 0 };
  }
  all[d].quiz_score = score;
  save(key(userId, "stats"), all);
}

// ── 學習 Session（中斷恢復）─────────────────────────────
export function getSession(userId: string, deckId: string): SessionState | null {
  return load<SessionState>(key(userId, "session", deckId));
}

export function saveSession(userId: string, session: SessionState): void {
  save(key(userId, "session", session.deckId), session);
}

export function clearSession(userId: string, deckId: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(key(userId, "session", deckId));
}

// ── 語音設定 ──────────────────────────────────────────────
const DEFAULT_SPEECH: SpeechSettings = {
  voiceName: "",
  rate: 1.0,
  pitch: 1.0,
  volume: 1.0,
};

export function getSpeechSettings(): SpeechSettings {
  return load<SpeechSettings>(key("speech")) ?? DEFAULT_SPEECH;
}

export function saveSpeechSettings(settings: SpeechSettings): void {
  save(key("speech"), settings);
}

// ── 用戶設定（LocalStorage fallback — 初始預設值）────────
const DEFAULT_USERS: UserConfig[] = [
  { id: "brother1", name: "哥哥", role: "learner", photoUrl: "", assignedDecks: [] },
  { id: "brother2", name: "弟弟", role: "learner", photoUrl: "", assignedDecks: [] },
  { id: "mom", name: "媽媽", role: "admin", photoUrl: "", assignedDecks: [], pinHash: "" },
  { id: "dad", name: "爸爸", role: "admin", photoUrl: "", assignedDecks: [], pinHash: "" },
];

export function getUserConfigs(): UserConfig[] {
  return load<UserConfig[]>(key("users")) ?? DEFAULT_USERS;
}

export function saveUserConfigs(configs: UserConfig[]): void {
  save(key("users"), configs);
}

export function getUserConfig(userId: string): UserConfig | undefined {
  return getUserConfigs().find((u) => u.id === userId);
}

// ── PIN 碼（簡單 hash）────────────────────────────────────
export function hashPin(pin: string): string {
  // 簡單的雙重 SHA-like 雜湊（純前端，非加密用途）
  let hash = 0;
  const str = `anki_${pin}_salt_2026`;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

export function verifyPin(userId: string, pin: string): boolean {
  const user = getUserConfig(userId);
  if (!user?.pinHash) return pin === "0000"; // 預設 PIN
  return user.pinHash === hashPin(pin);
}

export function setPin(userId: string, pin: string): void {
  const configs = getUserConfigs();
  const idx = configs.findIndex((u) => u.id === userId);
  if (idx >= 0) {
    configs[idx].pinHash = hashPin(pin);
    saveUserConfigs(configs);
  }
}

// ── Google Sheet ID 設定 ──────────────────────────────────
export function getSheetId(): string {
  return load<string>(key("sheetId")) ?? "";
}

export function saveSheetId(id: string): void {
  save(key("sheetId"), id);
}

// ── 學習模式（正面語言）──────────────────────────────────
export function getCardMode(userId: string, deckId: string): CardMode {
  return load<CardMode>(key(userId, "mode", deckId)) ?? "en-to-zh";
}

export function saveCardMode(userId: string, deckId: string, mode: CardMode): void {
  save(key(userId, "mode", deckId), mode);
}
