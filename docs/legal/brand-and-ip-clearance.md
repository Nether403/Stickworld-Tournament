# Brand and IP Clearance — Parallel Track

**Not a spec.** This runs alongside Specs 1–3 because it has long lead times and it gates naming.
Starting it late is how a project ends up renaming ten games after building them.

> This document is a design-control process, not legal advice. Qualified IP counsel reviews
> branding, character silhouettes, UI, and launch assets in the target jurisdictions before public
> launch.

---

## 1. Why this exists

The research documents establish the legal frame well: game **mechanics** are unprotectable ideas,
while the specific **expression** of a game is protected. Pendulum physics, ragdoll joints,
projectile arcs, and knockout conditions are free to build on. Another company's art, names,
animations, level layouts, UI, sound, code, and *distinctive combinations of expressive elements*
are not.

Two case-law lessons from the research are worth carrying as working rules:

- *Tetris Holding v. Xio* — copying only the rules was the defence, and it failed, because the
  clone also reproduced grid dimensions, piece shapes, colours, and pacing. Mechanics were fine;
  the specific expressive choices were not.
- *Spry Fox v. Lolapps* — swapping every art asset one-for-one was **not** sufficient. The
  hierarchical progression, object relationships, and overall feel still read as the same
  expression.

Working rule for the team, stated as a slogan because it is easy to remember under deadline:

> **Reference the player problem, not the other game's solution.**
>
> "Make timing a swing feel satisfying" is a player problem. Copying an existing game's hook
> placement, course order, and visual cadence is a particular solution to avoid.

---

## 2. Trademark clearance

Searches across USPTO, EUIPO, and WIPO for the platform name and all ten titles. Working titles
until cleared.

| Name | USPTO | EUIPO | WIPO | Verdict | Notes |
|---|---|---|---|---|---|
| Stickworld Tournament | ☐ | ☐ | ☐ | pending | platform name — highest priority |
| Hookline Sprint | ☐ | ☐ | ☐ | pending | game 1, needed before Spec 3 |
| Pickaxe Ascent | ☐ | ☐ | ☐ | pending | game 2, needed before Spec 3 |
| Launch Lab | ☐ | ☐ | ☐ | pending | generic-sounding — check carefully |
| Ragdoll Archery Rush | ☐ | ☐ | ☐ | pending | |
| Hammer Throw Havoc | ☐ | ☐ | ☐ | pending | |
| Pogo Tower | ☐ | ☐ | ☐ | pending | |
| Rooftop Relay | ☐ | ☐ | ☐ | pending | |
| Balance Bike Blitz | ☐ | ☐ | ☐ | pending | "balance bike" is a real product category — check |
| Cargo Chaos | ☐ | ☐ | ☐ | pending | likely crowded — have a fallback |
| Demolition Dive | ☐ | ☐ | ☐ | pending | |

Also clear the domain and the social handles at the same time. A cleared trademark with no
available domain is only half an answer.

---

## 3. Inspiration ledger

One entry per game, written **before** the game is built, reviewed at merge. The Spec 3
integration checklist requires it.

Template:

```markdown
## <Game name>

**Abstract lesson taken**
The unprotectable mechanic or player problem. One or two sentences.

**Explicitly excluded from copying**
Named third-party expressive elements we are deliberately not reproducing: level layouts,
colour palettes, sprite designs, hazard sequences, damage multipliers, upgrade pricing,
UI arrangement, sound effects, character names.

**Our independent creative pillars**
What makes this game's expression its own: setting, theme, scoring model, spatial dimensions,
mathematical pacing, art direction, audio language.

**Asset provenance**
Every asset: human-authored / generated / generated-then-human-edited. Links to the ledger.
```

Note the *Spry Fox* lesson in the "independent creative pillars" section: it is not enough to have
different art. Mathematical pacing, hierarchical structure, and overall feel need to differ too.

---

## 4. The CI grep gate

Cheap, automated, and it catches the single most likely real-world mistake — a third-party game
name left in a variable, a comment, a test fixture, a placeholder asset filename, or a commit
message during early prototyping.

A CI job fails the build when any of the following appears anywhere in code, UI strings, docs,
asset filenames, or test fixtures:

```
Stickman Hook · Ragdoll Hit · Dreadhead Parkour · Light It Up · Stickman Dismounting
Boomstick Bazooka · Archers Online · Stickman Fall · One Gun Stickman
Stickman Skate Battle · Stick Fight · Supreme Duelist · Ragdoll Archers · Vex · OvO
Rooftop Snipers · Stick War · Henry Stickmin · Fancy Pants · Xiao Xiao
Turbo Dismount · Stair Dismount · Line Rider · Hill Climb Racing · Elasto Mania
QWOP · Bowmasters · Powder Game · Clear Vision · Tactical Assassin
Stickman Party · Stickman Bike Battle · Stick It to the Stickman
```

Allowlisted paths: this file, `.kiro/specs/README.md`, and the workspace research documents — all
of which discuss these titles legitimately, as prior art being deliberately avoided.

Maintenance: when a new reference is consulted during design, add it to the list at the same time.

---

## 5. Generated-asset provenance

Recorded here because it affects what the project can own, not just what it can use.

Purely AI-generated images may not attract copyright protection where authorship requires human
intellectual creation — the EU analysis in the research covers this, and the US position is
similar in substance. The practical consequence:

| Asset class | Provenance requirement | Reason |
|---|---|---|
| Logo, wordmark, mascot | human, or generated-then-human-edited | needs to be defensible as owned IP |
| Stickman silhouette and proportions | human-authored | the platform's core visual identity |
| Volume art: backgrounds, textures, badges, skins | generated is fine | breadth matters more than exclusivity |
| Collision geometry | hand-authored always | tunability and versioning, not an IP question |
| Announcer voice lines | generated is fine | check Deepgram's terms on output ownership |

Trademark protects the brand regardless of the copyright position, which is why the trademark
searches in §2 matter more than the copyright question for the brand marks specifically.

---

## 6. Compliance items that surface elsewhere

Tracked here so nothing falls between specs:

- **Handles are user-generated content.** This alone makes the platform a UGC host, requiring a
  notice-and-action mechanism, a moderation queue, statements of reasons, and an audit trail. No
  chat or level sharing needed to trigger it. → Spec 5 R3.
- **GDPR** export and deletion, with competitive-integrity records retained anonymised. → Spec 5 R3.
- **No prizes at launch**, which keeps gambling, KYC, and tax questions out of scope. If that ever
  changes, it changes the schema and the verification rigour, and it needs re-planning rather than
  retrofitting.
- **Age policy.** Decide before launch whether under-13 users are permitted, since that pulls in
  COPPA obligations around data retention and information security. Currently undecided.

---

## 7. Status

| Item | Owner | Status |
|---|---|---|
| Trademark searches, platform name | — | not started |
| Trademark searches, ten titles | — | not started |
| Domain and social handle availability | — | not started |
| Inspiration ledger, games 1–2 | — | not started, needed before Spec 3 |
| CI grep gate | — | not started, implement in Spec 1 Task 1 |
| Counsel review, branding and silhouettes | — | not started, before public launch |
| Age policy decision | — | undecided |
