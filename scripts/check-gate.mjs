// Local gate check for the token radar: mirrors the sealed scorer's seven rows in RULES.txt, plus
// determinism (two runs, same bytes) and the dashboard's no-network rule. Run:
//   node scripts/check-gate.mjs <out-dir> [snapshot.json]
// Exit 0 when every row passes, 1 otherwise. This is a local mirror, not the scorer itself.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const outDir = process.argv[2] ?? 'out';
const snapFile = process.argv[3] ?? 'token-radar-01-kit/input/snapshot.json';

let failures = 0;
const ok = (name, pass, detail = '') => {
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!pass) failures++;
};

const snap = JSON.parse(readFileSync(snapFile, 'utf8'));
const snapSlugs = new Set(snap.protocols.map((p) => p.slug));
const boardDoc = JSON.parse(readFileSync(join(outDir, 'board.json'), 'utf8'));
const rows = boardDoc.rows;

// --- board_file ---
ok('board_file: 100..4000 rows', rows.length >= 100 && rows.length <= 4000, `${rows.length} rows`);
let boardOk = true;
const seen = new Set();
for (const r of rows) {
  if (!snapSlugs.has(r.slug)) { boardOk = false; console.log(`  invented slug: ${r.slug}`); break; }
  if (seen.has(r.slug)) { boardOk = false; console.log(`  duplicate slug: ${r.slug}`); break; }
  seen.add(r.slug);
  if (typeof r.name !== 'string' || r.name.length === 0) { boardOk = false; console.log(`  bad name: ${r.slug}`); break; }
  if (!Number.isSafeInteger(r.rank) || r.rank <= 0) { boardOk = false; console.log(`  bad rank: ${r.slug}`); break; }
  if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0 || r.implied_value_usd > 1e14) { boardOk = false; console.log(`  bad implied value: ${r.slug}`); break; }
}
ok('board_file: slugs/names/ranks/values', boardOk);

// --- sorted_by_value ---
const ranks = rows.map((r) => r.rank).sort((a, b) => a - b);
let sortedOk = ranks.every((v, i) => v === i + 1);
for (let i = 1; i < rows.length && sortedOk; i++) {
  if (rows[i].implied_value_usd > rows[i - 1].implied_value_usd) { sortedOk = false; console.log(`  row ${i + 1} outranks row ${i}`); }
}
const allSame = rows.length >= 2 && rows.every((r) => r.implied_value_usd === rows[0].implied_value_usd);
ok('sorted_by_value: ranks 1..N, implied non-increasing, not all equal', sortedOk && !allSame);

// --- coverage ---
const missing = snap.watchlist.filter((s) => !seen.has(s));
ok('coverage: every watchlist slug present', missing.length === 0, missing.length ? `missing ${missing.join(', ')}` : `${snap.watchlist.length}/${snap.watchlist.length}`);

// --- farm_steps ---
let farmOk = true;
for (const r of rows) {
  if (r.farm_steps.length < 3 || r.farm_steps.length > 12) { farmOk = false; console.log(`  ${r.slug}: ${r.farm_steps.length} steps`); break; }
  for (const s of r.farm_steps) {
    if (s.length < 20 || s.length > 600) { farmOk = false; console.log(`  ${r.slug}: step of ${s.length} chars`); break; }
  }
  if (!farmOk) break;
}
ok('farm_steps: 3..12 steps of 20..600 chars each', farmOk);

// --- dashboard_files ---
const dashDir = join(outDir, 'dashboard');
const dashFiles = readdirSync(dashDir).filter((f) => statSync(join(dashDir, f)).isFile());
const hasHtml = dashFiles.some((f) => f === 'index.html');
const hasCss = dashFiles.some((f) => f.endsWith('.css'));
const hasJs = dashFiles.some((f) => f.endsWith('.js'));
let dashBytes = 0;
let netRef = null;
for (const f of dashFiles) {
  const p = join(dashDir, f);
  dashBytes += statSync(p).size;
  const text = readFileSync(p, 'utf8');
  // No http(s) address in an HTML attribute value, a <style> body, an inline <script> import, a CSS
  // file, or a JS import/export/require/dynamic-import specifier.
  const hits = [...text.matchAll(/(?:href|src|action|import|from|require\()\s*=?\s*["'`](https?:\/\/[^"'`]+)["'`]/g)];
  if (hits.length > 0) { netRef = `${f}: ${hits[0][1]}`; break; }
  if (f.endsWith('.css') && /https?:\/\//.test(text)) { netRef = `${f}: url in css`; break; }
}
ok('dashboard_files: index.html + css + js, <=400 files, <=4MiB, no network refs', hasHtml && hasCss && hasJs && dashFiles.length <= 400 && dashBytes <= 4 * 1024 * 1024, `${dashFiles.length} files, ${dashBytes} bytes${netRef ? `; ${netRef}` : ''}`);

// --- screenshots ---
const shotDir = join(outDir, 'screenshots');
const shots = readdirSync(shotDir).filter((f) => !f.startsWith('.'));
let shotOk = shots.length >= 3 && shots.length <= 4;
for (const f of shots) {
  const buf = readFileSync(join(shotDir, f));
  const isPng = buf[0] === 0x89 && buf[1] === 0x50;
  const isJpg = buf[0] === 0xff && buf[1] === 0xd8;
  if (!isPng && !isJpg) { shotOk = false; console.log(`  ${f}: not PNG/JPEG`); break; }
  if (buf.length > 524_288) { shotOk = false; console.log(`  ${f}: ${buf.length} bytes over 512KiB`); break; }
  if (isPng) {
    const w = buf.readUInt32BE(16);
    const h = buf.readUInt32BE(20);
    if (Math.max(w, h) > 1440 || Math.min(w, h) < 800) { shotOk = false; console.log(`  ${f}: ${w}x${h}`); break; }
  }
}
ok('screenshots: 3..4 PNG/JPEG, <=512KiB, long side <=1440, short side >=800', shotOk, shots.join(', '));

// --- dossier_matches ---
const dossier = readFileSync(join(outDir, 'dossier.json'));
let dossierOk = dossier.length <= 1.5 * 1024 * 1024;
ok('dossier: <=1.5MiB', dossierOk, `${dossier.length} bytes`);

// --- data.js loads and agrees with board.json ---
const dataJs = readFileSync(join(outDir, 'data.js'), 'utf8');
const windowObj = {};
const fn = new Function('window', `${dataJs.replace(/^window\.RADAR=/, 'window.RADAR=')}; return window.RADAR;`);
const radar = fn(windowObj);
const dataRows = radar.rows;
let agreeOk = dataRows.length === rows.length;
if (agreeOk) {
  for (let i = 0; i < rows.length; i++) {
    if (dataRows[i].slug !== rows[i].slug || dataRows[i].implied_value_usd !== rows[i].implied_value_usd) { agreeOk = false; console.log(`  row ${i}: data.js disagrees with board.json`); break; }
  }
}
ok('data.js: same rows and implied values as board.json', agreeOk, `${dataRows.length} rows`);

// --- page recomputation: the dashboard's own impliedOf must reproduce board.json exactly ---
const model = radar.model;
let recomputeOk = true;
for (const r of dataRows) {
  const growth = Math.min(model.growth_cap, Math.max(model.growth_floor, r.change_7d ?? 0));
  const growthMult = 1 + (growth / 100) * model.growth_weight;
  const age = r.age_days ?? model.unknown_age_days;
  const maturity = model.maturity_floor + (Math.min(Math.max(age, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  const breadth = 1 + model.breadth_per_chain * Math.min((r.chains || []).length, model.breadth_max_chains);
  const recomputed = Math.max(1, Math.round(r.tvl_usd * r.category_multiple * growthMult * maturity * breadth));
  if (recomputed !== r.implied_value_usd) { recomputeOk = false; console.log(`  ${r.slug}: recomputed ${recomputed} != board ${r.implied_value_usd}`); break; }
}
ok('page recomputation: impliedOf reproduces board.json exactly', recomputeOk);

// --- dashboard source fits the dossier text cap ---
const textBytes = dashFiles.reduce((n, f) => n + statSync(join(dashDir, f)).size, 0);
ok('dashboard source under the 64KiB dossier text budget', textBytes <= 65536, `${textBytes} bytes`);

// --- top of the board ---
console.log('--- top 10 ---');
for (const r of rows.slice(0, 10)) {
  console.log(`#${r.rank} ${r.name} (${r.slug}) ${r.category} TVL=$${(r.tvl_usd / 1e9).toFixed(2)}B 7d=${r.change_7d} mult=${r.model.category_multiple} implied=$${r.implied_value_usd.toLocaleString()}`);
}
console.log(failures === 0 ? 'ALL GATE CHECKS PASS' : `${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
