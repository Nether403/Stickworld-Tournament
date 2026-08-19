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
