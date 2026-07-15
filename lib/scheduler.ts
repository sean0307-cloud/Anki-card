// ============================================================
// SRS 排程邏輯 v2.1
// Again → 插入第3張後（不足則放最後）
// Hard  → 插入第7張後（不足則放最後）
// Good  → 排到最後
// Easy  → 今天不再出現
//
// ★ 核心規則（問題1修正）：
//   remaining.length < 設定間隔 → 放最後（不消失）
//   remaining.length >= 設定間隔 → 按照設定位置插入
// ============================================================
type ReviewAnswer = "again" | "hard" | "good" | "easy";

export const SRS_INTERVALS = {
  again: 3,
  hard: 7,
} as const;

export function insertAt(arr: string[], item: string, pos: number): string[] {
  const copy = [...arr];
  const insertIndex = Math.min(pos, copy.length);
  copy.splice(insertIndex, 0, item);
  return copy;
}

/**
 * 處理複習回答，回傳更新後的佇列
 * @param remaining  當前卡片「之後」的所有卡片（不含目前這張）
 * @param wordId     當前卡片 ID
 * @param answer     用戶選擇
 *
 * 修正說明：
 *   - again/hard：若 remaining.length < interval → 放最後，否則插入對應位置
 *   - good：永遠放最後
 *   - easy：從佇列移除（今日不再出現）
 */
export function processReview(
  remaining: string[],   // 當前卡片之後的所有卡片
  wordId: string,
  answer: ReviewAnswer
): { newRemaining: string[]; markEasy: boolean } {
  let newRemaining = [...remaining];
  let markEasy = false;

  switch (answer) {
    case "again": {
      const interval = SRS_INTERVALS.again;
      if (newRemaining.length < interval) {
        // 剩餘不足間隔 → 放最後
        newRemaining = [...newRemaining, wordId];
      } else {
        // 剩餘充足 → 插入第3位
        newRemaining = insertAt(newRemaining, wordId, interval);
      }
      break;
    }
    case "hard": {
      const interval = SRS_INTERVALS.hard;
      if (newRemaining.length < interval) {
        // 剩餘不足間隔 → 放最後
        newRemaining = [...newRemaining, wordId];
      } else {
        // 剩餘充足 → 插入第7位
        newRemaining = insertAt(newRemaining, wordId, interval);
      }
      break;
    }
    case "good":
      // 永遠放最後（確保今天還能再看一次）
      newRemaining = [...newRemaining, wordId];
      break;
    case "easy":
      // 今天不再出現
      markEasy = true;
      break;
  }

  return { newRemaining, markEasy };
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
