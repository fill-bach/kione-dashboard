#!/usr/bin/env node
// Busca os dados diários por campanha na Meta Marketing API e gera public/data.json
// Uso:  META_ACCESS_TOKEN=... node scripts/update-data.mjs [--debug-actions]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const TOKEN = process.env.META_ACCESS_TOKEN;
const VERSION = process.env.META_API_VERSION || 'v21.0';
const START = process.env.START_DATE || '2026-09-01';
const OUT = process.env.OUT_FILE || path.join(dir, '..', 'public', 'data.json');
const DEBUG = process.argv.includes('--debug-actions');
const accounts = JSON.parse(fs.readFileSync(path.join(dir, 'accounts.json'), 'utf8'));

if (!TOKEN) { console.error('Defina a variável META_ACCESS_TOKEN.'); process.exit(1); }

// "hoje" no fuso de São Paulo
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function getJson(url, tries = 4) {
  for (let i = 1; i <= tries; i++) {
    const res = await fetch(url);
    const body = await res.json().catch(() => ({}));
    if (res.ok && !body.error) return body;
    const code = body.error?.code;
    const retry = [1, 2, 4, 17, 32, 613].includes(code) || res.status >= 500;
    if (!retry || i === tries)
      throw new Error(`Meta API ${res.status}: ${body.error?.message || 'erro desconhecido'} (code ${code})`);
    await sleep(2000 * i * i);
  }
}

function resultOf(acc, r, link) {
  if (acc.result === 'link_clicks') return link;
  const map = {};
  for (const a of r.actions || []) map[a.action_type] = Number(a.value || 0);
  for (const t of acc.actionTypes || []) if (map[t] !== undefined) return map[t];
  return 0;
}

async function fetchAccount(acc) {
  const params = new URLSearchParams({
    level: 'campaign',
    time_increment: '1',
    time_range: JSON.stringify({ since: START, until: today }),
    fields: 'campaign_id,campaign_name,spend,impressions,reach,inline_link_clicks,unique_inline_link_clicks,actions',
    limit: '500',
    access_token: TOKEN,
  });
  let url = `https://graph.facebook.com/${VERSION}/act_${acc.id}/insights?${params}`;
  const rows = [], seen = {};
  while (url) {
    const body = await getJson(url);
    for (const r of body.data || []) {
      for (const a of r.actions || []) seen[a.action_type] = (seen[a.action_type] || 0) + Number(a.value || 0);
      const spend = Number(r.spend || 0), imp = Number(r.impressions || 0);
      if (!spend && !imp) continue;
      const link = Number(r.inline_link_clicks || 0);
      rows.push([r.date_start, r.campaign_name, +spend.toFixed(2), imp, Number(r.reach || 0),
        link, Number(r.unique_inline_link_clicks || 0), resultOf(acc, r, link)]);
    }
    url = body.paging?.next || null;
  }
  if (DEBUG) {
    console.log(`\n[${acc.key}] ${acc.name} — tipos de ação encontrados (total no período):`);
    Object.entries(seen).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`   ${k}: ${v}`));
  }
  rows.sort((a, b) => a[0].localeCompare(b[0]));
  return rows;
}

const out = { updatedAt: new Date().toISOString(), start: START, end: today, rows: {} };
for (const acc of accounts) {
  try { out.rows[acc.key] = await fetchAccount(acc); }
  catch (e) { console.error(`Falha na conta ${acc.name}: ${e.message}`); process.exit(1); }
  const t = out.rows[acc.key].reduce((s, r) => [s[0] + r[2], s[1] + r[7]], [0, 0]);
  console.log(`${acc.name}: ${out.rows[acc.key].length} linhas | gasto R$ ${t[0].toFixed(2)} | resultados ${t[1]}`);
}
if (!Object.values(out.rows).some(r => r.length)) { console.error('Nenhum dado retornado. data.json não foi alterado.'); process.exit(1); }

fs.mkdirSync(path.dirname(OUT), { recursive: true });
const tmp = OUT + '.tmp';
fs.writeFileSync(tmp, JSON.stringify(out));
fs.renameSync(tmp, OUT);
console.log(`\ndata.json atualizado (${START} a ${today}).`);
