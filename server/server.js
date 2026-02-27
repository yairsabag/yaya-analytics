const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// ─── Serve React Frontend ────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ─── Database Connection ─────────────────────
const pool = new Pool({
  host: process.env.DB_HOST || 'postgres-main.internal',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'yaya_db',
  user: process.env.DB_USER || 'yaya_user',
  password: process.env.DB_PASSWORD || '',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
});

pool.query('SELECT NOW()')
  .then(res => console.log('✅ Database connected:', res.rows[0].now))
  .catch(err => console.error('❌ Database connection error:', err.message));

const query = async (sql, params = []) => {
  const client = await pool.connect();
  try {
    const result = await client.query(sql, params);
    return result.rows;
  } finally {
    client.release();
  }
};

// ─── Health Check ────────────────────────────
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ─── Overview Metrics ────────────────────────
app.get('/api/metrics/overview', async (req, res) => {
  try {
    const [activeUsers] = await query(`SELECT * FROM public.v_active_users`);
    const planDist = await query(`SELECT * FROM public.v_plan_distribution`);
    const activeByPlan = await query(`SELECT * FROM public.v_active_users_by_plan`);
    const totalUsers = await query(`SELECT COUNT(*) AS total FROM public.users`);

    let qaSummary = null;
    try {
      const qa = await query(`SELECT * FROM public.v_qa_summary`);
      qaSummary = qa[0] || null;
    } catch (e) {}

    res.json({
      totalUsers: parseInt(totalUsers[0]?.total || 0),
      dau: parseInt(activeUsers?.dau || 0),
      wau: parseInt(activeUsers?.wau || 0),
      mau: parseInt(activeUsers?.mau || 0),
      messagesToday: parseInt(activeUsers?.messages_today || 0),
      messagesWeek: parseInt(activeUsers?.messages_week || 0),
      messagesMonth: parseInt(activeUsers?.messages_month || 0),
      avgMessagesPerUser: activeUsers?.dau > 0
        ? Math.round(activeUsers.messages_today / activeUsers.dau * 10) / 10
        : 0,
      planDistribution: planDist,
      activeByPlan: activeByPlan,
      qaIssues: qaSummary,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Activity Trend ──────────────────────────
app.get('/api/metrics/activity-trend', async (req, res) => {
  try {
    const data = await query(`SELECT * FROM public.v_daily_activity ORDER BY day ASC`);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Hourly Activity ─────────────────────────
app.get('/api/metrics/hourly-activity', async (req, res) => {
  try {
    const data = await query(`
      SELECT h.hour, COALESCE(ha.message_count, 0) AS message_count, COALESCE(ha.unique_users, 0) AS unique_users
      FROM generate_series(0, 23) AS h(hour)
      LEFT JOIN public.v_hourly_activity ha ON ha.hour = h.hour
      ORDER BY h.hour
    `);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Top Users ───────────────────────────────
app.get('/api/metrics/top-users', async (req, res) => {
  try {
    const period = req.query.period || 'today';
    let viewName;
    switch (period) {
      case 'week': viewName = 'public.v_top_users_week'; break;
      case 'month': viewName = 'public.v_top_users_month'; break;
      default: viewName = 'public.v_top_users_today';
    }

    const users = await query(`SELECT * FROM ${viewName}`);

    const enrichedUsers = await Promise.all(users.map(async (user) => {
      let interval;
      switch (period) {
        case 'week': interval = '7 days'; break;
        case 'month': interval = '30 days'; break;
        default: interval = '0 days';
      }
      const tools = await query(`
        SELECT DISTINCT tool FROM public.v_tool_usage
        WHERE wa_id = $1 AND used_at >= CURRENT_DATE - INTERVAL '${interval}'
      `, [user.wa_id]);
      return { ...user, tools_used: tools.map(t => t.tool) };
    }));

    res.json(enrichedUsers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Tool Usage ──────────────────────────────
app.get('/api/metrics/tool-usage', async (req, res) => {
  try {
    const period = req.query.period || 'today';
    let viewName;
    switch (period) {
      case 'week': viewName = 'public.v_tool_usage_week'; break;
      case 'month': viewName = 'public.v_tool_usage_month'; break;
      default: viewName = 'public.v_tool_usage_today';
    }
    const data = await query(`SELECT * FROM ${viewName}`);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Tool Usage by Plan ──────────────────────
app.get('/api/metrics/tool-usage-by-plan', async (req, res) => {
  try {
    const data = await query(`SELECT * FROM public.v_tool_usage_by_plan`);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Tool Trend ──────────────────────────────
app.get('/api/metrics/tool-trend', async (req, res) => {
  try {
    const data = await query(`SELECT * FROM public.v_tool_trend ORDER BY day ASC`);
    const pivoted = {};
    data.forEach(row => {
      const dayKey = row.day.toISOString().split('T')[0];
      if (!pivoted[dayKey]) pivoted[dayKey] = { day: dayKey };
      pivoted[dayKey][row.tool] = parseInt(row.usage_count);
    });
    res.json(Object.values(pivoted));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Plans ───────────────────────────────────
app.get('/api/metrics/plans', async (req, res) => {
  try {
    const distribution = await query(`SELECT * FROM public.v_plan_distribution`);
    const activeByPlan = await query(`SELECT * FROM public.v_active_users_by_plan`);
    res.json({ distribution, activeByPlan });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── User Growth ─────────────────────────────
app.get('/api/metrics/user-growth', async (req, res) => {
  try {
    const data = await query(`SELECT * FROM public.v_user_growth`);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Languages ───────────────────────────────
app.get('/api/metrics/languages', async (req, res) => {
  try {
    const data = await query(`SELECT * FROM public.v_language_distribution`);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── QA Issues ───────────────────────────────
app.get('/api/qa/issues', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const status = req.query.status;
    const severity = req.query.severity;
    let sql = `SELECT qi.*, u.name AS user_name FROM public.qa_issues qi LEFT JOIN public.users u ON qi.wa_id = u.wa_id WHERE 1=1`;
    const params = [];
    if (status) { params.push(status); sql += ` AND qi.status = $${params.length}`; }
    if (severity) { params.push(severity); sql += ` AND qi.severity = $${params.length}`; }
    sql += ` ORDER BY qi.detected_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);
    const data = await query(sql, params);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/qa/summary', async (req, res) => {
  try {
    const data = await query(`SELECT * FROM public.v_qa_summary`);
    res.json(data[0] || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/qa/issues/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const data = await query(`
      UPDATE public.qa_issues SET status = $1,
      resolved_at = CASE WHEN $1 = 'resolved' THEN NOW() ELSE resolved_at END
      WHERE id = $2 RETURNING *
    `, [status, id]);
    res.json(data[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── User Details ────────────────────────────
app.get('/api/users/:wa_id', async (req, res) => {
  try {
    const { wa_id } = req.params;
    const [user] = await query(`
      SELECT wa_id, name, plan, language, timezone, created_at, last_active, subscription_status, billing_type, monthly_chat_count
      FROM public.users WHERE wa_id = $1
    `, [wa_id]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const recentMessages = await query(`SELECT message, sender, timestamp FROM public.chat_history WHERE wa_id = $1 ORDER BY timestamp DESC LIMIT 20`, [wa_id]);
    const toolUsage = await query(`SELECT tool, COUNT(*) AS count FROM public.v_tool_usage WHERE wa_id = $1 AND used_at >= CURRENT_DATE - INTERVAL '30 days' GROUP BY tool ORDER BY count DESC`, [wa_id]);
    res.json({ ...user, recentMessages, toolUsage });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Executive Summary ───────────────────────
app.get('/api/executive-summary', async (req, res) => {
  try {
    const [overview] = await query(`SELECT * FROM public.v_active_users`);
    const topUsers = await query(`SELECT * FROM public.v_top_users_today LIMIT 5`);
    const topTools = await query(`SELECT * FROM public.v_tool_usage_today LIMIT 3`);
    const planDist = await query(`SELECT * FROM public.v_plan_distribution`);
    let qaData = { open_issues: 0, high_severity: 0 };
    try { const [qa] = await query(`SELECT * FROM public.v_qa_summary`); qaData = qa || qaData; } catch (e) {}

    const summary = {
      date: new Date().toISOString().split('T')[0],
      dau: overview?.dau || 0,
      messagesToday: overview?.messages_today || 0,
      topUsers: topUsers.map(u => ({ name: u.name || u.wa_id, plan: u.plan, messages: u.message_count })),
      topTools: topTools.map(t => ({ tool: t.tool, count: t.usage_count })),
      plans: planDist,
      openIssues: qaData.open_issues || 0,
      highSeverity: qaData.high_severity || 0,
    };

    const whatsappText = `📊 *Yaya Daily Report*\n━━━━━━━━━━━━━━━\n📅 ${summary.date}\n\n👥 *Active Users:* ${summary.dau}\n💬 *Messages:* ${summary.messagesToday}\n\n🏆 *Top Users:*\n${summary.topUsers.map((u, i) => `${i + 1}. ${u.name} (${u.plan}) — ${u.messages} msgs`).join('\n')}\n\n🔧 *Top Tools:*\n${summary.topTools.map(t => `• ${t.tool}: ${t.count} uses`).join('\n')}\n\n⚠️ *Open Issues:* ${summary.openIssues} (${summary.highSeverity} high)\n━━━━━━━━━━━━━━━`;
    res.json({ ...summary, whatsappText });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Conversations for QA ────────────────────
app.get('/api/conversations/recent', async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24;
    const data = await query(`
      SELECT ch.wa_id, u.name, COALESCE(u.plan, 'basic') AS plan,
        json_agg(json_build_object('id', ch.id, 'message', ch.message, 'sender', ch.sender, 'timestamp', ch.timestamp) ORDER BY ch.timestamp) AS messages,
        COUNT(*) AS message_count
      FROM public.chat_history ch LEFT JOIN public.users u ON ch.wa_id = u.wa_id
      WHERE ch.timestamp >= NOW() - make_interval(hours => $1)
      GROUP BY ch.wa_id, u.name, u.plan ORDER BY COUNT(*) DESC
    `, [hours]);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Bot Analytics ───────────────────────────
app.get('/api/metrics/bot-analytics', async (req, res) => {
  try {
    const data = await query(`
      SELECT DATE(timestamp) AS day, COUNT(*) AS interactions, COUNT(DISTINCT user_id) AS unique_users,
        ROUND(AVG(response_time_ms)) AS avg_response_time, SUM(tokens_used) AS total_tokens,
        ROUND(SUM(estimated_cost_usd)::numeric, 4) AS total_cost,
        ROUND(AVG(CASE WHEN success THEN 1 ELSE 0 END) * 100, 1) AS success_rate
      FROM public.bot_analytics WHERE timestamp >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY DATE(timestamp) ORDER BY day DESC
    `);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Catch-all: serve React app ──────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Start ───────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Yaya Analytics running on port ${PORT}`);
});
