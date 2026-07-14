// ============================================================
// Google Sheets CSV 讀取與解析
// ============================================================
import { Card, Assignment, UserConfig } from "./types";

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
