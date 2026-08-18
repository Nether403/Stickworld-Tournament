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
  createTenBodyRagdoll,
  createRopeJoint,
  createWheelAssembly,
  createCargoCondition,
  damageCargoHazard,
  damageCargoSpeed,
  createKinematicCharacter,
  stepCharacterController,
  setCuboidHalfExtents,
  launchImpulse,
  movingPlatformX,
  resetDynamicPose,
  createVerticalGateSensor,
  destroyImpulseJoint,
  setKinematicAngle,
  setKinematicTranslation,
  stepMovingPlatform,
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
    expect(movingPlatformX(5, 0.5, 120, 0)).toBe(5);
    stepMovingPlatform(kin.body, 1, 2, 0.5, 120, 30);
    const character = createKinematicCharacter(sim, rapier, 0, 3, 0.18, 0.45, tags, 'runner');
    setCuboidHalfExtents(character.collider, 0.18, 0.22);
    const moved = stepCharacterController(character.controller, character.body, character.collider, {
      x: 0.05,
      y: -0.1,
    });
    expect(typeof moved.grounded).toBe('boolean');
    character.controller.free();
    const wheels = createWheelAssembly(sim, rapier, 2, 2, tags);
    expect(wheels.joints).toBe(3);
    const cargo = createCargoCondition(100);
    damageCargoSpeed(cargo, 7, 10);
    expect(cargo.value).toBe(99);
    damageCargoHazard(cargo, 15);
    expect(cargo.value).toBe(84);
    const ragdoll = createTenBodyRagdoll(sim, rapier, tags, 2, 1.4, true);
    expect(sim.registry.count()).toBeGreaterThanOrEqual(10);
    expect(ragdoll.joints).toBe(9);
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
