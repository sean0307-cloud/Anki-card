/**
 * lib/speech.ts
 * SpeechSynthesis API 封裝
 * 特色：Voice Cache（第一次搜尋後快取，不重複搜尋）
 */

import type { SpeechSettings } from "./types";

// ── Voice Cache ───────────────────────────────────────────
// 第一次取得 voice 後快取，避免每次播放都重新搜尋

let voiceCache: SpeechSynthesisVoice[] | null = null;
let preferredVoice: SpeechSynthesisVoice | null = null;
let preferredVoiceName = ""; // 上次快取的 voice name

/** 取得所有可用語音（有快取） */
export function getAvailableVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined") return [];
  if (voiceCache) return voiceCache;
  voiceCache = window.speechSynthesis.getVoices();
  return voiceCache;
}

/**
 * 取得偏好的英文語音（有快取）
 * 優先順序：設定中的 voiceName → 美式英文 → 英文 → 預設
 */
function getVoice(settings?: Partial<SpeechSettings>): SpeechSynthesisVoice | null {
  if (typeof window === "undefined") return null;
  const voices = getAvailableVoices();
  if (!voices.length) return null;

  const targetName = settings?.voiceName ?? "";

  // 如果設定的 voice name 和快取一樣，直接返回
  if (targetName && targetName === preferredVoiceName && preferredVoice) {
    return preferredVoice;
  }

  // 1. 指定 voice name
  if (targetName) {
    const found = voices.find((v) => v.name === targetName);
    if (found) {
      preferredVoice = found;
      preferredVoiceName = targetName;
      return found;
    }
  }

  // 2. 美式英文優先（David, Samantha, Alex...）
  const usVoice = voices.find(
    (v) => v.lang === "en-US" && !v.localService === false
  ) ?? voices.find((v) => v.lang === "en-US");

  // 3. 任何英文語音
  const enVoice = usVoice ?? voices.find((v) => v.lang.startsWith("en-"));

  preferredVoice = enVoice ?? null;
  preferredVoiceName = preferredVoice?.name ?? "";
  return preferredVoice;
}

/** 當語音清單更新時觸發（Android / 某些瀏覽器需要等待） */
export function onVoicesReady(callback: () => void): void {
  if (typeof window === "undefined") return;
  if (window.speechSynthesis.getVoices().length > 0) {
    voiceCache = window.speechSynthesis.getVoices();
    callback();
    return;
  }
  window.speechSynthesis.addEventListener("voiceschanged", () => {
    voiceCache = window.speechSynthesis.getVoices();
    callback();
  }, { once: true });
}

/** 清除 voice cache（設定變更後呼叫） */
export function clearVoiceCache(): void {
  voiceCache = null;
  preferredVoice = null;
  preferredVoiceName = "";
}

// ── 播放 API ──────────────────────────────────────────────

function speak(text: string, settings?: Partial<SpeechSettings>): void {
  if (typeof window === "undefined") return;
  stopSpeech();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = settings?.rate ?? 0.9;
  utterance.pitch = settings?.pitch ?? 1.0;
  utterance.volume = settings?.volume ?? 1.0;

  const voice = getVoice(settings);
  if (voice) utterance.voice = voice;

  window.speechSynthesis.speak(utterance);
}

/** 播放單字 */
export function speakWord(word: string, settings?: Partial<SpeechSettings>): void {
  speak(word, settings);
}

/** 播放句子（稍微慢一點以確保清晰） */
export function speakSentence(sentence: string, settings?: Partial<SpeechSettings>): void {
  speak(sentence, { ...settings, rate: (settings?.rate ?? 0.9) * 0.85 });
}

/** 停止目前播放 */
export function stopSpeech(): void {
  if (typeof window === "undefined") return;
  window.speechSynthesis.cancel();
}

/** 取得推薦的英文語音名稱（給設定面板顯示） */
export function getRecommendedVoiceName(): string {
  return preferredVoice?.name ?? "";
}
