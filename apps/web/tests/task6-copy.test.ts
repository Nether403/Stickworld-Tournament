import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const workspace = resolve(here, '../../..');

function readWorkspaceFile(path: string): string {
  return readFileSync(resolve(workspace, path), 'utf8');
}

function normaliseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

describe('Task 6 published championship copy', () => {
  it('publishes competitive specification version 2 with the nine-game amendment', () => {
    const spec = readWorkspaceFile('docs/competitive-spec.md');
    const normalised = normaliseWhitespace(spec);

    expect(spec).toMatch(/^# Stickworld Competitive Specification — Version 2$/m);
    expect(normalised).toContain(
      "Each championship game contributes 0–1,000 points. Championship games are the season's `fixed-course` titles. Weekly-seed and daily-seed boards do not contribute. At launch that is nine games (Pogo Tower is weekly-only). Non-participation is 0. Maximum championship total is 9,000.",
    );
    expect(normalised).toContain(
      'Highest median of the championship-game point totals (nine values; missing = 0).',
    );
    expect(normalised).toContain(
      'Future `season-1` uses `seasons.rules_version = 2` after the public-launch gates clear.',
    );
  });

  it('publishes a player-facing rulebook and catalogue copy', () => {
    const rulebook = normaliseWhitespace(readWorkspaceFile('docs/rulebook.md'));
    const page = normaliseWhitespace(readWorkspaceFile('apps/web/app/page.tsx'));

    expect(rulebook).toContain(
      'Nine fixed-course games count toward the championship. Pogo Tower is weekly-only and does not count toward the championship. Each championship game is worth up to 1,000 points, for a maximum total of 9,000.',
    );
    expect(page).toContain(
      'Nine fixed-course games count toward the championship. Pogo Tower is weekly-only. Maximum championship total: 9,000 points.',
    );
  });
});

describe('Task 6 launch controls', () => {
  it('records the open PR #4 presentation issues and pending device QA', () => {
    const knownIssues = readWorkspaceFile('docs/known-issues.md');

    expect(knownIssues).toContain('Presentation art can differ from the authoritative colliders');
    expect(knownIssues).toContain('Some presentation paths still use cubic P2 curves');
    expect(knownIssues).toContain('Real-device QA captures are pending');
  });

  it('records the binding legal stop without marking live season gates complete', () => {
    const clearance = normaliseWhitespace(
      readWorkspaceFile('docs/legal/brand-and-ip-clearance.md'),
    );
    const tasks = readWorkspaceFile('.kiro/specs/05-assets-integrity-operations-launch/tasks.md');

    expect(clearance).toContain(
      'Public Season 1 launch | — | blocked — counsel review not started; do not open `season-1`',
    );
    expect(tasks).toMatch(/- \[x\] 6\.1 /);
    expect(tasks).toMatch(/- \[ \] 6\.2 /);
    expect(tasks).toMatch(/- \[ \] 6\.3 /);
    expect(tasks).toMatch(/- \[x\] 6\.4 /);
    expect(tasks).toMatch(/- \[x\] 6\.5 /);
    expect(tasks).toMatch(/- \[ \] 6\.6 /);
  });

  it('documents every closed-beta metric and leaves live operations pending', () => {
    const metrics = readWorkspaceFile('docs/ops/metrics.md');
    const seasons = readWorkspaceFile('docs/ops/seasons.md');

    expect(metrics).toContain('## Attempts per player');
    expect(metrics).toContain('## Game popularity');
    expect(metrics).toContain('## Score distributions');
    expect(metrics).toContain('## Score-mismatch rate');
    expect(metrics).toContain('## Abandoned attempts');
    expect(metrics).toContain('## Verification outcomes by game');
    expect(seasons).toContain('Task 6 live status on 2026-08-19: **blocked**');
    expect(seasons).toContain('- [ ] `internal-0` status is `closed`.');
    expect(seasons).toContain('- [ ] `beta-0` live seed verified.');
  });
});
