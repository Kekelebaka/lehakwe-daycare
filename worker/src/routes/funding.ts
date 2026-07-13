import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv, Env } from '../env';
import { getCentreId } from '../tenant';

// Ubuntu Funding Navigator — the moat. Discovery (match score), Readiness score,
// AI application builder (Workers AI), and the pipeline/CRM. Available to all
// authenticated staff (management tool; not admin-gated for the MVP).
const r = new Hono<AppEnv>();
const uid = (c: any) => c.get('identity')?.sub || 'system';

// ── Centre profile (drives match + readiness), scoped to one centre ─────────
async function getProfile(env: Env, centreId: string) {
  const settingsRows = await env.DB.prepare('SELECT setting_key, setting_value FROM settings WHERE centre_id = ?').bind(centreId).all<any>();
  const s: Record<string, string> = {};
  for (const row of settingsRows.results) s[row.setting_key] = row.setting_value;

  const childRow = await env.DB.prepare("SELECT COUNT(*) AS n, SUM(CASE WHEN income_category='single_parent' THEN 1 ELSE 0 END) AS low FROM children WHERE status='active' AND centre_id = ?").bind(centreId).first<any>();
  const comp = await env.DB.prepare('SELECT category, item_name, status FROM compliance_items WHERE centre_id = ?').bind(centreId).all<any>();
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yy = String(now.getFullYear());
  const att = await env.DB.prepare("SELECT COUNT(*) AS n FROM attendance_records WHERE strftime('%m', date)=? AND strftime('%Y', date)=? AND centre_id = ?").bind(mm, yy, centreId).first<any>();
  const fees = await env.DB.prepare('SELECT COUNT(*) AS n FROM fee_records WHERE centre_id = ?').bind(centreId).first<any>();

  const compRows = comp.results as any[];
  const complete = compRows.filter((x) => x.status === 'complete').length;
  const isDone = (match: RegExp) => compRows.some((x) => match.test(x.item_name) && x.status === 'complete');

  return {
    name: s.daycare_name || 'Our centre',
    npo: !!(s.npo_number && s.npo_number.trim()),
    province: s.province || '',
    address: s.daycare_address || '',
    children: Number(childRow?.n || 0),
    lowIncome: Number(childRow?.low || 0),
    attendanceThisMonth: Number(att?.n || 0),
    feeRecords: Number(fees?.n || 0),
    complianceComplete: complete,
    complianceTotal: compRows.length,
    registrationComplete: isDone(/registration certificate/i),
    npoDocsComplete: isDone(/npo/i),
    safetyComplete: isDone(/fire|safety|health/i),
    consentComplete: isDone(/consent/i),
  };
}

function matchScore(opp: any, p: Awaited<ReturnType<typeof getProfile>>): number {
  let s = 55;
  const prov = (opp.provinces || 'all').toLowerCase();
  if (prov === 'all' || (p.province && prov.includes(p.province.toLowerCase()))) s += 12;
  if (opp.requires_npo) s += p.npo ? 12 : -18;
  if (opp.requires_registration) s += p.registrationComplete ? 12 : -12;
  switch (opp.focus) {
    case 'subsidy': s += p.lowIncome > 0 ? 16 : 4; break;
    case 'nutrition': s += p.children > 0 ? 10 : 0; break;
    case 'infrastructure': s += 8; break;
    case 'training': s += 8; break;
    default: s += 8; // quality
  }
  if (p.complianceTotal) s += Math.round((p.complianceComplete / p.complianceTotal) * 8);
  return Math.max(28, Math.min(97, Math.round(s)));
}

// ── Discovery: opportunities ranked by match score (catalog is global) ──────
r.get('/funding/opportunities', async (c) => {
  const p = await getProfile(c.env, getCentreId(c));
  const rows = await c.env.DB.prepare('SELECT * FROM funding_opportunities WHERE active = 1').all<any>();
  const data = rows.results
    .map((o) => ({ ...o, match_score: matchScore(o, p) }))
    .sort((a, b) => b.match_score - a.match_score);
  return c.json({ ok: true, data });
});

// ── Readiness: score + funder-critical checklist ────────────────
r.get('/funding/readiness', async (c) => {
  const p = await getProfile(c.env, getCentreId(c));
  const items = [
    { key: 'registration', label: 'ECD centre registration certificate', done: p.registrationComplete },
    { key: 'npo', label: 'NPO / legal registration', done: p.npo || p.npoDocsComplete },
    { key: 'financials', label: 'Financial records (fees tracked)', done: p.feeRecords > 0 },
    { key: 'children', label: 'Child enrolment records', done: p.children > 0 },
    { key: 'attendance', label: 'Attendance records maintained', done: p.attendanceThisMonth > 0 },
    { key: 'impact', label: 'Impact & enrolment data for reporting', done: p.children > 0 && p.attendanceThisMonth > 0 },
    { key: 'safety', label: 'Health & safety compliance', done: p.safetyComplete },
    { key: 'consent', label: 'Parent consent forms', done: p.consentComplete },
  ];
  const done = items.filter((i) => i.done).length;
  const score = Math.round((done / items.length) * 100);
  return c.json({ ok: true, data: { score, done, total: items.length, items, centre: p.name } });
});

// ── Pipeline (funding CRM) ──────────────────────────────────────
r.get('/funding/applications', async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT a.*, o.name AS opportunity_name, o.funder, o.category, o.deadline
     FROM funding_applications a LEFT JOIN funding_opportunities o ON a.opportunity_id = o.opportunity_id
     WHERE a.centre_id = ?
     ORDER BY a.updated_at DESC`,
  ).bind(getCentreId(c)).all();
  return c.json({ ok: true, data: rows.results });
});

const NewApp = z.object({ opportunity_id: z.string().optional(), title: z.string().trim().min(1).max(200), amount_requested: z.number().optional() });
r.post('/funding/applications', async (c) => {
  const parsed = NewApp.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ ok: false, error: 'A title is required.' }, 400);
  const id = crypto.randomUUID();
  const d = parsed.data;
  await c.env.DB.prepare(
    'INSERT INTO funding_applications (application_id, opportunity_id, title, amount_requested, created_by, centre_id) VALUES (?, ?, ?, ?, ?, ?)',
  ).bind(id, d.opportunity_id || null, d.title, d.amount_requested ?? null, uid(c), getCentreId(c)).run();
  return c.json({ ok: true, data: { application_id: id } });
});

r.put('/funding/applications/:id', async (c) => {
  const b = (await c.req.json().catch(() => ({}))) as any;
  const fields: string[] = [];
  const vals: any[] = [];
  const set = (col: string, v: any) => { fields.push(`${col} = ?`); vals.push(v); };
  if (b.status !== undefined) {
    if (!['draft', 'submitted', 'under_review', 'approved', 'rejected', 'received'].includes(b.status)) return c.json({ ok: false, error: 'Invalid status' }, 400);
    set('status', b.status);
    if (b.status === 'submitted') set('submitted_at', new Date().toISOString());
    if (['approved', 'rejected', 'received'].includes(b.status)) set('decision_at', new Date().toISOString());
  }
  if (b.amount_requested !== undefined) set('amount_requested', b.amount_requested);
  if (b.amount_awarded !== undefined) set('amount_awarded', b.amount_awarded);
  if (b.notes !== undefined) set('notes', b.notes);
  if (b.title !== undefined) set('title', b.title);
  if (!fields.length) return c.json({ ok: false, error: 'No fields to update' }, 400);
  set('updated_at', new Date().toISOString());
  vals.push(c.req.param('id'), getCentreId(c));
  await c.env.DB.prepare(`UPDATE funding_applications SET ${fields.join(', ')} WHERE application_id = ? AND centre_id = ?`).bind(...vals).run();
  return c.json({ ok: true });
});

r.delete('/funding/applications/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM funding_applications WHERE application_id = ? AND centre_id = ?').bind(c.req.param('id'), getCentreId(c)).run();
  return c.json({ ok: true });
});

// ── AI Application Builder (Workers AI) ─────────────────────────
const SECTIONS: Record<string, string> = {
  cover_letter: 'a concise, warm cover letter to the funder',
  organisation_profile: 'an organisation profile describing the centre, its community and track record',
  motivation: 'a compelling motivation explaining why this centre needs and deserves the funding',
  project_proposal: 'a clear project proposal with objectives, activities and expected outcomes',
  budget: 'a realistic itemised budget narrative (in South African Rand) appropriate to the request',
  impact_statement: 'an impact statement quantifying how many children and families benefit and how outcomes will be measured',
};

r.post('/funding/applications/:id/generate', async (c) => {
  const centre = getCentreId(c);
  const b = (await c.req.json().catch(() => ({}))) as any;
  const section = String(b.section || 'motivation');
  if (!SECTIONS[section]) return c.json({ ok: false, error: 'Unknown section' }, 400);
  const app = await c.env.DB.prepare(
    `SELECT a.*, o.name AS opp_name, o.funder, o.category, o.description AS opp_desc, o.max_amount
     FROM funding_applications a LEFT JOIN funding_opportunities o ON a.opportunity_id = o.opportunity_id
     WHERE a.application_id = ? AND a.centre_id = ?`,
  ).bind(c.req.param('id'), centre).first<any>();
  if (!app) return c.json({ ok: false, error: 'Application not found' }, 404);
  const p = await getProfile(c.env, centre);

  const facts = [
    `Centre name: ${p.name}`,
    p.npo ? 'Registered NPO' : 'NPO registration in progress',
    p.province ? `Province: ${p.province}` : '',
    `${p.children} children currently enrolled${p.lowIncome ? `, ${p.lowIncome} from low-income households` : ''}`,
    `Funder: ${app.funder || 'the funder'}${app.opp_name ? ` — ${app.opp_name}` : ''}`,
    app.opp_desc ? `Opportunity: ${app.opp_desc}` : '',
    app.amount_requested ? `Amount requested: R${Number(app.amount_requested).toLocaleString()}` : '',
  ].filter(Boolean).join('\n');

  const lang = b.language && b.language !== 'en' ? `Write it in ${({ st: 'Sesotho', zu: 'isiZulu', tn: 'Setswana', af: 'Afrikaans' } as any)[b.language] || b.language}. ` : '';
  const prompt = `Write ${SECTIONS[section]} for a South African early childhood development (ECD) centre's funding application. ${lang}Use these facts:\n\n${facts}\n\nBe specific, credible and grant-ready. Do not invent registration numbers or financial figures beyond what is given.`;

  const aiResponse = await c.env.AI.run('@cf/meta/llama-3.2-3b-instruct', {
    messages: [
      { role: 'system', content: 'You are an expert South African ECD funding-application writer. You produce clear, credible, submission-ready text for grant applications by early childhood development centres. Warm, professional, factual.' },
      { role: 'user', content: prompt },
    ],
    max_tokens: 900,
  });
  const output = (aiResponse as any).response || '';
  const label = section.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
  const block = `## ${label}\n\n${output.trim()}`;
  const content = app.content ? `${app.content}\n\n${block}` : block;
  await c.env.DB.prepare("UPDATE funding_applications SET content = ?, updated_at = datetime('now') WHERE application_id = ? AND centre_id = ?").bind(content, app.application_id, centre).run();
  try {
    await c.env.DB.prepare('INSERT INTO generated_docs (doc_id, template_id, input_variables, output_text, doc_type, language, created_by, centre_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(`fund-${Date.now()}`, null, JSON.stringify({ application_id: app.application_id, section }), output, 'funding', b.language || 'en', uid(c), centre).run();
  } catch { /* generated_docs logging is best-effort */ }
  return c.json({ ok: true, data: { section, label, output: output.trim(), content } });
});

export default r;
