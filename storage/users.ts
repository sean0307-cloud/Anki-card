/**
 * storage/users.ts
 * 用戶設定的讀寫（LocalStorage）
 * 職責：用戶名稱、照片、角色、PIN 雜湊值
 */

import { STORAGE_KEYS, DEFAULT_USER_NAMES, USER_IDS, ADMIN_USER_IDS } from "@/lib/constants";
import type { UserConfig } from "@/lib/types";

function getDefaultUsers(): UserConfig[] {
  return USER_IDS.map((id) => ({
    id,
    name: DEFAULT_USER_NAMES[id],
    photoUrl: "",
    role: ADMIN_USER_IDS.includes(id) ? "admin" : "learner",
    assignedDecks: [],
  }));
}

export function getUserConfigs(): UserConfig[] {
  if (typeof window === "undefined") return getDefaultUsers();
  const configs: UserConfig[] = [];
  for (const id of USER_IDS) {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.USER_CONFIG(id));
      if (raw) {
        configs.push(JSON.parse(raw));
      } else {
        configs.push({
          id,
          name: DEFAULT_USER_NAMES[id],
          photoUrl: "",
          role: ADMIN_USER_IDS.includes(id) ? "admin" : "learner",
          assignedDecks: [],
        });
      }
    } catch {
      configs.push({
        id,
        name: DEFAULT_USER_NAMES[id],
        photoUrl: "",
        role: ADMIN_USER_IDS.includes(id) ? "admin" : "learner",
        assignedDecks: [],
      });
    }
  }
  return configs;
}

export function getUserConfig(userId: string): UserConfig | null {
  return getUserConfigs().find((u) => u.id === userId) ?? null;
}

export function saveUserConfig(config: UserConfig): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEYS.USER_CONFIG(config.id), JSON.stringify(config));
}

export function saveAllUserConfigs(configs: UserConfig[]): void {
  configs.forEach(saveUserConfig);
}

/** SHA-256 雜湊（簡易版，用於 PIN 儲存） */
async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`anki_pin_salt_${pin}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** 儲存 PIN（雜湊後存入） */
export async function setPin(userId: string, pin: string): Promise<void> {
  if (typeof window === "undefined") return;
  const hashed = await hashPin(pin);
  localStorage.setItem(STORAGE_KEYS.PIN(userId), hashed);
}

/** 驗證 PIN */
export async function verifyPin(userId: string, pin: string): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const stored = localStorage.getItem(STORAGE_KEYS.PIN(userId));
  // 首次使用：預設 PIN = 0000
  if (!stored) return pin === "0000";
  const hashed = await hashPin(pin);
  return stored === hashed;
}
