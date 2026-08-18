# Spec 3 client bundle budget

Measured after `pnpm --filter @stickworld/web build` (Next.js 16.3.1 / Turbopack).

Task 1 golden freeze: commit `60f12a3` (`games/hookline-sprint/conformance/golden/hashes.json`). Task 2 extraction did not regenerate those files.

## `/play/hookline-sprint`

| Quantity | Bytes |
|---|---|
| Client JS+CSS gzip **excluding** Rapier inlined WASM | **571102** |
| Rapier WASM gzip (excluded from the budget) | 765090 |
| CI ceiling (120% of baseline) | 685323 |

Method: walk the `/play/hookline-sprint` client graph from `apps/web/.next/server/app/play/hookline-sprint/page*` manifests (falls back to the old `[slug]` page if present), follow `static/chunks/*.js` edges, skip Pickaxe-only chunks (`pickaxeAscentGame` / `mountPickaxeClient` without Hookline), gzip each file at zlib level 9 after stripping base64/`\0asm` WASM payloads.

CI: `node scripts/check-play-bundle.mjs` after `pnpm build`. Re-baseline with `WRITE_BUDGET=1` only when the play graph changes on purpose.

Machine-readable copy: `docs/budgets/spec3-bundles.json`.
