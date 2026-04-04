import { useState, useEffect, useCallback } from "react";

// 【重要】新しいデプロイURLに差し替え済み
const GAS_URL =
  "https://script.google.com/macros/s/AKfycbwMdnafA0BNM0TlTPhp7nQcrT58cL44KbZfdYuZaeYxQiy_bwCvyrbDShN6WWAOUFu3/exec";

const HOURS_PER_DAY = 7.75; // 1日の労働時間（有給用）
const NS_HOURS_PER_DAY = 8.0; // 看護休暇は1日8時間換算

const defaultSettings = {
  user1: "ともひろ",
  user2: "もえ",
  annualDays1: 40,
  annualDays2: 40,
  nsDays1: 7,
  nsDays2: 7,
  units: "0.5, 1.0, 2.0, 3.0, 4.0, 7.75, 8.0",
};

function parseUnits(str) {
  return str
    .split(",")
    .map((s) => parseFloat(s.trim()))
    .filter((n) => !isNaN(n) && n > 0)
    .sort((a, b) => a - b);
}

function formatVacationHours(totalHours) {
  const days = Math.floor(totalHours / HOURS_PER_DAY);
  const hours = Math.round((totalHours % HOURS_PER_DAY) * 100) / 100;
  if (days === 0) return `${hours}時間`;
  if (hours === 0) return `${days}日`;
  return `${days}日と${hours}時間`;
}

function formatNursingHours(totalHours) {
  const days = Math.floor(totalHours / NS_HOURS_PER_DAY);
  const hours = Math.round((totalHours % NS_HOURS_PER_DAY) * 100) / 100;
  if (days === 0) return `${hours}時間`;
  if (hours === 0) return `${days}日`;
  return `${days}日と${hours}時間`;
}

const TABS = ["入力", "残日数", "履歴", "設定"];
const TAB_ICONS = ["✏️", "📊", "📋", "⚙️"];
const VAC_TYPES = ["有給", "看護"];

export default function App() {
  const [tab, setTab] = useState(1);
  const [settings, setSettings] = useState(defaultSettings);
  const [records, setRecords] = useState([]);
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    user: "",
    type: "有給",
    hours: "",
  });
  const [saveMsg, setSaveMsg] = useState("");
  const [deleteId, setDeleteId] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const res = await fetch(GAS_URL);
      const data = await res.json();
      if (data.settings && Object.keys(data.settings).length > 0) {
        setSettings({ ...defaultSettings, ...data.settings });
      }
      setRecords(data.records.sort((a, b) => b.id - a.id));
    } catch (e) {
      console.error("Sync failed", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!loading) {
      const units = parseUnits(settings.units);
      setForm((f) => ({
        ...f,
        user: settings.user1,
        hours: units.length > 0 ? units[0].toString() : "",
      }));
    }
  }, [loading, settings.user1, settings.units]);

  const saveRecord = async () => {
    if (!form.date || !form.user || !form.type || !form.hours) return;
    setSaveMsg("送信中...");
    const newRecord = {
      type: "saveRecord",
      id: Date.now(),
      date: form.date,
      user: form.user,
      vac_type: form.type,
      hours: parseFloat(form.hours),
    };
    try {
      await fetch(GAS_URL, { method: "POST", body: JSON.stringify(newRecord) });
      await loadData();
      setSaveMsg("保存完了！");
    } catch (e) {
      setSaveMsg("エラー発生");
    } finally {
      setTimeout(() => setSaveMsg(""), 2000);
    }
  };

  const handleSaveSettings = async () => {
    setSaveMsg("同期中...");
    try {
      await fetch(GAS_URL, {
        method: "POST",
        body: JSON.stringify({ type: "saveSettings", data: settings }),
      });
      await loadData();
      setSaveMsg("設定を保存しました！");
    } catch (e) {
      setSaveMsg("保存失敗");
    } finally {
      setTimeout(() => setSaveMsg(""), 2000);
    }
  };

  const deleteRecord = async (id) => {
    setSaveMsg("削除中...");
    try {
      await fetch(GAS_URL, {
        method: "POST",
        body: JSON.stringify({ type: "deleteRecord", id: id }),
      });
      await loadData();
      setDeleteId(null);
      setSaveMsg("削除しました");
    } catch (e) {
      setSaveMsg("削除失敗");
    } finally {
      setTimeout(() => setSaveMsg(""), 2000);
    }
  };

  const getUsedHours = (userName, type) =>
    records
      .filter((r) => r.user === userName && r.vac_type === type)
      .reduce((acc, r) => acc + r.hours, 0);

  const userData = [
    {
      name: settings.user1,
      vac: {
        used: getUsedHours(settings.user1, "有給"),
        total: settings.annualDays1 * HOURS_PER_DAY,
        color: "#3a7d5e",
      },
      ns: {
        used: getUsedHours(settings.user1, "看護"),
        total: settings.nsDays1 * NS_HOURS_PER_DAY,
        color: "#c0392b",
      },
    },
    {
      name: settings.user2,
      vac: {
        used: getUsedHours(settings.user2, "有給"),
        total: settings.annualDays2 * HOURS_PER_DAY,
        color: "#4f9a7f",
      },
      ns: {
        used: getUsedHours(settings.user2, "看護"),
        total: settings.nsDays2 * NS_HOURS_PER_DAY,
        color: "#e74c3c",
      },
    },
  ];

  if (loading) return <div style={S.loadingScreen}>読み込み中...</div>;

  return (
    <div style={S.app}>
      <header style={S.header}>
        <div style={S.headerInner}>
          <span style={S.headerIcon}>🌿</span>
          <h1 style={S.headerTitle}>有給・看護管理</h1>
        </div>
      </header>

      <nav style={S.tabBar}>
        {TABS.map((t, i) => (
          <button
            key={t}
            onClick={() => setTab(i)}
            style={{ ...S.tabBtn, ...(tab === i ? S.tabBtnActive : {}) }}
          >
            <span style={S.tabIcon}>{TAB_ICONS[i]}</span>
            <span>{t}</span>
          </button>
        ))}
      </nav>

      <main style={S.main}>
        {tab === 0 && (
          <div style={S.card}>
            <h2 style={S.cardTitle}>休暇を記録する</h2>
            <label style={S.label}>📅 日付</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              style={S.input}
            />
            <label style={S.label}>👤 利用者</label>
            <div style={S.radioGroup}>
              {[settings.user1, settings.user2].map((u) => (
                <label
                  key={u}
                  style={{
                    ...S.radioLabel,
                    ...(form.user === u ? S.radioLabelActive : {}),
                  }}
                >
                  <input
                    type="radio"
                    checked={form.user === u}
                    onChange={() => setForm({ ...form, user: u })}
                    style={{ display: "none" }}
                  />
                  {u}
                </label>
              ))}
            </div>
            <label style={S.label}>🌿 休暇タイプ</label>
            <div style={S.radioGroup}>
              {VAC_TYPES.map((t) => (
                <label
                  key={t}
                  style={{
                    ...S.radioLabel,
                    ...(form.type === t
                      ? t === "看護"
                        ? S.radioLabelNSActive
                        : S.radioLabelActive
                      : {}),
                  }}
                >
                  <input
                    type="radio"
                    checked={form.type === t}
                    onChange={() => setForm({ ...form, type: t })}
                    style={{ display: "none" }}
                  />
                  {t}
                </label>
              ))}
            </div>
            <label style={S.label}>⏱ 時間</label>
            <select
              value={form.hours}
              onChange={(e) => setForm({ ...form, hours: e.target.value })}
              style={S.select}
            >
              {parseUnits(settings.units).map((u) => (
                <option key={u} value={u}>
                  {u}時間
                </option>
              ))}
            </select>
            <button onClick={saveRecord} style={S.saveBtn}>
              💾 保存
            </button>
          </div>
        )}

        {tab === 1 && (
          <div>
            {userData.map((user) => (
              <div key={user.name} style={S.dashCard}>
                <div style={S.dashName}>{user.name}</div>
                <div style={S.typeBlock}>
                  <div style={S.typeTitle}>🌿 有給</div>
                  <div style={S.dashRemain}>
                    <span style={S.dashRemainLabel}>残り</span>
                    <span style={S.dashRemainValue}>
                      {formatVacationHours(
                        Math.max(0, user.vac.total - user.vac.used)
                      )}
                    </span>
                  </div>
                  <div style={S.progressBg}>
                    <div
                      style={{
                        ...S.progressFill,
                        width: `${Math.min(
                          100,
                          (user.vac.used / user.vac.total) * 100
                        )}%`,
                        background: user.vac.color,
                        transition: "width 0.5s",
                      }}
                    />
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: "#999",
                      textAlign: "right",
                      marginTop: 4,
                    }}
                  >
                    付与: {formatVacationHours(user.vac.total)}
                  </div>
                </div>
                <div style={S.typeBlock}>
                  <div style={S.typeTitleNS}>🏥 看護休暇</div>
                  <div style={S.dashRemainNS}>
                    <span style={S.dashRemainLabelNS}>残り</span>
                    <span style={S.dashRemainValueNS}>
                      {formatNursingHours(
                        Math.max(0, user.ns.total - user.ns.used)
                      )}
                    </span>
                  </div>
                  <div style={S.progressBg}>
                    <div
                      style={{
                        ...S.progressFill,
                        width: `${Math.min(
                          100,
                          (user.ns.used / user.ns.total) * 100
                        )}%`,
                        background: user.ns.color,
                        transition: "width 0.5s",
                      }}
                    />
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: "#999",
                      textAlign: "right",
                      marginTop: 4,
                    }}
                  >
                    付与: {formatNursingHours(user.ns.total)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 2 && (
          <div>
            <h2 style={S.cardTitle}>履歴</h2>
            {records.length === 0 ? (
              <div
                style={{ textAlign: "center", color: "#999", marginTop: 20 }}
              >
                記録がありません
              </div>
            ) : (
              records.slice(0, 10).map((r) => (
                <div key={r.id} style={S.historyRow}>
                  <div style={S.historyLeft}>
                    <div style={{ fontSize: 11, color: "#999" }}>
                      {new Date(r.date).toLocaleDateString()}
                    </div>
                    <div style={{ fontWeight: "600" }}>
                      {r.user}{" "}
                      <span
                        style={{
                          fontSize: 12,
                          color: r.vac_type === "看護" ? "#c0392b" : "#3a7d5e",
                        }}
                      >
                        ({r.vac_type})
                      </span>
                    </div>
                  </div>
                  <div style={S.historyHours}>{r.hours}h</div>
                  <button
                    onClick={() => setDeleteId(r.id)}
                    style={S.deleteToggle}
                  >
                    🗑️
                  </button>
                  {deleteId === r.id && (
                    <button
                      onClick={() => deleteRecord(r.id)}
                      style={S.deleteYes}
                    >
                      確定
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {tab === 3 && (
          <div style={S.card}>
            <h2 style={S.cardTitle}>マスター設定</h2>
            {[1, 2].map((i) => (
              <div
                key={i}
                style={{
                  marginBottom: 20,
                  padding: 10,
                  background: "#f9f9f9",
                  borderRadius: 10,
                }}
              >
                <label style={S.label}>👤 ユーザー{i}の名前</label>
                <input
                  style={S.input}
                  value={settings[`user${i}`]}
                  onChange={(e) =>
                    setSettings({ ...settings, [`user${i}`]: e.target.value })
                  }
                />
                <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                  <div style={{ flex: 1 }}>
                    <label style={S.label}>🌿 有給(日)</label>
                    <input
                      type="number"
                      style={S.input}
                      value={settings[`annualDays${i}`]}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          [`annualDays${i}`]: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={S.label}>🏥 看護(日)</label>
                    <input
                      type="number"
                      style={S.input}
                      value={settings[`nsDays${i}`]}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          [`nsDays${i}`]: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
              </div>
            ))}
            <label style={S.label}>⏱ 時間単位（カンマ区切り）</label>
            <input
              style={S.input}
              value={settings.units}
              onChange={(e) =>
                setSettings({ ...settings, units: e.target.value })
              }
            />
            <button onClick={handleSaveSettings} style={S.saveBtn}>
              ✅ 設定を保存
            </button>
          </div>
        )}
      </main>
      {saveMsg && <div style={S.successMsg}>{saveMsg}</div>}
    </div>
  );
}

const S = {
  app: {
    minHeight: "100vh",
    background: "#f5f7f2",
    fontFamily: "sans-serif",
    maxWidth: 480,
    margin: "0 auto",
    paddingBottom: 24,
    color: "#333",
  },
  loadingScreen: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    height: "100vh",
    color: "#666",
  },
  header: {
    background: "linear-gradient(135deg, #3a7d5e, #4f9a7f)",
    padding: "16px 20px",
    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
  },
  headerInner: { display: "flex", alignItems: "center", gap: 10 },
  headerIcon: { fontSize: 24 },
  headerTitle: { color: "#fff", margin: 0, fontSize: 20, fontWeight: "700" },
  tabBar: {
    display: "flex",
    background: "#fff",
    position: "sticky",
    top: 0,
    zIndex: 10,
    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
  },
  tabBtn: {
    flex: 1,
    border: "none",
    background: "transparent",
    padding: "12px",
    fontSize: 11,
    color: "#999",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    outline: "none",
    WebkitTapHighlightColor: "transparent",
  },
  tabBtnActive: { color: "#3a7d5e", fontWeight: "700" },
  tabIcon: { fontSize: 20, marginBottom: 2 },
  main: { padding: "20px 16px" },
  card: {
    background: "#fff",
    borderRadius: 16,
    padding: "20px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
  },
  cardTitle: {
    fontSize: 18,
    margin: "0 0 15px",
    color: "#2c4a35",
    fontWeight: "700",
  },
  label: {
    display: "block",
    fontSize: 12,
    color: "#666",
    marginBottom: 5,
    fontWeight: "600",
  },
  input: {
    width: "100%",
    padding: "12px",
    borderRadius: 10,
    border: "1px solid #dde8dd",
    boxSizing: "border-box",
    fontSize: 15,
  },
  select: {
    width: "100%",
    padding: "12px",
    borderRadius: 10,
    border: "1px solid #dde8dd",
    background: "#fafffe",
    fontSize: 15,
  },
  radioGroup: { display: "flex", gap: 10, marginBottom: 15 },
  radioLabel: {
    flex: 1,
    textAlign: "center",
    padding: "12px",
    borderRadius: 10,
    border: "1px solid #dde8dd",
    background: "#fff",
    fontSize: 14,
    cursor: "pointer",
    transition: "0.2s",
  },
  radioLabelActive: {
    background: "#e8f5ef",
    border: "1px solid #4f9a7f",
    color: "#2c6e4f",
    fontWeight: "700",
  },
  radioLabelNSActive: {
    background: "#fdf1f1",
    border: "1px solid #c0392b",
    color: "#9c2c2c",
    fontWeight: "700",
  },
  saveBtn: {
    width: "100%",
    marginTop: 20,
    padding: "16px",
    borderRadius: 12,
    border: "none",
    background: "linear-gradient(135deg, #3a7d5e, #4f9a7f)",
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
    cursor: "pointer",
  },
  successMsg: {
    position: "fixed",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    padding: "20px 30px",
    background: "rgba(0,0,0,0.85)",
    color: "#fff",
    borderRadius: 15,
    zIndex: 100,
    textAlign: "center",
  },
  dashCard: {
    background: "#fff",
    borderRadius: 20,
    padding: "20px",
    marginBottom: 15,
    boxShadow: "0 4px 15px rgba(0,0,0,0.05)",
  },
  dashName: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 15,
    borderBottom: "1px solid #eee",
    paddingBottom: 10,
  },
  typeBlock: { marginBottom: 20 },
  typeTitle: {
    fontSize: 13,
    color: "#3a7d5e",
    marginBottom: 5,
    fontWeight: "700",
  },
  typeTitleNS: {
    fontSize: 13,
    color: "#c0392b",
    marginBottom: 5,
    fontWeight: "700",
  },
  dashRemain: { display: "flex", alignItems: "baseline", gap: 5 },
  dashRemainLabel: { fontSize: 12, color: "#888" },
  dashRemainValue: { fontSize: 26, fontWeight: "800", color: "#2c4a35" },
  dashRemainLabelNS: { fontSize: 12, color: "#888" },
  dashRemainValueNS: { fontSize: 26, fontWeight: "800", color: "#9c2c2c" },
  progressBg: {
    height: 10,
    borderRadius: 5,
    background: "#f0f0f0",
    overflow: "hidden",
    marginTop: 8,
  },
  progressFill: { height: "100%" },
  historyRow: {
    background: "#fff",
    padding: "15px",
    borderRadius: 12,
    marginBottom: 8,
    display: "flex",
    alignItems: "center",
    boxShadow: "0 2px 4px rgba(0,0,0,0.03)",
  },
  historyLeft: { flex: 1 },
  historyHours: {
    fontSize: 18,
    fontWeight: "800",
    color: "#3a7d5e",
    marginRight: 15,
  },
  deleteToggle: {
    border: "none",
    background: "none",
    fontSize: 18,
    cursor: "pointer",
    opacity: 0.3,
  },
  deleteYes: {
    background: "#c0392b",
    color: "#fff",
    border: "none",
    padding: "6px 12px",
    borderRadius: 6,
    fontSize: 12,
    fontWeight: "700",
    marginLeft: 10,
  },
};
