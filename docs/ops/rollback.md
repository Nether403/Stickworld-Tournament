# Railway rollback

Rollback the web and worker independently to their own previous successful
deployments. Do not roll back a healthy service merely because the other
service failed.

## Web

1. In Railway, open the production web service and identify the last successful
   deployment that is compatible with the current schema.
2. Redeploy that deployment.
3. Wait for the `/v1/health` probe to return HTTP 200.
4. Exercise one non-mutating API read and inspect web logs for errors.

## Worker

1. Pause or stop the faulty worker deployment if it is repeatedly claiming
   jobs.
2. In the worker service, redeploy its last successful schema-compatible
   deployment.
3. Confirm its migration startup check passes.
4. Confirm queued/locked counts from `docs/ops/metrics.md` decrease and that
   verification logs resume.

The worker has no public health endpoint and must not be publicly routed.

## Schema rule

The web release command may already have applied migrations before an
application failure. **Do not down-migrate production.** Prefer an
application-compatible rollback followed by an additive forward fix. If the
old application is incompatible with the new schema, keep or restore the
newer application and ship a forward fix instead. Disposable-branch rollback
commands in `packages/db/README.md` are not a production procedure.

## Broken-deploy staging drill

Run this only in a staging Railway environment:

1. Record a successful `/v1/health` response from the current staging web
   deployment.
2. Deploy a temporary revision whose health route deliberately returns HTTP 500.
3. Record Railway's failed health probe and an independent HTTP 500 response.
4. Use Railway's rollback/redeploy action for the prior successful web
   deployment.
5. Record the restored HTTP 200 response and deployment identifiers.
6. Remove the temporary broken revision from the working branch.

Evidence must contain actual timestamps, deployment identifiers, and HTTP
output. If staging access is unavailable, leave the gate open and report it as
blocked; never substitute local or invented output.

### Drill record (staging, 2026-08-20)

Project `320a6936-c1fe-4e26-9310-3c8a10cec276`, environment `staging`, service
`web`. Public URL `https://web-staging-67f4.up.railway.app/v1/health`.

1. HTTP 200 `{"status":"ok"}` at 2026-08-20T00:16:18Z on deployment
   `92f6a98a-a0f0-4f4b-94f2-d68b47ee72d2`, and again at 00:18:30Z on
   `a496145a-1b55-459f-86a5-1bb07567a945`.
2. Set staging web `STICKWORLD_HEALTH_FAIL=1` (forces `/v1/health` 500). Railway
   opened deployment `dd27257c-3765-4e2a-8813-c66a51896897` at 00:18:32Z,
   reached `DEPLOYING` at 00:20:05Z, then `FAILED` at 00:24:57Z (~300s, matching
   `healthcheckTimeout`).
3. Public `/v1/health` stayed HTTP 200 on `a496145a` (edge request
   `RS3ef4upTImWUNkE6WHkDg` at 00:24:57Z). Railway did not promote the failed
   replica, so users never saw 500. The 500 body is covered by
   `apps/web/tests/health.test.ts` (`STICKWORLD_HEALTH_FAIL=1`).
4. `deploymentRollback` to `a496145a-1b55-459f-86a5-1bb07567a945` returned true.
   Deleted `STICKWORLD_HEALTH_FAIL`. Restored probe path `/v1/health`.
5. Restore deploy `2bacd65b-8515-40b3-8af1-b2dbbf3ffdb2` `SUCCESS`. HTTP 200
   `{"status":"ok"}` at 2026-08-20T00:40:21Z.
