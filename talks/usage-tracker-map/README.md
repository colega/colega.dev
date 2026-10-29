# The Map That Forgets: FOSDEM 2027 talk

25-minute talk about [`pkg/usagetracker/tenantshard`](https://github.com/grafana/mimir/tree/main/pkg/usagetracker/tenantshard) in Grafana Mimir. reveal.js 5.1.0, fonts and libraries are in `vendor/`, so it works offline.

## Run

```
python3 -m http.server 8765
open http://127.0.0.1:8765/
```

Opening `index.html` from the file system also works.

## Present

- `→` / space: next step. Most diagrams animate step by step.
- `S`: speaker view, with notes, the next slide and a timer. Every note starts with a `[m:ss]` target time.
- `F`: full screen. `B`: black screen. `Esc`: overview.
- `?shot` in the URL turns off animations (only for screenshots).

## Files

- `index.html`: slides and speaker notes.
- `anim.js`: the step-driven diagrams (architecture, clock face, group layout, SWAR match, bit packing, probe chain, three generations of delete, SWAR cleanup, lock holds, timeline).
- `bg.js`: the background on title and section slides: a map that fills, ages, and gets cleaned up by a sweep.
- `theme.css`: Grafana-style dark theme.
- `tools/shot.sh`, `tools/shots.sh`: headless Chrome screenshots to `out/shots/`, for example `tools/shots.sh s05=/5/0/3` (slide 5, fragment 3).
- `tools/walk.js`: clicks through all 83 steps in real Chrome with animations on. It saves a screenshot per step to `out/live/` and reports JS errors, failed requests, and elements outside the slide. `tools/check.js` checks the speaker notes. Run `npm install` in `tools/` once, then `node tools/walk.js` while the server runs.
- `bench/bench_test.go`: the Go map comparison on slide 13. It imports Mimir packages, so copy it into a directory of the Mimir repo to run it.

## Sources for the numbers

| Slide | Number | Source |
|---|---|---|
| One goroutine per shard | 12.48 ms to 38 µs, -58% geomean | #10164 benchmark |
| Reality | 30.3 vs 20.0 B/series, ~50 ns Put, 61.9 vs 5.4 ms Cleanup | `bench/` on M3 Pro, Go 1.27.3, 10M series |
| Reality | "up to 14% slower than fixed shards" | commit 2df988d0e6 (Jul 2025) |
| Branch prediction | 8.63 to 6.78 ms (-21%) | #16778 |
| Three attempts | AVX2 vs SWAR table | #16825 (c7i.2xlarge, instance 1) |
| One-character fix | 140 to 230 ms to 15 ms | #16882, #16892 |
| Chunks | ~460 holds, 24 µs avg, 110 µs max | #16892 |

## Checked facts

- Slide 4, 1B series per partition: the scale that #16473 sizes the Cleanup work for ("at 1e9 series per partition a single shard takes ~274ms").
- Slide 13, keys array: commit 2df988d0e6 (`dynamictenantshard`, Jul 2025) made the shard count a parameter (`New(sz, shard, totalShards)`) and moved keys to their own array; 2fcb158b9e switched to 16 shards.
- Slide 22: #16473 (SSE2 + NEON) is open as of 2026-10-28.
