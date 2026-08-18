import { hypot, SimWorld, type RapierModule } from '@stickworld/sim-core';

export type ColliderTags = Map<number, string>;

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
): { collider: { handle: number; parent: () => ReturnType<SimWorld['createRigidBody']> | null } } | null {
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
  return hit as never;
}

export function createRopeJoint(
  world: SimWorld['world'],
  rapier: RapierModule,
  bodyA: ReturnType<SimWorld['createRigidBody']>,
  bodyB: ReturnType<SimWorld['createRigidBody']>,
  restLength: number,
): ReturnType<SimWorld['world']['createImpulseJoint']> {
  return world.createImpulseJoint(
    rapier.JointData.rope(restLength, { x: 0, y: 0 }, { x: 0, y: 0 }),
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
