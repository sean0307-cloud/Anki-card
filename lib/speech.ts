// ============================================================
// SpeechSynthesis API 封裝
// 支援：單字發音、例句發音、Voice/Rate/Pitch/Volume 設定
// ============================================================
import { SpeechSettings } from "./types";
import { getSpeechSettings } from "./storage";

let currentUtterance: SpeechSynthesisUtterance | null = null;

export function stopSpeech(): void {
  if (typeof window === "undefined") return;
  window.speechSynthesis.cancel();
  currentUtterance = null;
}

export function speak(text: string, lang = "en-US", overrides?: Partial<SpeechSettings>): void {
  if (typeof window === "undefined") return;
  stopSpeech();

  const settings = { ...getSpeechSettings(), ...overrides };
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = lang;
  utter.rate = settings.rate;
  utter.pitch = settings.pitch;
  utter.volume = settings.volume;

  if (settings.voiceName) {
    const voices = window.speechSynthesis.getVoices();
    const match = voices.find((v) => v.name === settings.voiceName);
    if (match) utter.voice = match;
  }

  currentUtterance = utter;
  window.speechSynthesis.speak(utter);
}

export function speakWord(word: string): void {
  speak(word, "en-US");
}

export function speakSentence(sentence: string): void {
  speak(sentence, "en-US");
}

export function getAvailableVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined") return [];
  return window.speechSynthesis.getVoices().filter(
    (v) => v.lang.startsWith("en")
  );
}

export function onVoicesReady(callback: () => void): void {
  if (typeof window === "undefined") return;
  if (window.speechSynthesis.getVoices().length > 0) {
    callback();
  } else {
    window.speechSynthesis.onvoiceschanged = callback;
  }
}
