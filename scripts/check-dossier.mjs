// Dossier check: the dossier main.ts wrote must be byte-identical to a fresh buildDossier call
// over the same /output. buildDossier returns a Uint8Array, so decode it before comparing.
// Run: node scripts/check-dossier.mjs [out-dir]
import { readFileSync } from 'node:fs';
import { buildDossier } from '../token-radar-01-kit/starter/vendor/makefun-board.ts';

const outDir = process.argv[2] ?? 'out';
const fresh = Buffer.from(
  buildDossier(outDir, {
    text_max_bytes: 65_536,
    screenshots: { max: 4, max_bytes: 524_288 },
    dashboard: { max_files: 400, max_bytes: 4_194_304 },
  }),
).toString('utf8');
const mine = readFileSync(`${outDir}/dossier.json`, 'utf8');
console.log(`fresh ${fresh.length} bytes, written ${mine.length} bytes, byte-identical: ${fresh === mine}`);
if (fresh !== mine) {
  const a = JSON.parse(fresh);
  const b = JSON.parse(mine);
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) console.log('DIFFERS:', k);
  }
  process.exit(1);
}
