import { Linter } from 'eslint';
import { describe, expect, it } from 'vitest';
import plugin from '../plugin.js';

function lint(code: string): Linter.LintMessage[] {
  const linter = new Linter({ configType: 'flat' });
  return linter.verify(code, {
    plugins: { stickworld: plugin },
    languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
    rules: {
      'stickworld/no-nondeterminism': 'error',
      'stickworld/no-host-imports': 'error',
    },
  });
}

describe('stickworld/no-nondeterminism', () => {
  it('fails a file that uses Math.sin', () => {
    const messages = lint('export const x = Math.sin(1);\n');
    expect(messages.length).toBeGreaterThan(0);
    expect(messages.some((m) => m.ruleId === 'stickworld/no-nondeterminism')).toBe(true);
  });

  it('fails the ** operator', () => {
    const messages = lint('export const x = 2 ** 3;\n');
    expect(messages.some((m) => m.ruleId === 'stickworld/no-nondeterminism')).toBe(true);
  });

  it('fails Date.now, new Date, and performance.now', () => {
    expect(lint('export const t = Date.now();\n').length).toBeGreaterThan(0);
    expect(lint('export const d = new Date();\n').length).toBeGreaterThan(0);
    expect(lint('export const t = performance.now();\n').length).toBeGreaterThan(0);
  });

  it('allows Math.imul and Math.sqrt (IEEE-exact / specified)', () => {
    const messages = lint('export const x = Math.imul(2, 3) + Math.sqrt(4);\n');
    expect(messages.filter((m) => m.ruleId === 'stickworld/no-nondeterminism')).toEqual([]);
  });
});

describe('stickworld/no-host-imports', () => {
  it('fails node: and Phaser imports', () => {
    expect(lint("import fs from 'node:fs';\n").length).toBeGreaterThan(0);
    expect(lint("import Phaser from 'phaser';\n").length).toBeGreaterThan(0);
    expect(lint("import { useState } from 'react';\n").length).toBeGreaterThan(0);
  });

  it('allows a pure relative import', () => {
    const messages = lint("import { sin } from './detmath.js';\nexport const x = sin(1);\n");
    expect(messages.filter((m) => m.ruleId === 'stickworld/no-host-imports')).toEqual([]);
  });
});
