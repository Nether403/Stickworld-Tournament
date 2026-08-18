export type BodyHandle = number;

export class BodyRegistry {
  private readonly handles: BodyHandle[] = [];
  private readonly alive: boolean[] = [];

  register(handle: BodyHandle): number {
    const index = this.handles.length;
    this.handles.push(handle);
    this.alive.push(true);
    return index;
  }

  unregister(handle: BodyHandle): void {
    const index = this.handles.indexOf(handle);
    if (index >= 0) {
      this.alive[index] = false;
    }
  }

  ordered(): readonly BodyHandle[] {
    const out: BodyHandle[] = [];
    for (let i = 0; i < this.handles.length; i++) {
      if (this.alive[i]) {
        out.push(this.handles[i]!);
      }
    }
    return out;
  }

  count(): number {
    let n = 0;
    for (const flag of this.alive) {
      if (flag) n += 1;
    }
    return n;
  }
}
