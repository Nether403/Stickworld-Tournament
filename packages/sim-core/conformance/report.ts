import {
  CHECKPOINTS,
  type HashSeries,
  type StressResult,
} from './fixtures/stress-01.js';

export interface RuntimeRow {
  runtime: string;
  hashes: HashSeries;
}

export type ForkBranch = 'A' | 'B1' | 'B2' | 'B3' | 'B4';

export interface MatrixVerdict {
  branch: ForkBranch;
  agreement: string;
  earliestDivergence: number | null;
  table: string;
}

export function compareSeries(a: HashSeries, b: HashSeries): number | null {
  for (const tick of CHECKPOINTS) {
    if (a[tick] !== b[tick]) return tick;
  }
  return null;
}

export function judge(rows: RuntimeRow[]): MatrixVerdict {
  const node = rows.find((r) => r.runtime.startsWith('node'));
  const browsers = rows.filter((r) => !r.runtime.startsWith('node'));

  let earliest: number | null = null;
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const tick = compareSeries(rows[i]!.hashes, rows[j]!.hashes);
      if (tick !== null && (earliest === null || tick < earliest)) earliest = tick;
    }
  }

  const allAgree = earliest === null;
  const browsersAgree =
    browsers.length > 1 &&
    browsers.every((b) => compareSeries(b.hashes, browsers[0]!.hashes) === null);
  const nodeMatchesBrowsers =
    node && browsers[0] ? compareSeries(node.hashes, browsers[0].hashes) === null : true;

  let branch: ForkBranch = 'A';
  let agreement = 'all runtimes identical at all checkpoints';
  if (!allAgree) {
    if (browsersAgree && node && !nodeMatchesBrowsers) {
      branch = 'B1';
      agreement = `{${browsers.map((b) => b.runtime).join(', ')}} agree; node diverges from t=${earliest}`;
    } else if (!browsersAgree) {
      branch = 'B2';
      agreement = `browsers diverge from each other (earliest t=${earliest})`;
    } else {
      branch = 'B3';
      agreement = `conditional divergence at t=${earliest}`;
    }
  }

  const header =
    'runtime'.padEnd(22) + CHECKPOINTS.map((t) => `t=${t}`.padEnd(18)).join('');
  const lines = [header];
  for (const row of rows) {
    const cells = CHECKPOINTS.map((t) => (row.hashes[t] ?? '').padEnd(18)).join('');
    lines.push(row.runtime.padEnd(22) + cells);
  }

  return {
    branch,
    agreement,
    earliestDivergence: earliest,
    table: lines.join('\n'),
  };
}

export function formatReport(
  rapierHash: string,
  rows: RuntimeRow[],
  extra?: string,
): string {
  const verdict = judge(rows);
  return [
    'Stickworld determinism conformance — fixture stress-01',
    `Rapier @dimforge/rapier2d-compat 0.20.0  sha256:${rapierHash}`,
    '',
    verdict.table,
    '',
    `AGREEMENT: ${verdict.agreement}`,
    `VERDICT:   ${verdict.branch === 'A' ? 'PASS → Branch A' : `FAIL → Branch ${verdict.branch}`}`,
    extra ?? '',
  ]
    .filter((line) => line !== undefined)
    .join('\n');
}

export function assertAgainstGolden(actual: StressResult, golden: StressResult): void {
  if (actual.rapierBuildHash !== golden.rapierBuildHash) {
    throw new Error(
      `Rapier WASM hash ${actual.rapierBuildHash} != golden ${golden.rapierBuildHash}`,
    );
  }
  for (const tick of CHECKPOINTS) {
    if (actual.hashes[tick] !== golden.hashes[tick]) {
      throw new Error(
        `Hash mismatch at t=${tick}: ${actual.hashes[tick]} != ${golden.hashes[tick]}`,
      );
    }
  }
}
