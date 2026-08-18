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

## Not in Spec 3

**Ragdoll is not implemented.** Hookline Sprint and Pickaxe Ascent v1 use a locked-rotation
capsule (Pickaxe adds a kinematic pickaxe body). A ten-body stickman assembly waits for the
first game that simulates one (Spec 4). Wheels, breakables, and moving platforms are also
out of this package until a game proves them.
