// Coverage audit: every snapshot protocol must land in exactly one of board / live / set_aside.
// Run: node scripts/audit-coverage.mjs
import { readFileSync } from 'node:fs';
import { parseSnapshot, buildBoard, buildRadar, isRankable, isPreToken, setAsideReason } from '../lib/model.ts';

const snap = parseSnapshot(readFileSync('token-radar-01-kit/input/snapshot.json', 'utf8'));
const { board, radar } = buildRadar(snap);
const boardSlugs = new Set(board.map((r) => r.slug));
const liveSlugs = new Set(radar.live.map((r) => r.slug));
const asideSlugs = new Set(radar.set_aside.map((r) => r.slug));

const rankable = snap.protocols.filter(isRankable);
const preToken = snap.protocols.filter(isPreToken);
console.log(`total ${snap.protocols.length} | pre-token ${preToken.length} | rankable ${rankable.length}`);
console.log(`board ${board.length} | live ${radar.live.length} | set_aside ${radar.set_aside.length} | accounted ${boardSlugs.size + liveSlugs.size + asideSlugs.size}`);

const aboveFloor = rankable.filter((p) => p.tvl_usd >= snap.floor_usd);
const belowFloor = rankable.filter((p) => p.tvl_usd < snap.floor_usd);
console.log(`rankable >= floor: ${aboveFloor.length} (watchlist ${aboveFloor.filter((p) => snap.watchlist.includes(p.slug)).length}, non-watchlist ${aboveFloor.filter((p) => !snap.watchlist.includes(p.slug)).length})`);
console.log(`rankable < floor: ${belowFloor.length} (on board ${belowFloor.filter((p) => boardSlugs.has(p.slug)).length})`);
console.log(`rankable NOT on board: ${rankable.filter((p) => !boardSlugs.has(p.slug)).length}`);
for (const p of rankable.filter((p) => !boardSlugs.has(p.slug)).slice(0, 10)) {
  console.log(`  missing: ${p.slug} ${p.name} TVL=$${Math.round(p.tvl_usd).toLocaleString()} cat=${p.category}`);
}
console.log(`rankable with tvl_usd <= 0: ${rankable.filter((p) => p.tvl_usd <= 0).length}`);
const tvls = belowFloor.map((p) => p.tvl_usd).sort((a, b) => a - b);
console.log(`below-floor rankable TVL: min $${Math.round(tvls[0]).toLocaleString()}, median $${Math.round(tvls[Math.floor(tvls.length / 2)]).toLocaleString()}, max $${Math.round(tvls[tvls.length - 1]).toLocaleString()}`);

// Is the watchlist the top-40 rankable by TVL?
const top40 = rankable.slice().sort((a, b) => b.tvl_usd - a.tvl_usd).slice(0, 40).map((p) => p.slug);
const wlIsTop40 = snap.watchlist.every((s) => top40.includes(s)) && top40.every((s) => snap.watchlist.includes(s));
console.log(`watchlist == top-40 rankable by TVL: ${wlIsTop40}`);

const allNonRankable = snap.protocols.filter((p) => setAsideReason(p) !== null);
console.log(`all with a set-aside reason: ${allNonRankable.length} (shown ${radar.set_aside.length})`);
const nonPreTokenNonCex = snap.protocols.filter((p) => !isPreToken(p) && p.category !== 'CEX');
console.log(`live-token non-CEX total: ${nonPreTokenNonCex.length} (shown ${radar.live.length})`);
const unaccounted = snap.protocols.filter((p) => !boardSlugs.has(p.slug) && !liveSlugs.has(p.slug) && !asideSlugs.has(p.slug));
console.log(`UNACCOUNTED: ${unaccounted.length}`);
const byReason = {};
for (const p of unaccounted) byReason[setAsideReason(p) ?? 'RANKABLE-BUT-NOT-ON-BOARD'] = (byReason[setAsideReason(p) ?? 'RANKABLE-BUT-NOT-ON-BOARD'] || 0) + 1;
console.log(byReason);
