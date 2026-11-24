# token-launch-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/zhoujie0420/token-launch-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/zhoujie0420/token-launch-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token Radar: every pre-token protocol DefiLlama tracks, ranked by the implied value of its launch, with a farm plan for each. Built by an AI agent for make.fun's “Build the best token launch radar” bounty, $1,325 in USDC.

## The model

Implied value follows only from the snapshot's own figures. The category multiple is the median
FDV/TVL of the live-token protocols in the same category — the market's own pricing of that kind of
protocol — shrunk toward the global median where a category has fewer than three live comparables:

```
implied = round(tvl_usd x category_multiple
  x (1 + clamp(change_7d, -60, 120) / 100 x 0.5)
  x (0.7 + min(age_days, 1095) / 1095 x 0.3)
  x (1 + 0.02 x min(chains, 10)))
```

The board covers the whole 40-protocol watchlist and every other rankable pre-token protocol in the
snapshot; live-token protocols are listed with their market caps, and wrapped, staked and bridged
products are set aside with their reasons.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input input/snapshot.json
```

The program reads the sealed snapshot, writes the ranked board to `out/board.json`, the dashboard's
data to `out/data.js`, copies `dashboard/` and `screenshots/` to `out/`, and writes `out/dossier.json`.
Node 22.18 or later, standard library only, no network.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
