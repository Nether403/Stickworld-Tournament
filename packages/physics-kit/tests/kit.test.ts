import { describe, expect, it } from 'vitest';
import { initRapier, SimWorld } from '@stickworld/sim-core';
import {
  castTaggedRay,
  createAabbSensor,
  createFixedBall,
  createFixedCuboid,
  createLockedCapsule,
  createRopeJoint,
  createVerticalGateSensor,
  destroyImpulseJoint,
} from '../src/index.ts';

describe('physics-kit factories', () => {
  it('creates tagged colliders through SimWorld', async () => {
    const rapier = await initRapier();
    const sim = new SimWorld(rapier);
    const tags = new Map<number, string>();
    const player = createLockedCapsule(sim, rapier, 0, 2, 0.45, 0.18, 70, 0.04, tags, 'player');
    const ledge = createFixedCuboid(sim, rapier, 0, 0, 2, 0.25, tags, 'ledge');
    const ball = createFixedBall(sim, rapier, 4, 4, 0.2, tags, 'anchor');
    const sensor = createAabbSensor(sim, rapier, 10, 8, 4, 20, tags, 'finish');
    const gate = createVerticalGateSensor(sim, rapier, 8, tags, 'gate');
    expect(player.body.isFixed()).toBe(false);
    expect(ledge.body.isFixed()).toBe(true);
    expect(ball.collider.isSensor()).toBe(false);
    expect(sensor.collider.isSensor()).toBe(true);
    expect(gate.collider.isSensor()).toBe(true);
    expect(tags.get(player.collider.handle)).toBe('player');
    const miss = castTaggedRay(
      sim.world,
      rapier,
      { x: 0, y: 2 },
      { x: 0, y: 1 },
      1,
      player.collider,
      player.body,
      tags,
      'anchor',
    );
    expect(miss).toBeNull();
    const joint = createRopeJoint(sim.world, rapier, player.body, ball.body, 1);
    destroyImpulseJoint(sim.world, joint);
    sim.free();
  });
});
