/**
 * storage/settings.ts
 * 全域設定的讀寫（LocalStorage）
 * 職責：語音設定、UI 偏好、教材 Sheet ID
 */

import { STORAGE_KEYS } from "@/lib/constants";
import type { AppSettings } from "@/lib/types";

const DEFAULT_SETTINGS: AppSettings = {
  sheetId: "",
  theme: "system",
  speech: {
    voiceName: "",
    rate: 0.9,
    pitch: 1.0,
    volume: 1.0,
  },
  cardMode: "en-to-zh",
  autoPlaySpeech: true,
  gesture: false,
  lastSyncDate: "",
};

export function getSettings(): AppSettings {
  if (typeof window === "undefined") return { ...DEFAULT_SETTINGS };
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(patch: Partial<AppSettings>): AppSettings {
  if (typeof window === "undefined") return { ...DEFAULT_SETTINGS };
  const current = getSettings();
  const updated = { ...current, ...patch };
  localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
  return updated;
}

export function getSheetId(): string {
  return getSettings().sheetId;
}

export function saveSheetId(id: string): void {
  saveSettings({ sheetId: id });
}

export function getLastSyncDate(): string {
  return getSettings().lastSyncDate ?? "";
}

export function saveLastSyncDate(date: string): void {
  saveSettings({ lastSyncDate: date });
}
