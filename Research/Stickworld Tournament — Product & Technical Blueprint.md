# Stickworld Tournament

## Game Roster, Ranking System, Technical Architecture & Development Roadmap

> **Project:** Stickworld Tournament  
> **Platform:** Browser-based competitive stickman physics games  
> **Launch roster:** 10 single-player games  
> **Competitive model:** Per-game high-score leaderboards + overall tournament ranking

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Recommended Game Roster](#2-recommended-game-roster)
3. [Tournament & Ranking System](#3-tournament--ranking-system)
4. [Platform Architecture](#4-platform-architecture)
5. [Recommended Technology Stack](#5-recommended-technology-stack)
6. [Replay Verification & Anti-Cheat](#6-replay-verification--anti-cheat)
7. [Project & Repository Structure](#7-project--repository-structure)
8. [Development Roadmap](#8-development-roadmap)
9. [Testing & Quality Assurance](#9-testing--quality-assurance)
10. [Observability](#10-observability)
11. [Launch Quality Bar](#11-launch-quality-bar)
12. [Major Risks](#12-major-risks)
13. [Recommended Development Sequence](#13-recommended-development-sequence)
14. [Final Recommendation](#14-final-recommendation)

---

# 1. Executive Summary

**Stickworld Tournament should be designed as one competitive gaming platform containing ten games rather than ten independent browser games connected afterward.**

The platform should establish a common foundation for:

- Physics simulation
- Game lifecycle
- Input handling
- Replay recording
- Score calculation
- Score verification
- User accounts
- Tournament seasons
- Game leaderboards
- Overall tournament rankings
- Analytics
- Shared UI
- Shared stickman/ragdoll systems

The individual games should then operate as relatively thin modules on top of this shared infrastructure.

## Recommended Core Stack

| Layer | Recommendation |
|---|---|
| Platform frontend | **Next.js + React + TypeScript** |
| Game framework | **Phaser 4** |
| Physics engine | **Rapier 2D / WASM** |
| Backend API | **Node.js + Fastify + TypeScript** |
| Database | **PostgreSQL** |
| Leaderboard/cache layer | **Redis** |
| Replay storage | **S3-compatible object storage** |
| Validation | **Asynchronous replay-validation workers** |
| Authentication | **Managed OIDC/passkey-compatible provider** |
| End-to-end testing | **Playwright** |
| Observability | **OpenTelemetry-compatible stack** |
| Repository architecture | **TypeScript monorepo + Turborepo** |

The most important competitive-integrity principle should be:

> **The client provides evidence of a run; the server decides the score.**

The browser should never be trusted to submit an authoritative value such as:

```json
{
  "score": 999999999
}
```

Instead, ranked games should record player inputs. The backend should replay those inputs using the same deterministic simulation and calculate the score independently.

---

# 2. Recommended Game Roster

The launch roster should contain games that test substantially different skills while still sharing physics technology and reusable gameplay components.

The goal is to create **ten different competitive experiences running on one common physics platform**.

---

## 2.1 Hookline Sprint

### Core Mechanic

The player controls a stickman using a grappling line.

The player:

1. Attaches to anchor points
2. Swings using pendulum momentum
3. Releases at the correct moment
4. Transfers momentum toward the next obstacle or checkpoint

Courses can contain:

- Moving anchors
- Walls
- Narrow passages
- Speed gates
- Hazards
- Bonus routes

### Scoring

```text
Score =
    distance
  + gate bonuses
  + perfect-release bonuses
  + combo multiplier
```

### Tournament Fit

Excellent competitive game because it provides:

- Very simple controls
- Immediate understanding
- High skill ceiling
- Short attempts
- Fast restarts
- Clear visual mastery
- Highly reproducible physics

---

## 2.2 Pickaxe Ascent

### Core Mechanic

The stickman climbs upward using a rotating pickaxe.

Players manipulate the angle and momentum of the pickaxe to:

- Hook ledges
- Swing upward
- Launch between platforms
- Recover from mistakes
- Reach progressively higher sections

### Scoring

```text
Score =
    maximum altitude
  + checkpoint bonuses
  + clean-climb streak
```

### Tournament Fit

This creates a precision-heavy game where mastery comes from understanding:

- Rotation
- Momentum
- Leverage
- Recovery

The same basic controls can produce dramatically different results depending on player skill.

---

## 2.3 Rooftop Relay

### Core Mechanic

Physics-assisted parkour across city rooftops.

Movement includes:

- Running
- Jumping
- Vaulting
- Wall rebounds
- Sliding
- Recoverable ragdoll stumbles

Maintaining speed builds a **Flow Multiplier**.

### Scoring

```text
Score =
    checkpoint progress
  + collectible bonuses
  + flow multiplier
  + finishing-time bonus
```

### Tournament Fit

Introduces more traditional movement while maintaining the Stickworld physics identity.

It rewards:

- Route optimization
- Momentum preservation
- Precise timing
- Risk/reward decisions

---

## 2.4 Pogo Tower

### Core Mechanic

The stickman automatically bounces upward on a pogo stick.

Players control:

- Lean
- Rotation
- Landing angle
- Limited aerial correction

Platforms become increasingly:

- Small
- Moving
- Angled
- Unstable

### Scoring

```text
Score =
    height reached
  + precision landing streak
  + optional bonus platforms
```

### Tournament Fit

A highly replayable "one more attempt" game.

Its controls are accessible while the skill ceiling comes from:

- Angular momentum
- Landing precision
- Route choice
- Recovery control

---

## 2.5 Balance Bike Blitz

### Core Mechanic

The player rides a physics-driven bicycle through an obstacle course.

Controls include:

- Throttle
- Brake
- Forward lean
- Backward lean

Obstacles include:

- Ramps
- Bridges
- Seesaws
- Narrow beams
- Collapsible structures
- Large jumps

### Scoring

```text
Score =
    distance
  + airtime
  + stunt combinations
  + checkpoint bonuses
```

Crashing ends the active combo.

### Tournament Fit

Adds vehicle physics to the tournament while maintaining intuitive controls and a strong skill component.

---

## 2.6 Launch Lab

### Core Mechanic

Players launch a stickman through an obstacle course.

Before launch, the player chooses:

- Launch angle
- Launch power

During flight, limited controls allow the player to:

- Tuck
- Stretch
- Rotate

These actions influence trajectory and landing.

### Scoring

```text
Score =
    distance
  + ring checkpoints
  + target accuracy
  + landing quality
```

Ranked matches could use the combined result of **three launches**.

### Tournament Fit

Very easy to understand and extremely suitable for short competitive sessions.

Multiple launches reduce the effect of accidental lucky outcomes.

---

## 2.7 Demolition Dive

### Core Mechanic

Launch a ragdoll stickman into destructible structures.

The goal is to trigger maximum destruction using:

- Impact angle
- Velocity
- Structural weak points
- Chain reactions

### Scoring

```text
Score =
    destroyed-object value
  × chain-reaction multiplier
  + special-object bonuses
```

A ranked attempt should contain a fixed number of launches.

### Tournament Fit

Adds a highly visual destruction game to the roster.

It is particularly suitable for:

- Spectacular outcomes
- High-score optimization
- Replay sharing
- Physics-based experimentation

---

## 2.8 Ragdoll Archery Rush

### Core Mechanic

The stickman uses a physics-driven bow.

The body reacts to:

- Bow tension
- Recoil
- Position
- Balance

Targets can include:

- Stationary targets
- Moving targets
- Swinging targets
- Ricochet shots
- Small precision targets

### Scoring

```text
Score =
    target value
  × accuracy multiplier
  × streak multiplier
  + difficulty bonuses
```

### Tournament Fit

Adds a precision discipline to Stickworld.

The scoring model is extremely clear and suitable for competitive ranking.

---

## 2.9 Hammer Throw Havoc

### Core Mechanic

The stickman spins while holding a heavy hammer.

Players build angular velocity and release the hammer at the optimal moment.

Courses can contain:

- Multiplier gates
- Distance zones
- Obstacles
- Bonus targets

### Scoring

Use the combined result of three throws.

```text
Score =
    throw distance
  + gate bonuses
  + target bonuses
```

### Tournament Fit

Rounds are extremely short and naturally encourage repeated attempts.

The game also reuses:

- Joint physics
- Angular velocity
- Projectile systems
- Trajectory calculations

---

## 2.10 Cargo Chaos

### Core Mechanic

The player transports unstable cargo through a physics obstacle course.

Obstacles include:

- Elevators
- Conveyors
- Seesaws
- Swinging platforms
- Collapsing floors

Aggressive movement damages the cargo.

### Scoring

```text
Score =
    delivery progress
  + package condition
  + remaining-time bonus
```

### Tournament Fit

This introduces a different form of mastery.

Instead of maximizing speed or destruction, players must balance:

- Precision
- Patience
- Momentum
- Risk

---

# 3. Tournament & Ranking System

Stickworld requires two ranking layers:

1. **Individual game rankings**
2. **Overall tournament rankings**

---

## 3.1 Individual Game Rankings

Every game should expose one canonical score value:

```text
ranked_score
```

The universal rule should be:

> **Higher is always better.**

Even when time matters, time should be converted into bonus points.

Example:

```text
Rooftop Relay Score =
    checkpoints × 10,000
  + collectibles × 500
  + flow_bonus
  + time_bonus
```

This avoids having some leaderboards where lower values are better and others where higher values are better.

---

## 3.2 Personal Best Model

A player's leaderboard position should be based on their:

> **Best verified score during the current tournament season.**

Not their cumulative score.

Store every attempt for:

- Analytics
- Anti-cheat investigation
- Replay history
- Debugging

But maintain a compact personal-best record.

Example:

```text
game_best_scores
```

```text
tournament_id
game_id
user_id
best_score
run_id
achieved_at
```

---

# 4. Overall Tournament Ranking

Raw scores from different games cannot be added together.

For example:

```text
Demolition Dive: 750,000 points
Ragdoll Archery:   4,200 points
```

The scales are fundamentally different.

Stickworld should therefore convert **competitive placement** into normalized Tournament Points.

---

## 4.1 Recommended Tournament Point Formula

For each game, calculate the player's percentile rank.

Then:

```text
GamePoints = round(1000 × (1 - percent_rank))
```

Each game contributes a maximum of:

```text
1,000 Tournament Points
```

With ten games:

```text
Maximum Overall Score = 10,000
```

Example:

| Placement | Approximate Tournament Points |
|---|---:|
| Best player | 1,000 |
| Top 10% | ~900 |
| Top 25% | ~750 |
| Median | ~500 |
| Bottom 25% | ~250 |
| Bottom player | ~0 |
| Did not participate | 0 |

Overall:

```text
OverallPoints =
    Game1Points
  + Game2Points
  + Game3Points
  + ...
  + Game10Points
```

---

## 4.2 Why Percentile Ranking Works

This system means every game has equal championship importance.

A player cannot dominate the tournament simply because one game happens to generate very large raw scores.

Instead, players are rewarded for being competitively strong across the entire roster.

---

## 4.3 Player-Facing Results

Each game's result screen could show:

```text
GAME SCORE        128,450
GAME RANK         #143
TOURNAMENT PTS    942 / 1000
```

Overall leaderboard:

| Player | Hook | Climb | Parkour | Archery | Cargo | ... | Total |
|---|---:|---:|---:|---:|---:|---:|---:|
| NovaStick | 991 | 976 | 954 | 962 | 921 | ... | 9,537 |
| RagdollKing | 1000 | 841 | 997 | 955 | 862 | ... | 9,411 |
| StickSteve | 932 | 970 | 901 | 948 | 975 | ... | 9,386 |

---

## 4.4 Ties

Players with equal raw scores should receive equal Tournament Points.

Do not manufacture ranking differences using timestamps.

For championship ties, publish a predetermined tie-break system.

Recommended order:

1. Most individual game victories
2. Most top-10 finishes
3. Highest lowest-game score
4. Designated tournament tie-break game

---

## 4.5 Missing Games

A game the player has not completed should award:

```text
0 Tournament Points
```

This naturally encourages competitors to participate in all ten games.

---

# 5. Ranking Update Architecture

Individual game rankings can update immediately.

Overall rankings should update asynchronously.

```text
Verified Personal Best
        |
        +--> PostgreSQL personal best
        |
        +--> Redis game leaderboard
        |
        +--> "Tournament Ranking Dirty" event
                        |
                        v
                Ranking Worker
                        |
                Recalculate percentiles
                        |
                Calculate totals
                        |
                        v
              Overall leaderboard cache
```

This avoids recalculating thousands of overall standings during every score-submission HTTP request.

---

# 6. Seasons & Game Versioning

Each tournament should reference exact versions of its games.

Example:

```text
Tournament 2026-S01
├── Hookline Sprint
│   ├── Game Version: 1.0
│   ├── Simulation Version: 1.3
│   └── Scoring Version: 1.0
│
├── Pickaxe Ascent
│   ├── Game Version: 1.0
│   ├── Simulation Version: 1.1
│   └── Scoring Version: 1.0
│
└── ...
```

Never silently change during an active tournament:

- Physics constants
- Gravity
- Friction
- Restitution
- Collision geometry
- Scoring rules
- Procedural generation
- Physics engine version

Any competition-affecting change should create either:

- A new game version
- A new scoring version
- A new leaderboard
- A new tournament season

Cosmetic changes can generally ship independently.

---

# 7. Platform Architecture

## 7.1 High-Level Architecture

```text
                         STICKWORLD TOURNAMENT
                                  |
                  +---------------+---------------+
                  |                               |
             Platform UI                    Game Runtime
             Next.js/React                  Phaser + Rapier
                  |                               |
                  |                     +---------+---------+
                  |                     |                   |
                  |                Game Packages       Input Recorder
                  |                   × 10              + Replay Log
                  |                     |                   |
                  +---------------------+-------------------+
                                        |
                                   Fastify API
                                        |
                  +---------------------+--------------------+
                  |                     |                    |
              PostgreSQL              Redis            Validation Queue
          Source of Truth       Fast Leaderboards             |
                  |                                          |
                  +---------------- Replay Worker ------------+
                                      |
                               Rapier Simulation
                               Calculates Score
                                      |
                                 VERIFIED RUN
                                      |
                    +-----------------+----------------+
                    |                                  |
             Game Leaderboard                 Overall Ranking
```

---

# 8. Game Frontend

## Recommended Stack

```text
Phaser 4
+
Rapier 2D
+
TypeScript
```

### Phaser Responsibilities

Phaser should handle:

- Rendering
- Sprites
- Animation
- Cameras
- Scene management
- Input
- Audio
- Effects

### Rapier Responsibilities

Rapier should handle:

- Rigid bodies
- Colliders
- Joints
- Ragdolls
- Rope-like mechanics
- Vehicles
- Projectiles
- Collision detection
- Deterministic simulation

---

## 8.1 Fixed Physics Simulation

Ranked gameplay should run at:

```text
60 simulation ticks per second
```

Recommended rules:

```text
Physics simulation: 60 ticks/sec
Score calculations: integer arithmetic where practical
Randomness: seeded PRNG only
Run timing: simulation ticks
Input recording: input changes / simulation ticks
Physics version: pinned per tournament
```

The display can run at:

```text
30 FPS
60 FPS
90 FPS
120 FPS
144 FPS
```

without changing the actual game result.

---

# 9. Platform Frontend

Use:

```text
Next.js
React
TypeScript
```

For everything surrounding gameplay.

Example routes:

```text
/
├── games
├── tournaments
├── login
├── signup
├── profile
├── leaderboard
├── rankings
├── rules
├── achievements
└── settings
```

React should **not** drive the high-frequency game loop.

Use this separation:

```tsx
<GamePage>
  <GameHeader />
  <TournamentSummary />

  <PhaserCanvas />

  <PersonalBest />
  <LeaderboardPreview />
</GamePage>
```

Phaser owns the game canvas.

React owns the surrounding application.

---

# 10. Backend

Recommended stack:

```text
Node.js
+
TypeScript
+
Fastify
```

The API should remain relatively conventional.

Example endpoints:

```http
POST /v1/games/:gameId/attempts
POST /v1/attempts/:attemptId/finish

GET /v1/games
GET /v1/tournaments/current

GET /v1/leaderboards/:tournamentId/:gameId
GET /v1/tournaments/:tournamentId/standings

GET /v1/users/:userId/profile
GET /v1/me/runs
```

Because gameplay itself is single-player, WebSockets are not required for version one.

They can later support:

- Live tournament events
- Spectator features
- Live leaderboard animations

---

# 11. Database Architecture

Use PostgreSQL as the permanent source of truth.

Suggested entities:

```text
users
games
game_versions
tournaments
tournament_games
attempts
runs
best_scores
tournament_standing_snapshots
audit_events
```

---

## 11.1 Simplified Schema

```sql
users
-----
id
handle
auth_provider_id
created_at
```

```sql
games
-----
id
slug
name
```

```sql
game_versions
-------------
id
game_id
version
simulation_version
physics_version
scoring_version
config_json
released_at
```

```sql
tournaments
-----------
id
slug
starts_at
ends_at
status
```

```sql
tournament_games
----------------
tournament_id
game_id
game_version_id
```

```sql
attempts
--------
id
user_id
tournament_id
game_id
game_version_id
seed
started_at
expires_at
status
```

```sql
runs
----
id
attempt_id
user_id
game_id
raw_score
simulation_ticks
replay_object_key
verification_status
verified_at
created_at
```

```sql
best_scores
-----------
tournament_id
game_id
user_id
raw_score
run_id
achieved_at
```

The important distinction is:

```text
Attempt ≠ Run ≠ Personal Best
```

A player can start an attempt without completing it.

A completed attempt becomes a run.

A verified run only becomes the personal best if it beats the previous score.

---

# 12. Redis

Redis should be treated as an acceleration layer rather than the permanent database.

Recommended uses:

- Game leaderboard caches
- Overall leaderboard cache
- Rate limiting
- Attempt state
- Temporary session state
- Queue coordination

Example keys:

```text
lb:tournament-2026-s1:hookline
lb:tournament-2026-s1:pickaxe
lb:tournament-2026-s1:archery

lb:tournament-2026-s1:overall
```

If Redis is lost, all leaderboard data should be reconstructable from PostgreSQL.

---

# 13. Authentication

Use a managed authentication provider.

Avoid implementing from scratch:

- Password storage
- Password reset
- Email verification
- MFA
- Token rotation
- Passkeys
- OAuth/OIDC flows

Recommended user flow:

```text
Guest
  |
  └── Practice Games

Registered Account
  |
  ├── Ranked Runs
  ├── Leaderboards
  ├── Personal Bests
  ├── Profile
  └── Run History
```

Internally:

```text
Internal User UUID
        |
        └── External Authentication Provider ID
```

This keeps authentication loosely coupled from the rest of the platform.

---

# 14. Replay Verification & Anti-Cheat

This should be considered one of Stickworld's core systems.

The browser is controlled by the player and therefore cannot be trusted as an authoritative source.

---

## 14.1 Ranked Attempt Lifecycle

```text
Player clicks "Ranked Run"
        |
        v
POST /attempts
        |
        v
Server generates:
- attempt_id
- seed
- game_version
- expiry
- signed run token
        |
        v
Browser loads exact game version
        |
        v
Player plays
        |
        v
Game records inputs
        |
        v
Run finishes
        |
        v
Browser submits:
- attempt_id
- claimed score
- input replay
- checkpoints
- simulation ticks
        |
        v
Validation Worker
        |
        v
Loads exact game version
        |
        v
Loads identical seed
        |
        v
Replays player inputs
        |
        v
Calculates score independently
        |
   +----+----+
   |         |
 Match    Mismatch
   |         |
Verified   Rejected
   |
Update Personal Best
   |
Update Leaderboard
```

---

## 14.2 Record Inputs, Not Positions

Example replay:

```json
{
  "attemptId": "a13f...",
  "events": [
    {
      "tick": 12,
      "action": "grapple",
      "value": 1
    },
    {
      "tick": 41,
      "action": "grapple",
      "value": 0
    },
    {
      "tick": 67,
      "action": "grapple",
      "value": 1
    }
  ]
}
```

Do **not** accept authoritative player coordinates such as:

```json
{
  "x": 10000,
  "y": 5000
}
```

A modified client could fabricate those values.

Instead, the server simulation determines where the character moves.

---

## 14.3 Deterministic Simulation Rules

Competitive simulation should never depend on:

```text
Math.random()
Date.now()
render-frame delta
audio timing
network timing
browser DOM state
device refresh rate
```

Use:

```text
Seeded PRNG
Fixed simulation ticks
Explicit state
Integer tick timers
Versioned configuration
Recorded inputs
```

---

## 14.4 Validation Checks

Every ranked run should validate:

```text
Attempt exists
Attempt belongs to user
Attempt belongs to correct tournament
Correct game version
Attempt has not expired
Attempt has not already been consumed
Replay size is reasonable
Input values are valid
Input frequency is valid
Simulation duration is valid
Replay reaches a legitimate final state
Server-calculated score is valid
```

---

# 15. Project & Repository Structure

Use a single TypeScript monorepo.

Recommended structure:

```text
stickworld/
│
├── apps/
│   ├── web/
│   ├── api/
│   └── validator/
│
├── games/
│   ├── hookline-sprint/
│   ├── pickaxe-ascent/
│   ├── rooftop-relay/
│   ├── pogo-tower/
│   ├── balance-bike/
│   ├── launch-lab/
│   ├── demolition-dive/
│   ├── ragdoll-archery/
│   ├── hammer-throw/
│   └── cargo-chaos/
│
├── packages/
│   ├── game-sdk/
│   ├── simulation-core/
│   ├── physics/
│   ├── ragdoll/
│   ├── input/
│   ├── replay/
│   ├── scoring/
│   ├── ranking/
│   ├── contracts/
│   ├── ui/
│   ├── telemetry/
│   └── config/
│
├── tooling/
│   ├── eslint/
│   ├── typescript/
│   └── tests/
│
└── turbo.json
```

---

# 16. Shared Game SDK

The most important reusable package should be:

```text
packages/game-sdk
```

Each competitive game should implement the same contract.

Example:

```ts
interface StickworldGame {
  id: string;
  version: string;

  createSimulation(seed: bigint): Simulation;

  applyInput(
    simulation: Simulation,
    input: GameInput
  ): void;

  step(simulation: Simulation): void;

  calculateScore(
    simulation: Simulation
  ): number;

  isFinished(
    simulation: Simulation
  ): boolean;
}
```

---

# 17. Simulation vs Presentation

Every game should separate authoritative simulation from rendering.

## Simulation

Contains:

```text
Physics
Game state
Rules
Scoring
Inputs
Random seeds
Game-over conditions
```

## Presentation

Contains:

```text
Sprites
Particles
Camera
Audio
Animations
Visual effects
UI
```

Conceptually:

```text
Simulation
    |
    +--> Browser Renderer
    |      ├── Phaser
    |      ├── Camera
    |      ├── Audio
    |      └── Effects
    |
    └--> Validation Worker
           ├── No rendering
           ├── No audio
           ├── Replay inputs
           └── Authoritative score
```

---

# 18. Shared Physics Components

Once the first game works, reusable physics systems should be extracted.

Examples:

```ts
createStickmanRagdoll()
createRopeJoint()
createHingeJoint()
createMovingPlatform()
createBreakableObject()
createWheelAssembly()
createProjectile()
createCheckpoint()
createScoreMultiplier()
createComboSystem()
createImpactSensor()
```

---

## 18.1 Standard Stickman Ragdoll

Example body structure:

```text
head
torso

upperArmLeft
forearmLeft

upperArmRight
forearmRight

upperLegLeft
lowerLegLeft

upperLegRight
lowerLegRight
```

Games should configure the standard ragdoll instead of creating independent implementations.

---

# 19. Shared Systems Across the Ten Games

| Shared Capability | Games |
|---|---|
| Rigid bodies / colliders | All 10 |
| Stickman ragdoll | Most games |
| Joints / hinges / ropes | Hookline, Pickaxe, Pogo, Bike, Hammer |
| Projectiles | Launch, Demolition, Archery, Hammer |
| Breakable structures | Bike, Demolition |
| Moving platforms | Pickaxe, Rooftop, Pogo, Bike, Cargo |
| Impact scoring | Bike, Launch, Demolition, Cargo |
| Combos / streaks | Hookline, Rooftop, Pogo, Bike, Demolition, Archery |
| Seeded generation | Hookline, Rooftop, Pogo, Bike, Cargo |

The goal is:

> **Ten game rule sets over one reusable physics toolkit.**

---

# 20. Game Package Structure

Each game should use approximately the same internal structure.

Example:

```text
games/hookline-sprint/
│
├── src/
│   ├── simulation/
│   │   ├── state.ts
│   │   ├── rules.ts
│   │   ├── scoring.ts
│   │   ├── obstacles.ts
│   │   └── simulation.ts
│   │
│   ├── client/
│   │   ├── scene.ts
│   │   ├── renderer.ts
│   │   ├── effects.ts
│   │   ├── audio.ts
│   │   └── controls.ts
│   │
│   └── manifest.ts
│
└── tests/
    ├── deterministic.test.ts
    ├── scoring.test.ts
    └── replay.test.ts
```

---

# 21. Determinism Testing

CI should verify that recorded test inputs always produce the same outcome.

Example:

```text
Seed: 123456
Inputs: fixture.json
```

Expected:

```text
Browser Simulation A → 491,250
Browser Simulation B → 491,250
Validator Simulation → 491,250
```

If any result differs, CI should fail.

---

# 22. Development Roadmap

## Phase 0 — Competitive Specification

Before building the full games, write the **Stickworld Competitive Specification**.

Define:

- Physics tick rate
- Score datatype
- Replay format
- Random seed format
- Attempt lifecycle
- Game-over contract
- Pause/focus behavior
- Personal-best rules
- Tie rules
- Tournament-point formula
- Game versioning
- Replay validation

Every competitive game should satisfy:

```text
1. Accept an explicit random seed.
2. Use fixed simulation ticks.
3. Produce an integer score.
4. Reproduce the same score from replay inputs.
5. Serialize all player inputs.
6. Produce deterministic checkpoints.
7. Support game-version pinning.
```

---

# 23. Phase 1 — Monorepo Foundation

Set up:

```text
TypeScript
Turborepo
ESLint
Formatting
Shared tsconfig
Unit testing
GitHub Actions / CI
Environment management
```

Create:

```text
apps/web
apps/api
apps/validator
packages/game-sdk
packages/contracts
packages/simulation-core
```

Do not build ten games yet.

---

# 24. Phase 2 — Physics & Simulation Foundation

Implement:

- Rapier initialization
- Fixed timestep
- Seeded PRNG
- Input abstraction
- Replay format
- Game state model
- Simulation serialization
- Basic scoring infrastructure

Build deterministic tests immediately.

---

# 25. Phase 3 — Hookline Sprint Vertical Slice

Build one complete game from login to verified leaderboard score.

Target flow:

```text
Sign In
   ↓
Choose Tournament
   ↓
Start Ranked Attempt
   ↓
Receive Server Seed
   ↓
Play Hookline Sprint
   ↓
Record Inputs
   ↓
Finish Run
   ↓
Upload Replay
   ↓
Server Validates
   ↓
Personal Best Updates
   ↓
Game Rank Updates
   ↓
Tournament Points Update
   ↓
Profile Displays Result
```

Hookline Sprint becomes the reference implementation for every later game.

---

# 26. Phase 4 — Extract Shared Game Systems

Once Hookline works, stop briefly and extract shared systems.

Create:

```text
@stickworld/game-sdk
@stickworld/physics
@stickworld/ragdoll
@stickworld/input
@stickworld/replay
@stickworld/scoring
@stickworld/results
@stickworld/tournament-client
```

This prevents duplication across the remaining nine games.

---

# 27. Phase 5 — Account & Profile Systems

Implement:

- Authentication
- Username/handle
- Player profile
- Personal bests
- Tournament history
- Run history
- Current tournament rank

Allow guest practice but require authentication for ranked runs.

---

# 28. Phase 6 — Leaderboard Infrastructure

Build:

## Per-Game Leaderboards

```text
Tournament
   └── Game
       └── Player Personal Bests
```

## Overall Leaderboard

```text
Tournament
   └── Player
       ├── Game 1 Tournament Points
       ├── Game 2 Tournament Points
       ├── ...
       └── Game 10 Tournament Points
```

Use PostgreSQL as source of truth and Redis for fast reads.

---

# 29. Phase 7 — Replay Validation

Implement the full validation pipeline before scaling game production.

Requirements:

- Exact game-version loading
- Exact physics-version loading
- Attempt verification
- Seed verification
- Input replay
- Score calculation
- Score mismatch detection
- Duplicate submission prevention
- Replay storage
- Validation audit logs

---

# 30. Phase 8 — Build Games in Mechanic Batches

## Batch A — Movement & Joints

```text
Hookline Sprint
Pickaxe Ascent
Pogo Tower
```

Shared technology:

- Joints
- Momentum
- Moving platforms
- Compact replay input

---

## Batch B — Projectiles & Ragdolls

```text
Launch Lab
Ragdoll Archery Rush
Hammer Throw Havoc
```

Shared technology:

- Projectile trajectories
- Angular velocity
- Target scoring
- Multi-attempt scoring

---

## Batch C — Continuous Movement

```text
Rooftop Relay
Balance Bike Blitz
Cargo Chaos
```

Shared technology:

- Scrolling worlds
- Vehicles
- Cargo joints
- Checkpoints
- Longer runs

---

## Batch D — Destruction

```text
Demolition Dive
```

Build this last because destruction introduces:

- More objects
- More collisions
- More simulation state
- Larger replays
- More determinism edge cases

---

# 31. Recommended Game Production Order

```text
1. Hookline Sprint
2. Pickaxe Ascent
3. Launch Lab
4. Ragdoll Archery Rush
5. Pogo Tower
6. Rooftop Relay
7. Balance Bike Blitz
8. Hammer Throw Havoc
9. Cargo Chaos
10. Demolition Dive
```

This progressively proves the underlying systems rather than attempting the most technically complex game first.

---

# 32. Shared Scoring Infrastructure

Different games can have different scoring rules while sharing a common score-event architecture.

Example event:

```json
{
  "tick": 3288,
  "type": "CHECKPOINT",
  "points": 5000,
  "multiplier": 2.4
}
```

Common scoring components:

```text
Base points
Combos
Multipliers
Streaks
Checkpoint bonuses
Penalties
Time bonuses
Run termination
Personal best comparison
Score telemetry
```

Structured scoring events make debugging suspicious or rejected runs significantly easier.

---

# 33. Testing & Quality Assurance

## 33.1 Simulation Tests

Every game needs:

```text
Determinism tests
Replay tests
Scoring tests
Collision tests
Boundary tests
Seed tests
Game-over tests
```

---

## 33.2 Browser Tests

Use Playwright.

Minimum test matrix:

```text
Chromium Desktop
Firefox Desktop
WebKit Desktop
Mobile Chromium
Mobile Safari / WebKit
```

Automated flow:

```text
Login
  ↓
Open Game
  ↓
Start Attempt
  ↓
Load Bundle
  ↓
Play Deterministic Test
  ↓
Submit Replay
  ↓
Validate
  ↓
Display Personal Best
  ↓
Display Leaderboard
```

---

# 34. Performance Testing

Test across:

- Desktop computers
- Mid-range Android devices
- iPhones
- Tablets
- Low-power laptops

Measure:

```text
Initial game bundle size
Game loading time
Physics frame time
Rendering frame time
Memory use
Replay size
Validation time
```

Each game's code and assets should be loaded only when that game is opened.

Do not make visitors download the assets for all ten games on the Stickworld home page.

---

# 35. Observability

Instrument:

```text
Web Application
API
Validation Worker
Ranking Worker
Games
```

Important metrics:

```text
Game load success rate
Game load duration

Attempt starts
Attempt completions
Attempt abandonment rate

Replay validation duration
Replay validation failure rate
Score mismatch rate

Personal-best improvement rate

Submissions per minute

API latency
Redis latency
Database latency

Leaderboard recalculation time

Errors by:
- game
- version
- browser
- device
```

Recommended telemetry tags:

```text
game_id
game_version
tournament_id
browser_family
device_class
ranked_or_practice
```

---

# 36. Internal Tournament

Before public beta, run a complete internal tournament.

Test:

```text
Normal scores
Extreme scores
Tied scores
Zero scores

Disconnects
Refresh during run
Duplicate submission

Long replay
Malformed replay
Expired attempt

Slow browser
Background tab
Mobile touch input

Network failure after finish
Redis outage

Validation-worker backlog

Tournament ending while run is active
```

This internal tournament should use the exact production ranking and verification systems.

---

# 37. Closed Beta

Invite a controlled group of external players.

Measure:

- Average attempts per player
- Game popularity
- Difficulty curves
- Score distributions
- Leaderboard participation
- Mobile usability
- Validation mismatches
- Crash rates
- Load times
- Abandonment rates

Look especially for games where a small exploit creates dramatically higher scores.

---

# 38. Version Freeze

Before launch:

Freeze competition-affecting values including:

```text
Physics engine version
Physics configuration
Gravity
Collision masks
Level geometry
Random-generation rules
Scoring formulas
Game versions
Replay format
Tournament rules
```

Only critical fixes should ship afterward.

---

# 39. Launch Quality Bar

Before public launch, all ten games should meet the following conditions.

## Competitive Integrity

- [ ] Client cannot submit authoritative scores directly
- [ ] Ranked runs require server-issued attempt IDs
- [ ] Ranked runs receive server-controlled seeds
- [ ] Replays are validated server-side
- [ ] Duplicate submissions are rejected
- [ ] Game versions are pinned
- [ ] Scoring rules are versioned
- [ ] Tournament tie rules are published

## Game Stability

- [ ] All ten games pass deterministic replay tests
- [ ] All ten games work on supported desktop browsers
- [ ] All ten games work on supported mobile browsers
- [ ] Game loading failures are below the defined threshold
- [ ] No known leaderboard-breaking exploit remains

## Platform

- [ ] Accounts work reliably
- [ ] Personal bests persist correctly
- [ ] Per-game rankings are accurate
- [ ] Overall rankings are accurate
- [ ] Redis can be rebuilt from PostgreSQL
- [ ] Replay storage is functioning
- [ ] Backups are tested

## Operations

- [ ] Error monitoring enabled
- [ ] API metrics enabled
- [ ] Validation metrics enabled
- [ ] Leaderboard metrics enabled
- [ ] Alerting configured
- [ ] Rollback process documented

---

# 40. Major Risks

## Risk 1 — Trusting Client Scores

Bad architecture:

```text
Game calculates score
      ↓
POST /score
{
  "score": 999999999
}
      ↓
Database accepts score
```

This will be exploited.

### Mitigation

Server-side replay verification.

---

## Risk 2 — Frame-Rate-Dependent Gameplay

A 144 Hz monitor must not create different gameplay from a 60 Hz phone.

### Mitigation

Use:

```text
Fixed physics timestep
Simulation tick timing
Frame-rate-independent rendering
```

---

## Risk 3 — Ten Separate Codebases

Ten independent games would multiply:

- Bugs
- Build systems
- Physics implementations
- Analytics code
- Score systems
- UI work

### Mitigation

One monorepo and one shared SDK.

---

## Risk 4 — Scoring Imbalance

Raw scores cannot be meaningfully compared across games.

### Mitigation

Convert placement into Tournament Points.

---

## Risk 5 — Physics Updates Invalidating Scores

Changing physics can make historical runs impossible to reproduce.

### Mitigation

Pin:

```text
Game version
Simulation version
Physics version
Scoring version
```

---

## Risk 6 — Mobile Performance

Heavy destruction or large numbers of rigid bodies could perform poorly on mobile devices.

### Mitigation

Define per-game physics budgets.

For example:

```text
Maximum active rigid bodies
Maximum destructible objects
Maximum joints
Maximum particles
Maximum replay size
```

---

# 41. Visual & Product Consistency

Although gameplay differs, every game should share the same Stickworld visual language.

Standardize:

```text
Stickman proportions
Typography
Impact effects
Countdown
Pause screen
Results screen
Leaderboard widgets
Personal-best celebration
Tournament badges
Audio language
Color system
```

Players should feel:

> **"I'm competing inside Stickworld."**

Not:

> "I'm opening ten unrelated minigames."

---

# 42. Shared Presentation Packages

Useful shared packages:

```text
@stickworld/ui
@stickworld/audio
@stickworld/ragdoll
@stickworld/results
@stickworld/tournament-client
@stickworld/replay
@stickworld/telemetry
```

---

# 43. Complete Recommended Stack

| Layer | Technology | Purpose |
|---|---|---|
| Platform frontend | **Next.js + TypeScript** | Navigation, accounts, rankings, profiles |
| UI | **React** | Platform interface |
| Game framework | **Phaser 4** | Rendering, input, scenes, animation, audio |
| Physics | **Rapier 2D WASM** | Deterministic physics simulation |
| Simulation architecture | **Pure TypeScript game logic** | Shared browser/server simulation |
| API | **Node.js + Fastify** | Attempts, accounts, tournaments |
| Database | **PostgreSQL** | Authoritative persistent data |
| Cache | **Redis** | Fast leaderboard access |
| Replay storage | **S3-compatible storage** | Compressed replay files |
| Validation | **Worker queue** | Authoritative score calculation |
| Authentication | **Managed OIDC provider** | Accounts and identity |
| E2E testing | **Playwright** | Browser testing |
| Observability | **OpenTelemetry** | Metrics and tracing |
| Repository | **Turborepo monorepo** | Shared packages and CI |

---

# 44. Recommended Development Sequence

```text
Competitive Specification
          ↓
Monorepo + Shared Contracts
          ↓
Physics / Simulation Core
          ↓
Input + Replay System
          ↓
Hookline Sprint Vertical Slice
          ↓
Server Replay Verification
          ↓
Per-Game Leaderboard
          ↓
Overall Tournament Ranking
          ↓
Shared Ragdoll / Game SDK
          ↓
Games 2–4
          ↓
Integration Hardening
          ↓
Games 5–7
          ↓
Performance Optimization
          ↓
Games 8–10
          ↓
Cross-Browser QA
          ↓
Internal Tournament
          ↓
Closed Beta
          ↓
Version Freeze
          ↓
PUBLIC LAUNCH
```

---

# 45. Post-Launch Expansion

Once the shared platform exists, it can support significantly more than the original ten games.

Possible future features:

- New games
- Seasonal game variants
- Daily challenges
- Weekly tournaments
- Friend leaderboards
- Country rankings
- Club/team competitions
- Tournament divisions
- Achievements
- Player progression
- Ghost replays
- Featured player runs
- Replay sharing
- Seasonal archives
- Limited-time events
- Sponsored tournaments

---

# 46. Final Recommendation

The central engineering principle for Stickworld Tournament should be:

> **Build the tournament platform once. Build the physics primitives once. Build the replay system once. Then let each game provide its own mechanics, rules, scoring, level design, and presentation.**

The strongest initial architecture is:

```text
Next.js
   +
Phaser 4
   +
Rapier 2D
   +
TypeScript
   +
Fastify
   +
PostgreSQL
   +
Redis
   +
Replay Validation Workers
```

The most important gameplay architecture is:

```text
Shared Simulation Core
        |
        +--> Browser Gameplay
        |
        +--> Server Replay Validation
```

The most important ranking architecture is:

```text
Raw Game Score
      ↓
Per-Game Ranking
      ↓
Normalized Tournament Points
      ↓
Overall Championship Ranking
```

And the most important security principle is:

> **Never trust the browser with the authoritative score.**

If implemented this way, Stickworld Tournament becomes more than a collection of ten minigames.

It becomes a reusable **competitive browser-gaming platform** capable of supporting additional games, seasons, tournament formats, daily challenges, rankings, and future competitive features without requiring the underlying platform to be redesigned.