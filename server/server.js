const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// ─── Authentication ──────────────────────────
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'changeme';
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

// Simple token-based auth
const activeSessions = new Map();

function generateToken() {
  return crypto.randomBytes(48).toString('hex');
}

function authMiddleware(req, res, next) {
  // Allow login endpoint
  if (req.path === '/api/auth/login' || req.path === '/api/auth/check') return next();
  
  // Check for token in header or cookie
  const token = req.headers['x-auth-token'] || req.query.token;
  
  if (!token || !activeSessions.has(token)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const session = activeSessions.get(token);
  // Session expires after 24 hours
  if (Date.now() - session.created > 24 * 60 * 60 * 1000) {
    activeSessions.delete(token);
    return res.status(401).json({ error: 'Session expired' });
  }
  
  next();
}

// Login endpoint
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    const token = generateToken();
    activeSessions.set(token, { user: username, created: Date.now() });
    return res.json({ success: true, token });
  }
  
  // Rate limiting: small delay on failed attempts
  setTimeout(() => {
    res.status(401).json({ error: 'Invalid credentials' });
  }, 1000);
});

app.get('/api/auth/check', (req, res) => {
  const token = req.headers['x-auth-token'];
  if (token && activeSessions.has(token)) {
    const session = activeSessions.get(token);
    if (Date.now() - session.created < 24 * 60 * 60 * 1000) {
      return res.json({ authenticated: true, user: session.user });
    }
    activeSessions.delete(token);
  }
  res.json({ authenticated: false });
});

app.post('/api/auth/logout', (req, res) => {
  const token = req.headers['x-auth-token'];
  if (token) activeSessions.delete(token);
  res.json({ success: true });
});

// ─── Serve React Frontend (public) ───────────
app.use(express.static(path.join(__dirname, 'public')));

// ─── Protect all /api routes (except auth) ───
app.use('/api', authMiddleware);

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

// ─── Signups ─────────────────────────────────
app.get('/api/metrics/signups', async (req, res) => {
  try {
    const [data] = await query('SELECT * FROM public.v_signups');
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Live Activity ───────────────────────────
app.get('/api/activity/recent-users', async (req, res) => {
  try {
    const data = await query('SELECT * FROM public.v_recent_active_users');
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/activity/recent-messages', async (req, res) => {
  try {
    const data = await query('SELECT * FROM public.v_recent_messages');
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/activity/near-limits', async (req, res) => {
  try {
    const data = await query('SELECT * FROM public.v_near_limits');
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/activity/churn-risk', async (req, res) => {
  try {
    const data = await query('SELECT * FROM public.v_churn_risk');
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/activity/returning-users', async (req, res) => {
  try {
    const data = await query('SELECT * FROM public.v_returning_users');
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Country detection from phone prefix ─────
// Sorted longest-first so we match the most specific code
const COUNTRY_CODES = [
  ['998','Uzbekistan','🇺🇿'],['996','Kyrgyzstan','🇰🇬'],['995','Georgia','🇬🇪'],['994','Azerbaijan','🇦🇿'],['993','Turkmenistan','🇹🇲'],['992','Tajikistan','🇹🇯'],
  ['977','Nepal','🇳🇵'],['976','Mongolia','🇲🇳'],['975','Bhutan','🇧🇹'],['974','Qatar','🇶🇦'],['973','Bahrain','🇧🇭'],['972','Israel','🇮🇱'],['971','UAE','🇦🇪'],['970','Palestine','🇵🇸'],
  ['968','Oman','🇴🇲'],['967','Yemen','🇾🇪'],['966','Saudi Arabia','🇸🇦'],['965','Kuwait','🇰🇼'],['964','Iraq','🇮🇶'],['963','Syria','🇸🇾'],['962','Jordan','🇯🇴'],['961','Lebanon','🇱🇧'],['960','Maldives','🇲🇻'],
  ['886','Taiwan','🇹🇼'],['880','Bangladesh','🇧🇩'],['856','Laos','🇱🇦'],['855','Cambodia','🇰🇭'],['853','Macau','🇲🇴'],['852','Hong Kong','🇭🇰'],['850','North Korea','🇰🇵'],
  ['692','Marshall Is','🇲🇭'],['691','Micronesia','🇫🇲'],['690','Tokelau','🇹🇰'],['689','Fr Polynesia','🇵🇫'],['686','Kiribati','🇰🇮'],['685','Samoa','🇼🇸'],['679','Fiji','🇫🇯'],['673','Brunei','🇧🇳'],['670','Timor-Leste','🇹🇱'],
  ['599','Curaçao','🇨🇼'],['598','Uruguay','🇺🇾'],['597','Suriname','🇸🇷'],['595','Paraguay','🇵🇾'],['593','Ecuador','🇪🇨'],['592','Guyana','🇬🇾'],['591','Bolivia','🇧🇴'],['590','Guadeloupe','🇬🇵'],
  ['507','Panama','🇵🇦'],['506','Costa Rica','🇨🇷'],['505','Nicaragua','🇳🇮'],['504','Honduras','🇭🇳'],['503','El Salvador','🇸🇻'],['502','Guatemala','🇬🇹'],['501','Belize','🇧🇿'],['500','Falklands','🇫🇰'],
  ['423','Liechtenstein','🇱🇮'],['421','Slovakia','🇸🇰'],['420','Czechia','🇨🇿'],
  ['389','N Macedonia','🇲🇰'],['387','Bosnia','🇧🇦'],['386','Slovenia','🇸🇮'],['385','Croatia','🇭🇷'],['383','Kosovo','🇽🇰'],['382','Montenegro','🇲🇪'],['381','Serbia','🇷🇸'],['380','Ukraine','🇺🇦'],
  ['378','San Marino','🇸🇲'],['377','Monaco','🇲🇨'],['376','Andorra','🇦🇩'],['375','Belarus','🇧🇾'],['374','Armenia','🇦🇲'],['373','Moldova','🇲🇩'],['372','Estonia','🇪🇪'],['371','Latvia','🇱🇻'],['370','Lithuania','🇱🇹'],
  ['359','Bulgaria','🇧🇬'],['358','Finland','🇫🇮'],['357','Cyprus','🇨🇾'],['356','Malta','🇲🇹'],['355','Albania','🇦🇱'],['353','Ireland','🇮🇪'],['352','Luxembourg','🇱🇺'],['351','Portugal','🇵🇹'],['350','Gibraltar','🇬🇮'],
  ['291','Eritrea','🇪🇷'],['265','Malawi','🇲🇼'],['263','Zimbabwe','🇿🇼'],['260','Zambia','🇿🇲'],['256','Uganda','🇺🇬'],['255','Tanzania','🇹🇿'],['254','Kenya','🇰🇪'],['251','Ethiopia','🇪🇹'],['250','Rwanda','🇷🇼'],
  ['249','Sudan','🇸🇩'],['248','Seychelles','🇸🇨'],['234','Nigeria','🇳🇬'],['233','Ghana','🇬🇭'],['230','Mauritius','🇲🇺'],['225','Ivory Coast','🇨🇮'],['221','Senegal','🇸🇳'],['220','Gambia','🇬🇲'],['216','Tunisia','🇹🇳'],['213','Algeria','🇩🇿'],['212','Morocco','🇲🇦'],
  ['98','Iran','🇮🇷'],['95','Myanmar','🇲🇲'],['94','Sri Lanka','🇱🇰'],['93','Afghanistan','🇦🇫'],['92','Pakistan','🇵🇰'],['91','India','🇮🇳'],['90','Turkey','🇹🇷'],
  ['86','China','🇨🇳'],['84','Vietnam','🇻🇳'],['82','South Korea','🇰🇷'],['81','Japan','🇯🇵'],['66','Thailand','🇹🇭'],['65','Singapore','🇸🇬'],['64','New Zealand','🇳🇿'],['63','Philippines','🇵🇭'],['62','Indonesia','🇮🇩'],['61','Australia','🇦🇺'],['60','Malaysia','🇲🇾'],
  ['58','Venezuela','🇻🇪'],['57','Colombia','🇨🇴'],['56','Chile','🇨🇱'],['55','Brazil','🇧🇷'],['54','Argentina','🇦🇷'],['53','Cuba','🇨🇺'],['52','Mexico','🇲🇽'],['51','Peru','🇵🇪'],
  ['49','Germany','🇩🇪'],['48','Poland','🇵🇱'],['47','Norway','🇳🇴'],['46','Sweden','🇸🇪'],['45','Denmark','🇩🇰'],['44','UK','🇬🇧'],['43','Austria','🇦🇹'],['41','Switzerland','🇨🇭'],['40','Romania','🇷🇴'],
  ['39','Italy','🇮🇹'],['36','Hungary','🇭🇺'],['34','Spain','🇪🇸'],['33','France','🇫🇷'],['32','Belgium','🇧🇪'],['31','Netherlands','🇳🇱'],['30','Greece','🇬🇷'],
  ['27','South Africa','🇿🇦'],['20','Egypt','🇪🇬'],['7','Russia','🇷🇺'],['1','USA/Canada','🇺🇸'],
];

function countryFromWaId(waId) {
  const num = String(waId || '').replace(/\D/g, '');
  for (const [code, country, flag] of COUNTRY_CODES) {
    if (num.startsWith(code)) return { country, flag, code };
  }
  return { country: 'Unknown', flag: '🌍', code: '' };
}

app.get('/api/activity/newest-users', async (req, res) => {
  try {
    const data = await query('SELECT * FROM public.v_newest_users');
    const enriched = data.map(u => {
      const c = countryFromWaId(u.wa_id);
      return { ...u, country: c.country, flag: c.flag };
    });
    res.json(enriched);
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
