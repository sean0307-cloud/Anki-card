"use client";
/**
 * hooks/useCards.ts
 * Card Store → React hook
 * 乾淨的資料流：CardStore → useCards() → FlashCard
 */

import { useEffect, useReducer, useCallback } from "react";
import {
  initCardStore,
  syncCardStore,
  getDeckCards,
  getUserDecks,
  getCardStoreSnapshot,
  subscribeCardStore,
} from "@/lib/cardStore";
import { getSheetId, saveLastSyncDate } from "@/storage/settings";
import type { Card, Assignment } from "@/lib/types";

export interface UseCardsReturn {
  cards: Card[];
  userDecks: Assignment[];
  isLoaded: boolean;
  isLoading: boolean;
  error: string | null;
  lastFetchDate: string;
  syncNow: () => Promise<void>;
}

/**
 * 取得特定牌組的卡片（訂閱 CardStore 更新）
 */
export function useCards(deckId: string, userName?: string): UseCardsReturn {
  // 用 useReducer 強制 re-render
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    // 訂閱 CardStore 更新
    const unsubscribe = subscribeCardStore(forceUpdate);

    // 初始化（如果還沒載入）
    const sheetId = getSheetId();
    if (sheetId) {
      initCardStore(sheetId);
    }

    return unsubscribe;
  }, []);

  const syncNow = useCallback(async () => {
    const sheetId = getSheetId();
    if (!sheetId) return;
    await syncCardStore(sheetId);
    saveLastSyncDate(new Date().toISOString());
  }, []);

  const snapshot = getCardStoreSnapshot();
  const cards = getDeckCards(deckId);
  const userDecks = userName ? getUserDecks(userName) : [];

  return {
    cards,
    userDecks,
    isLoaded: snapshot.isLoaded,
    isLoading: snapshot.isLoading,
    error: snapshot.error,
    lastFetchDate: snapshot.lastFetchDate,
    syncNow,
  };
}

/**
 * 只取得 CardStore 的載入狀態（首頁用）
 */
export function useCardStoreStatus() {
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    const unsubscribe = subscribeCardStore(forceUpdate);
    const sheetId = getSheetId();
    if (sheetId) initCardStore(sheetId);
    return unsubscribe;
  }, []);

  return getCardStoreSnapshot();
}
