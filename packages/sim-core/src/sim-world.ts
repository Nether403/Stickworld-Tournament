import type RAPIER from '@dimforge/rapier2d-compat';
import { BodyRegistry } from './bodies.js';
import { stateHash } from './hash.js';
import { GRAVITY } from './units.js';
import { TIMESTEP } from './version.js';
import type { RapierModule } from './rapier.js';

export class SimWorld {
  readonly world: RAPIER.World;
  readonly registry = new BodyRegistry();

  constructor(rapier: RapierModule, gravity: { x: number; y: number } = GRAVITY) {
    this.world = new rapier.World(gravity);
    this.world.timestep = TIMESTEP;
  }

  createRigidBody(desc: RAPIER.RigidBodyDesc): RAPIER.RigidBody {
    const body = this.world.createRigidBody(desc);
    this.registry.register(body.handle);
    return body;
  }

  removeRigidBody(body: RAPIER.RigidBody): void {
    this.registry.unregister(body.handle);
    this.world.removeRigidBody(body);
  }

  step(): void {
    this.world.step();
  }

  stateHash(): bigint {
    return stateHash(this.world, this.registry);
  }

  free(): void {
    this.world.free();
  }
}
