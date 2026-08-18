# Stickworld Tournament — Research Notes

## Verified gameplay-pattern sources

| Source | Verified finding | Design implication |
|---|---|---|
| Colyseus documentation (https://docs.colyseus.io/) | Colyseus provides an open-source Node.js basis for authoritative game servers, state synchronization, rooms/matchmaking, TypeScript and Phaser support, and tutorials on client-predicted input and fixed tick rate. | Use an authoritative room per match; send compact input events and synchronize concise gameplay state. Start with correction/interpolation and add prediction only to high-tempo modes. |
| Landfall, *Stick Fight: The Game* (https://landfall.se/stickfightthegame) | The official description identifies a physics-based couch/online fighting game focused on battling friends or random players. | Short rounds, legible hazards, simple controls, and social match flow are a validated competitive pattern—but the new platform must avoid copied arenas, weapon behavior, branding, and character treatment. |

## Research input tracks

1. Arena combat and knock-out rules.
2. Precision projectile duels.
3. Traversal races and grappling/swinging.
4. Vehicle and momentum challenges.
5. Objective sports and territory modes.
6. Small-team co-op-versus-competitive modes.
7. Browser 2D rendering, simulation, and networking architecture.
8. Intellectual-property boundaries for inspiration-driven game design.

## Working technical baseline

- Client: TypeScript with Phaser for 2D rendering/input and a 2D rigid-body engine such as Matter.js or Rapier 2D.
- Server: Node.js authoritative simulation, WebSocket rooms, fixed simulation tick, input validation, and state snapshots.
- Competitive scope: keep launch matches compact (typically 1v1, 2v2, or free-for-all of up to 4), use reproducible seeded maps, and favor server-resolved hits, scores, spawns, and outcomes.

## Sources

1. [Colyseus documentation](https://docs.colyseus.io/)
2. [Landfall — Stick Fight: The Game](https://landfall.se/stickfightthegame)

*Notes reflect source review conducted 18 August 2026.*

## Additional verified implementation findings

| Source | Verified finding | Design implication |
|---|---|---|
| Phaser documentation — [What is Phaser?](https://docs.phaser.io/phaser/getting-started/what-is-phaser) | Phaser is an open-source HTML5 2D framework for WebGL/Canvas rendering in desktop and mobile browsers, usable with JavaScript or TypeScript. | A TypeScript + Phaser client is a mature fit for a common 2D platform shell across all launch games. |
| Matter.js — [official project page](https://brm.io/matter-js/) | Matter.js is a web 2D physics engine offering rigid/compound bodies, constraints, collision phases, restitution, friction, gravity, and events. | It can underpin accessible client-side prototypes for objects, ropes, projectiles, and vehicles; competitive shipping builds require server authority and careful state correction. |
| Colyseus — [Phaser fixed-tick-rate tutorial](https://docs.colyseus.io/learn/tutorial/phaser/fixed-tickrate) | The tutorial recommends queueing player inputs, processing them on server ticks, and using corresponding fixed-rate loops to improve determinism between client and server. | Use fixed 60 Hz simulation where viable; submit timestamped input rather than client positions, resolve outcomes server-side, and render snapshots with interpolation. |

## Intellectual-property finding

WIPO’s article [*Video Games: Computer Programs or Creative Works?*](https://www.wipo.int/en/web/wipo-magazine/articles/video-games-computer-programs-or-creative-works-38930) states that the underlying idea of a game does not qualify for copyright protection, while its expression or representation does. It further describes games as a fusion of software and audiovisual elements. Accordingly, the recommendations may take inspiration from abstract competitive patterns—such as physics duels, projectile arcs, or knockout arenas—but must use original naming, art direction, character proportions/animation, audio, interface, level geometry, item designs, world fiction, and code. This is general design information, not legal advice; obtain jurisdiction-specific IP counsel before launch.

## Added sources

3. [Phaser documentation — What is Phaser?](https://docs.phaser.io/phaser/getting-started/what-is-phaser)
4. [Matter.js — official project page](https://brm.io/matter-js/)
5. [Colyseus — Phaser fixed-tick-rate tutorial](https://docs.colyseus.io/learn/tutorial/phaser/fixed-tickrate)
6. [WIPO — Video Games: Computer Programs or Creative Works?](https://www.wipo.int/en/web/wipo-magazine/articles/video-games-computer-programs-or-creative-works-38930)

## Additional gameplay reference

| Source | Verified finding | Design implication |
|---|---|---|
| Poki — [Stickman Hook](https://poki.com/en/g/stickman-hook) | The stated basic loop is to attach a rope to a hook, release to launch forward, and use spring platforms to reposition for subsequent swings. | This validates a simple, readable grappling rhythm. A competitive version should introduce original checkpoint geometry, shared dynamic anchors, drafting/interaction rules, and a distinct world/theme rather than recreate its levels or presentation. |

7. [Poki — Stickman Hook](https://poki.com/en/g/stickman-hook)

## Additional gameplay reference

| Source | Verified finding | Design implication |
|---|---|---|
| CrazyGames — [Ragdoll Archers](https://www.crazygames.com/game/ragdoll-archers) | The game is described as bow-and-arrow stickman action with ragdoll physics and two-player PvP/co-op options. | Use the abstract lesson of visually legible ballistic competition; build different objectives, arrow behavior, arenas, art, pacing, and progression. |

8. [CrazyGames — Ragdoll Archers](https://www.crazygames.com/game/ragdoll-archers)
