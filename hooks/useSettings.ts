"use client";
/**
 * hooks/useSettings.ts
 * 全域設定 hook
 */

import { useState, useCallback } from "react";
import { getSettings, saveSettings } from "@/storage/settings";
import { clearVoiceCache } from "@/lib/speech";
import type { AppSettings } from "@/lib/types";

export function useSettings() {
  const [settings, setSettingsState] = useState<AppSettings>(getSettings);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    const updated = saveSettings(patch);
    setSettingsState(updated);
    // 如果語音設定有變動，清除 voice cache
    if (patch.speech) clearVoiceCache();
  }, []);

  return { settings, updateSettings };
}
