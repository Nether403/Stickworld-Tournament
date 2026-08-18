# ADR-0005 — Spec 3 game host, auth, and extraction scope

**Status:** accepted for Spec 3 deepening (2026-08-18)
**Spec:** 3

## Context

Spec 3's scope draft left four open questions. Spec 2 is merged ([PR #2](https://github.com/Nether403/Stickworld-Tournament/pull/2)). Ranked `/v1` routes, Neon Auth, and the Node verification worker exist. The remaining questions would otherwise be re-litigated while writing Phaser scenes.

Post-merge product facts (2026-08-18), given by the project owner:

- Google OAuth works.
- Email signup is configured on Neon Auth (bundled sender, not a third vendor).
- GitHub OAuth is deferred. Do not block Spec 3 on it.

## Decisions

1. **A platform `GameHost` owns the `Stepper`, the rAF loop, pause/focus policy, and ranked attempt lifecycle.** Phaser is a view: it may read `renderState()` and `interpolationAlpha`, and it may never call `step()`, `applyInput`, or write simulation fields. Ranked pause is impossible because the host refuses it, not because each scene remembers not to.

   Rejected alternative: Phaser scene owns the stepper. That copies competitive-spec §8 into every game and makes it easy for a scene to accidentally step on a hidden tab.

2. **Practice vs ranked is a host mode, not a manifest field and not a scene flag.** The manifest still declares `rankedFormat` (the competitive contract). The host chooses `practice` (local seed, no `/v1` attempt, pause allowed) or `ranked` (`POST /v1/games/:slug/attempts`, no pause, finish submits the replay). Same `StickworldGame` module, same Phaser view.

3. **Placeholder art is Phaser primitives plus `@stickworld/ui` tokens.** Flat colour capsules, discs, and AABB platforms. No generated-asset pipeline (Spec 5). No per-game PNG dump. Tokens (background, ink, accent, success, hazard, type scale) are the visual language both games share.

4. **`@stickworld/telemetry` ships as a no-op/in-memory emitter with the standard tag set.** It must not be required for a game to run. Production observability (Sentry / OTel) stays Spec 5. No third vendor.

5. **Extract only what Hookline proved.** After Hookline's golden hash is recorded:

   | Package | Spec 3 |
   |---|---|
   | `physics-kit` | rope/distance joint, anchor, raycast attach, gate/checkpoint sensor, impact sensor |
   | `scoring` | combo / streak / integer multiplier |
   | `input` | keyboard / mouse / touch → action table, record-on-change |
   | `ui` | tokens, countdown, pause (practice), results, leaderboard widget, PB toast |
   | `telemetry` | no-op emitter |
   | `ragdoll` | **not implemented.** Ten-body stickman waits for a game that simulates one. Hookline and Pickaxe v1 use a capsule (plus a kinematic pickaxe body). Declared in `physics-kit` README roadmap. |
   | wheel, breakable, moving platform | still Spec 4 |

   This is a recorded bend of the Spec 3 scope draft's package list, which named `ragdoll` up front. The sequencing rule in that same draft wins: do not extract speculation.

   **Owner confirmation (2026-08-18):** deferral is accepted. Neither Spec 3 game simulates a ten-body stickman, so there is nothing to extract. The ten-body assembly arrives with the first game that needs it (Spec 4).

6. **Spec 3 auth surface:** Google + email signup/sign-in via Neon Auth. Remove or hide the GitHub button until a later spec. Email does not add a vendor. Discord remains out.

7. **Pickaxe Ascent v1 uses static ledges only.** Spec 4's kinematic moving platforms are Wave B. Putting them in Spec 3 would smuggle a second new primitive into the kit-proving game.

8. **Allowed platform touches when adding a shipping game:** insert `games` + `game_versions` + `season_games`, and one line in the worker `GAMES` map. Anything else (schema, cheap-checks, `/v1` shape, host API) is a **kit finding** and must be recorded in that game's `docs/games/<slug>.md`.

## Pins (as of 2026-08-18)

| package | version |
|---|---|
| `phaser` | `4.2.1` (exact, no `^`) |
| `next` | `16.3.1` (already pinned, ADR-0004) |
| `react` / `react-dom` | `19.2.8` |

Do not add a separate renderer, a CSS framework, or a UI kit. `@stickworld/ui` is React + CSS modules or inline design tokens, nothing else.

## Consequences

- Spec 3 tasks can name packages, files, course geometry, score events, and numeric limits.
- Ranked Playwright in CI uses a seeded session fixture, not live Google (flaky). Live Google + email is a manual demo gate.
- Real iPhone / mid-range Android frame-time is a demo gate. CI proves Playwright mobile viewports, physics budgets, and bundle budgets.
