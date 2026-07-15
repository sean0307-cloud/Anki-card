"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getUserConfigs, setPin, verifyPin } from "@/storage/users";
import { getSheetId, saveSettings, getSettings } from "@/storage/settings";
import {
  syncCardStore, getAllCards, getAllDeckNames, getUserDecks,
  getAllAssignments, updateLocalAssignment, getCardStoreSnapshot, initCardStore
} from "@/lib/cardStore";
import type { UserConfig, Assignment } from "@/lib/types";

type AdminPhase = "pin" | "dashboard";
type TabId = "decks" | "users" | "settings";

const ADMIN_IDS = ["mom", "dad"];
const USER_LIST = [
  { id: "brother1", name: "哥哥", emoji: "👦" },
  { id: "brother2", name: "弟弟", emoji: "👦" },
  { id: "mom",      name: "媽媽", emoji: "👩" },
  { id: "dad",      name: "爸爸", emoji: "👨" },
];

export default function AdminPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<AdminPhase>("pin");
  const [selectedAdmin, setSelectedAdmin] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");
  const [users, setUsers] = useState<UserConfig[]>([]);
  const [sheetId, setSheetIdState] = useState("");
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("decks");
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");

  // Deck management state
  const [deckNames, setDeckNames] = useState<string[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [expandedDeck, setExpandedDeck] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [storeSnap, setStoreSnap] = useState(getCardStoreSnapshot());

  useEffect(() => {
    setUsers(getUserConfigs());
    const sid = getSheetId();
    setSheetIdState(sid);
    if (sid) initCardStore(sid).then(refreshStore);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshStore = useCallback(() => {
    setDeckNames(getAllDeckNames());
    setAssignments(getAllAssignments());
    setStoreSnap(getCardStoreSnapshot());
  }, []);

  const handlePinSubmit = async () => {
    if (!selectedAdmin) { setPinError("請先選擇管理者"); return; }
    const ok = await verifyPin(selectedAdmin, pinInput);
    if (ok) { setPhase("dashboard"); setPinError(""); }
    else { setPinError("PIN 碼錯誤"); setPinInput(""); }
  };

  const handleSave = () => {
    saveSettings({ sheetId });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleSync = async () => {
    if (!sheetId) { alert("請先儲存 Sheet ID"); return; }
    saveSettings({ sheetId });
    setSyncing(true);
    setSyncMsg("同步中...");
    try {
      await syncCardStore(sheetId);
      refreshStore();
      setSyncMsg(`✓ 同步完成，共 ${getCardStoreSnapshot().cardCount} 張`);
    } catch {
      setSyncMsg("⚠️ 同步失敗，請確認 Sheet ID 及共用設定");
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMsg(""), 4000);
    }
  };

  const toggleAssignment = useCallback((userId: string, deckName: string, currentEnabled: boolean) => {
    const existing = assignments.find(a => a.user === userId && a.deck === deckName);
    const updated: Assignment = existing
      ? { ...existing, enabled: !currentEnabled }
      : { user: userId, deck: deckName, enabled: !currentEnabled, order: 99 };
    updateLocalAssignment(updated);
    setAssignments(prev => {
      const idx = prev.findIndex(a => a.user === userId && a.deck === deckName);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = updated;
        return next;
      }
      return [...prev, updated];
    });
  }, [assignments]);

  // ── PIN 登入畫面 ──────────────────────────────────
  if (phase === "pin") {
    const adminUsers = users.filter((u) => ADMIN_IDS.includes(u.id));
    return (
      <div className="page" style={{ alignItems: "center", justifyContent: "center", padding: "40px 24px" }}>
        <div style={{ width: "100%", maxWidth: "360px" }}>
          <div style={{ textAlign: "center", marginBottom: "32px" }}>
            <div style={{ fontSize: "2.5rem" }}>🔐</div>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginTop: "12px" }}>後台管理</h1>
            <p className="text-muted text-sm mt-1">請選擇管理者並輸入 PIN 碼</p>
          </div>
          <div style={{ display: "flex", gap: "12px", marginBottom: "20px" }}>
            {adminUsers.map((u) => (
              <button key={u.id} onClick={() => setSelectedAdmin(u.id)} style={{
                flex: 1, padding: "14px", borderRadius: "var(--r-lg)",
                border: "2px solid", borderColor: selectedAdmin === u.id ? "var(--blue)" : "var(--border)",
                background: selectedAdmin === u.id ? "var(--blue-light)" : "var(--surface)",
                color: selectedAdmin === u.id ? "var(--blue)" : "var(--text)",
                fontWeight: 700, cursor: "pointer", transition: "all 150ms ease",
              }}>
                <div style={{ fontSize: "1.5rem", marginBottom: "4px" }}>{u.id === "mom" ? "👩" : "👨"}</div>
                {u.name}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: "12px", marginBottom: "16px" }}>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} style={{
                width: "48px", height: "48px", borderRadius: "var(--r-md)",
                border: "2px solid", borderColor: pinInput.length > i ? "var(--blue)" : "var(--border)",
                background: pinInput.length > i ? "var(--blue-light)" : "var(--surface-2)",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem",
              }}>
                {pinInput.length > i ? "●" : ""}
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", marginBottom: "16px" }}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, "del"].map((num, idx) => (
              <button key={idx} disabled={num === null}
                onClick={() => {
                  if (num === null) return;
                  if (num === "del") { setPinInput((p) => p.slice(0, -1)); return; }
                  if (pinInput.length < 4) setPinInput((p) => p + num.toString());
                }}
                style={{
                  height: "56px", borderRadius: "var(--r-md)",
                  background: num === "del" ? "var(--surface-2)" : num === null ? "transparent" : "var(--surface)",
                  border: "1px solid", borderColor: num === null ? "transparent" : "var(--border)",
                  fontSize: num === "del" ? "1rem" : "1.25rem", fontWeight: 600,
                  cursor: num === null ? "default" : "pointer",
                  color: "var(--text)", transition: "all 150ms ease",
                }}>
                {num === "del" ? "⌫" : num ?? ""}
              </button>
            ))}
          </div>
          {pinError && <div style={{ textAlign: "center", color: "var(--again)", fontSize: "0.875rem", marginBottom: "12px" }}>{pinError}</div>}
          <button className="btn btn-primary w-full" style={{ borderRadius: "var(--r-lg)", padding: "16px" }} onClick={handlePinSubmit} disabled={pinInput.length < 4 || !selectedAdmin}>登入</button>
          <button className="btn btn-ghost w-full mt-2" onClick={() => router.push("/")}>返回首頁</button>
          <p className="text-xs text-muted text-center mt-3">首次使用預設 PIN：0000</p>
        </div>
      </div>
    );
  }

  // ── 後台儀錶板 ────────────────────────────────────
  return (
    <div className="page">
      <div className="page-header">
        <button className="btn-icon" onClick={() => router.push("/")}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700 }}>後台管理</div>
          <div className="text-xs text-muted">{users.find(u => u.id === selectedAdmin)?.name}</div>
        </div>
        <button className="btn btn-primary" style={{ padding: "8px 16px", fontSize: "0.875rem" }} onClick={handleSave}>
          {saved ? "✓ 已儲存" : "儲存"}
        </button>
      </div>

      {/* 分頁列 */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--border)", padding: "0 16px" }}>
        {([["decks", "📦 牌組"], ["users", "👥 用戶"], ["settings", "⚙️ 設定"]] as const).map(([tab, label]) => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: "12px 14px", fontSize: "0.8125rem",
            fontWeight: activeTab === tab ? 700 : 400,
            color: activeTab === tab ? "var(--blue)" : "var(--text-muted)",
            borderBottom: "2px solid", borderColor: activeTab === tab ? "var(--blue)" : "transparent",
            marginBottom: "-1px", cursor: "pointer", transition: "all 150ms ease",
          }}>{label}</button>
        ))}
      </div>

      <div className="page-content">

        {/* ══════════════════════════════════════════════
            📦 牌組管理
        ══════════════════════════════════════════════ */}
        {activeTab === "decks" && (
          <div>
            {/* 同步狀態卡片 */}
            <div className="card" style={{ marginBottom: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <div style={{ fontWeight: 700 }}>📊 教材狀態</div>
                <button className="btn btn-secondary" style={{ padding: "6px 14px", fontSize: "0.8125rem" }}
                  onClick={handleSync} disabled={syncing || !sheetId}>
                  {syncing ? "⏳" : "↻"} 同步
                </button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <div style={{ background: "var(--surface-2)", borderRadius: "var(--r-md)", padding: "10px 12px" }}>
                  <div className="text-xs text-muted">總單字數</div>
                  <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>{storeSnap.cardCount}</div>
                </div>
                <div style={{ background: "var(--surface-2)", borderRadius: "var(--r-md)", padding: "10px 12px" }}>
                  <div className="text-xs text-muted">牌組數量</div>
                  <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>{deckNames.length}</div>
                </div>
              </div>
              {syncMsg && <div style={{ marginTop: "8px", fontSize: "0.8125rem", color: syncMsg.startsWith("✓") ? "var(--good)" : "var(--text-muted)" }}>{syncMsg}</div>}
              {!sheetId && <div className="text-xs text-muted mt-2" style={{ color: "var(--again)" }}>⚠️ 尚未設定 Sheet ID，請先至「⚙️ 設定」分頁設定</div>}
            </div>

            {/* 牌組列表 */}
            {deckNames.length === 0 ? (
              <div className="card" style={{ textAlign: "center", padding: "40px 20px" }}>
                <div style={{ fontSize: "2rem", marginBottom: "12px" }}>📭</div>
                <div style={{ fontWeight: 600 }}>尚無牌組資料</div>
                <div className="text-sm text-muted mt-2">請先設定 Sheet ID 並同步教材</div>
                <button className="btn btn-primary mt-4" onClick={() => setActiveTab("settings")}>前往設定</button>
              </div>
            ) : (
              <>
                <input
                  type="search" placeholder="🔍 搜尋牌組..."
                  value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                  style={{ width: "100%", padding: "10px 14px", borderRadius: "var(--r-lg)", border: "1px solid var(--border)", background: "var(--surface-2)", marginBottom: "12px", fontSize: "0.9375rem" }}
                />
                {deckNames.filter(d => d.toLowerCase().includes(searchTerm.toLowerCase())).map(deckName => {
                  const deckCards = getAllCards().filter(c => c.deck === deckName);
                  const isExpanded = expandedDeck === deckName;
                  return (
                    <div key={deckName} className="card" style={{ marginBottom: "12px" }}>
                      {/* 牌組標頭 */}
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <button onClick={() => setExpandedDeck(isExpanded ? null : deckName)} style={{
                          flex: 1, display: "flex", alignItems: "center", gap: "10px",
                          background: "none", border: "none", textAlign: "left", cursor: "pointer", padding: 0
                        }}>
                          <div style={{ fontSize: "1.25rem" }}>{isExpanded ? "📂" : "📁"}</div>
                          <div>
                            <div style={{ fontWeight: 700, color: "var(--text)" }}>{deckName}</div>
                            <div className="text-xs text-muted">{deckCards.length} 張單字</div>
                          </div>
                        </button>
                      </div>

                      {/* 展開：用戶指派切換 */}
                      {isExpanded && (
                        <div style={{ marginTop: "14px", borderTop: "1px solid var(--border)", paddingTop: "12px" }}>
                          <div className="text-xs text-muted" style={{ marginBottom: "8px", fontWeight: 600 }}>指派給成員</div>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "12px" }}>
                            {USER_LIST.map(({ id, name, emoji }) => {
                              const asgn = assignments.find(a => a.user === name && a.deck === deckName);
                              const isEnabled = asgn?.enabled ?? false;
                              return (
                                <button key={id} onClick={() => toggleAssignment(name, deckName, isEnabled)}
                                  style={{
                                    display: "flex", alignItems: "center", gap: "8px", padding: "10px 12px",
                                    borderRadius: "var(--r-md)", border: "2px solid",
                                    borderColor: isEnabled ? "var(--good)" : "var(--border)",
                                    background: isEnabled ? "rgba(52,199,89,0.08)" : "var(--surface-2)",
                                    cursor: "pointer", transition: "all 150ms ease",
                                  }}>
                                  <span style={{ fontSize: "1.25rem" }}>{emoji}</span>
                                  <span style={{ fontWeight: 600, color: "var(--text)", fontSize: "0.875rem" }}>{name}</span>
                                  <span style={{ marginLeft: "auto", fontSize: "0.875rem" }}>{isEnabled ? "✅" : "○"}</span>
                                </button>
                              );
                            })}
                          </div>
                          {/* 單字預覽 */}
                          <div className="text-xs text-muted" style={{ marginBottom: "6px", fontWeight: 600 }}>單字預覽（前10張）</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                            {deckCards.slice(0, 10).map(c => (
                              <span key={c.word} style={{
                                padding: "3px 8px", borderRadius: "var(--r-full)",
                                background: "var(--surface-2)", fontSize: "0.75rem", color: "var(--text)"
                              }}>
                                {c.word}
                                <span className="text-muted" style={{ marginLeft: "4px" }}>{c.meaning}</span>
                              </span>
                            ))}
                            {deckCards.length > 10 && (
                              <span style={{ padding: "3px 8px", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                +{deckCards.length - 10} 更多...
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════
            👥 用戶管理
        ══════════════════════════════════════════════ */}
        {activeTab === "users" && (
          <div>
            {users.map((u) => {
              const userDecks = assignments.filter(a =>
                a.user === (USER_LIST.find(ul => ul.id === u.id)?.name ?? u.name) && a.enabled
              );
              return (
                <div key={u.id} className="card" style={{ marginBottom: "16px" }}>
                  <div style={{ fontWeight: 700, marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "1.5rem" }}>
                      {u.id === "brother1" ? "👦" : u.id === "brother2" ? "👦" : u.id === "mom" ? "👩" : "👨"}
                    </span>
                    {u.name}
                    <span className={`badge ${u.role === "admin" ? "badge-blue" : "badge-green"}`}>
                      {u.role === "admin" ? "管理者" : "學習者"}
                    </span>
                  </div>
                  {/* 已指派的牌組 */}
                  <div className="text-xs text-muted" style={{ marginBottom: "6px" }}>已指派牌組（{userDecks.length} 個）</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "8px" }}>
                    {userDecks.length === 0 ? (
                      <span className="text-xs text-muted">尚未指派任何牌組</span>
                    ) : userDecks.map(a => (
                      <span key={a.deck} style={{
                        padding: "4px 10px", borderRadius: "var(--r-full)",
                        background: "rgba(52,199,89,0.12)", fontSize: "0.8125rem", color: "var(--good)", fontWeight: 600
                      }}>{a.deck}</span>
                    ))}
                  </div>
                  {ADMIN_IDS.includes(u.id) && (
                    <div style={{ borderTop: "1px solid var(--border)", paddingTop: "10px", marginTop: "4px" }}>
                      <label className="text-xs text-muted" style={{ display: "block", marginBottom: "4px" }}>修改 PIN 碼</label>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <input type="password" maxLength={4} placeholder="新 PIN（4位數）" id={`pin-${u.id}`}
                          style={{ flex: 1, padding: "10px 12px", borderRadius: "var(--r-md)", border: "1px solid var(--border)", background: "var(--surface-2)", fontSize: "1rem" }}
                        />
                        <button className="btn btn-secondary" onClick={async () => {
                          const el = document.getElementById(`pin-${u.id}`) as HTMLInputElement;
                          if (el?.value?.length === 4) { await setPin(u.id, el.value); el.value = ""; alert(`${u.name} 的 PIN 已更新`); }
                          else alert("請輸入 4 位數字");
                        }}>更新</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ══════════════════════════════════════════════
            ⚙️ 系統設定
        ══════════════════════════════════════════════ */}
        {activeTab === "settings" && (
          <div>
            <div className="card" style={{ marginBottom: "16px" }}>
              <div style={{ fontWeight: 700, marginBottom: "12px" }}>📊 Google Sheets 設定</div>
              <label className="text-xs text-muted" style={{ display: "block", marginBottom: "4px" }}>試算表 ID（從 URL 取得）</label>
              <input type="text" value={sheetId}
                placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
                onChange={(e) => setSheetIdState(e.target.value)}
                style={{ width: "100%", padding: "10px 12px", borderRadius: "var(--r-md)", border: "1px solid var(--border)", background: "var(--surface-2)", fontSize: "0.8125rem", fontFamily: "monospace", marginBottom: "8px" }}
              />
              <div className="text-xs text-muted">URL 格式：docs.google.com/spreadsheets/d/<strong>試算表ID</strong>/edit</div>
              <div className="text-xs text-muted mt-1">⚠️ 試算表需設為「知道連結的任何人皆可檢視」</div>
              <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={handleSave}>💾 儲存 ID</button>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSync} disabled={syncing || !sheetId}>
                  {syncing ? "⏳ 同步中..." : "↻ 立即同步"}
                </button>
              </div>
              {syncMsg && <div style={{ marginTop: "8px", fontSize: "0.8125rem", color: syncMsg.startsWith("✓") ? "var(--good)" : "var(--text-muted)" }}>{syncMsg}</div>}
            </div>

            <div className="card" style={{ marginBottom: "16px" }}>
              <div style={{ fontWeight: 700, marginBottom: "8px" }}>📋 Sheets 工作表格式</div>
              <div style={{ fontFamily: "monospace", fontSize: "0.75rem", background: "var(--surface-2)", padding: "12px", borderRadius: "var(--r-sm)", lineHeight: 2, overflowX: "auto" }}>
                <div><strong>Vocabulary</strong>（工作表1）</div>
                <div style={{ color: "var(--text-muted)" }}>Word | Meaning | PartOfSpeech | Example | ExampleChinese | Synonyms | Root | Level | Deck</div>
                <div style={{ marginTop: "8px" }}><strong>Assignments</strong>（工作表2）</div>
                <div style={{ color: "var(--text-muted)" }}>User | Deck | Enabled | Order</div>
              </div>
              <div className="text-xs text-muted mt-2">
                ✏️ 單字的新增、修改、刪除請直接在 Google Sheets 中操作，完成後點「同步」即可更新。
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
