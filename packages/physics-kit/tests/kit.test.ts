import { describe, expect, it } from 'vitest';
import { initRapier, SimWorld } from '@stickworld/sim-core';
import {
  castTaggedRay,
  createAabbSensor,
  createFixedBall,
  createFixedCuboid,
  createKinematicCuboid,
  createDynamicCapsule,
  createDynamicCuboid,
  createFixedJoint,
  createLockedCapsule,
  createPlantedCapsule,
  createRevoluteJoint,
  createRopeJoint,
  launchImpulse,
  resetDynamicPose,
  createVerticalGateSensor,
  destroyImpulseJoint,
  setKinematicAngle,
  setKinematicTranslation,
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
    const kin = createKinematicCuboid(sim, rapier, 1, 2, 0.6, 0.04, tags, 'pickaxe', true);
    setKinematicTranslation(kin.body, 1.1, 2.2);
    setKinematicAngle(kin.body, 45);
    expect(kin.collider.isSensor()).toBe(true);
    const planted = createPlantedCapsule(sim, rapier, 2, 2, 0.28, 0.16, 22, 0, tags, 'torso');
    expect(planted.body.isFixed()).toBe(false);
    const arrow = createDynamicCapsule(sim, rapier, 2.4, 2, 0.35, 0.03, 0.04, 0, tags, 'arrow');
    launchImpulse(arrow.body, { x: 1, y: 0 }, 10);
    expect(arrow.body.linvel().x).toBe(10);
    resetDynamicPose(arrow.body, 2.4, 2);
    expect(arrow.body.linvel().x).toBe(0);
    const hammer = createDynamicCuboid(sim, rapier, 3.6, 1.6, 0.45, 0.08, 8, tags, 'hammer');
    const weld = createFixedJoint(sim.world, rapier, planted.body, arrow.body);
    destroyImpulseJoint(sim.world, weld);
    const hinge = createRevoluteJoint(
      sim.world,
      rapier,
      planted.body,
      hammer.body,
      { x: 0.4, y: 0 },
      { x: 0, y: 0 },
      { min: -1, max: 1 },
    );
    destroyImpulseJoint(sim.world, hinge);
    sim.free();
  });
});
