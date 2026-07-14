// ============================================================
// SRS 排程邏輯
// Again → 插入第3張後（不足則最後）
// Hard  → 插入第7張後（不足則最後）
// Good  → 排到最後
// Easy  → 今天不再出現，明天恢復
// ============================================================
type ReviewAnswer = "again" | "hard" | "good" | "easy";

export function insertAt(arr: string[], item: string, pos: number): string[] {
  const copy = [...arr];
  const insertIndex = Math.min(pos, copy.length);
  copy.splice(insertIndex, 0, item);
  return copy;
}

/**
 * 處理複習回答，回傳更新後的佇列
 * @param queue      剩餘佇列（currentIndex 之後的卡片）
 * @param wordId     當前卡片 ID
 * @param answer     用戶選擇
 * @returns          更新後的佇列
 */
export function processReview(
  queue: string[],   // 當前卡片之後的所有卡片
  wordId: string,
  answer: ReviewAnswer
): { newQueue: string[]; markEasy: boolean } {
  let newQueue = [...queue];
  let markEasy = false;

  switch (answer) {
    case "again":
      // 插入第3張後（index 3），不足則放最後
      newQueue = insertAt(queue, wordId, 3);
      break;
    case "hard":
      // 插入第7張後（index 7），不足則放最後
      newQueue = insertAt(queue, wordId, 7);
      break;
    case "good":
      // 排到最後
      newQueue = [...queue, wordId];
      break;
    case "easy":
      // 今天不再出現，明天恢復
      markEasy = true;
      break;
  }

  return { newQueue, markEasy };
}

/**
 * 建立新的學習佇列（每天開始時）
 * Easy 卡片的 next_review 若是今天，仍會排入
 */
export function buildDailyQueue(
  wordIds: string[],
  todayEasyIds: string[],
  today: string
): string[] {
  // 過濾掉今天被標為 Easy 的卡片
  const easySet = new Set(todayEasyIds);
  const filtered = wordIds.filter((id) => !easySet.has(id));
  // 簡單隨機洗牌（Fisher-Yates）
  return shuffle(filtered);
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function getTodayDate(): string {
  return new Date().toISOString().split("T")[0];
}

export function getTomorrowDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}
