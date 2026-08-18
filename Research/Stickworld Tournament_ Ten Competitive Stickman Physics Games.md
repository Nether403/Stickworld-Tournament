# Stickworld Tournament: Ten Competitive Stickman Physics Games

**Prepared for:** Stickworld Tournament  
**Prepared by:** Manus AI  
**Date:** 18 August 2026

## Executive recommendation

Stickworld Tournament should launch as a **single competitive platform with ten compact, spectator-readable games**, rather than ten unrelated standalone products. The strongest common denominator is a deliberately simple stick-figure silhouette paired with expressive, legible physics: players should understand why a swing, collision, rebound, or shot succeeded within a second. The recommended roster spans arena combat, projectiles, traversal, vehicle control, ball sports, and objective play. Most matches should last **two to five minutes**, support rematches, and use the same account, party, matchmaking, cosmetics, replay, and tournament infrastructure.

The top three games—**Reactor Rumble**, **Quiverfall**, and **Tether Sprint**—are the best vertical-slice candidates because together they validate the platform’s authoritative physics, projectiles, ropes, knockouts, fixed-tick rooms, and small-party matchmaking. They also map to well-established high-level stickman patterns: online physics fighting, ragdoll archery, and hook-swinging traversal. Landfall describes *Stick Fight: The Game* as a physics-based couch/online fighting game; *Ragdoll Archers* presents ragdoll archery with two-player PvP; and *Stickman Hook* uses attach-and-release rope traversal. [1] [2] [3]

| Rank | Game | Match format | Competitive hook | Launch fit | Physics / networking risk |
|---:|---|---|---|---|---|
| 1 | **Reactor Rumble** | 2–4 player FFA or 2v2 | Knock rivals from shifting arenas | Flagship | Medium |
| 2 | **Quiverfall** | 1v1 or 2v2 | Curved shots, wind, and mobile cover | Flagship | Medium |
| 3 | **Tether Sprint** | 2–4 player race | Grapple-routing and momentum mastery | Flagship | Medium |
| 4 | **Relay Ruins** | 2v2 | Pass a charged relic through parkour routes | Strong | Medium |
| 5 | **Crash Cart Derby** | 2–4 player FFA | Vehicle balance, drafting, and sabotage | Strong | Medium–high |
| 6 | **Orbitball** | 2v2 | Physics sport with possession and aerial saves | Strong | Medium–high |
| 7 | **Seismic Sumo** | 1v1 / 4-player bracket | Read instability and force ring-outs | Strong | Low–medium |
| 8 | **Skyhook Heist** | 2v2 | Carry, pass, and steal a physics payload | Differentiated | Medium |
| 9 | **Bridgebreak Brigade** | 2v2 | Build routes while collapsing opponents’ plans | Differentiated | Medium–high |
| 10 | **Avalanche Ascent** | 2–4 player race | Climb a destructing vertical course | Differentiated | Medium |

> **Portfolio principle:** score outcomes from player skill, not simulation randomness. Randomness can shape the arena—such as wind direction or a falling beam—but must be telegraphed early, seeded, and applied symmetrically.

## 1. Reactor Rumble

**Core gameplay and competitive design.** Reactor Rumble is a two-to-four-player arena knockout game. Each player runs, jumps, braces, grabs, and uses a short cooldown shove in a small industrial reactor arena. Conveyor strips, collapsing gantries, magnetic pads, and periodically shifting walls make positioning more important than a large move list. Players collect a temporary “charge tool” from a central station—examples include a pulse paddle, spring mine, or recoil cannon—and win rounds by being the last player with reactor charge remaining. A best-of-five structure, six original arena archetypes, and a sudden-death shrinking field create clean tournament pacing. Competitive depth comes from spacing, momentum conservation, baiting a shove, weapon timing, and stage awareness rather than complicated combat strings.

**Inspiration and originality boundary.** The high-level reference is *Stick Fight: The Game*, whose publisher presents it as a physics-based online/couch fight between stick figures. [1] Stickworld should borrow only the **abstract premise of short multiplayer physics knockouts**. It must not copy the name, logo treatment, level geometry, stage hazards, weapon shapes or behavior, player silhouettes, animations, UI, sound effects, round flow, marketing copy, or any other recognizable audiovisual expression. The original “reactor sport” fiction, hub-and-spoke arenas, charge system, and tool kit give the concept a separate identity.

**Web build overview.** Model every fighter as a lightweight capsule with a separate hit/interaction zone rather than a fully simulated multi-joint ragdoll during normal control. Trigger a short ragdoll or loose-limb visual state only for high-impact knockbacks. Run collision, charge, hazards, and win detection on an authoritative 60 Hz server. Clients submit input states and interpolate snapshots; the server alone validates hits, impulse strength, pickups, and ring-outs. This keeps a visually physical brawler feasible without allowing client-side position or hit spoofing.

## 2. Quiverfall

**Core gameplay and competitive design.** Quiverfall is a precision projectile duel for 1v1 or 2v2 teams. Each archer has a concise three-action kit: draw-and-release an arrow, sidestep/dash, and deploy one temporary cover object. Wind changes in clearly announced 20-second phases; hanging lanterns, rope bridges, and breakable shields alter shot lines. The match is first to five crests, earned by tagging opponents or holding the elevated central perch. Ammunition stays intentionally limited: standard arrows, a low-damage tether arrow that pulls a target slightly, and a foam-impact arrow that shifts objects without producing an instant kill. This turns every shot into a prediction problem while keeping spectators able to read the arc.

**Inspiration and originality boundary.** The reference is *Ragdoll Archers*, which is described as bow-and-arrow stickman action with ragdoll physics and a two-player PvP option. [2] Adopt the general design lesson—**ballistic aim plus unstable bodies creates suspense**—but design a different energy model, objective, projectile vocabulary, art direction, hit rules, stages, progression, and audio. Do not reproduce the source game’s character pose, health/items, ammunition designs, enemy structure, economy, maps, or specific arrow effects. In particular, a tournament mode should favor balanced preset loadouts over copying any collectible upgrade schema.

**Web build overview.** Use deterministic analytic projectile stepping where possible: on launch, the authoritative room simulates gravity, drag, wind, bounce count, collisions, and a compact impact event. This is cheaper and easier to reconcile than network-synchronizing a fully physical arrow-and-ragdoll simulation. Replicate launch angle, draw strength, and seed; clients may predict their own arrow, but display server correction for impacts. Keep cover as simple convex polygons with health states, rather than arbitrary destructible meshes.

## 3. Tether Sprint

**Core gameplay and competitive design.** Tether Sprint is a two-to-four-player vertical and lateral race across a gigantic suspended construction site. Players may attach a tether to visible anchor nodes, release for momentum, wall-kick once between hooks, and activate a very brief brake. Each course presents two or three viable routes: a safe low route, a high-skill swing chain, and a risky route with moving anchors. Racers earn checkpoint points; the first player to reach the final beacon wins, while trailing players may still place for tournament points. Ghost racing and time trials share the same routes, but live races add body blocking only at narrow checkpoints—never enough to make griefing optimal.

**Inspiration and originality boundary.** *Stickman Hook* establishes a simple public reference for attaching a rope to a hook, releasing to launch, and using spring platforms to set up the next swing. [3] Keep the mechanic at that level of abstraction only. Tether Sprint needs a wholly original setting, anchors, camera language, character design, level layouts, route structure, boosters, scoring, and sound. Avoid reproducing the visual color palette, obstacle sequence, hook placement, spring-pad behavior, names, or tap-only presentation associated with the inspiration.

**Web build overview.** Implement the tether as a server-owned distance constraint between player and anchor with max length, damping, and a capped retraction rule. On client, predict local swing motion and render other players from interpolated server snapshots; resolve checkpoint triggers and collision priority on the server. Design tracks as tileable static collision geometry plus scripted moving anchors, and transmit each anchor’s phase/seed rather than its full transform on every packet. The approach provides the readability of physics swinging without a costly general-purpose rope simulation.

## 4. Relay Ruins

**Core gameplay and competitive design.** Relay Ruins is a 2v2 possession-and-parkour match. Teams must transport a heavy “relic capacitor” through three activation gates before depositing it at their base. The carrier is slower, cannot grapple, and drops the relic when knocked down, so success depends on routes, handoffs, switches, and escorting. Teammates can throw a pass over a hazard, bounce the relic off a jump pad, or briefly open a gate from an alternate route. Each three-minute match alternates side selection and has an overtime based on distance-to-goal if scores are equal. It is a natural competitive team game because the role changes from carrier to interceptor every few seconds.

**Inspiration and originality boundary.** The broad reference is the **precision obstacle-course discipline** popularized by stickman platformers such as the *Vex* series. The game should not recreate any level, trap combination, visual theme, animation, HUD, or character presentation from those games. The differentiating expression is a team sport built around a passable physics relic, mirrored competitive maps, operating machinery, and relay tactics—not a single-player obstacle course.

**Web build overview.** Use platformer kinematics that are intentionally more deterministic than full ragdolls: acceleration, coyote time, buffered jump, one wall-kick, and fixed collider shapes. Simulate only the relic as a full rigid body, with an authoritative possession state and server-validated throws. Build maps from mirrored tile modules, so distance and timing are symmetric. A rollback-lite local prediction model is sufficient because collisions between players should impart mild displacement rather than decide instant elimination.

## 5. Crash Cart Derby

**Core gameplay and competitive design.** Crash Cart Derby is a two-to-four-player racing brawl in improvised gravity carts. Each racer leans forward/back to manage wheel contact, spends a limited boost to clear gaps, and can pick up a low-power tow magnet that pulls nearby scrap into a shield. Tracks mix downhill momentum, seesaw bridges, loose cargo, and split lanes. A race uses two laps and awards points for finishing, airtime gates, and clean overtakes; reckless crashes cause a quick respawn at the prior checkpoint rather than an extended stun. This makes the physics funny while keeping actual racing skill central.

**Inspiration and originality boundary.** The reference is the broad balancing-and-momentum feel associated with stickman bike and downhill games, including *Stickman Bike Battle*. Treat it as a genre cue, not a blueprint. Use original vehicle proportions, suspension behavior, tracks, pickups, HUD, camera, animation, narrative theme, and music. Do not use another title’s bike model, touch-control layout, level topology, brand, or challenge structure. The “salvage-cart derby” premise and tow-magnet defense system separate the design from a conventional bike racer.

**Web build overview.** Simulate carts as one rigid chassis with two wheel contact points and a simplified angular spring, not a complex vehicle stack. Static terrain is segmented; loose cargo uses object pooling and sleeps when settled. On the server, validate boost energy, checkpoint order, hazards, and item effects; transmit remote cart transform/velocity at a modest rate and interpolate. Keep race fields to four players at launch and cap the number of simultaneously active debris bodies.

## 6. Orbitball

**Core gameplay and competitive design.** Orbitball is a 2v2 physics sport played inside a circular arena with low gravity. Teams score by sending a luminous ball through the opponent’s orbital goal ring. Players jump, air-dash once, body-block, catch only for a brief charge window, and throw with a direction/strength vector. After 40 seconds without a score, the ball gains a slow magnetic pull toward the arena center to prevent passive stalling. A three-minute game is fast enough for a tournament queue but supports highly practiced set plays: a rebound pass, ceiling bank, or defender-launch into a save.

**Inspiration and originality boundary.** The broad inspiration is the fast, physics-forward party-sport appeal found in stickman party collections such as *Stickman Party*, not any one minigame or visual treatment. The game needs its own circular arena, orbital rules, original goal mechanics, roster, color language, sound, and competitive regulations. Never re-use sports courts, minigame rules, title wording, art, or interface patterns from a reference title.

**Web build overview.** Treat Orbitball as a server-authoritative rigid ball plus player-controlled capsules. Encode throws as input events with aim direction and normalized charge time; server-side cooldown and possession checks make them cheat-resistant. Use continuous collision detection for the ball at high speed, and publish goal, possession, and wall-bounce events reliably. Because a single ball drives most of the drama, devote replay and spectator camera tooling to it from the beginning.

## 7. Seismic Sumo

**Core gameplay and competitive design.** Seismic Sumo is a compact 1v1 balance duel with a four-player elimination variant. Fighters stand on a layered stone disk above a chasm; they can walk, crouch to anchor, jump, shove, or stomp. Stomps generate visible radial cracks, weaken small tiles, and alter the disk’s tilt. The round ends on a fall, but the greatest skill is force management: an early shove may give an opponent the recoil they need to move you later. The rules create a clean fighting game with no weapons and a strong “one more round” pull.

**Inspiration and originality boundary.** The general reference is *Supreme Duelist Stickman*’s approachable two-player, physics-oriented stickman combat framing. The new game should explicitly avoid its weapons, maps, characters, animations, icons, mode names, UI, and audiovisual presentation. The original expression is a geological balance sport in which players manufacture the arena’s instability; that is distinct from a weapon-chaos duel.

**Web build overview.** This is a low-risk physics game. Use a fixed set of tilting platform layers with joint limits and tile-state bitmasks, rather than fully fracturing terrain. Players use deterministic kinematic locomotion; stomp and shove resolve as server-side impulses. Replicate the disk angle, per-tile damage state, and player states. The small entity count makes it well suited to low-latency ranked play and mobile browsers.

## 8. Skyhook Heist

**Core gameplay and competitive design.** Skyhook Heist is a 2v2 asymmetric-in-the-moment robbery sport: each team alternates for 90 seconds as the courier and the interceptors, then sides switch. Couriers must move three volatile canisters from a drifting sky barge to their extraction line; interceptors use short grapples, movable wind fans, and body blocks to force drops. A dropped canister bounces and rolls toward danger, creating spectacular recoveries. The courier team scores for delivery speed; the defense scores for delay and recoveries. The mirrored two-leg format is fair because both teams face the same conditions.

**Inspiration and originality boundary.** The game combines two abstract stickman patterns—grappling traversal exemplified by *Stickman Hook* and short multiplayer physical confrontations exemplified by *Stick Fight: The Game*. [1] [3] It must not copy the source titles’ expressions. The original airship-rescue world, timed role swap, canister behavior, wind-control devices, modular barge deck, and scoring create a clearly independent product.

**Web build overview.** Reuse the tether constraint from Tether Sprint and the carryable-object authority model from Relay Ruins. Keep the barge deck as a scripted kinematic platform with predictable movement, while canisters are authoritative rigid bodies. Replicate role, timer, canister delivery state, and wind-fan activations. That asset and netcode reuse makes this a valuable seventh or eighth game, not a separate engineering project.

## 9. Bridgebreak Brigade

**Core gameplay and competitive design.** Bridgebreak Brigade is a 2v2 construction-versus-demolition contest. Both teams spawn on opposite cliffs and must ferry three energy cores across a ravine. Players collect temporary beam, hinge, and counterweight pieces, then snap them to predefined connection nodes. The other team can slam into unstable joints, trigger a legal demolition charge on a cooldown, or steal a loose core. A bridge should be fast but fragile; a reinforced bridge costs time. The resulting strategic trade-off provides depth without requiring players to learn a full construction editor.

**Inspiration and originality boundary.** The inspiration is the broad joy of stickman physics puzzles and ragdoll-driven environmental interaction, not a particular bridge-building title. Any resemblance risk is minimized by avoiding third-party names, exact construction interfaces, map compositions, art motifs, pieces, UI language, and campaign framing. Stickworld’s original competitive identity is the mirrored “engineering derby” where teams race, defend, and disrupt under tournament rules.

**Web build overview.** Use a node-and-edge structural graph, not arbitrary mesh deformation. Every placed beam has server-defined mass, maximum stress, and joint health; a deterministic stress approximation marks joints as stable, cracked, or broken. Render wobble and debris locally from authoritative break events. Restrict each team to a small piece budget and six to eight connection nodes per map to ensure both understandable play and bounded simulation cost.

## 10. Avalanche Ascent

**Core gameplay and competitive design.** Avalanche Ascent is a two-to-four-player vertical climb race through a collapsing mountain research station. Players have grip, jump, mantle, and a limited use rescue line. As the lead climber advances, lower sections begin to fail in a clearly visible wave; players can dislodge safe-looking snow shelves to deny a route, but doing so can also remove their own recovery path. The winner is the first to activate the summit transmitter. Tournament scoring rewards placement over several short heats, giving eliminated players an incentive to finish rather than quit.

**Inspiration and originality boundary.** The reference is the general stickman climbing and precision-platformer tradition. The concept must use original mountain-fiction, climbing controls, route design, collapse rules, silhouettes, artwork, soundtrack, and interface. Avoid any recognizable representation of an existing climbing game, including its course sequence, obstacles, animations, iconography, level labels, and tutorial wording. The signature distinction is the player-triggered but telegraphed avalanche front, coupled with multi-heat placement scoring.

**Web build overview.** Author the mountain as modular static collision chunks with a server-driven collapse schedule. A chunk transitions through intact, warning, falling, and removed states; visual debris is cosmetic and spawned locally from the shared event seed. Use kinematic character movement with server-validated ledge grabs and checkpoint triggers. The collapse front ensures races converge naturally, which reduces the need for aggressive catch-up items.

## Shared web architecture and production policy

The recommended client stack is **TypeScript + Phaser** for browser rendering/input and a 2D physics layer such as Matter.js. Phaser is an HTML5 2D framework intended for desktop and mobile web browsers; Matter.js provides the web-facing 2D building blocks needed for rigid bodies, constraints, collisions, restitution, friction, and gravity. [4] [5] This shared stack permits a common launcher, input remapping, asset pipeline, replay UI, and performance budget across the entire roster.

For ranked multiplayer, use a **server-authoritative room** for every match. Colyseus is one practical Node.js option because it supports authoritative servers, rooms/matchmaking, and state synchronization. Its Phaser guidance specifically recommends input queues and a matching fixed-tick update model for deterministic client/server simulation. [6] [7] In implementation terms, clients should send compact input intents—move axis, jump, aim, hook, throw—not positions, velocities, scores, or hit declarations. Servers resolve collisions, projectile impacts, resources, checkpoints, objectives, timers, and final results. Clients predict only their own responsive motion, interpolate remote snapshots, and visibly but gently reconcile corrections.

| Shared system | Recommendation | Why it matters across ten games |
|---|---|---|
| Match sizes | Prioritize 1v1, 2v2, and 2–4 player FFA | Reduces physics entity count, networking load, and queue fragmentation. |
| Simulation | Fixed 60 Hz authoritative simulation; render decoupled from tick | Stable interactions and reproducible replays. [7] |
| Input / anti-cheat | Input-only protocol; sequence numbers, rate limits, server validation | Prevents client-forged movement, scores, projectiles, and hits. |
| Rendering | Client-side interpolation; cosmetic particles are non-authoritative | Keeps the game smooth without making outcomes client-controlled. |
| Map fairness | Mirrored competitive maps or seeded symmetric variations | Supports fair ladders and credible tournaments. |
| Content economy | Cosmetics only: banners, trails, emotes, victory poses, arena themes | Protects competitive integrity across every title. |
| Replays | Store seed, map version, inputs, and server events | Enables dispute review, highlights, spectating, and regression testing. |

## Copyright-safe development guardrails

The legal distinction is important but not a permission to imitate wholesale. WIPO explains that the underlying **idea** of a game is not copyrightable, whereas its **expression or representation** is; it also notes that games combine software with audiovisual elements. [8] Therefore, mechanics such as projectile arcs, ropes, collision, balance, racing, or a knockout condition can inform original design, while third-party characters, names, art, animation, levels, UI, sound, code, narrative, and distinctive combinations of expressive elements must not be copied.

Before production, maintain a brief **inspiration ledger** for each title. It should name the abstract lesson taken from a reference, list the elements excluded from copying, document the new game’s independent creative pillars, and attach original-art and audio provenance. This is a practical design-control process, not legal advice. Have qualified IP counsel review branding, character silhouettes, UI, launch-store assets, creator contracts, and the target jurisdictions before release.

> **Recommended rule for the team:** “Reference the player problem, not the other game’s solution.” For example: “make timing a swing satisfying” is a player problem; copying an existing game’s hooks, course layout, visual cadence, and obstacle order is a particular solution to avoid.

## Next production step

Create a six-week shared-platform prototype containing **Reactor Rumble**, **Quiverfall**, and **Tether Sprint**. The objective is to validate fixed-tick authoritative physics, input feel at real latency, matchmaking, spectators/replays, cross-device performance, and the platform’s visual identity. Then use the resulting player controller, projectile system, rope constraint, objective framework, and room-service foundations to produce the remaining seven games faster and with consistent competitive quality.

## References

[1]: https://landfall.se/stickfightthegame "Landfall — Stick Fight: The Game"
[2]: https://www.crazygames.com/game/ragdoll-archers "CrazyGames — Ragdoll Archers"
[3]: https://poki.com/en/g/stickman-hook "Poki — Stickman Hook"
[4]: https://docs.phaser.io/phaser/getting-started/what-is-phaser "Phaser documentation — What is Phaser?"
[5]: https://brm.io/matter-js/ "Matter.js — official project page"
[6]: https://docs.colyseus.io/ "Colyseus documentation"
[7]: https://docs.colyseus.io/learn/tutorial/phaser/fixed-tickrate "Colyseus — Phaser fixed tick-rate tutorial"
[8]: https://www.wipo.int/en/web/wipo-magazine/articles/video-games-computer-programs-or-creative-works-38930 "WIPO — Video Games: Computer Programs or Creative Works?"
