import { useState, useEffect, useMemo, useCallback } from "react";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, Legend } from "recharts";
import { Bell, List, Calendar, Users, TrendingUp, AlertTriangle, CheckCircle, Clock, Search, Mic, Image, DollarSign, Activity, Eye, ArrowUp, ArrowDown, Zap, Shield, MessageCircle, BarChart3, RefreshCw, Wifi, WifiOff, Apple, Globe } from "lucide-react";

// ─── API Configuration ───────────────────────
const API_BASE = "http://localhost:3001/api";

const apiFetch = async (endpoint) => {
  try {
    const res = await fetch(`${API_BASE}${endpoint}`);
    if (!res.ok) throw new Error(`API ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error(`API Error [${endpoint}]:`, err);
    return null;
  }
};

// ─── Theme ───────────────────────────────────
const C = {
  bg: "#0a0e17", surface: "#111827", surfaceHover: "#1a2235",
  border: "#1e293b", borderLight: "#334155",
  text: "#e2e8f0", textMuted: "#94a3b8", textDim: "#64748b",
  accent: "#06b6d4", pro: "#a855f7", basic: "#3b82f6", ultimate: "#f59e0b",
  success: "#10b981", warning: "#f59e0b", danger: "#ef4444",
  chart1: "#06b6d4", chart2: "#a855f7", chart3: "#f59e0b", chart4: "#10b981", chart5: "#ec4899", chart6: "#3b82f6",
};

const TOOL_COLORS = {
  Reminders: "#06b6d4", Lists: "#a855f7", Calendar: "#f59e0b", Expenses: "#10b981",
  "Web Search": "#ec4899", "Voice Notes": "#3b82f6", Contacts: "#f97316",
  "Image Analysis": "#8b5cf6", "Food Tracking": "#22d3ee",
};

const TOOL_ICONS = {
  Reminders: Bell, Lists: List, Calendar: Calendar, Expenses: DollarSign,
  "Web Search": Search, "Voice Notes": Mic, Contacts: Users,
  "Image Analysis": Image, "Food Tracking": Apple,
};

const PLAN_COLORS = { basic: C.basic, pro: C.pro, ultimate: C.ultimate };

// ─── Reusable Components ─────────────────────

const StatCard = ({ label, value, sub, icon: Icon, color = C.accent, trend, trendValue }) => (
  <div style={{
    background: `linear-gradient(135deg, ${C.surface} 0%, ${C.surfaceHover} 100%)`,
    border: `1px solid ${C.border}`, borderRadius: 16, padding: "20px 24px",
    position: "relative", overflow: "hidden",
  }}>
    <div style={{ position: "absolute", top: -20, right: -20, width: 80, height: 80, borderRadius: "50%", background: `${color}08` }} />
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
      <div style={{
        width: 40, height: 40, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center",
        background: `${color}15`, border: `1px solid ${color}30`,
      }}>
        {Icon && <Icon size={20} color={color} />}
      </div>
      {trend && (
        <div style={{
          display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600,
          color: trend === "up" ? C.success : C.danger,
          background: trend === "up" ? `${C.success}15` : `${C.danger}15`,
          padding: "3px 8px", borderRadius: 8,
        }}>
          {trend === "up" ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
          {trendValue}
        </div>
      )}
    </div>
    <div style={{ fontSize: 32, fontWeight: 700, color: C.text, letterSpacing: "-0.02em", fontFamily: "'JetBrains Mono', monospace" }}>
      {typeof value === "number" ? value.toLocaleString() : value}
    </div>
    <div style={{ fontSize: 13, color: C.textMuted, marginTop: 4, fontWeight: 500 }}>{label}</div>
    {sub && <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>{sub}</div>}
  </div>
);

const SeverityBadge = ({ severity }) => {
  const cfg = {
    high: { bg: `${C.danger}20`, color: C.danger, border: `${C.danger}40` },
    medium: { bg: `${C.warning}20`, color: C.warning, border: `${C.warning}40` },
    low: { bg: `${C.success}20`, color: C.success, border: `${C.success}40` },
  };
  const c = cfg[severity] || cfg.low;
  return <span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>{severity}</span>;
};

const StatusBadge = ({ status }) => {
  const cfg = { open: { bg: `${C.danger}15`, color: C.danger }, reviewing: { bg: `${C.warning}15`, color: C.warning }, resolved: { bg: `${C.success}15`, color: C.success } };
  const c = cfg[status] || cfg.open;
  return <span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: c.bg, color: c.color }}>{status}</span>;
};

const PlanBadge = ({ plan }) => {
  const color = PLAN_COLORS[plan] || C.basic;
  return <span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", background: `${color}20`, color, border: `1px solid ${color}40` }}>{plan}</span>;
};

const TabButton = ({ active, onClick, children }) => (
  <button onClick={onClick} style={{
    padding: "8px 18px", borderRadius: 10, border: "none", cursor: "pointer",
    fontSize: 13, fontWeight: 600, transition: "all 0.2s",
    background: active ? C.accent : "transparent", color: active ? "#000" : C.textMuted,
  }}>{children}</button>
);

const SectionTitle = ({ icon: Icon, children, right }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {Icon && <Icon size={20} color={C.accent} />}
      <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, margin: 0 }}>{children}</h2>
    </div>
    {right}
  </div>
);

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 14px", boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}>
      <div style={{ fontSize: 12, color: C.textDim, marginBottom: 6 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ fontSize: 13, color: p.color || C.text, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: p.color || C.accent, display: "inline-block" }} />
          {p.name}: {p.value?.toLocaleString()}
        </div>
      ))}
    </div>
  );
};

const LoadingSpinner = () => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
    <RefreshCw size={24} color={C.accent} style={{ animation: "spin 1s linear infinite" }} />
    <span style={{ marginLeft: 10, color: C.textMuted, fontSize: 14 }}>Loading data...</span>
  </div>
);

// ─── Main Dashboard ──────────────────────────

export default function YayaDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [timePeriod, setTimePeriod] = useState("today");
  const [now, setNow] = useState(new Date());
  const [connected, setConnected] = useState(null); // null = checking, true/false
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);

  // ─── Data State ────────────────────────────
  const [overview, setOverview] = useState(null);
  const [activityTrend, setActivityTrend] = useState([]);
  const [hourlyActivity, setHourlyActivity] = useState([]);
  const [topUsers, setTopUsers] = useState({ today: [], week: [], month: [] });
  const [toolUsage, setToolUsage] = useState({ today: [], week: [], month: [] });
  const [toolTrend, setToolTrend] = useState([]);
  const [toolByPlan, setToolByPlan] = useState([]);
  const [qaIssues, setQaIssues] = useState([]);
  const [qaSummary, setQaSummary] = useState(null);
  const [userGrowth, setUserGrowth] = useState([]);
  const [languages, setLanguages] = useState([]);

  // ─── Fetch All Data ────────────────────────
  const fetchAllData = useCallback(async () => {
    setLoading(true);

    // Health check
    const health = await apiFetch("/health");
    if (!health) {
      setConnected(false);
      setLoading(false);
      return;
    }
    setConnected(true);

    // Parallel fetch
    const [
      overviewData,
      trendData,
      hourlyData,
      topToday,
      topWeek,
      topMonth,
      toolToday,
      toolWeek,
      toolMonth,
      toolTrendData,
      toolPlanData,
      qaIssueData,
      qaSumData,
      growthData,
      langData,
    ] = await Promise.all([
      apiFetch("/metrics/overview"),
      apiFetch("/metrics/activity-trend"),
      apiFetch("/metrics/hourly-activity"),
      apiFetch("/metrics/top-users?period=today"),
      apiFetch("/metrics/top-users?period=week"),
      apiFetch("/metrics/top-users?period=month"),
      apiFetch("/metrics/tool-usage?period=today"),
      apiFetch("/metrics/tool-usage?period=week"),
      apiFetch("/metrics/tool-usage?period=month"),
      apiFetch("/metrics/tool-trend"),
      apiFetch("/metrics/tool-usage-by-plan"),
      apiFetch("/qa/issues?limit=20"),
      apiFetch("/qa/summary"),
      apiFetch("/metrics/user-growth"),
      apiFetch("/metrics/languages"),
    ]);

    if (overviewData) setOverview(overviewData);
    if (trendData) setActivityTrend(trendData.map(d => ({ ...d, day: new Date(d.day).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) })));
    if (hourlyData) setHourlyActivity(hourlyData.map(d => ({ ...d, hour: `${d.hour}:00`, message_count: parseInt(d.message_count) })));
    if (topToday) setTopUsers(prev => ({ ...prev, today: topToday }));
    if (topWeek) setTopUsers(prev => ({ ...prev, week: topWeek }));
    if (topMonth) setTopUsers(prev => ({ ...prev, month: topMonth }));
    if (toolToday) setToolUsage(prev => ({ ...prev, today: toolToday.map(t => ({ ...t, usage_count: parseInt(t.usage_count) })) }));
    if (toolWeek) setToolUsage(prev => ({ ...prev, week: toolWeek.map(t => ({ ...t, usage_count: parseInt(t.usage_count) })) }));
    if (toolMonth) setToolUsage(prev => ({ ...prev, month: toolMonth.map(t => ({ ...t, usage_count: parseInt(t.usage_count) })) }));
    if (toolTrendData) setToolTrend(toolTrendData);
    if (toolPlanData) setToolByPlan(toolPlanData);
    if (qaIssueData) setQaIssues(Array.isArray(qaIssueData) ? qaIssueData : []);
    if (qaSumData) setQaSummary(qaSumData);
    if (growthData) setUserGrowth(growthData.map(d => ({ ...d, signup_date: new Date(d.signup_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" }), cumulative_users: parseInt(d.cumulative_users), new_users: parseInt(d.new_users) })));
    if (langData) setLanguages(langData);

    setLastRefresh(new Date());
    setLoading(false);
  }, []);

  useEffect(() => { fetchAllData(); }, [fetchAllData]);
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(t); }, []);

  // ─── Derived Data ──────────────────────────
  const currentToolData = toolUsage[timePeriod] || [];
  const currentTopUsers = topUsers[timePeriod] || [];
  const totalToolUsage = currentToolData.reduce((s, t) => s + (t.usage_count || 0), 0);

  const planData = overview?.planDistribution?.map(p => ({
    name: p.plan, value: parseInt(p.user_count), color: PLAN_COLORS[p.plan] || C.textDim,
  })) || [];

  const activeByPlanMap = {};
  (overview?.activeByPlan || []).forEach(p => { activeByPlanMap[p.plan] = p; });

  const openIssues = qaSummary?.open_issues || 0;
  const highSeverity = qaSummary?.high_severity || 0;

  // Build tool usage by plan comparison
  const toolPlanComparison = useMemo(() => {
    const map = {};
    toolByPlan.forEach(row => {
      if (!map[row.tool]) map[row.tool] = { feature: row.tool };
      map[row.tool][row.plan] = parseFloat(row.avg_per_user) || 0;
    });
    return Object.values(map);
  }, [toolByPlan]);

  const tabs = [
    { id: "overview", label: "Overview", icon: Activity },
    { id: "users", label: "Users & Plans", icon: Users },
    { id: "tools", label: "Tool Usage", icon: BarChart3 },
    { id: "quality", label: "AI Quality", icon: Shield },
  ];

  // ─── Connection Error State ────────────────
  if (connected === false) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif" }}>
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <div style={{ textAlign: "center", padding: 40 }}>
          <WifiOff size={48} color={C.danger} style={{ marginBottom: 20 }} />
          <h2 style={{ color: C.text, marginBottom: 8 }}>Cannot Connect to API</h2>
          <p style={{ color: C.textMuted, marginBottom: 24, maxWidth: 400 }}>
            Make sure the Yaya Analytics API server is running on <code style={{ color: C.accent, background: `${C.accent}15`, padding: "2px 8px", borderRadius: 4 }}>localhost:3001</code>
          </p>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, textAlign: "left", maxWidth: 400, margin: "0 auto" }}>
            <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 8 }}>Quick start:</div>
            <code style={{ fontSize: 12, color: C.accent, lineHeight: 2, display: "block" }}>
              npm install express pg cors dotenv<br />
              # Edit .env with your DB password<br />
              node server.js
            </code>
          </div>
          <button onClick={fetchAllData} style={{
            marginTop: 20, padding: "10px 24px", borderRadius: 10, border: "none",
            background: C.accent, color: "#000", fontWeight: 700, cursor: "pointer", fontSize: 14,
          }}>
            <RefreshCw size={14} style={{ marginRight: 6, display: "inline" }} /> Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* ─── Header ─── */}
      <div style={{
        background: `linear-gradient(180deg, ${C.surface} 0%, ${C.bg} 100%)`,
        borderBottom: `1px solid ${C.border}`, padding: "20px 32px",
        position: "sticky", top: 0, zIndex: 100, backdropFilter: "blur(12px)",
      }}>
        <div style={{ maxWidth: 1400, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{
                width: 42, height: 42, borderRadius: 12,
                background: `linear-gradient(135deg, ${C.accent} 0%, ${C.pro} 100%)`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 20, fontWeight: 800, color: "#000",
              }}>Y</div>
              <div>
                <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>Yaya Analytics</h1>
                <div style={{ fontSize: 12, color: C.textDim, fontWeight: 500 }}>AI Monitoring Dashboard — Live Data</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <button onClick={fetchAllData} style={{
                display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 8,
                background: `${C.accent}15`, border: `1px solid ${C.accent}30`, cursor: "pointer", color: C.accent, fontSize: 12, fontWeight: 600,
              }}>
                <RefreshCw size={13} /> Refresh
              </button>
              <div style={{
                display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8,
                background: connected ? `${C.success}15` : `${C.danger}15`,
                border: `1px solid ${connected ? C.success : C.danger}30`,
              }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: connected ? C.success : C.danger, animation: "pulse 2s infinite" }} />
                <span style={{ fontSize: 12, color: connected ? C.success : C.danger, fontWeight: 600 }}>
                  {connected ? "Live" : "Offline"}
                </span>
              </div>
              <div style={{ fontSize: 12, color: C.textDim, fontFamily: "'JetBrains Mono', monospace" }}>
                {now.toLocaleString("en-IL", { dateStyle: "medium", timeStyle: "short" })}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 4, background: `${C.surface}80`, borderRadius: 12, padding: 4, width: "fit-content" }}>
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                display: "flex", alignItems: "center", gap: 7, padding: "9px 18px", borderRadius: 10,
                border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, transition: "all 0.2s",
                background: activeTab === tab.id ? C.accent : "transparent",
                color: activeTab === tab.id ? "#000" : C.textMuted,
              }}>
                <tab.icon size={15} /> {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Content ─── */}
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "28px 32px" }}>
        {loading ? <LoadingSpinner /> : (
          <>
            {/* ════════ OVERVIEW TAB ════════ */}
            {activeTab === "overview" && overview && (
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 28 }}>
                  <StatCard icon={Users} label="Daily Active Users" value={overview.dau}
                    sub={`of ${overview.totalUsers} total users`} color={C.accent} />
                  <StatCard icon={Activity} label="Weekly Active Users" value={overview.wau} color={C.chart4} />
                  <StatCard icon={TrendingUp} label="Monthly Active Users" value={overview.mau} color={C.chart2} />
                  <StatCard icon={MessageCircle} label="Messages Today" value={overview.messagesToday}
                    sub={`Avg ${overview.avgMessagesPerUser} per user`} color={C.chart3} />
                  <StatCard icon={Zap} label="Tool Executions Today" value={totalToolUsage} color={C.chart5} />
                  <StatCard icon={AlertTriangle} label="Open Issues" value={parseInt(openIssues) || 0}
                    sub={`${parseInt(highSeverity) || 0} high severity`}
                    color={openIssues > 0 ? C.danger : C.success} />
                </div>

                {/* Activity Trend + Hourly */}
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginBottom: 28 }}>
                  <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24 }}>
                    <SectionTitle icon={TrendingUp}>User Activity Trend (30 Days)</SectionTitle>
                    {activityTrend.length > 0 ? (
                      <ResponsiveContainer width="100%" height={260}>
                        <AreaChart data={activityTrend}>
                          <defs>
                            <linearGradient id="dauGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={C.accent} stopOpacity={0.3} />
                              <stop offset="100%" stopColor={C.accent} stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                          <XAxis dataKey="day" tick={{ fill: C.textDim, fontSize: 11 }} stroke={C.border} />
                          <YAxis tick={{ fill: C.textDim, fontSize: 11 }} stroke={C.border} />
                          <Tooltip content={<CustomTooltip />} />
                          <Area type="monotone" dataKey="unique_users" stroke={C.accent} fill="url(#dauGrad)" strokeWidth={2.5} name="Active Users" />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : <div style={{ color: C.textDim, textAlign: "center", padding: 40 }}>No activity data yet</div>}
                  </div>

                  <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24 }}>
                    <SectionTitle icon={Clock}>Activity by Hour</SectionTitle>
                    {hourlyActivity.some(h => h.message_count > 0) ? (
                      <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={hourlyActivity}>
                          <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                          <XAxis dataKey="hour" tick={{ fill: C.textDim, fontSize: 10 }} stroke={C.border} interval={3} />
                          <YAxis tick={{ fill: C.textDim, fontSize: 11 }} stroke={C.border} />
                          <Tooltip content={<CustomTooltip />} />
                          <Bar dataKey="message_count" fill={C.accent} radius={[4, 4, 0, 0]} name="Messages" />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : <div style={{ color: C.textDim, textAlign: "center", padding: 40 }}>No messages today yet</div>}
                  </div>
                </div>

                {/* Top User + Top Tools */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24 }}>
                    <SectionTitle icon={Users}>Top User Today</SectionTitle>
                    {topUsers.today.length > 0 ? topUsers.today.slice(0, 1).map((u, i) => (
                      <div key={i} style={{ background: `linear-gradient(135deg, ${C.surfaceHover} 0%, ${C.surface} 100%)`, border: `1px solid ${C.borderLight}`, borderRadius: 14, padding: 20 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <div style={{ width: 48, height: 48, borderRadius: 14, background: `linear-gradient(135deg, ${C.accent}30 0%, ${C.pro}30 100%)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, border: `2px solid ${C.accent}50` }}>👑</div>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 15 }}>{u.name || "Anonymous"}</div>
                              <div style={{ fontSize: 12, color: C.textDim, fontFamily: "'JetBrains Mono', monospace" }}>{u.wa_id?.replace(/(\d{3})\d{4}(\d{3})/, "$1****$2")}</div>
                            </div>
                          </div>
                          <PlanBadge plan={u.plan} />
                        </div>
                        <div style={{ display: "flex", gap: 24, marginTop: 8 }}>
                          <div>
                            <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: C.accent }}>{u.message_count}</div>
                            <div style={{ fontSize: 11, color: C.textDim }}>Messages</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: C.pro }}>{u.tools_used?.length || 0}</div>
                            <div style={{ fontSize: 11, color: C.textDim }}>Tools Used</div>
                          </div>
                        </div>
                        {u.tools_used?.length > 0 && (
                          <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
                            {u.tools_used.map(t => (
                              <span key={t} style={{ padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: `${TOOL_COLORS[t] || C.accent}15`, color: TOOL_COLORS[t] || C.accent }}>{t}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    )) : <div style={{ color: C.textDim, textAlign: "center", padding: 40 }}>No activity today yet</div>}
                  </div>

                  <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24 }}>
                    <SectionTitle icon={Zap}>Top Tools Today</SectionTitle>
                    {currentToolData.length > 0 ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {currentToolData.slice(0, 5).map((t) => {
                          const Icon = TOOL_ICONS[t.tool];
                          const pct = currentToolData[0]?.usage_count > 0 ? (t.usage_count / currentToolData[0].usage_count) * 100 : 0;
                          return (
                            <div key={t.tool} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                              <div style={{ width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: `${TOOL_COLORS[t.tool] || C.accent}15`, flexShrink: 0 }}>
                                {Icon ? <Icon size={16} color={TOOL_COLORS[t.tool]} /> : <Zap size={16} color={C.accent} />}
                              </div>
                              <div style={{ flex: 1 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                                  <span style={{ fontSize: 13, fontWeight: 600 }}>{t.tool}</span>
                                  <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: TOOL_COLORS[t.tool] || C.accent }}>{t.usage_count}</span>
                                </div>
                                <div style={{ height: 6, borderRadius: 3, background: C.border }}>
                                  <div style={{ height: "100%", borderRadius: 3, width: `${pct}%`, background: `linear-gradient(90deg, ${TOOL_COLORS[t.tool] || C.accent}80, ${TOOL_COLORS[t.tool] || C.accent})`, transition: "width 0.8s ease" }} />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : <div style={{ color: C.textDim, textAlign: "center", padding: 40 }}>No tool usage today</div>}
                  </div>
                </div>
              </div>
            )}

            {/* ════════ USERS & PLANS TAB ════════ */}
            {activeTab === "users" && overview && (
              <div>
                <div style={{ display: "grid", gridTemplateColumns: `repeat(${overview.planDistribution?.length + 1 || 4}, 1fr)`, gap: 16, marginBottom: 28 }}>
                  <StatCard icon={Users} label="Total Users" value={overview.totalUsers} color={C.accent} />
                  {overview.planDistribution?.map(p => (
                    <StatCard key={p.plan} icon={p.plan === "pro" ? Zap : Users}
                      label={`${p.plan.charAt(0).toUpperCase() + p.plan.slice(1)} Plan`}
                      value={parseInt(p.user_count)}
                      sub={`${p.percentage}% of total`}
                      color={PLAN_COLORS[p.plan] || C.textDim} />
                  ))}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: 16, marginBottom: 28 }}>
                  {/* Pie Chart */}
                  <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24 }}>
                    <SectionTitle icon={Users}>Plan Distribution</SectionTitle>
                    {planData.length > 0 ? (
                      <>
                        <ResponsiveContainer width="100%" height={280}>
                          <PieChart>
                            <Pie data={planData} dataKey="value" cx="50%" cy="50%" outerRadius={100} innerRadius={60} strokeWidth={0}>
                              {planData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                            </Pie>
                            <Tooltip content={<CustomTooltip />} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div style={{ display: "flex", justifyContent: "center", gap: 20, marginTop: 8, flexWrap: "wrap" }}>
                          {planData.map(p => (
                            <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <div style={{ width: 12, height: 12, borderRadius: 3, background: p.color }} />
                              <span style={{ fontSize: 13, color: C.textMuted }}>{p.name}: <strong style={{ color: C.text }}>{p.value}</strong></span>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : <div style={{ color: C.textDim, textAlign: "center", padding: 40 }}>No data</div>}
                  </div>

                  {/* Tool Usage by Plan */}
                  <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24 }}>
                    <SectionTitle icon={BarChart3}>Avg Tool Usage / User by Plan</SectionTitle>
                    {toolPlanComparison.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={toolPlanComparison} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                          <XAxis type="number" tick={{ fill: C.textDim, fontSize: 11 }} stroke={C.border} />
                          <YAxis dataKey="feature" type="category" tick={{ fill: C.textMuted, fontSize: 12 }} stroke={C.border} width={100} />
                          <Tooltip content={<CustomTooltip />} />
                          <Bar dataKey="basic" fill={C.basic} name="Basic" radius={[0, 4, 4, 0]} barSize={12} />
                          <Bar dataKey="pro" fill={C.pro} name="Pro" radius={[0, 4, 4, 0]} barSize={12} />
                          <Bar dataKey="ultimate" fill={C.ultimate} name="Ultimate" radius={[0, 4, 4, 0]} barSize={12} />
                          <Legend wrapperStyle={{ fontSize: 12, color: C.textMuted }} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : <div style={{ color: C.textDim, textAlign: "center", padding: 40 }}>No data</div>}
                  </div>
                </div>

                {/* User Growth Chart */}
                {userGrowth.length > 0 && (
                  <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, marginBottom: 28 }}>
                    <SectionTitle icon={TrendingUp}>User Growth</SectionTitle>
                    <ResponsiveContainer width="100%" height={250}>
                      <AreaChart data={userGrowth}>
                        <defs>
                          <linearGradient id="growthGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={C.chart4} stopOpacity={0.3} />
                            <stop offset="100%" stopColor={C.chart4} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                        <XAxis dataKey="signup_date" tick={{ fill: C.textDim, fontSize: 10 }} stroke={C.border} />
                        <YAxis tick={{ fill: C.textDim, fontSize: 11 }} stroke={C.border} />
                        <Tooltip content={<CustomTooltip />} />
                        <Area type="monotone" dataKey="cumulative_users" stroke={C.chart4} fill="url(#growthGrad)" strokeWidth={2.5} name="Total Users" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Active Users by Plan & Period */}
                <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, marginBottom: 28 }}>
                  <SectionTitle icon={Activity}>Active Users by Plan &amp; Period</SectionTitle>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
                    {[
                      { label: "Today (DAU)", key: "dau", total: overview.dau },
                      { label: "This Week (WAU)", key: "wau", total: overview.wau },
                      { label: "This Month (MAU)", key: "mau", total: overview.mau },
                    ].map(p => (
                      <div key={p.label} style={{ background: C.surfaceHover, borderRadius: 12, padding: 20, border: `1px solid ${C.border}` }}>
                        <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 12, fontWeight: 600 }}>{p.label}</div>
                        <div style={{ fontSize: 32, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", marginBottom: 12 }}>{p.total}</div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {(overview.activeByPlan || []).map(plan => (
                            <div key={plan.plan} style={{ flex: 1, minWidth: 70, padding: "8px 12px", borderRadius: 8, background: `${PLAN_COLORS[plan.plan] || C.textDim}10`, border: `1px solid ${PLAN_COLORS[plan.plan] || C.textDim}30` }}>
                              <div style={{ fontSize: 18, fontWeight: 700, color: PLAN_COLORS[plan.plan] || C.textDim, fontFamily: "'JetBrains Mono', monospace" }}>{plan[p.key]}</div>
                              <div style={{ fontSize: 11, color: C.textDim }}>{plan.plan}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Language Distribution */}
                {languages.length > 0 && (
                  <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, marginBottom: 28 }}>
                    <SectionTitle icon={Globe}>Language Distribution</SectionTitle>
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                      {languages.map(l => (
                        <div key={l.language} style={{ padding: "12px 20px", borderRadius: 12, background: C.surfaceHover, border: `1px solid ${C.border}`, textAlign: "center" }}>
                          <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: C.accent }}>{parseInt(l.user_count)}</div>
                          <div style={{ fontSize: 12, color: C.textMuted, fontWeight: 600 }}>{l.language}</div>
                          <div style={{ fontSize: 10, color: C.textDim }}>{l.percentage}%</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Top Users Table */}
                <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24 }}>
                  <SectionTitle icon={Users} right={
                    <div style={{ display: "flex", gap: 4, background: C.bg, borderRadius: 10, padding: 3 }}>
                      {["today", "week", "month"].map(p => (
                        <TabButton key={p} active={timePeriod === p} onClick={() => setTimePeriod(p)}>
                          {p === "today" ? "Today" : p === "week" ? "7 Days" : "30 Days"}
                        </TabButton>
                      ))}
                    </div>
                  }>Power Users</SectionTitle>
                  {currentTopUsers.length > 0 ? (
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                          <tr>
                            {["#", "User", "Plan", "Messages", "Tools Used"].map(h => (
                              <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: C.textDim, textTransform: "uppercase", letterSpacing: "0.08em", borderBottom: `1px solid ${C.border}` }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {currentTopUsers.map((u, i) => (
                            <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                              <td style={{ padding: "14px 16px", fontSize: 14, fontWeight: 700, color: i === 0 ? C.accent : C.textMuted, fontFamily: "'JetBrains Mono', monospace" }}>{i === 0 ? "👑" : `#${i + 1}`}</td>
                              <td style={{ padding: "14px 16px" }}>
                                <div style={{ fontWeight: 600, fontSize: 13 }}>{u.name || "Anonymous"}</div>
                                <div style={{ fontSize: 11, color: C.textDim, fontFamily: "'JetBrains Mono', monospace" }}>{u.wa_id?.replace(/(\d{3})\d{4}(\d{3})/, "$1****$2")}</div>
                              </td>
                              <td style={{ padding: "14px 16px" }}><PlanBadge plan={u.plan} /></td>
                              <td style={{ padding: "14px 16px", fontWeight: 700, fontSize: 15, fontFamily: "'JetBrains Mono', monospace", color: C.accent }}>{parseInt(u.message_count).toLocaleString()}</td>
                              <td style={{ padding: "14px 16px" }}>
                                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                                  {(u.tools_used || []).map(t => (
                                    <span key={t} style={{ padding: "3px 8px", borderRadius: 5, fontSize: 10, fontWeight: 600, background: `${TOOL_COLORS[t] || C.accent}15`, color: TOOL_COLORS[t] || C.accent }}>{t}</span>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : <div style={{ color: C.textDim, textAlign: "center", padding: 40 }}>No users in this period</div>}
                </div>
              </div>
            )}

            {/* ════════ TOOL USAGE TAB ════════ */}
            {activeTab === "tools" && (
              <div>
                <div style={{ display: "flex", gap: 4, background: C.surface, borderRadius: 12, padding: 4, width: "fit-content", marginBottom: 24, border: `1px solid ${C.border}` }}>
                  {["today", "week", "month"].map(p => (
                    <TabButton key={p} active={timePeriod === p} onClick={() => setTimePeriod(p)}>
                      {p === "today" ? "Today" : p === "week" ? "7 Days" : "30 Days"}
                    </TabButton>
                  ))}
                </div>

                {/* Tool Cards */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginBottom: 28 }}>
                  {currentToolData.map((t, i) => {
                    const Icon = TOOL_ICONS[t.tool];
                    return (
                      <div key={t.tool} style={{
                        background: C.surface, border: `1px solid ${i === 0 ? `${TOOL_COLORS[t.tool] || C.accent}40` : C.border}`,
                        borderRadius: 14, padding: "18px 16px", position: "relative",
                        boxShadow: i === 0 ? `0 0 20px ${TOOL_COLORS[t.tool] || C.accent}10` : "none",
                      }}>
                        {i === 0 && <div style={{ position: "absolute", top: 8, right: 8, fontSize: 10, fontWeight: 700, background: `${TOOL_COLORS[t.tool] || C.accent}20`, color: TOOL_COLORS[t.tool] || C.accent, padding: "2px 8px", borderRadius: 6 }}>MOST USED</div>}
                        <div style={{ width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: `${TOOL_COLORS[t.tool] || C.accent}15`, marginBottom: 10 }}>
                          {Icon ? <Icon size={18} color={TOOL_COLORS[t.tool]} /> : <Zap size={18} color={C.accent} />}
                        </div>
                        <div style={{ fontSize: 24, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: TOOL_COLORS[t.tool] || C.accent }}>{parseInt(t.usage_count).toLocaleString()}</div>
                        <div style={{ fontSize: 12, color: C.textMuted, fontWeight: 600 }}>{t.tool}</div>
                        <div style={{ fontSize: 11, color: C.textDim }}>{totalToolUsage > 0 ? ((t.usage_count / totalToolUsage) * 100).toFixed(1) : 0}% of total</div>
                      </div>
                    );
                  })}
                </div>

                {currentToolData.length === 0 && <div style={{ color: C.textDim, textAlign: "center", padding: 60, background: C.surface, borderRadius: 16, border: `1px solid ${C.border}` }}>No tool usage data for this period</div>}

                {/* Tool Trend + Bar */}
                {toolTrend.length > 0 && (
                  <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, marginBottom: 28 }}>
                    <SectionTitle icon={TrendingUp}>Tool Usage Trend</SectionTitle>
                    <ResponsiveContainer width="100%" height={320}>
                      <LineChart data={toolTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                        <XAxis dataKey="day" tick={{ fill: C.textDim, fontSize: 11 }} stroke={C.border} />
                        <YAxis tick={{ fill: C.textDim, fontSize: 11 }} stroke={C.border} />
                        <Tooltip content={<CustomTooltip />} />
                        {Object.keys(TOOL_COLORS).map(tool => (
                          <Line key={tool} type="monotone" dataKey={tool} stroke={TOOL_COLORS[tool]} strokeWidth={2} dot={false} name={tool} connectNulls />
                        ))}
                        <Legend wrapperStyle={{ fontSize: 12, color: C.textMuted }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {currentToolData.length > 0 && (
                  <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24 }}>
                    <SectionTitle icon={BarChart3}>Tool Usage Breakdown</SectionTitle>
                    <ResponsiveContainer width="100%" height={Math.max(200, currentToolData.length * 45)}>
                      <BarChart data={currentToolData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                        <XAxis type="number" tick={{ fill: C.textDim, fontSize: 11 }} stroke={C.border} />
                        <YAxis dataKey="tool" type="category" tick={{ fill: C.textMuted, fontSize: 12 }} stroke={C.border} width={110} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="usage_count" name="Usage Count" radius={[0, 6, 6, 0]} barSize={20}>
                          {currentToolData.map((entry, i) => <Cell key={i} fill={TOOL_COLORS[entry.tool] || C.accent} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            )}

            {/* ════════ AI QUALITY TAB ════════ */}
            {activeTab === "quality" && (
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 28 }}>
                  <StatCard icon={AlertTriangle} label="Total Issues (24h)" value={parseInt(qaSummary?.total_issues) || 0} color={C.warning} />
                  <StatCard icon={AlertTriangle} label="High Severity" value={parseInt(qaSummary?.high_severity) || 0} color={C.danger} />
                  <StatCard icon={Eye} label="Under Review" value={parseInt(qaSummary?.reviewing_issues) || 0} color={C.warning} />
                  <StatCard icon={CheckCircle} label="Resolved" value={parseInt(qaSummary?.resolved_issues) || 0} color={C.success} />
                </div>

                {/* Issue Categories */}
                <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, marginBottom: 28 }}>
                  <SectionTitle icon={Shield}>Issue Categories</SectionTitle>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                    {[
                      { cat: "Tool Failure", key: "tool_failures", color: C.danger, icon: "⚙️" },
                      { cat: "Incorrect Answer", key: "incorrect_answers", color: C.chart5, icon: "❌" },
                      { cat: "User Complaint", key: "complaints", color: C.warning, icon: "😤" },
                      { cat: "Conversation Loop", key: "loops", color: C.chart2, icon: "🔄" },
                      { cat: "Misunderstanding", key: "misunderstandings", color: C.chart6, icon: "🤷" },
                    ].map(c => (
                      <div key={c.cat} style={{ background: `${c.color}08`, border: `1px solid ${c.color}25`, borderRadius: 12, padding: 16, display: "flex", alignItems: "center", gap: 14 }}>
                        <div style={{ fontSize: 28 }}>{c.icon}</div>
                        <div>
                          <div style={{ fontSize: 26, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: c.color }}>{parseInt(qaSummary?.[c.key]) || 0}</div>
                          <div style={{ fontSize: 12, color: C.textMuted, fontWeight: 600 }}>{c.cat}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Issues Table */}
                <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, marginBottom: 28 }}>
                  <SectionTitle icon={AlertTriangle}>Detected Issues</SectionTitle>
                  {qaIssues.length > 0 ? (
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                          <tr>
                            {["Severity", "Category", "User", "Summary", "Detected", "Status"].map(h => (
                              <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: C.textDim, textTransform: "uppercase", letterSpacing: "0.08em", borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {qaIssues.map((issue) => (
                            <tr key={issue.id} style={{ borderBottom: `1px solid ${C.border}`, background: issue.severity === "high" && issue.status === "open" ? `${C.danger}05` : "transparent" }}>
                              <td style={{ padding: 14 }}><SeverityBadge severity={issue.severity} /></td>
                              <td style={{ padding: 14, fontSize: 12, color: C.textMuted, fontWeight: 600 }}>{issue.category?.replace("_", " ")}</td>
                              <td style={{ padding: 14 }}>
                                <div style={{ fontSize: 12, fontWeight: 600 }}>{issue.user_name || "Unknown"}</div>
                                <div style={{ fontSize: 10, color: C.textDim, fontFamily: "'JetBrains Mono', monospace" }}>{issue.wa_id?.replace(/(\d{3})\d{4}(\d{3})/, "$1****$2")}</div>
                              </td>
                              <td style={{ padding: 14, fontSize: 13, color: C.text, maxWidth: 400 }}>{issue.summary}</td>
                              <td style={{ padding: 14, fontSize: 12, color: C.textDim, whiteSpace: "nowrap" }}>{issue.detected_at ? new Date(issue.detected_at).toLocaleString("en-IL", { dateStyle: "short", timeStyle: "short" }) : ""}</td>
                              <td style={{ padding: 14 }}><StatusBadge status={issue.status} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div style={{ textAlign: "center", padding: 40, color: C.textDim }}>
                      <CheckCircle size={32} color={C.success} style={{ marginBottom: 12 }} />
                      <div style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 4 }}>No Issues Detected</div>
                      <div>AI Supervisor has not flagged any issues. Set up the n8n workflow to enable automated scanning.</div>
                    </div>
                  )}
                </div>

                {/* Supervisor Info */}
                <div style={{ background: `linear-gradient(135deg, ${C.surface} 0%, ${C.surfaceHover} 100%)`, border: `1px solid ${C.accent}25`, borderRadius: 16, padding: 24 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: `${C.accent}15`, border: `1px solid ${C.accent}30`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Shield size={20} color={C.accent} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>AI Supervisor Agent</div>
                      <div style={{ fontSize: 12, color: C.textDim }}>Automated conversation quality monitoring</div>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 12 }}>
                    {[
                      "Scans all conversations via n8n workflow",
                      "Detects user frustration, loops & misunderstandings",
                      "Identifies tool failures & incorrect answers",
                      "Stores issues in qa_issues PostgreSQL table",
                      "Sends daily executive summary via WhatsApp",
                      "API: GET /api/conversations/recent for audit",
                    ].map((item, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: C.textMuted }}>
                        <CheckCircle size={14} color={C.accent} style={{ flexShrink: 0 }} /> {item}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: ${C.bg}; }
        ::-webkit-scrollbar-thumb { background: ${C.borderLight}; border-radius: 3px; }
      `}</style>
    </div>
  );
}
