# Invite-season operations

This runbook creates only `internal-0` and `beta-0`. The helper rejects every
other slug, including `season-1`. It never creates users or synthetic scores.
Operators supply real invite addresses in a local file; addresses are written
to `ranked_invites` and are not printed in command output.

Task 6 live status on 2026-08-19: **blocked**. Railway access is unavailable,
the production Neon database still needs the normal forward application of
migration `0002`, and no staff or beta addresses were supplied. No
`internal-0`, `beta-0`, or `season-1` row was written by Task 6.

## Preconditions

- [ ] Use the production Railway/Neon project or a private production-shaped
      Railway environment with no public DNS.
- [ ] Deploy the target commit and confirm the web release applied all
      committed migrations, including `0002_spec5_compliance`.
- [ ] Confirm the worker migration guard starts successfully.
- [ ] Confirm `DATABASE_URL_UNPOOLED` points to the intended direct Neon
      endpoint. Never commit the value or the invite file.
- [ ] Prepare one real staff email per line for `internal-0`, or exactly 24
      real participant emails for `beta-0`. Blank lines and lines beginning
      with `#` are ignored. Do not use synthetic identities.

## Plan and seed

The helper defaults to a no-database dry run. It normalises addresses,
rejects duplicates, displays only the invite count, and shows the nine
championship registry ids plus Pogo's weekly registry id.

```bash
chmod 600 /tmp/internal-0-invites.txt
pnpm --filter @stickworld/db seed:invite-season -- \
  --slug internal-0 \
  --starts-at 2026-09-01T00:00:00Z \
  --invite-file /tmp/internal-0-invites.txt
```

Review the summary and the target environment. Apply only from the protected
operator shell:

```bash
STICKWORLD_SEED_INVITE_SEASON=1 \
pnpm --filter @stickworld/db seed:invite-season -- \
  --slug internal-0 \
  --starts-at 2026-09-01T00:00:00Z \
  --invite-file /tmp/internal-0-invites.txt \
  --apply
```

For `beta-0`, change the slug and file. The helper enforces a 14-day window
and exactly 24 unique invite addresses. `internal-0` uses a seven-day window.
Both use `entry_policy = 'invite'` and rules version 2. Delete the temporary
file after verifying the rows.

Verify the season shape without selecting invite addresses:

```sql
SELECT slug, starts_at, ends_at, status, rules_version, entry_policy
FROM seasons
WHERE slug IN ('internal-0', 'beta-0');

SELECT
  s.slug,
  g.registry_id,
  g.slug AS game,
  array_agg(sg.seed_policy ORDER BY sg.seed_policy) AS boards
FROM seasons s
JOIN season_games sg ON sg.season_id = s.id
JOIN games g ON g.id = sg.game_id
WHERE s.slug IN ('internal-0', 'beta-0')
GROUP BY s.slug, g.registry_id, g.slug
ORDER BY s.slug, g.registry_id;
```

Registry ids 1, 2, 3, 4, 5, 7, 8, 9, and 10 must have `fixed-course`.
Pogo Tower, registry id 6, must have only `weekly-seed`.

## Internal human edge list

Exercise these checks with staff accounts on the protected environment.
Retain dated output or recordings. An unchecked row is not a pass.

- [ ] Extreme score envelope rejection.
- [ ] Ties and zero scores.
- [ ] Disconnect or refresh during a ranked run.
- [ ] Duplicate finish submission.
- [ ] Long and malformed replay rejection.
- [ ] Expired attempt rejection.
- [ ] Background-tab ranked hitch without pause.
- [ ] Mobile viewport and touch controls on the pending real devices.
- [ ] Idempotent retry after the finish connection is killed.
- [ ] Verification backlog drains after pausing and resuming the worker.
- [ ] Start closing with an unexpired attempt and confirm finish returns
      `SEASON_INACTIVE`.

## Close and freeze `internal-0`

Run the existing manual season-close process:

```bash
pnpm --filter @stickworld/worker cron close-season internal-0
```

If an unexpired issued/active attempt exists, the first run leaves the season
in `closing`. Wait until its 15-minute attempt TTL expires, then run the same
command again. Verify closure and frozen rows:

```sql
SELECT slug, status
FROM seasons
WHERE slug = 'internal-0';

SELECT scope, count(*) AS snapshots
FROM ranking_snapshots rs
JOIN seasons s ON s.id = rs.season_id
WHERE s.slug = 'internal-0' AND rs.frozen
GROUP BY scope
ORDER BY scope;
```

- [ ] Human edge list completed with evidence.
- [ ] `internal-0` status is `closed`.
- [ ] Final game, daily, and championship snapshots are frozen.

## Closed beta

Seed `beta-0` only after the internal snapshot is frozen. Run the read-only
queries in `docs/ops/metrics.md` for attempts per player, game popularity,
score distributions, mismatch rate, abandonment, and errors by game. With 24
invitees the championship is expected to remain provisional. Any
competition-affecting fix requires a new `game_version`; never edit
`verified_results`.

- [ ] Exactly 24 real beta invite addresses supplied.
- [ ] `beta-0` live seed verified.
- [ ] Provisional championship indicator verified.
- [ ] Metrics captured and reviewed.

## Public launch stop

Do not create or open `season-1`. Version 2 of the competitive specification
requires `rules_version = 2` when that future season is authorized, but
`docs/legal/brand-and-ip-clearance.md` records counsel review as not started
and public Season 1 as blocked.
