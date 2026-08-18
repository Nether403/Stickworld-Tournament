# Spec 3 — Design

**Depth:** full. This document is detailed enough to implement from directly.
**Fork:** Branch A (ADR-0001). Worker stays Node.
**Host / kit / auth decisions:** ADR-0005.
**Do not execute until approved.** Spec 3 was approved 2026-08-18. Execution follows `tasks.md`.

The previous scope draft was not enough to build from: it named two games and a
kit but omitted who steps the sim, where practice lives, Phaser pin, course
numbers, score events, workspace layout, and the registration seam. Those are
now here, in `docs/games/*.md`, and in `tasks.md`.

---

## 1. Design principle

> Build one shipping game properly, record its goldens, then extract only what
> that game proved. Phaser never writes the sim. The server still defines the
> ranked run (Spec 2).

Sequencing is load-bearing:

```
Hookline local (sim → goldens → Phaser view → host → /v1 e2e)
    → extract kit (byte-identical goldens)
    → Pickaxe against the kit (registration seam only)
```

Inverting that order (kit first) is how this platform would grow joints nobody
needs.

---

## 2. Repository layout (what Spec 3 adds)

```
apps/web/
  app/play/[slug]/page.tsx          # dynamic(ssr:false) GameHost island
  app/leaderboards/[slug]/page.tsx
  lib/play/PlayIsland.tsx
  lib/auth/email.ts                 # Neon Auth email wrappers
docs/
  adr/0005-spec3-game-host-and-auth.md
  games/hookline-sprint.md
  games/pickaxe-ascent.md
  budgets/spec3-bundles.md          # written in Task 2
  legal/inspiration/*.md
games/
  hookline-sprint/                  # @stickworld/game-hookline-sprint
  pickaxe-ascent/                   # @stickworld/game-pickaxe-ascent
packages/
  game-host/                        # Stepper, modes, attempt client
  physics-kit/                      # extracted in Task 2
  scoring/                          # extracted in Task 2
  input/                            # extracted in Task 2
  ui/                               # extracted in Task 2
  telemetry/                        # extracted in Task 2 (no-op)
```

`pnpm-workspace.yaml` gains `'games/*'`.

Task 1 puts rope/scoring/input **inside** `games/hookline-sprint/src/simulation`
and `.../client`. Task 2 moves proved code into packages and re-points imports.
Pickaxe never copies those files; it imports the packages.

Game package exports:

```json
{
  ".": "./dist/index.js",
  "./client": "./dist/client/index.js"
}
```

`.` is simulation + manifest only (worker-safe). `./client` may import Phaser
and MUST NOT be imported from `packages/platform/src/verify.ts`.

`apps/web/next.config.ts` `transpilePackages` SHALL include
`@stickworld/game-host`, both game packages, `@stickworld/sim-core`,
`@stickworld/replay`, `@stickworld/ui`, `@stickworld/input`,
`@stickworld/physics-kit`, `@stickworld/scoring`, `@stickworld/telemetry`.

---

## 3. Pins

| package | version | notes |
|---|---|---|
| `phaser` | `4.2.1` | exact. Client-only dependency of `./client` and `apps/web` |
| `next` | `16.3.1` | already |
| `react` / `react-dom` | `19.2.8` | already |
| `@dimforge/rapier2d-compat` | `0.20.0` | already; do not bump |

No CSS framework, no extra renderer, no `phaser3-rex-plugins`.

---

## 4. GameHost (owns time)

`packages/game-host` is created in **Task 1**. It is not an extraction from
Hookline; it is Spec 1 §2 + competitive-spec §8 applied once.

```ts
export type PlayMode = 'practice' | 'ranked';

export interface GameView {
  onFrame(args: {
    renderState: unknown;
    interpolationAlpha: number;
    tick: number;
    events: readonly ScoreEvent[];
    score: number;
    finished: boolean;
  }): void;
  onPhase(phase: 'countdown' | 'playing' | 'paused' | 'results'): void;
}

export interface RankedSession {
  attemptId: string;
  token: string;
  seed: readonly [number, number, number, number];
  gameVersion: string;
  expiresAt: string;
}

export interface GameHostConfig {
  game: StickworldGame;
  slug: string;
  mode: PlayMode;
  view: GameView;
  fetchImpl?: typeof fetch;          // tests inject
  now?: () => number;                // ms; default performance.now
}

export class GameHost {
  readonly mode: PlayMode;
  readonly paused: boolean;
  start(): Promise<void>;            // ranked: POST attempts, then countdown
  stop(): void;                      // ranked refresh/close → abandon (no finish)
  setPaused(paused: boolean): void;  // throws in ranked
  dispose(): void;
}
```

Loop (playing phase only):

1. `dt = clamp(now() - last, 0, MAX_FRAME_DELTA)`
2. `consumed = stepper.advance(dt / 1000)`
3. For each consumed tick: `applyInput` **only for recorder events on that tick**
   (same as `playReplay`), then `sim.step()`. Bool `hook` is a **level latch**
   inside the simulation: `applyInput(1, 1)` stays held until `applyInput(1, 0)`.
   Ticks with no events must not pulse the action.
4. `view.onFrame({ interpolationAlpha: stepper.interpolationAlpha, ... })`

Countdown: 3 seconds wall-clock (not sim ticks). Sim is created but **not
stepped**. Ranked attempt is already issued (TTL 15 min). First input accepted
after GO.

Ranked finish: `encodeReplay` of the `Recorder` snapshot →
`POST /v1/attempts/:id/finish` with `{ token, replay: b64, claimedScore }`.
Poll `GET /v1/runs/:runId` until `verified` or `rejected` (max 30 s in the UI).
Then show results + `GET /v1/leaderboards/:seasonId/:gameId` viewer row.

Practice finish: results from local events only. No POST.

Hidden-tab: host does not pause ranked. Stepper already clamps (competitive-spec
§2). Practice: `document.visibilityState === 'hidden'` MAY auto-pause.

`GameHost` MAY use `performance.now` and `document`. It MUST NOT import Phaser.

Attempt HTTP lives in `packages/game-host/src/ranked-client.ts` using `fetch`
against same-origin `/v1`.

---

## 5. Hookline Sprint

Authoritative numbers: `docs/games/hookline-sprint.md`. This section is the
module map and worker wiring.

### 5.1 Manifest (copy into `games/hookline-sprint/src/manifest.ts`)

```ts
export const hooklineSprintManifest: GameManifest = {
  id: 'hookline-sprint',
  registryId: 1,
  gameVersion: '1.0.0',
  simulationVersion: 1,
  scoringVersion: 1,
  rankedFormat: 'fixed-course',
  attemptShape: { kind: 'single' },
  maxRunTicks: 5400,
  tickRate: 60,
  actions: [
    { id: 1, name: 'aim', kind: 'int', min: 0, max: 359 },
    { id: 2, name: 'hook', kind: 'bool' },
  ],
  budget: {
    maxRigidBodies: 16,
    maxColliders: 32,
    maxJoints: 4,
    maxReplayBytes: 8192,
    maxScoreEvents: 512,
  },
};
```

### 5.2 Files (Task 1, all local)

```
games/hookline-sprint/
  src/index.ts                 # StickworldGame export
  src/manifest.ts
  src/simulation/course.ts     # anchors, gates, ledge numbers
  src/simulation/scoring.ts    # event emitters + combo
  src/simulation/simulation.ts # createSimulation
  src/client/scene.ts          # Phaser view (GameView)
  src/client/index.ts
  tests/deterministic.test.ts
  tests/scoring.test.ts
  tests/replay.test.ts
  tests/contract.test.ts       # wraps contract-suite
  fixtures/sample.swr
  conformance/golden/sample.json
  conformance/golden/hashes.json
```

### 5.3 `renderState` (view contract)

```ts
{
  playerX: number; playerY: number; playerVx: number; playerVy: number;
  attached: boolean;
  ropeAnchorX: number | null;
  ropeAnchorY: number | null;
  restLength: number | null;
  gatesPassed: boolean[];     // copy, not a live array
  comboHundredths: number;
  score: number;
  tick: number;
  finished: boolean;
  fail: boolean;
}
```

Mutating a snapshot MUST NOT change `stateHash` (contract-suite already asserts).

---

## 6. Input

Until Task 2, Hookline client maps pointer/keyboard to `hook` and calls
`Recorder.record` only on edges.

After extraction, `@stickworld/input`:

```ts
export function bindControls(args: {
  canvas: HTMLElement;
  actions: readonly ActionDescriptor[];
  getTick: () => number;
  recorder: Recorder;
  onEdge: (actionId: number, value: number) => void; // host applyInput + record
  autoAim: () => { x: number; y: number }; // keyboard ray direction
}): { dispose(): void };
```

The binder turns pointer/keyboard into **edges**. The host records those edges
and feeds the same ticks into `applyInput`. It does **not** call `applyInput(1,1)`
on every held tick — `playReplay` would not, and the hashes would diverge.

Do not record `hook=1` for 5400 ticks.

---

## 7. Pickaxe Ascent

Authoritative numbers: `docs/games/pickaxe-ascent.md`.

Manifest `registryId: 2`, `maxRunTicks: 7200`, actions `aim` int 0–359 and
`hook` bool.

Kinematic pickaxe: each pre-step,
`body.setNextKinematicRotation(aim * π / 180)` using `detmath.sin`/`cos` only
if we convert through a unit vector; Rapier takes a rotation `f32`. Compute
`θ = aim * detmath` constant `PI/180` stored as a literal split if needed.
**Do not call `Math.sin`.** `detmath` already has `sin`/`cos`.

If `setNextKinematicRotation` is awkward with Rapier 0.20 compat, the allowed
kit extension is a tiny helper `setKinematicAngle(body, degrees: number)` in
`physics-kit` that uses `detmath`. Record it in the Pickaxe finding log if the
helper was not needed by Hookline (expected).

---

## 8. Extraction gate (Task 2)

Procedure, no shortcuts:

1. Capture `games/hookline-sprint/conformance/golden/hashes.json` and
   `sample.json` on the Task 1 commit (already in git).
2. Move rope/anchor/raycast/gate helpers → `packages/physics-kit`.
3. Move combo → `packages/scoring`.
4. Move controls → `packages/input`.
5. Move results/countdown/tokens → `packages/ui`.
6. Add `packages/telemetry` `emit(event, tags)` no-op.
7. Re-run Hookline tests. Hashes and sample score **must match exactly**.
8. Write `docs/budgets/spec3-bundles.md` with the measured gzip sizes.

`physics-kit` factories take `SimWorld` + Rapier module. They MUST create
bodies through `sim.createRigidBody` so the registry order stays defined.

Lint: add `packages/physics-kit/src/**/*.ts` and `packages/scoring/src/**/*.ts`
to the determinism ESLint files glob.

---

## 9. Visual language (`@stickworld/ui` tokens)

```ts
export const tokens = {
  bg: '#1a1f2b',
  ink: '#f4efe6',
  accent: '#e85d4c',
  success: '#7ec8a3',
  hazard: '#c45c5c',
  muted: '#8b93a7',
  font: 'ui-sans-serif, system-ui, sans-serif',
} as const;
```

Capsule stickman: head disc radius `0.18` m stacked on the physics capsule is
**presentation only** (extra circle in Phaser, not a rigid body).

Countdown, pause overlay (practice), results table (event type + points),
leaderboard widget (uses existing `/v1/leaderboards/...`), PB toast: React
components in `@stickworld/ui`. Phaser does not draw HTML chrome.

---

## 10. Auth shell changes

`apps/web/app/auth/[path]/page.tsx`:

- Keep Google `signIn.social({ provider: 'google', callbackURL: '/' })`.
- Add email sign-up and sign-in fields calling Neon Auth email APIs
  (`signUp.email` / `signIn.email` or the 0.5.0-beta equivalents — wrap in
  `apps/web/lib/auth/email.ts` if names differ).
- **Delete the GitHub button.**

Home catalogue: cards for Hookline and Pickaxe (practice CTA always, ranked CTA
if session). Test Chamber is not listed.

---

## 11. Integration checklist (CI merge gate)

A game in `games/<slug>` may not merge unless all exist and tests pass:

- [ ] `docs/games/<slug>.md`
- [ ] `docs/legal/inspiration/<slug>.md`
- [ ] `src/manifest.ts` with stable `registryId`, versions, action table, budget
- [ ] Score contract in the design doc matches tests
- [ ] `tests/deterministic.test.ts` (Node hash vs committed golden)
- [ ] Browser score job **or** inclusion in `pnpm score:browser` matrix for Chromium
      (four-runtime identity remains `stress-01` + Hookline hashes in Task 1.x)
- [ ] `tests/scoring.test.ts` — one test per score event type
- [ ] `fixtures/sample.swr` + worker verifies to `conformance/golden/sample.json`
- [ ] `tests/contract.test.ts` runs `contract-suite`
- [ ] Playwright touch on mobile viewports (shared play e2e)
- [ ] Budget asserted in simulation
- [ ] Accessibility: instructions copy on `/play/<slug>`, gates/checkpoints not
      colour-only, no hover-only control
- [ ] Lazy-load: opening this slug does not fetch another game's `./client` chunk
- [ ] Inspiration ledger (above)

CI implementation: `packages/config-eslint` or `scripts/check-game-integration.mjs`
run from the `verify` job, globbing `games/*`.

Four-runtime Hookline determinism: Node unit + Playwright Chromium/Firefox/WebKit
on a headless page that loads the **simulation module only** (same pattern as
Test Chamber `score:browser`). Mobile viewports are the touch tests, not a fifth
physics runtime (Spec 1 already covered mobile-chromium/webkit on `stress-01`).

---

## 12. Worker and seed seam

`packages/platform/src/verify.ts`:

```ts
const GAMES = new Map<number, StickworldGame>([
  [0, testChamberGame],
  [1, hooklineSprintGame],
  [2, pickaxeAscentGame],
]);
```

`packages/platform` worker extra deps: the two game packages (`.` export only).

`packages/db/src/seed.ts`: helper `seedGame({ slug, registryId, maxRunTicks })`
idempotent `onConflictDoNothing`, plus `fixed-course` and `daily-seed` season
games on `ci`. Hookline `maxRunTicks: 5400`, Pickaxe `7200`, Test Chamber `600`.

`apps/web` `GET /v1/games` already lists seeded games — no route change expected.

---

## 13. Telemetry tags (no-op)

```ts
type Tags = {
  gameId: string;
  gameVersion: string;
  seasonId?: string;
  mode: PlayMode;
  browserFamily?: string;
};
emit(name: 'host.start' | 'host.finish' | 'verify.shown', tags: Tags): void;
```

Games must run if `emit` is a no-op. Do not import Sentry here.

---

## 14. Legal grep

Add CI `verify` step: `scripts/check-forbidden-names.mjs` greps the repo for the
list in `docs/legal/brand-and-ip-clearance.md` §4. Allowlist:

- `docs/legal/brand-and-ip-clearance.md`
- `.kiro/specs/README.md`
- `Research/**`
- `Developing a Web-Based Stickman Tournament Platform/**`

---

## 15. What Spec 4 inherits

- GameHost + play island pattern
- Kit packages and the byte-identical extraction ritual
- Checklist CI
- Registration seam (seed + map)
- UI tokens
- Working evidence that Pickaxe did not need a worker rewrite

Moving platforms, ragdoll, projectiles: still not here.

---

## 16. Risks

| Risk | Handling |
|---|---|
| Phaser 4 + Next 16 SSR | `dynamic(..., { ssr: false })` only |
| Rapier in the API bundle | keep `./verify` split; play island imports games on the client |
| Aim spam blows Pickaxe replays | record-on-change; 15 KB fixture cap |
| Kit extraction changes hashes | Task 2 fails closed; no golden regen |
| Email API names in Neon beta | wrapper module; no new vendor |
| Real phones not in CI | demo gate; Playwright mobile viewports in CI |

---

## 17. Tasks

| # | Task | Plan ref |
|---|---|---|
| 1 | Hookline vertical slice + host + auth shell | 10 |
| 2 | Extract kit; byte-identical goldens; bundle baseline | 12 |
| 3 | Checklist CI + Pickaxe Ascent against the kit | 14 |
