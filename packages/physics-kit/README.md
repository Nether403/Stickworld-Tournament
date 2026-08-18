# @stickworld/physics-kit

Factories used by Spec 3 shipping games. Bodies are created through `SimWorld.createRigidBody`
so registry order stays defined.

Task 1 golden freeze: commit `60f12a3` (`games/hookline-sprint/conformance/golden/hashes.json` and `sample.json`).
Task 2 must not regenerate those files.

## Spec 3

- Fixed ball **anchor**
- Fixed cuboid **ledge / wall**
- Vertical **gate** sensor
- AABB **impact** sensor
- Raycast attach onto a tagged collider
- Rope / distance impulse joint
- Kinematic cuboid + `setKinematicAngle` (added for Pickaxe Ascent; not used by Hookline)

## Spec 4 Wave A

- `launchImpulse(body, dir, speed)` — set linvel to unit direction × speed (impulse-from-rest)
- `resetDynamicPose` — best-of pose reset without new bodies
- Planted / dynamic capsules, dynamic cuboid, revolute + fixed joints
- `createTenBodyRagdoll` — extracted from Ragdoll Archery Rush after goldens (`370da3b8b548c5f8`)

## Spec 4 Wave B

- `movingPlatformX` / `stepMovingPlatform` — Pogo Tower kinematic movers (`detmath.sin`)
- Pickaxe v1 must not consume movers (hash stays `6b03896db5837763`)

## Later waves (not yet in this package until a consumer proves them)

Wheels, breakables, and kinematic character controllers wait for their first
Spec 4 consumer. Ragdoll is Wave A (`createTenBodyRagdoll`). Movers are Wave B.
