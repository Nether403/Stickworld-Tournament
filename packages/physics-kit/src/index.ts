import { atan, hypot, SimWorld, type RapierModule } from '@stickworld/sim-core';

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

/** Degrees → radians via detmath `atan` π, then Rapier `setNextKinematicRotation`. */
export function setKinematicAngle(
  body: { setNextKinematicRotation: (angle: number) => void },
  degrees: number,
): void {
  body.setNextKinematicRotation(degreesToRadians(degrees));
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
