"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UserConfig } from "@/lib/types";
import {
  getUserConfigs, saveUserConfigs, verifyPin, setPin, hashPin,
  getSheetId, saveSheetId,
} from "@/lib/storage";

type AdminPhase = "pin" | "dashboard";

const ADMIN_USERS = ["mom", "dad"];

export default function AdminPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<AdminPhase>("pin");
  const [selectedAdmin, setSelectedAdmin] = useState<string>("");
  const [pin, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");
  const [users, setUsers] = useState<UserConfig[]>([]);
  const [sheetId, setSheetIdState] = useState("");
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<"users" | "decks" | "settings">("users");

  useEffect(() => {
    setUsers(getUserConfigs());
    setSheetIdState(getSheetId());
  }, []);

  const handlePinSubmit = () => {
    if (!selectedAdmin) { setPinError("請先選擇管理者"); return; }
    if (verifyPin(selectedAdmin, pin)) {
      setPhase("dashboard");
      setPinError("");
    } else {
      setPinError("PIN 碼錯誤，請再試一次");
      setPinInput("");
    }
  };

  const handleSave = () => {
    saveUserConfigs(users);
    saveSheetId(sheetId);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // ── PIN 登入畫面 ──────────────────────────────────────
  if (phase === "pin") {
    const adminUsers = users.filter((u) => ADMIN_USERS.includes(u.id));
    return (
      <div className="page" style={{ alignItems: "center", justifyContent: "center", padding: "40px 24px" }}>
        <div style={{ width: "100%", maxWidth: "360px" }}>
          <div style={{ textAlign: "center", marginBottom: "32px" }}>
            <div style={{ fontSize: "2.5rem" }}>🔐</div>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginTop: "12px" }}>後台管理</h1>
            <p className="text-muted text-sm mt-1">請選擇管理者並輸入 PIN 碼</p>
          </div>

          {/* 管理者選擇 */}
          <div style={{ display: "flex", gap: "12px", marginBottom: "20px" }}>
            {adminUsers.map((u) => (
              <button
                key={u.id}
                onClick={() => setSelectedAdmin(u.id)}
                style={{
                  flex: 1,
                  padding: "14px",
                  borderRadius: "var(--r-lg)",
                  border: "2px solid",
                  borderColor: selectedAdmin === u.id ? "var(--blue)" : "var(--border)",
                  background: selectedAdmin === u.id ? "var(--blue-light)" : "var(--surface)",
                  color: selectedAdmin === u.id ? "var(--blue)" : "var(--text)",
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "all 150ms ease",
                }}
              >
                <div style={{ fontSize: "1.5rem", marginBottom: "4px" }}>{u.id === "mom" ? "👩" : "👨"}</div>
                {u.name}
              </button>
            ))}
          </div>

          {/* PIN 輸入 */}
          <div style={{ marginBottom: "16px" }}>
            <div style={{ display: "flex", justifyContent: "center", gap: "12px", marginBottom: "16px" }}>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "var(--r-md)",
                  border: "2px solid",
                  borderColor: pin.length > i ? "var(--blue)" : "var(--border)",
                  background: pin.length > i ? "var(--blue-light)" : "var(--surface-2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.5rem",
                }}>
                  {pin.length > i ? "●" : ""}
                </div>
              ))}
            </div>

            {/* 數字鍵盤 */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, "del"].map((num, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    if (num === null) return;
                    if (num === "del") { setPinInput((p) => p.slice(0, -1)); return; }
                    if (pin.length < 4) setPinInput((p) => p + num.toString());
                  }}
                  disabled={num === null}
                  style={{
                    height: "56px",
                    borderRadius: "var(--r-md)",
                    background: num === "del" ? "var(--surface-2)" : num === null ? "transparent" : "var(--surface)",
                    border: "1px solid",
                    borderColor: num === null ? "transparent" : "var(--border)",
                    fontSize: num === "del" ? "1rem" : "1.25rem",
                    fontWeight: 600,
                    cursor: num === null ? "default" : "pointer",
                    color: "var(--text)",
                    boxShadow: num !== null && num !== "del" ? "var(--shadow-sm)" : "none",
                    transition: "all 150ms ease",
                  }}
                >
                  {num === "del" ? "⌫" : num ?? ""}
                </button>
              ))}
            </div>
          </div>

          {pinError && (
            <div style={{ textAlign: "center", color: "var(--again)", fontSize: "0.875rem", marginBottom: "12px" }}>
              {pinError}
            </div>
          )}

          <button
            className="btn btn-primary w-full"
            style={{ borderRadius: "var(--r-lg)", padding: "16px" }}
            onClick={handlePinSubmit}
            disabled={pin.length < 4 || !selectedAdmin}
          >
            登入
          </button>

          <button className="btn btn-ghost w-full mt-2" onClick={() => router.push("/")}>
            返回首頁
          </button>

          <p className="text-xs text-muted text-center mt-3">
            首次使用預設 PIN：0000（請登入後修改）
          </p>
        </div>
      </div>
    );
  }

  // ── 後台儀錶板 ────────────────────────────────────────
  return (
    <div className="page">
      <div className="page-header">
        <button className="btn-icon" onClick={() => router.push("/")}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700 }}>後台管理</div>
          <div className="text-xs text-muted">{users.find(u => u.id === selectedAdmin)?.name}</div>
        </div>
        <button
          className="btn btn-primary"
          style={{ padding: "8px 16px", fontSize: "0.875rem" }}
          onClick={handleSave}
        >
          {saved ? "✓ 已儲存" : "儲存"}
        </button>
      </div>

      {/* Tab 選單 */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--border)", padding: "0 16px" }}>
        {([["users", "👥 用戶"], ["decks", "📚 牌組"], ["settings", "⚙️ 設定"]] as const).map(([tab, label]) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "12px 16px",
              fontSize: "0.875rem",
              fontWeight: activeTab === tab ? 700 : 400,
              color: activeTab === tab ? "var(--blue)" : "var(--text-muted)",
              borderBottom: "2px solid",
              borderColor: activeTab === tab ? "var(--blue)" : "transparent",
              marginBottom: "-1px",
              cursor: "pointer",
              transition: "all 150ms ease",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="page-content">
        {/* ── 用戶管理 ── */}
        {activeTab === "users" && (
          <div>
            {users.map((u, idx) => (
              <div key={u.id} className="card" style={{ marginBottom: "16px" }}>
                <div style={{ fontWeight: 700, marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "1.5rem" }}>{u.id === "brother1" ? "👦" : u.id === "brother2" ? "👦" : u.id === "mom" ? "👩" : "👨"}</span>
                  {u.name}
                  <span className={`badge ${u.role === "admin" ? "badge-blue" : "badge-green"}`}>
                    {u.role === "admin" ? "管理者" : "學習者"}
                  </span>
                </div>

                <label className="text-xs text-muted" style={{ display: "block", marginBottom: "4px" }}>顯示名稱</label>
                <input
                  type="text"
                  value={u.name}
                  onChange={(e) => {
                    const newUsers = [...users];
                    newUsers[idx] = { ...u, name: e.target.value };
                    setUsers(newUsers);
                  }}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: "var(--r-md)", border: "1px solid var(--border)", background: "var(--surface-2)", marginBottom: "10px", fontSize: "0.9375rem" }}
                />

                <label className="text-xs text-muted" style={{ display: "block", marginBottom: "4px" }}>大頭照 URL（Google Drive 公開連結）</label>
                <input
                  type="text"
                  value={u.photoUrl}
                  placeholder="https://drive.google.com/uc?id=..."
                  onChange={(e) => {
                    const newUsers = [...users];
                    newUsers[idx] = { ...u, photoUrl: e.target.value };
                    setUsers(newUsers);
                  }}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: "var(--r-md)", border: "1px solid var(--border)", background: "var(--surface-2)", marginBottom: "10px", fontSize: "0.875rem", fontFamily: "monospace" }}
                />

                {u.role === "admin" && (
                  <div>
                    <label className="text-xs text-muted" style={{ display: "block", marginBottom: "4px" }}>新 PIN 碼（4 位數字）</label>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <input
                        type="password"
                        maxLength={4}
                        placeholder="輸入新 PIN"
                        id={`pin-${u.id}`}
                        style={{ flex: 1, padding: "10px 12px", borderRadius: "var(--r-md)", border: "1px solid var(--border)", background: "var(--surface-2)", fontSize: "0.9375rem" }}
                      />
                      <button
                        className="btn btn-secondary"
                        onClick={() => {
                          const el = document.getElementById(`pin-${u.id}`) as HTMLInputElement;
                          if (el?.value?.length === 4) {
                            setPin(u.id, el.value);
                            el.value = "";
                            alert(`${u.name} 的 PIN 已更新`);
                          }
                        }}
                      >
                        更新
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── 牌組指派 ── */}
        {activeTab === "decks" && (
          <div>
            {users.map((u) => (
              <div key={u.id} className="card" style={{ marginBottom: "16px" }}>
                <div style={{ fontWeight: 700, marginBottom: "12px" }}>{u.name} 的指派牌組</div>
                <label className="text-xs text-muted" style={{ display: "block", marginBottom: "4px" }}>
                  牌組名稱（以逗號分隔，例：Unit1, Unit2, Advanced）
                </label>
                <textarea
                  value={u.assignedDecks.join(", ")}
                  rows={3}
                  onChange={(e) => {
                    const decks = e.target.value.split(",").map((d) => d.trim()).filter(Boolean);
                    const newUsers = users.map((usr) => usr.id === u.id ? { ...usr, assignedDecks: decks } : usr);
                    setUsers(newUsers);
                  }}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: "var(--r-md)", border: "1px solid var(--border)", background: "var(--surface-2)", resize: "vertical", fontSize: "0.9375rem" }}
                />
                <div className="text-xs text-muted mt-2">
                  ⚠️ 請確保 Google Sheets Assignments 中有對應設定
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── 系統設定 ── */}
        {activeTab === "settings" && (
          <div>
            <div className="card" style={{ marginBottom: "16px" }}>
              <div style={{ fontWeight: 700, marginBottom: "12px" }}>📊 Google Sheets 設定</div>
              <label className="text-xs text-muted" style={{ display: "block", marginBottom: "4px" }}>
                試算表 ID（從 Google Sheets URL 中取得）
              </label>
              <input
                type="text"
                value={sheetId}
                placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
                onChange={(e) => setSheetIdState(e.target.value)}
                style={{ width: "100%", padding: "10px 12px", borderRadius: "var(--r-md)", border: "1px solid var(--border)", background: "var(--surface-2)", fontSize: "0.875rem", fontFamily: "monospace", marginBottom: "8px" }}
              />
              <div className="text-xs text-muted">
                URL 格式：docs.google.com/spreadsheets/d/<strong>[試算表ID]</strong>/edit
              </div>
              <div className="text-xs text-muted mt-2">
                ⚠️ 試算表需設定為「知道連結的任何人皆可檢視」
              </div>
            </div>

            <div className="card" style={{ marginBottom: "16px" }}>
              <div style={{ fontWeight: 700, marginBottom: "8px" }}>📋 需要的工作表名稱</div>
              {["Vocabulary", "Assignments", "Users"].map((name) => (
                <div key={name} style={{ padding: "8px 0", borderBottom: "1px solid var(--border)", fontSize: "0.875rem", display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontFamily: "monospace" }}>{name}</span>
                  <span className="badge badge-blue">sheet</span>
                </div>
              ))}
            </div>

            <div className="card">
              <div style={{ fontWeight: 700, marginBottom: "8px" }}>CSV 欄位格式（Vocabulary）</div>
              <div style={{ fontFamily: "monospace", fontSize: "0.75rem", background: "var(--surface-2)", padding: "10px", borderRadius: "var(--r-sm)", lineHeight: 1.8, overflowX: "auto" }}>
                Word | Meaning | PartOfSpeech | Example | ExampleChinese | Synonyms | Root | Level | Deck
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
