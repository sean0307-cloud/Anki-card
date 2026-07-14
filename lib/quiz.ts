// ============================================================
// 測驗邏輯：自動生成測驗題目（三種題型）
// ============================================================
import { Card, QuizQuestion, QuizType } from "./types";
import { shuffle } from "./scheduler";

/**
 * 取得干擾選項（同詞性、不同單字）
 */
function getDistractors(
  card: Card,
  pool: Card[],
  count: number,
  answerField: "word" | "meaning"
): string[] {
  const samePos = pool.filter(
    (c) => c.word !== card.word && c.partOfSpeech === card.partOfSpeech
  );
  const different = pool.filter(
    (c) => c.word !== card.word && c.partOfSpeech !== card.partOfSpeech
  );
  const candidates = [...samePos, ...different];
  const shuffled = shuffle(candidates);
  return shuffled.slice(0, count).map((c) => c[answerField]);
}

/**
 * 生成情境填空題（主要題型）
 * 句子中的答案詞以 _______ 替換
 */
function makeContextFill(card: Card, pool: Card[]): QuizQuestion | null {
  if (!card.example || !card.word) return null;
  // 嘗試用 word 替換（不區分大小寫）
  const regex = new RegExp(`\\b${card.word}\\b`, "i");
  if (!regex.test(card.example)) return null;

  const sentence = card.example.replace(regex, "_______");
  const distractors = getDistractors(card, pool, 3, "word");
  if (distractors.length < 3) return null;

  return {
    type: "context-fill",
    wordId: card.word,
    sentence,
    sentenceChinese: card.exampleChinese,
    prompt: sentence,
    answer: card.word,
    options: shuffle([card.word, ...distractors]),
  };
}

/**
 * 生成英文→中文辨義題
 */
function makeEnToZh(card: Card, pool: Card[]): QuizQuestion {
  const distractors = getDistractors(card, pool, 3, "meaning");
  const filledDistractors = distractors.length >= 3
    ? distractors
    : [...distractors, "不知道A", "不知道B", "不知道C"].slice(0, 3);

  return {
    type: "en-to-zh",
    wordId: card.word,
    prompt: card.word,
    answer: card.meaning,
    options: shuffle([card.meaning, ...filledDistractors]),
  };
}

/**
 * 生成中文→英文辨義題
 */
function makeZhToEn(card: Card, pool: Card[]): QuizQuestion {
  const distractors = getDistractors(card, pool, 3, "word");
  const filledDistractors = distractors.length >= 3
    ? distractors
    : [...distractors, "wordA", "wordB", "wordC"].slice(0, 3);

  return {
    type: "zh-to-en",
    wordId: card.word,
    prompt: `${card.meaning} (${card.partOfSpeech})`,
    answer: card.word,
    options: shuffle([card.word, ...filledDistractors]),
  };
}

/**
 * 主函數：為學完的單字生成測驗題組
 * 優先使用情境填空，無例句時用辨義題
 * 混合三種題型
 */
export function generateQuiz(learnedWords: Card[], allWords: Card[]): QuizQuestion[] {
  const questions: QuizQuestion[] = [];

  learnedWords.forEach((card) => {
    // 嘗試情境填空（優先）
    const contextQ = makeContextFill(card, allWords);
    if (contextQ) {
      questions.push(contextQ);
      return;
    }
    // 備用：辨義題
    questions.push(makeEnToZh(card, allWords));
  });

  // 補充反向辨義題（從 learnedWords 隨機取 1/3）
  const zhToEnPool = shuffle(learnedWords).slice(0, Math.floor(learnedWords.length / 3));
  zhToEnPool.forEach((card) => {
    questions.push(makeZhToEn(card, allWords));
  });

  return shuffle(questions);
}

/**
 * 計算測驗分數（0-100）
 */
export function calcScore(correct: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((correct / total) * 100);
}
