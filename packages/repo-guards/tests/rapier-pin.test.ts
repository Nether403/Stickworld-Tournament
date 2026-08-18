import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  RAPIER_PACKAGE,
  RAPIER_VERSION,
  rapierPinError,
} from '../src/patterns.js';

const repoRoot = join(fileURLToPath(new URL('.', import.meta.url)), '../../..');

function walkPackageJson(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.git' || entry === 'dist') continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walkPackageJson(full, acc);
    else if (entry === 'package.json') acc.push(full);
  }
  return acc;
}

function dependencyEntries(pkg: {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}): Array<[string, string]> {
  return [
    ...Object.entries(pkg.dependencies ?? {}),
    ...Object.entries(pkg.devDependencies ?? {}),
    ...Object.entries(pkg.optionalDependencies ?? {}),
    ...Object.entries(pkg.peerDependencies ?? {}),
  ];
}

describe('Rapier pin guard', () => {
  it('rejects simd and ranged versions', () => {
    expect(rapierPinError('@dimforge/rapier2d-simd', '0.20.0')).toBeTruthy();
    expect(rapierPinError(RAPIER_PACKAGE, '^0.20.0')).toBeTruthy();
    expect(rapierPinError(RAPIER_PACKAGE, RAPIER_VERSION)).toBeUndefined();
  });

  it('scans workspace package.json files', () => {
    const files = walkPackageJson(repoRoot);
    const errors: string[] = [];
    let sawCompat = false;

    for (const file of files) {
      const pkg = JSON.parse(readFileSync(file, 'utf8')) as {
        name?: string;
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
        optionalDependencies?: Record<string, string>;
        peerDependencies?: Record<string, string>;
      };
      for (const [name, version] of dependencyEntries(pkg)) {
        const error = rapierPinError(name, version);
        if (error) errors.push(`${file}: ${error}`);
        if (name === RAPIER_PACKAGE) sawCompat = true;
      }
    }

    expect(errors).toEqual([]);

    const simCoreJson = files.find((file) => file.replaceAll('\\', '/').endsWith('/packages/sim-core/package.json'));
    if (simCoreJson) {
      expect(sawCompat).toBe(true);
      const pkg = JSON.parse(readFileSync(simCoreJson, 'utf8')) as {
        dependencies?: Record<string, string>;
      };
      expect(pkg.dependencies?.[RAPIER_PACKAGE]).toBe(RAPIER_VERSION);
    }
  });
});
