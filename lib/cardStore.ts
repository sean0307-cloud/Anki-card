/**
 * lib/cardStore.ts
 * ★ 教材記憶體層（Module-level Singleton）
 *
 * 資料流：
 *   Google Sheets CSV → fetch（只在載入時或同步時執行）
 *      ↓
 *   CardStore（記憶體，本模組維護）
 *      ↓
 *   React Components 透過 cardStore.get*() 讀取
 *
 * 重要：
 *   - 所有翻卡、排程操作只走這個 Store，不再 fetch Google Sheets
 *   - 只有「同步教材」按鈕才會觸發新的 fetch
 *   - fetch 完成後自動存入 LocalStorage cache（6小時有效）
 */

import { fetchVocabulary, fetchAssignments } from "./sheets";
import { CACHE_HOURS, STORAGE_KEYS } from "./constants";
import type { Card, Assignment } from "./types";

interface CardStoreState {
  cards: Card[];            // 所有單字卡
  assignments: Assignment[]; // 所有指派設定
  deckMap: Record<string, Card[]>; // deck 名稱 → 卡片列表
  isLoaded: boolean;
  isLoading: boolean;
  lastFetchDate: string;   // ISO date string
  error: string | null;
}

// Module-level singleton state
const state: CardStoreState = {
  cards: [],
  assignments: [],
  deckMap: {},
  isLoaded: false,
  isLoading: false,
  lastFetchDate: "",
  error: null,
};

// 監聽者清單（用於通知 React components 狀態更新）
type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribeCardStore(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify() {
  listeners.forEach((l) => l());
}

/** 從 LocalStorage 讀取快取 */
function loadFromCache(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const cacheDate = localStorage.getItem(STORAGE_KEYS.CARD_CACHE_DATE);
    if (!cacheDate) return false;

    const cacheTime = new Date(cacheDate).getTime();
    const now = Date.now();
    const ageHours = (now - cacheTime) / (1000 * 60 * 60);
    if (ageHours > CACHE_HOURS) return false; // 快取過期

    const raw = localStorage.getItem(STORAGE_KEYS.CARD_CACHE);
    if (!raw) return false;

    const cached = JSON.parse(raw) as { cards: Card[]; assignments: Assignment[] };
    populateStore(cached.cards, cached.assignments);
    state.lastFetchDate = cacheDate;
    return true;
  } catch {
    return false;
  }
}

/** 將資料填入 store */
function populateStore(cards: Card[], assignments: Assignment[]) {
  state.cards = cards;
  state.assignments = assignments;
  state.deckMap = {};
  for (const card of cards) {
    if (!state.deckMap[card.deck]) state.deckMap[card.deck] = [];
    state.deckMap[card.deck].push(card);
  }
  state.isLoaded = true;
  state.error = null;
}

/** 將資料儲存到 LocalStorage 快取 */
function saveToCache(cards: Card[], assignments: Assignment[]) {
  if (typeof window === "undefined") return;
  try {
    const now = new Date().toISOString();
    localStorage.setItem(STORAGE_KEYS.CARD_CACHE, JSON.stringify({ cards, assignments }));
    localStorage.setItem(STORAGE_KEYS.CARD_CACHE_DATE, now);
  } catch {
    // LocalStorage 可能滿了，忽略錯誤
  }
}

/**
 * 初始化 Card Store（程式啟動時呼叫一次）
 * 1. 先嘗試從 LocalStorage 快取載入（快速）
 * 2. 如果快取過期或不存在，才 fetch Google Sheets
 */
export async function initCardStore(sheetId: string): Promise<void> {
  if (state.isLoaded || state.isLoading) return;
  state.isLoading = true;
  notify();

  // 嘗試快取
  const fromCache = loadFromCache();
  if (fromCache) {
    state.isLoading = false;
    notify();
    return;
  }

  // 快取無效，fetch 新資料
  await fetchAndUpdate(sheetId);
}

/**
 * 強制同步（「同步教材」按鈕觸發）
 * 無論快取是否有效，都重新 fetch
 */
export async function syncCardStore(sheetId: string): Promise<void> {
  state.isLoading = true;
  notify();
  await fetchAndUpdate(sheetId);
}

async function fetchAndUpdate(sheetId: string): Promise<void> {
  try {
    const [cards, assignments] = await Promise.all([
      fetchVocabulary(sheetId),
      fetchAssignments(sheetId),
    ]);
    populateStore(cards, assignments);
    saveToCache(cards, assignments);
    state.lastFetchDate = new Date().toISOString();
  } catch (err) {
    state.error = err instanceof Error ? err.message : "fetch 失敗";
  } finally {
    state.isLoading = false;
    notify();
  }
}

// ── 讀取 API ──────────────────────────────────────────

/** 取得所有卡片 */
export function getAllCards(): Card[] {
  return state.cards;
}

/** 取得特定牌組的卡片 */
export function getDeckCards(deckId: string): Card[] {
  return state.deckMap[deckId] ?? [];
}

/** 取得所有牌組名稱 */
export function getAllDeckNames(): string[] {
  return Object.keys(state.deckMap);
}

/** 取得指派給特定用戶的牌組 */
export function getUserDecks(userName: string): Assignment[] {
  return state.assignments
    .filter((a) => a.user === userName && a.enabled)
    .sort((a, b) => a.order - b.order);
}

/** Store 當前狀態快照（供 React hook 使用） */
export function getCardStoreSnapshot() {
  return {
    isLoaded: state.isLoaded,
    isLoading: state.isLoading,
    error: state.error,
    lastFetchDate: state.lastFetchDate,
    cardCount: state.cards.length,
  };
}
