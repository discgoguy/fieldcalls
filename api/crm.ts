import Anthropic from '@anthropic-ai/sdk';
import { requireAuth, getServiceClient, errorResponse } from './_lib.js';
// Single source of truth for the CRM aggregation math: the same pure module the
// dashboard renders from, so the assistant's numbers always match the UI.
import { deriveCrmOverview } from '../src/pages/crmDashboard.logic';

// One serverless function for the CRM server-only actions, dispatched on
// `body.action` ('chat' | 'sendEmail'). Merged into a single route to stay under
// the Hobby-plan 12-function limit; split back out if you move to Pro.
export const maxDuration = 60;

// ============================ chat ============================
const MAX_TOOL_ROUNDS = 4;
const HISTORY_TURNS = 6;
// Prefix-stem match: word boundary at the START only, so stems cover their
// derived forms ("analy" → analyze/analysis, "stall" → stalled/stalling…).
const ANALYTICAL_RE =
  /\b(analy|insight|why|compar|trend|risk|concentrat|funnel|leak|focus|recommend|should|improve|forecast|roi|health|stall|aging|drop[-\s]?off|best|worst|opportunit|priorit|underperform|where|how come)/i;

const TOOLS = [
  {
    name: 'query_deals',
    description:
      'Query CRM deals with filters. Use to inspect specific deals - large open deals, stalled deals, deals by source or stage. Returns lean rows: name, company, status, amount, stage, source, days since last stage change, prequote estimate.',
    input_schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['open', 'won', 'lost'], description: 'Filter by deal status.' },
        stage_name: { type: 'string', description: 'Filter by pipeline stage name (e.g. "Negotiation").' },
        source_name: { type: 'string', description: 'Filter by originating lead source (e.g. "Website").' },
        min_amount: { type: 'number', description: 'Only deals with amount >= this value.' },
        stalled_days: { type: 'number', description: 'Only OPEN deals with no stage change in at least this many days.' },
        order_by: { type: 'string', enum: ['amount', 'days_in_stage'], description: 'Sort descending by this key (default amount).' },
        limit: { type: 'number', description: 'Max rows (default 8, cap 25).' },
      },
    },
  },
  {
    name: 'source_performance',
    description:
      'Per-source funnel and ROI rollup: leads, MQLs, SQLs, opportunities, projected value, quoted value, bookings, marketing cost, cost-per-lead and ROI (bookings − cost). Use to compare lead sources or assess ROI.',
    input_schema: { type: 'object', properties: {} },
  },
];

const num = (v) => Number(v) || 0;
const daysSince = (iso, now) => (iso ? Math.max(0, Math.floor((now - new Date(iso).getTime()) / 86400000)) : null);

function buildTools(data, now) {
  const { deals, stages, companies, leads, sources, quotes, history } = data;
  const stageName = Object.fromEntries(stages.map((s) => [s.id, s.name]));
  const companyName = Object.fromEntries(companies.map((c) => [c.id, c.name]));
  const sourceName = Object.fromEntries(sources.map((s) => [s.id, s.name]));
  const leadById = Object.fromEntries(leads.map((l) => [l.id, l]));
  const lastChange = {};
  history.forEach((h) => { if (h.created_date && (!lastChange[h.deal_id] || h.created_date > lastChange[h.deal_id])) lastChange[h.deal_id] = h.created_date; });

  // Same attribution rule as deriveCrmOverview: deal -> originating lead -> source
  // (a deal with no originating lead is shown per-row but not source-attributed).
  const dealSource = (d) => {
    const lead = d.lead_id ? leadById[d.lead_id] : null;
    if (!lead) return null;
    return lead.source_id ? sourceName[lead.source_id] || 'Unknown' : 'Unassigned';
  };

  // The aggregate rollups come from the shared dashboard module; recomputed
  // here would be a second copy of the same math that could silently drift.
  const derived = deriveCrmOverview({ deals, stages, leads, stageHistory: history, sources, quotes });

  function query_deals(input = {}) {
    let rows = deals.map((d) => ({
      name: d.name,
      company: companyName[d.company_id] || null,
      status: d.status,
      amount: Math.round(num(d.amount)),
      stage: stageName[d.stage_id] || null,
      source: dealSource(d),
      days_since_stage_change: daysSince(lastChange[d.id] || d.created_date, now),
      prequote: Math.round(num(d.prequote_estimate_value)),
    }));
    if (input.status) rows = rows.filter((r) => r.status === input.status);
    if (input.stage_name) rows = rows.filter((r) => (r.stage || '').toLowerCase() === String(input.stage_name).toLowerCase());
    if (input.source_name) rows = rows.filter((r) => (r.source || '').toLowerCase() === String(input.source_name).toLowerCase());
    if (typeof input.min_amount === 'number') rows = rows.filter((r) => r.amount >= input.min_amount);
    if (typeof input.stalled_days === 'number') rows = rows.filter((r) => r.status === 'open' && (r.days_since_stage_change ?? 0) >= input.stalled_days);
    rows.sort((a, b) => (input.order_by === 'days_in_stage' ? (b.days_since_stage_change ?? 0) - (a.days_since_stage_change ?? 0) : b.amount - a.amount));
    const limit = Math.min(input.limit || 8, 25);
    return { total_matched: rows.length, returned: Math.min(rows.length, limit), deals: rows.slice(0, limit) };
  }

  // Dashboard sourceDetails + marketing cost/ROI (cost lives on crm_sources and
  // isn't a dashboard concern, so it's layered on here rather than in the shared
  // module). Cost-only sources (spend but no leads/deals yet) are appended so
  // negative ROI is still visible.
  function source_performance() {
    const costBySource = Object.fromEntries(sources.map((s) => [s.name, num(s.total_cost)]));
    const rows = derived.sourceDetails.map((r) => {
      const cost = Math.round(costBySource[r.source] || 0);
      return {
        source: r.source, leads: r.leads, mql: r.mql, sql: r.sql, opps: r.opps,
        projected: Math.round(r.projected), quoted: Math.round(r.quotes), bookings: Math.round(r.bookings),
        cost, cost_per_lead: r.leads ? Math.round(cost / r.leads) : null, roi: Math.round(r.bookings - cost),
      };
    });
    const seen = new Set(rows.map((r) => r.source));
    sources.filter((s) => !seen.has(s.name) && num(s.total_cost) > 0).forEach((s) => {
      const cost = Math.round(num(s.total_cost));
      rows.push({ source: s.name, leads: 0, mql: 0, sql: 0, opps: 0, projected: 0, quoted: 0, bookings: 0, cost, cost_per_lead: null, roi: -cost });
    });
    return { sources: rows };
  }

  // Prompt headline, built from the same derivation the dashboard renders.
  const headline = {
    open_pipeline: Math.round(derived.openPipeline),
    booked_value: Math.round(derived.wonValue),
    lost_value: Math.round(derived.lostValue),
    win_rate_pct: derived.winRate,
    avg_open_deal: Math.round(derived.avgDealSize),
    open_deals: derived.openDeals.length,
    total_leads: leads.length,
    mqls: derived.mqlCount,
    sqls: derived.sqlCount,
    opportunities: derived.oppCount,
    deal_value_projected: Math.round(derived.quotedValue),
  };

  return { query_deals, source_performance, headline };
}

async function handleChat(user, body, res) {
  const { question, history: chatHistory } = body;
  if (!question || !String(question).trim()) return errorResponse(res, 400, 'A question is required');

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return errorResponse(res, 503, 'AI chat is not configured (ANTHROPIC_API_KEY is not set).');

  const db = getServiceClient();
  // Page past PostgREST's max_rows cap (supabase/config.toml: max_rows = 1000) and
  // surface query errors instead of swallowing them. A single bare .select() would
  // (a) truncate any table over one page - so once crm_deal_stage_history grows the
  // chat's headline silently diverges from the dashboard, and (b) turn a failed
  // query into [] via `r.data || []`, making the assistant confidently report a $0
  // pipeline. Throwing lets the dispatch try/catch return a real 500.
  const PAGE = 1000;
  const pick = async (t, cols = '*') => {
    const rows = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await db.from(t).select(cols).range(from, from + PAGE - 1);
      if (error) throw error;
      if (!data?.length) break;
      rows.push(...data);
      if (data.length < PAGE) break;
    }
    return rows;
  };
  const [deals, stages, companies, leads, sources, quotes, stageHistory] = await Promise.all([
    pick('crm_deals'),
    pick('crm_pipeline_stages'),
    pick('crm_companies', 'id,name'),
    pick('crm_leads'),
    pick('crm_sources'),
    pick('quotes', 'id,total_amount'),
    pick('crm_deal_stage_history', 'deal_id,to_stage_id,created_date'),
  ]);
  const tools = buildTools({ deals, stages, companies, leads, sources, quotes, history: stageHistory }, Date.now());
  const client = new Anthropic({ apiKey });

  const isAnalysis = ANALYTICAL_RE.test(String(question));
  const tier = isAnalysis
    ? { model: 'claude-sonnet-5', max_tokens: 4096, thinking: { type: 'adaptive' }, output_config: { effort: 'medium' } }
    : { model: 'claude-haiku-4-5', max_tokens: 1024 };

  const system = `You are a sharp sales analyst embedded in the A52 CRM Overview. Surface valuable, non-obvious findings (concentration risk, funnel drop-off, stalled/aging deals, source ROI) - don't just restate numbers.
Rules:
- Every figure you state MUST come from the headline below or a tool result - never invent numbers.
- Answer simple headline questions directly; call tools only when you need detail beyond the headline.
- Currency is CAD. "Projected"/"deal value" is the prequote estimate, not a formal quote.
- Be concise: lead with the finding, cite the exact figures, add one concrete recommendation when useful.

Headline metrics (current, authoritative):
${JSON.stringify(tools.headline)}`;

  const messages = [];
  if (Array.isArray(chatHistory)) {
    for (const m of chatHistory.slice(-HISTORY_TURNS)) {
      if (m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string') {
        messages.push({ role: m.role, content: m.content });
      }
    }
  }
  messages.push({ role: 'user', content: String(question) });

  let response = null;
  let rounds = 0;
  const usage = { input: 0, output: 0, cache_read: 0 };
  for (; rounds < MAX_TOOL_ROUNDS; rounds++) {
    const stream = client.messages.stream({ ...tier, system, tools: TOOLS, messages });
    response = await stream.finalMessage();
    if (response.usage) {
      usage.input += response.usage.input_tokens || 0;
      usage.output += response.usage.output_tokens || 0;
      usage.cache_read += response.usage.cache_read_input_tokens || 0;
    }
    if (response.stop_reason !== 'tool_use') break;

    messages.push({ role: 'assistant', content: response.content });
    const toolResults = [];
    for (const block of response.content) {
      if (block.type !== 'tool_use') continue;
      let out;
      try {
        out = block.name === 'query_deals' ? tools.query_deals(block.input || {})
          : block.name === 'source_performance' ? tools.source_performance()
            : { error: `Unknown tool: ${block.name}` };
      } catch (e) {
        out = { error: e?.message || 'tool failed' };
      }
      toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(out) });
    }
    messages.push({ role: 'user', content: toolResults });
  }

  console.log(`crm.chat tier=${isAnalysis ? 'analysis' : 'factual'} model=${tier.model} rounds=${rounds + 1} in=${usage.input} out=${usage.output} cache_read=${usage.cache_read}`);

  const answer = (response?.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();

  return res.json({ answer: answer || 'I gathered the data but could not finish an answer - try narrowing the question.', model: response?.model });
}

// ============================ sendEmail ============================
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function handleSendEmail(user, body, res) {
  const { to, subject, body: emailBody } = body;
  if (!to || !EMAIL_RE.test(String(to).trim())) {
    return errorResponse(res, 400, 'A valid recipient email is required');
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) return res.json({ success: true, sent: false, reason: 'Email provider not configured' });

  const safeBody = String(emailBody || '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'FieldCalls CRM <noreply@tickets.fieldcalls.com>',
      to: [String(to).trim()],
      reply_to: user.email, // replies route back to the rep
      subject: subject || '(no subject)',
      html: `<div style="font-family:Arial,sans-serif;white-space:pre-wrap">${safeBody}</div>`,
    }),
  });

  if (!resp.ok) {
    const detail = await resp.text().catch(() => String(resp.status));
    console.error('Resend send failed:', detail);
    return errorResponse(res, 502, 'Email provider rejected the message');
  }
  return res.json({ success: true, sent: true });
}

// ============================ dispatch ============================
export default async function handler(req, res) {
  if (req.method !== 'POST') return errorResponse(res, 405, 'Method not allowed');

  try {
    const user = await requireAuth(req);
    if (user.role !== 'admin' && user.role !== 'technician') {
      return errorResponse(res, 403, 'Only staff can use CRM tools');
    }

    const action = req.body?.action;
    if (action === 'chat') return await handleChat(user, req.body, res);
    if (action === 'sendEmail') return await handleSendEmail(user, req.body, res);
    return errorResponse(res, 400, `Unknown action: ${action || '(none)'}`);
  } catch (err) {
    if (err && typeof err.status === 'number' && typeof err.error === 'string') {
      return errorResponse(res, err.status, err.error);
    }
    console.error('crm error:', err);
    return errorResponse(res, 500, err?.message || 'Request failed');
  }
}
