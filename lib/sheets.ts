// ============================================================
// Google Sheets CSV 讀取與解析
// ============================================================
import { Card, Assignment, UserConfig, CardProgress } from "./types";

const SHEET_BASE = process.env.NEXT_PUBLIC_SHEET_BASE_URL || "";

// CSV 欄位解析（處理帶逗號的欄位用雙引號包裹）
function parseCSV(text: string): string[][] {
  const lines = text.trim().split("\n");
  return lines.map((line) => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  });
}

// ── 讀取單字庫 ────────────────────────────────────────────
export async function fetchVocabulary(sheetId: string): Promise<Card[]> {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=Vocabulary`;
  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    const text = await res.text();
    const rows = parseCSV(text);
    if (rows.length < 2) return [];
    const headers = rows[0].map((h) => h.toLowerCase().replace(/"/g, ""));
    return rows.slice(1).map((row) => {
      const get = (key: string) => (row[headers.indexOf(key)] || "").replace(/^"|"$/g, "");
      return {
        word: get("word"),
        meaning: get("meaning"),
        partOfSpeech: get("partofspeech"),
        example: get("example"),
        exampleChinese: get("examplechinese"),
        synonyms: get("synonyms"),
        root: get("root"),
        level: get("level"),
        deck: get("deck"),
      } as Card;
    }).filter((c) => c.word);
  } catch (e) {
    console.error("fetchVocabulary error:", e);
    return [];
  }
}

// ── 讀取指派設定 ──────────────────────────────────────────
export async function fetchAssignments(sheetId: string): Promise<Assignment[]> {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=Assignments`;
  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    const text = await res.text();
    const rows = parseCSV(text);
    if (rows.length < 2) return [];
    const headers = rows[0].map((h) => h.toLowerCase().replace(/"/g, ""));
    return rows.slice(1).map((row) => {
      const get = (key: string) => (row[headers.indexOf(key)] || "").replace(/^"|"$/g, "");
      return {
        user: get("user"),
        deck: get("deck"),
        enabled: get("enabled").toLowerCase() === "true",
        order: parseInt(get("order") || "0"),
      } as Assignment;
    });
  } catch (e) {
    console.error("fetchAssignments error:", e);
    return [];
  }
}

// ── 讀取用戶設定（從 Users sheet）────────────────────────
export async function fetchUserConfigs(sheetId: string): Promise<UserConfig[]> {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=Users`;
  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    const text = await res.text();
    const rows = parseCSV(text);
    if (rows.length < 2) return [];
    const headers = rows[0].map((h) => h.toLowerCase().replace(/"/g, ""));
    return rows.slice(1).map((row) => {
      const get = (key: string) => (row[headers.indexOf(key)] || "").replace(/^"|"$/g, "");
      return {
        id: get("id"),
        name: get("name"),
        role: get("role") as "admin" | "learner",
        photoUrl: get("photourl"),
        assignedDecks: [],
        pinHash: get("pinhash") || undefined,
      } as UserConfig;
    });
  } catch (e) {
    console.error("fetchUserConfigs error:", e);
    return [];
  }
}

// ── 讀取學習進度 ──────────────────────────────────────────
export async function fetchProgressAll(sheetId: string): Promise<{ user: string; progress: CardProgress }[]> {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=Progress`;
  try {
    const res = await fetch(url, { next: { revalidate: 30 } }); // 快取時間 30 秒，以防快速更新
    if (!res.ok) return [];
    const text = await res.text();
    const rows = parseCSV(text);
    if (rows.length < 2) return [];
    const headers = rows[0].map((h) => h.toLowerCase().replace(/"/g, ""));
    return rows.slice(1).map((row) => {
      const get = (key: string) => (row[headers.indexOf(key)] || "").replace(/^"|"$/g, "");
      return {
        user: get("user"),
        progress: {
          word: get("word"),
          interval: parseInt(get("interval") || "1"),
          easeFactor: parseFloat(get("easefactor") || "2.5"),
          reviews: parseInt(get("reviews") || "0"),
          nextReview: get("nextreview"),
          lastAnswer: (get("lastanswer") || undefined) as any,
        } as CardProgress
      };
    }).filter((r) => r.user && r.progress.word);
  } catch (e) {
    console.warn("fetchProgressAll error (Progress sheet might not exist yet):", e);
    return [];
  }
}

// ── 寫入 Assignments (Google Apps Script) ────────────────────────────────
export async function saveAssignmentsToSheet(url: string, assignments: Assignment[]): Promise<boolean> {
  if (!url) return false;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "saveAssignments",
        assignments,
      }),
      mode: "no-cors",
    });
    return true;
  } catch (e) {
    console.error("saveAssignmentsToSheet error:", e);
    return false;
  }
}

// ── 寫入學習進度 (Google Apps Script) ────────────────────────────────────
export async function saveProgressToSheet(url: string, user: string, progress: CardProgress[]): Promise<boolean> {
  if (!url) return false;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "saveProgress",
        user,
        progress,
      }),
      mode: "no-cors",
    });
    return true;
  } catch (e) {
    console.error("saveProgressToSheet error:", e);
    return false;
  }
}

// ── 寫入用戶 PIN (Google Apps Script) ─────────────────────────────────────
export async function savePinToSheet(url: string, userId: string, pinHash: string): Promise<boolean> {
  if (!url) return false;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "savePin",
        userId,
        pinHash,
      }),
      mode: "no-cors",
    });
    return true;
  } catch (e) {
    console.error("savePinToSheet error:", e);
    return false;
  }
}

