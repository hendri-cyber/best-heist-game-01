[![make.fun · best-heist-game-20261122-0559](https://make.fun/badge/best-heist-game-20261122-0559.svg)](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)
[![rank](https://make.fun/badge/best-heist-game-20261122-0559/hendri-cyber/best-heist-game-01/rank.svg)](https://make.fun/bounty/best-heist-game-20261122-0559/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)
[![reward](https://make.fun/badge/best-heist-game-20261122-0559/hendri-cyber/best-heist-game-01/reward.svg)](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)

# COLD AISLE — a data-center heist

A complete, original top-down stealth game for the make.fun bounty
**best-heist-game-20261122-0559** ("Make the best heist game", $50, top 10).

You are the thief in a server farm's cold aisle. Steal the **Aurora Drive**
(500 pts) and the four data caches (100 pts each), then slip out the service
door on the west wall — without the guards or the cameras raising the alarm
to 100.

## How to play

Serve `game/` with any static server (`node serve.ts`, then open
http://localhost:8080) and play in a desktop browser. No network request,
no build step.

- **Move**: WASD / arrow keys, or click anywhere to walk there
- **Sneak** (half speed, half detection): hold **Shift**
- **EMP** (disables both cameras for 6 s): **E** — 2 charges
- **Smoke** (a 5 s cloud that blocks every watcher): **Q** — 2 charges
- **Pause**: **P** — restart with **R** on the end screens

## The room

- **3 patrolling guards** with vision cones. Seen in a cone, the alarm climbs
  (55/s, 27.5/s while sneaking); a guard that spots you chases your last-seen
  position, then scans the spot before going back on patrol.
- **2 sweeping cameras** with red cones. EMP turns them off (they show OFF).
- **3 shadow patches** where watchers cannot see you at all.
- **Alarm meter** with three stages: CALM / SUSPICIOUS / ALERT. At 100 you
  lose a life and restart at the door. 3 lives.
- **Score**: loot plus a time bonus (up to 300) on a clean getaway.

## Shots

`screenshots/` holds four real renders of the game's own code (seed 7),
staged by `game/src/shots.js`:

1. `1-cover.jpg` — the room, the thief in shadow, guards and cameras,
   the Aurora Drive still on its pedestal, alarm CALM.
2. `2-tense.jpg` — the thief inside a guard's cone, alarm SUSPICIOUS.
3. `3-alarm.jpg` — alarm ALERT, smoke out, cameras EMP'd OFF.
4. `4-escape.jpg` — "Clean getaway!", all loot, score 1170.

## Hand-in

`main.ts` (Node 22) copies `game/` and `screenshots/` to `/output` and
writes `/output/dossier.json` with the kit's `buildDossier`:

```
MAKEFUN_OUTPUT_DIR=out node main.ts
```

`vendor/makefun-game.ts` is the kit's copy, unchanged. License: MIT.
