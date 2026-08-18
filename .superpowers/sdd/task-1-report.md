# Task 1 report — Build-time asset pipeline

## Status

DONE

## Commit

- `c28f6ef` — Add build-time asset pipeline and runtime AI guards
- Pushed to `origin/cursor/spec-5-full-depth-42c0`.

## Implementation

- Added original human-authored geometric `logo.svg` and `wordmark.svg` under
  `sources/brand/`, with byte-identical shipped copies under
  `apps/web/public/assets/brand/`. Both use the required `#1a1f2b`, `#f4efe6`,
  and `#e85d4c` tokens.
- Added both brand marks with descriptive alt text to the catalogue and auth
  headers.
- Added `docs/assets/prompts/ui-badges.yaml` and the dependency-free operator
  script `scripts/assets-build.mjs`, exposed as `pnpm assets:build`.
  - With no Gemini or Deepgram key it prints `skipped` and exits zero.
  - Gemini prompts call the provider and write PNG bytes only to
    `assets/generated/`.
  - Deepgram prompts are supported and write OGG bytes only to
    `assets/generated/`.
  - Keyed HTTP failures exit non-zero.
  - Nothing is copied into `public/` automatically.
- Added `docs/assets/ledger.md` and `scripts/check-asset-ledger.mjs`.
  The checker hashes exact bytes, rejects unlisted public assets, missing
  assets, mismatches, duplicates, invalid classes, and missing generated
  prompt provenance while ignoring directories.
- Added `scripts/check-no-runtime-ai.mjs`, which scans the required built web,
  worker, and game output locations for exact banned hostnames without banning
  other Google APIs or auth.
- Added CI ledger checking after the forbidden-name check and runtime AI
  checking after the build.
- Extended the Hookline practice Playwright test to record request hostnames
  and assert zero Gemini, Deepgram, or OpenRouter requests.
- Added `docs/known-issues.md` recording that there is no announcer VO at
  launch; no audio binary was added.

## TDD and verification

- Red state: all six initial script behavior tests failed because the three
  scripts did not exist. A later generated-provenance test failed with status
  zero before its checker rule was implemented.
- `node --test scripts/asset-pipeline.test.mjs`: 7/7 passed. This covers
  ledger success and failures, keyless generation, Gemini success through a
  local HTTP stub, keyed HTTP failure, output placement, and exact-host runtime
  detection.
- `node scripts/check-asset-ledger.mjs`: passed, 2 shipped assets verified.
- `env -u GEMINI_API_KEY -u DEEPGRAM_API_KEY node scripts/assets-build.mjs`:
  printed the expected skipped message and exited zero.
- `pnpm --filter @stickworld/web build && node scripts/check-no-runtime-ai.mjs`:
  build passed; 958 built files scanned with no runtime AI hosts.
- `CI=true pnpm --filter @stickworld/web e2e --grep "practice play shows instructions"`:
  2/2 passed (Chromium and mobile), including the banned-network assertion.
- Catalogue/auth brand Playwright selection: 4/4 passed across Chromium and
  mobile.
- `pnpm lint`: passed.
- `pnpm test`: 197 passed, 20 skipped; all ten deterministic game tests,
  including Hookline and Pickaxe, passed.
- Targeted Hookline/Pickaxe contract run: 9/9 passed.
- Hookline golden remains `9c52d8f426f31ee1`; Pickaxe golden remains
  `6b03896db5837763`; no `hashes.json` file changed.
- Simulation import search found no `public/assets` or `/assets/brand` matches
  under `games/*/src/simulation/**`.
- `cmp` confirmed each shipped brand file is byte-identical to its source.

## Self-review

- No game primitive or simulation source was edited.
- No golden was regenerated.
- No runtime AI, Sentry, OpenTelemetry, or Cloudflare dependency was added.
- Generated output remains gitignored.
- The pre-existing uncommitted ADR edit was preserved and excluded from the
  commit.
- Real provider credentials were not exercised; the Gemini request and failure
  paths were verified against a local HTTP stub as permitted by the task.

## Concerns

None.

---

## Important review fixes — 2026-08-18

### Status

DONE

### Commit

- `056ac9e` — Fix Spec 5 asset verification and mobile branding
- Pushed to `origin/cursor/spec-5-full-depth-42c0`.

### Fixes

- Added `node --test scripts/asset-pipeline.test.mjs` to the `verify` job in
  `.github/workflows/ci.yml`, so CI executes the standalone `node:test` suite
  in addition to Vitest.
- Made the catalogue and auth brand headers wrap and constrained both logos
  and wordmarks to the available width while preserving their aspect ratios.
- Strengthened the existing catalogue/auth Playwright coverage to assert that
  each brand image remains fully within the viewport, including the existing
  iPhone 12 mobile project.
- Included the pending one-line ADR owner-approval correction in the fix
  commit.

### Test results

- `node --test scripts/asset-pipeline.test.mjs`: passed, 7/7.
- `CI=true pnpm --filter @stickworld/web e2e --grep "catalogue lists|auth offers|practice play shows instructions"`:
  passed, 6/6 across desktop Chromium and mobile (catalogue, auth, and
  Hookline practice).
- `pnpm --filter @stickworld/web build`: passed.
- `pnpm --filter @stickworld/web typecheck`: passed.
- `pnpm exec eslint "apps/web/app/page.tsx" "apps/web/app/auth/[path]/page.tsx" "apps/web/e2e/play.spec.ts"`:
  passed.

### Scope checks

- No golden files were regenerated.
- No vendor or dependency was added.
