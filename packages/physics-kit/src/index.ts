import { atan, hypot, sin, SimWorld, type RapierModule } from '@stickworld/sim-core';

export type ColliderTags = Map<number, string>;

const PI = 4 * atan(1);

export function degreesToRadians(degrees: number): number {
  return (degrees * PI) / 180;
}

export function tagCollider(
  tags: ColliderTags,
  collider: { handle: number },
  name: string,
): void {
  tags.set(collider.handle, name);
}

export type LinvelBody = {
  setLinvel: (v: { x: number; y: number }, wake: boolean) => void;
};

export type PoseBody = LinvelBody & {
  setTranslation: (t: { x: number; y: number }, wake: boolean) => void;
  setAngvel: (w: number, wake: boolean) => void;
  setRotation: (angle: number, wake: boolean) => void;
};

/** Impulse-from-rest: set linear velocity to unit(dir) × speed. Spec 4 Wave A. */
export function launchImpulse(body: LinvelBody, dir: { x: number; y: number }, speed: number): void {
  const len = hypot(dir.x, dir.y);
  if (len === 0) {
    body.setLinvel({ x: 0, y: 0 }, true);
    return;
  }
  body.setLinvel({ x: (dir.x / len) * speed, y: (dir.y / len) * speed }, true);
}

/** Best-of pose reset: translation + zero velocities. Does not create bodies. */
export function resetDynamicPose(body: PoseBody, x: number, y: number, angle = 0): void {
  body.setTranslation({ x, y }, true);
  body.setLinvel({ x: 0, y: 0 }, true);
  body.setAngvel(0, true);
  body.setRotation(angle, true);
}

export function createLockedCapsule(
  sim: SimWorld,
  rapier: RapierModule,
  x: number,
  y: number,
  halfHeight: number,
  radius: number,
  mass: number,
  damping: number,
  tags: ColliderTags,
  name: string,
) {
  const body = sim.createRigidBody(
    rapier.RigidBodyDesc.dynamic().setTranslation(x, y).setLinearDamping(damping).lockRotations(),
  );
  const collider = sim.world.createCollider(
    rapier.ColliderDesc.capsule(halfHeight, radius).setMass(mass),
    body,
  );
  tagCollider(tags, collider, name);
  return { body, collider };
}

/** Locked rotation and translation (Archery plant, Hammer thrower). */
export function createPlantedCapsule(
  sim: SimWorld,
  rapier: RapierModule,
  x: number,
  y: number,
  halfHeight: number,
  radius: number,
  mass: number,
  damping: number,
  tags: ColliderTags,
  name: string,
) {
  const body = sim.createRigidBody(
    rapier.RigidBodyDesc.dynamic()
      .setTranslation(x, y)
      .setLinearDamping(damping)
      .lockRotations()
      .lockTranslations(),
  );
  const collider = sim.world.createCollider(
    rapier.ColliderDesc.capsule(halfHeight, radius).setMass(mass),
    body,
  );
  tagCollider(tags, collider, name);
  return { body, collider };
}

/** Unlocked-rotation capsule (Archery arrow). */
export function createDynamicCapsule(
  sim: SimWorld,
  rapier: RapierModule,
  x: number,
  y: number,
  halfHeight: number,
  radius: number,
  mass: number,
  damping: number,
  tags: ColliderTags,
  name: string,
) {
  const body = sim.createRigidBody(
    rapier.RigidBodyDesc.dynamic().setTranslation(x, y).setLinearDamping(damping),
  );
  const collider = sim.world.createCollider(
    rapier.ColliderDesc.capsule(halfHeight, radius).setMass(mass),
    body,
  );
  tagCollider(tags, collider, name);
  return { body, collider };
}

export function createDynamicCuboid(
  sim: SimWorld,
  rapier: RapierModule,
  x: number,
  y: number,
  hx: number,
  hy: number,
  mass: number,
  tags: ColliderTags,
  name: string,
) {
  const body = sim.createRigidBody(rapier.RigidBodyDesc.dynamic().setTranslation(x, y));
  const collider = sim.world.createCollider(rapier.ColliderDesc.cuboid(hx, hy).setMass(mass), body);
  tagCollider(tags, collider, name);
  return { body, collider };
}

export function createFixedCuboid(
  sim: SimWorld,
  rapier: RapierModule,
  x: number,
  y: number,
  hx: number,
  hy: number,
  tags: ColliderTags,
  name: string,
) {
  const body = sim.createRigidBody(rapier.RigidBodyDesc.fixed().setTranslation(x, y));
  const collider = sim.world.createCollider(rapier.ColliderDesc.cuboid(hx, hy), body);
  tagCollider(tags, collider, name);
  return { body, collider };
}

export function createFixedBall(
  sim: SimWorld,
  rapier: RapierModule,
  x: number,
  y: number,
  radius: number,
  tags: ColliderTags,
  name: string,
) {
  const body = sim.createRigidBody(rapier.RigidBodyDesc.fixed().setTranslation(x, y));
  const collider = sim.world.createCollider(rapier.ColliderDesc.ball(radius), body);
  tagCollider(tags, collider, name);
  return { body, collider };
}

export function createAabbSensor(
  sim: SimWorld,
  rapier: RapierModule,
  x: number,
  y: number,
  hx: number,
  hy: number,
  tags: ColliderTags,
  name: string,
) {
  const body = sim.createRigidBody(rapier.RigidBodyDesc.fixed().setTranslation(x, y));
  const collider = sim.world.createCollider(
    rapier.ColliderDesc.cuboid(hx, hy).setSensor(true),
    body,
  );
  tagCollider(tags, collider, name);
  return { body, collider };
}

export function createVerticalGateSensor(
  sim: SimWorld,
  rapier: RapierModule,
  x: number,
  tags: ColliderTags,
  name = 'gate',
) {
  return createAabbSensor(sim, rapier, x, 8, 0.05, 10, tags, name);
}

/** Kinematic cuboid. Spec 3 Pickaxe: pose with setKinematicAngle / setNextKinematicTranslation. */
export function createKinematicCuboid(
  sim: SimWorld,
  rapier: RapierModule,
  x: number,
  y: number,
  hx: number,
  hy: number,
  tags: ColliderTags,
  name: string,
  sensor: boolean,
) {
  const body = sim.createRigidBody(
    rapier.RigidBodyDesc.kinematicPositionBased().setTranslation(x, y),
  );
  const desc = rapier.ColliderDesc.cuboid(hx, hy);
  if (sensor) desc.setSensor(true);
  const collider = sim.world.createCollider(desc, body);
  tagCollider(tags, collider, name);
  return { body, collider };
}

export function setKinematicTranslation(
  body: { setNextKinematicTranslation: (t: { x: number; y: number }) => void },
  x: number,
  y: number,
): void {
  body.setNextKinematicTranslation({ x, y });
}

/** Oscillating kinematic platform. `sin` is detmath. Extra PRNG draws belong in the generator, not here. */
export function movingPlatformX(originX: number, amplitude: number, periodTicks: number, tick: number): number {
  if (periodTicks <= 0 || amplitude === 0) return originX;
  const omega = (2 * PI) / periodTicks;
  return originX + amplitude * sin(tick * omega);
}

export function stepMovingPlatform(
  body: { setNextKinematicTranslation: (t: { x: number; y: number }) => void },
  originX: number,
  originY: number,
  amplitude: number,
  periodTicks: number,
  tick: number,
): void {
  setKinematicTranslation(body, movingPlatformX(originX, amplitude, periodTicks, tick), originY);
}

/** Degrees → radians via detmath `atan` π, then Rapier `setNextKinematicRotation`. */
export function setKinematicAngle(
  body: { setNextKinematicRotation: (angle: number) => void },
  degrees: number,
): void {
  body.setNextKinematicRotation(degreesToRadians(degrees));
}

export type CharacterControllerHandle = {
  computeColliderMovement: (collider: never, desired: { x: number; y: number }) => void;
  computedMovement: () => { x: number; y: number };
  computedGrounded: () => boolean;
  numComputedCollisions: () => number;
  setUp: (v: { x: number; y: number }) => void;
  setSlideEnabled: (enabled: boolean) => void;
  enableSnapToGround: (distance: number) => void;
  free: () => void;
};

/** Kinematic cuboid + Rapier character controller. Gravity is integrated by the caller. */
export function createKinematicCharacter(
  sim: SimWorld,
  rapier: RapierModule,
  x: number,
  y: number,
  hx: number,
  hy: number,
  tags: ColliderTags,
  name: string,
) {
  const body = sim.createRigidBody(
    rapier.RigidBodyDesc.kinematicPositionBased().setTranslation(x, y).lockRotations(),
  );
  const collider = sim.world.createCollider(rapier.ColliderDesc.cuboid(hx, hy), body);
  tagCollider(tags, collider, name);
  const controller = sim.world.createCharacterController(0.01) as unknown as CharacterControllerHandle;
  controller.setUp({ x: 0, y: 1 });
  controller.setSlideEnabled(true);
  controller.enableSnapToGround(0.2);
  return { body, collider, controller };
}

export function setCuboidHalfExtents(
  collider: { setHalfExtents: (he: { x: number; y: number }) => void },
  hx: number,
  hy: number,
): void {
  collider.setHalfExtents({ x: hx, y: hy });
}

export function stepCharacterController(
  controller: CharacterControllerHandle,
  body: {
    translation: () => { x: number; y: number };
    setNextKinematicTranslation: (t: { x: number; y: number }) => void;
  },
  collider: { handle: number },
  desired: { x: number; y: number },
): { grounded: boolean; collisions: number } {
  controller.computeColliderMovement(collider as never, desired);
  const mv = controller.computedMovement();
  const pos = body.translation();
  body.setNextKinematicTranslation({ x: pos.x + mv.x, y: pos.y + mv.y });
  return { grounded: controller.computedGrounded(), collisions: controller.numComputedCollisions() };
}

export function createDynamicBall(
  sim: SimWorld,
  rapier: RapierModule,
  x: number,
  y: number,
  radius: number,
  mass: number,
  tags: ColliderTags,
  name: string,
) {
  const body = sim.createRigidBody(rapier.RigidBodyDesc.dynamic().setTranslation(x, y));
  const collider = sim.world.createCollider(
    rapier.ColliderDesc.ball(radius).setMass(mass).setFriction(1.4),
    body,
  );
  tagCollider(tags, collider, name);
  return { body, collider };
}

export function createFixedCuboidRotated(
  sim: SimWorld,
  rapier: RapierModule,
  x: number,
  y: number,
  hx: number,
  hy: number,
  angleRadians: number,
  tags: ColliderTags,
  name: string,
) {
  const body = sim.createRigidBody(
    rapier.RigidBodyDesc.fixed().setTranslation(x, y).setRotation(angleRadians),
  );
  const collider = sim.world.createCollider(rapier.ColliderDesc.cuboid(hx, hy), body);
  tagCollider(tags, collider, name);
  return { body, collider };
}

export function createSpringJoint(
  world: SimWorld['world'],
  rapier: RapierModule,
  bodyA: ReturnType<SimWorld['createRigidBody']>,
  bodyB: ReturnType<SimWorld['createRigidBody']>,
  restLength: number,
  stiffness: number,
  damping: number,
  localA: { x: number; y: number } = { x: 0, y: 0 },
  localB: { x: number; y: number } = { x: 0, y: 0 },
): ReturnType<SimWorld['world']['createImpulseJoint']> {
  return world.createImpulseJoint(
    rapier.JointData.spring(restLength, stiffness, damping, localA, localB),
    bodyA,
    bodyB,
    true,
  );
}

/** Frame + two wheels + rider. Prismatic would lock wheel spin; v1 uses spring distance rest. */
export function createWheelAssembly(
  sim: SimWorld,
  rapier: RapierModule,
  x: number,
  y: number,
  tags: ColliderTags,
) {
  const frame = createDynamicCuboid(sim, rapier, x, y, 0.275, 0.04, 12, tags, 'frame');
  const rear = createDynamicBall(sim, rapier, x - 0.28, y - 0.32, 0.28, 2, tags, 'wheel-r');
  const front = createDynamicBall(sim, rapier, x + 0.28, y - 0.32, 0.28, 2, tags, 'wheel-f');
  const rider = createDynamicCapsule(sim, rapier, x, y + 0.42, 0.28, 0.16, 40, 0.04, tags, 'rider');
  createFixedJoint(sim.world, rapier, frame.body, rider.body, { x: 0, y: 0.2 }, { x: 0, y: -0.2 });
  createSpringJoint(sim.world, rapier, frame.body, rear.body, 0.32, 500, 18, { x: -0.28, y: 0 }, { x: 0, y: 0 });
  createSpringJoint(sim.world, rapier, frame.body, front.body, 0.32, 500, 18, { x: 0.28, y: 0 }, { x: 0, y: 0 });
  return { frame, rear, front, rider, joints: 3 };
}

export interface CargoCondition {
  value: number;
  lastSpeedDamageTick: number;
}

export function createCargoCondition(start = 100): CargoCondition {
  return { value: start, lastSpeedDamageTick: -1000 };
}

export function damageCargoSpeed(
  state: CargoCondition,
  speed: number,
  tick: number,
  speedLimit = 6,
  interval = 10,
): void {
  if (state.value <= 0) return;
  if (speed > speedLimit && tick - state.lastSpeedDamageTick >= interval) {
    state.value -= 1;
    if (state.value < 0) state.value = 0;
    state.lastSpeedDamageTick = tick;
  }
}

export function damageCargoHazard(state: CargoCondition, amount = 15): void {
  if (state.value <= 0) return;
  state.value -= amount;
  if (state.value < 0) state.value = 0;
}

export function castTaggedRay(
  world: SimWorld['world'],
  rapier: RapierModule,
  origin: { x: number; y: number },
  dir: { x: number; y: number },
  maxToi: number,
  excludeCollider: { handle: number },
  excludeBody: { handle: number },
  tags: ColliderTags,
  name: string,
): {
  collider: { handle: number; parent: () => ReturnType<SimWorld['createRigidBody']> | null };
  toi: number;
} | null {
  const len = hypot(dir.x, dir.y);
  if (len === 0) return null;
  const ray = new rapier.Ray({ x: origin.x, y: origin.y }, { x: dir.x / len, y: dir.y / len });
  const hit = world.castRay(
    ray,
    maxToi,
    true,
    rapier.QueryFilterFlags.EXCLUDE_SENSORS,
    0xffffffff,
    excludeCollider as never,
    excludeBody as never,
    (collider) => tags.get(collider.handle) === name,
  );
  if (!hit || tags.get(hit.collider.handle) !== name) return null;
  return { collider: hit.collider, toi: hit.timeOfImpact };
}

export function createRopeJoint(
  world: SimWorld['world'],
  rapier: RapierModule,
  bodyA: ReturnType<SimWorld['createRigidBody']>,
  bodyB: ReturnType<SimWorld['createRigidBody']>,
  restLength: number,
  localA: { x: number; y: number } = { x: 0, y: 0 },
  localB: { x: number; y: number } = { x: 0, y: 0 },
): ReturnType<SimWorld['world']['createImpulseJoint']> {
  return world.createImpulseJoint(
    rapier.JointData.rope(restLength, localA, localB),
    bodyA,
    bodyB,
    true,
  );
}

export function destroyImpulseJoint(
  world: SimWorld['world'],
  joint: ReturnType<SimWorld['world']['createImpulseJoint']>,
): void {
  world.removeImpulseJoint(joint, true);
}

export function createRevoluteJoint(
  world: SimWorld['world'],
  rapier: RapierModule,
  bodyA: ReturnType<SimWorld['createRigidBody']>,
  bodyB: ReturnType<SimWorld['createRigidBody']>,
  localA: { x: number; y: number },
  localB: { x: number; y: number },
  limits?: { min: number; max: number },
): ReturnType<SimWorld['world']['createImpulseJoint']> {
  const joint = world.createImpulseJoint(
    rapier.JointData.revolute(localA, localB),
    bodyA,
    bodyB,
    true,
  );
  if (limits) {
    const typed = joint as { setLimits?: (min: number, max: number) => void };
    typed.setLimits?.(limits.min, limits.max);
  }
  return joint;
}

export function createFixedJoint(
  world: SimWorld['world'],
  rapier: RapierModule,
  bodyA: ReturnType<SimWorld['createRigidBody']>,
  bodyB: ReturnType<SimWorld['createRigidBody']>,
  localA: { x: number; y: number } = { x: 0, y: 0 },
  localB: { x: number; y: number } = { x: 0, y: 0 },
): ReturnType<SimWorld['world']['createImpulseJoint']> {
  return world.createImpulseJoint(
    rapier.JointData.fixed(localA, 0, localB, 0),
    bodyA,
    bodyB,
    true,
  );
}

export const RAGDOLL_LIMITS = {
  head: { min: -40, max: 40 },
  shoulder: { min: -110, max: 40 },
  elbow: { min: 0, max: 140 },
  hip: { min: -20, max: 80 },
  knee: { min: 0, max: 140 },
} as const;

export type RagdollPart = ReturnType<typeof createDynamicCapsule>;

export interface TenBodyRagdoll {
  torso: RagdollPart;
  head: RagdollPart;
  lUpper: RagdollPart;
  lLower: RagdollPart;
  rUpper: RagdollPart;
  rLower: RagdollPart;
  lThigh: RagdollPart;
  lShin: RagdollPart;
  rThigh: RagdollPart;
  rShin: RagdollPart;
  joints: number;
}

function ragdollLimits(minDeg: number, maxDeg: number): { min: number; max: number } {
  return { min: degreesToRadians(minDeg), max: degreesToRadians(maxDeg) };
}

/** Ten-body stickman, root-to-leaves. Extracted from Ragdoll Archery Rush after goldens. */
export function createTenBodyRagdoll(
  sim: SimWorld,
  rapier: RapierModule,
  tags: ColliderTags,
  originX: number,
  originY: number,
  plantedTorso: boolean,
): TenBodyRagdoll {
  const torsoFactory = plantedTorso ? createPlantedCapsule : createDynamicCapsule;
  const torso = torsoFactory(sim, rapier, originX, originY, 0.28, 0.16, 22, 0.04, tags, 'torso');
  const head = createDynamicCapsule(sim, rapier, originX, originY + 0.56, 0.08, 0.12, 6, 0.04, tags, 'head');
  const lUpper = createDynamicCapsule(sim, rapier, originX - 0.28, originY + 0.18, 0.14, 0.07, 4, 0.04, tags, 'l-upper');
  const lLower = createDynamicCapsule(sim, rapier, originX - 0.48, originY - 0.08, 0.13, 0.06, 3, 0.04, tags, 'l-lower');
  const rUpper = createDynamicCapsule(sim, rapier, originX + 0.28, originY + 0.18, 0.14, 0.07, 4, 0.04, tags, 'r-upper');
  const rLower = createDynamicCapsule(sim, rapier, originX + 0.48, originY - 0.08, 0.13, 0.06, 3, 0.04, tags, 'r-lower');
  const lThigh = createDynamicCapsule(sim, rapier, originX - 0.1, originY - 0.48, 0.18, 0.08, 7, 0.04, tags, 'l-thigh');
  const lShin = createDynamicCapsule(sim, rapier, originX - 0.1, originY - 0.86, 0.16, 0.07, 5, 0.04, tags, 'l-shin');
  const rThigh = createDynamicCapsule(sim, rapier, originX + 0.1, originY - 0.48, 0.18, 0.08, 7, 0.04, tags, 'r-thigh');
  const rShin = createDynamicCapsule(sim, rapier, originX + 0.1, originY - 0.86, 0.16, 0.07, 5, 0.04, tags, 'r-shin');

  createRevoluteJoint(sim.world, rapier, torso.body, head.body, { x: 0, y: 0.4 }, { x: 0, y: -0.16 }, ragdollLimits(RAGDOLL_LIMITS.head.min, RAGDOLL_LIMITS.head.max));
  createRevoluteJoint(sim.world, rapier, torso.body, lUpper.body, { x: -0.16, y: 0.2 }, { x: 0.14, y: 0 }, ragdollLimits(RAGDOLL_LIMITS.shoulder.min, RAGDOLL_LIMITS.shoulder.max));
  createRevoluteJoint(sim.world, rapier, lUpper.body, lLower.body, { x: 0, y: -0.14 }, { x: 0, y: 0.13 }, ragdollLimits(RAGDOLL_LIMITS.elbow.min, RAGDOLL_LIMITS.elbow.max));
  createRevoluteJoint(sim.world, rapier, torso.body, rUpper.body, { x: 0.16, y: 0.2 }, { x: -0.14, y: 0 }, ragdollLimits(RAGDOLL_LIMITS.shoulder.min, RAGDOLL_LIMITS.shoulder.max));
  createRevoluteJoint(sim.world, rapier, rUpper.body, rLower.body, { x: 0, y: -0.14 }, { x: 0, y: 0.13 }, ragdollLimits(RAGDOLL_LIMITS.elbow.min, RAGDOLL_LIMITS.elbow.max));
  createRevoluteJoint(sim.world, rapier, torso.body, lThigh.body, { x: -0.08, y: -0.28 }, { x: 0, y: 0.18 }, ragdollLimits(RAGDOLL_LIMITS.hip.min, RAGDOLL_LIMITS.hip.max));
  createRevoluteJoint(sim.world, rapier, lThigh.body, lShin.body, { x: 0, y: -0.18 }, { x: 0, y: 0.16 }, ragdollLimits(RAGDOLL_LIMITS.knee.min, RAGDOLL_LIMITS.knee.max));
  createRevoluteJoint(sim.world, rapier, torso.body, rThigh.body, { x: 0.08, y: -0.28 }, { x: 0, y: 0.18 }, ragdollLimits(RAGDOLL_LIMITS.hip.min, RAGDOLL_LIMITS.hip.max));
  createRevoluteJoint(sim.world, rapier, rThigh.body, rShin.body, { x: 0, y: -0.18 }, { x: 0, y: 0.16 }, ragdollLimits(RAGDOLL_LIMITS.knee.min, RAGDOLL_LIMITS.knee.max));

  return {
    torso,
    head,
    lUpper,
    lLower,
    rUpper,
    rLower,
    lThigh,
    lShin,
    rThigh,
    rShin,
    joints: 9,
  };
}
