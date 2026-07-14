"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUserConfigs, getUserConfig, saveAllUserConfigs, setPin, verifyPin } from "@/storage/users";
import { getSheetId, saveSettings, getSettings } from "@/storage/settings";
import { syncCardStore } from "@/lib/cardStore";
import type { UserConfig } from "@/lib/types";

type AdminPhase = "pin" | "dashboard";
type TabId = "users" | "settings";

const ADMIN_IDS = ["mom", "dad"];

export default function AdminPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<AdminPhase>("pin");
  const [selectedAdmin, setSelectedAdmin] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");
  const [users, setUsers] = useState<UserConfig[]>([]);
  const [sheetId, setSheetIdState] = useState("");
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("settings");
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    setUsers(getUserConfigs());
    setSheetIdState(getSheetId());
  }, []);

  const handlePinSubmit = async () => {
    if (!selectedAdmin) { setPinError("請先選擇管理者"); return; }
    const ok = await verifyPin(selectedAdmin, pinInput);
    if (ok) { setPhase("dashboard"); setPinError(""); }
    else { setPinError("PIN 碼錯誤"); setPinInput(""); }
  };

  const handleSave = () => {
    saveAllUserConfigs(users);
    saveSettings({ sheetId });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleSync = async () => {
    if (!sheetId) { alert("請先儲存 Sheet ID"); return; }
    setSyncing(true);
    try { await syncCardStore(sheetId); }
    finally { setSyncing(false); }
    alert("同步完成！");
  };

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
                  height: "56px", borderRadius: "var(--r-md)", background: num === "del" ? "var(--surface-2)" : num === null ? "transparent" : "var(--surface)",
                  border: "1px solid", borderColor: num === null ? "transparent" : "var(--border)",
                  fontSize: num === "del" ? "1rem" : "1.25rem", fontWeight: 600, cursor: num === null ? "default" : "pointer",
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
      <div style={{ display: "flex", borderBottom: "1px solid var(--border)", padding: "0 16px" }}>
        {([["settings", "⚙️ 設定"], ["users", "👥 用戶"]] as const).map(([tab, label]) => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: "12px 16px", fontSize: "0.875rem",
            fontWeight: activeTab === tab ? 700 : 400,
            color: activeTab === tab ? "var(--blue)" : "var(--text-muted)",
            borderBottom: "2px solid", borderColor: activeTab === tab ? "var(--blue)" : "transparent",
            marginBottom: "-1px", cursor: "pointer", transition: "all 150ms ease",
          }}>{label}</button>
        ))}
      </div>
      <div className="page-content">
        {/* ── 系統設定 ── */}
        {activeTab === "settings" && (
          <div>
            <div className="card" style={{ marginBottom: "16px" }}>
              <div style={{ fontWeight: 700, marginBottom: "12px" }}>📊 Google Sheets 設定</div>
              <label className="text-xs text-muted" style={{ display: "block", marginBottom: "4px" }}>試算表 ID（從 URL 取得）</label>
              <input type="text" value={sheetId} placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
                onChange={(e) => setSheetIdState(e.target.value)}
                style={{ width: "100%", padding: "10px 12px", borderRadius: "var(--r-md)", border: "1px solid var(--border)", background: "var(--surface-2)", fontSize: "0.875rem", fontFamily: "monospace", marginBottom: "8px" }}
              />
              <div className="text-xs text-muted">URL 格式：docs.google.com/spreadsheets/d/<strong>試算表ID</strong>/edit</div>
              <div className="text-xs text-muted mt-1">⚠️ 試算表需設為「知道連結的任何人皆可檢視」</div>
              <button className="btn btn-secondary w-full mt-3" onClick={handleSync} disabled={syncing || !sheetId}>
                {syncing ? "⏳ 同步中..." : "↻ 立即同步教材"}
              </button>
            </div>
            <div className="card" style={{ marginBottom: "16px" }}>
              <div style={{ fontWeight: 700, marginBottom: "8px" }}>📋 Sheets 工作表格式</div>
              <div style={{ fontFamily: "monospace", fontSize: "0.75rem", background: "var(--surface-2)", padding: "10px", borderRadius: "var(--r-sm)", lineHeight: 1.8, overflowX: "auto" }}>
                <div><strong>Vocabulary</strong>：Word | Meaning | PartOfSpeech | Example | ExampleChinese | Synonyms | Root | Level | Deck</div>
                <div><strong>Assignments</strong>：User | Deck | Enabled | Order</div>
              </div>
            </div>
            <div className="card">
              <div style={{ fontWeight: 700, marginBottom: "12px" }}>🔐 修改 PIN 碼</div>
              {users.filter(u => ADMIN_IDS.includes(u.id)).map((u) => (
                <div key={u.id} style={{ marginBottom: "12px" }}>
                  <div className="text-sm" style={{ fontWeight: 600, marginBottom: "4px" }}>{u.id === "mom" ? "👩" : "👨"} {u.name}</div>
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
              ))}
            </div>
          </div>
        )}
        {/* ── 用戶管理 ── */}
        {activeTab === "users" && (
          <div>
            {users.map((u, idx) => (
              <div key={u.id} className="card" style={{ marginBottom: "16px" }}>
                <div style={{ fontWeight: 700, marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "1.5rem" }}>{u.id === "brother1" ? "👦" : u.id === "brother2" ? "👦" : u.id === "mom" ? "👩" : "👨"}</span>
                  {u.name}
                  <span className={`badge ${u.role === "admin" ? "badge-blue" : "badge-green"}`}>{u.role === "admin" ? "管理者" : "學習者"}</span>
                </div>
                <label className="text-xs text-muted" style={{ display: "block", marginBottom: "4px" }}>顯示名稱</label>
                <input type="text" value={u.name} onChange={(e) => { const n = [...users]; n[idx] = { ...u, name: e.target.value }; setUsers(n); }}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: "var(--r-md)", border: "1px solid var(--border)", background: "var(--surface-2)", marginBottom: "10px", fontSize: "0.9375rem" }}
                />
                <label className="text-xs text-muted" style={{ display: "block", marginBottom: "4px" }}>大頭照 URL（Google Drive 公開連結）</label>
                <input type="text" value={u.photoUrl} placeholder="https://drive.google.com/uc?id=..."
                  onChange={(e) => { const n = [...users]; n[idx] = { ...u, photoUrl: e.target.value }; setUsers(n); }}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: "var(--r-md)", border: "1px solid var(--border)", background: "var(--surface-2)", fontSize: "0.875rem", fontFamily: "monospace" }}
                />
              </div>
            ))}
            <div className="card">
              <div style={{ fontWeight: 700, marginBottom: "8px" }}>💡 牌組指派</div>
              <div className="text-sm text-muted">牌組指派請直接在 Google Sheets 的 Assignments 工作表中設定：</div>
              <div style={{ fontFamily: "monospace", fontSize: "0.8125rem", background: "var(--surface-2)", padding: "10px", borderRadius: "var(--r-sm)", marginTop: "8px", lineHeight: 1.8 }}>
                User | Deck | Enabled | Order<br />
                哥哥 | 國中1200 | TRUE | 1<br />
                弟弟 | 國小500 | TRUE | 1<br />
                媽媽 | TOEIC | TRUE | 1
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
