# Neon PITR restore drill

This demo gate restores into a new Neon branch, rebuilds ranking read models
from `verified_results`, and compares them with a frozen snapshot. Never reset,
rewind, migrate down, or repoint production during this drill.

## 1. Preflight and source evidence

Choose a closed season with a frozen ranking snapshot. Run this read-only
preflight on production:

```sql
SELECT s.slug, count(*) AS frozen_snapshots
FROM ranking_snapshots rs
JOIN seasons s ON s.id = rs.season_id
WHERE rs.frozen = true
GROUP BY s.slug
ORDER BY s.slug;
```

If it returns no season, stop and report the demo gate as blocked. A seeded CI
row or an invented hash is not a substitute for a production frozen snapshot.

Record the chosen season, a UTC recovery timestamp after its snapshot was
frozen, and the source checksums:

```sql
SELECT
  rs.season_id,
  rs.scope,
  rs.subject_id,
  md5((rs.payload - 'asOf')::text) AS ranking_checksum
FROM ranking_snapshots rs
JOIN seasons s ON s.id = rs.season_id
WHERE rs.frozen = true
  AND s.slug = '<closed-season-slug>'
ORDER BY rs.scope, rs.subject_id;
```

`asOf` is deliberately excluded because a rebuild has a new timestamp; all
ranking rows, scores, points, and tiebreak data remain in the checksum.

## 2. Restore to an isolated branch

In the Neon console or API, create a branch named `restore-drill-<timestamp>`
from the recorded point-in-time recovery timestamp. Obtain that branch's
pooled and direct connection strings. Point the drill shell's `DATABASE_URL`
and `DATABASE_URL_UNPOOLED` at the new branch only, and confirm the server and
database identity before continuing.

```bash
pnpm db:migrate
pnpm build
```

Migration should be a no-op when the selected timestamp already contains all
committed migrations. It is safe to apply missing forward migrations to the
throwaway branch.

## 3. Rebuild and compare

The restore-only helper writes new non-frozen snapshots beside the untouched
frozen rows:

```bash
pnpm --filter @stickworld/worker pitr-rebuild <closed-season-slug>
```

Run this on the drill branch:

```sql
WITH frozen AS (
  SELECT DISTINCT ON (rs.season_id, rs.scope, rs.subject_id)
    rs.season_id,
    rs.scope,
    rs.subject_id,
    md5((rs.payload - 'asOf')::text) AS checksum
  FROM ranking_snapshots rs
  JOIN seasons s ON s.id = rs.season_id
  WHERE rs.frozen = true
    AND s.slug = '<closed-season-slug>'
  ORDER BY rs.season_id, rs.scope, rs.subject_id, rs.created_at DESC
),
rebuilt AS (
  SELECT
    rs.season_id,
    rs.scope,
    rs.subject_id,
    md5((rs.payload - 'asOf')::text) AS checksum
  FROM ranking_snapshots rs
  JOIN seasons s ON s.id = rs.season_id
  WHERE rs.frozen = false
    AND s.slug = '<closed-season-slug>'
)
SELECT
  frozen.scope,
  frozen.subject_id,
  frozen.checksum AS frozen_checksum,
  rebuilt.checksum AS rebuilt_checksum,
  frozen.checksum = rebuilt.checksum AS matches
FROM frozen
LEFT JOIN rebuilt USING (season_id, scope, subject_id)
ORDER BY frozen.scope, frozen.subject_id;
```

Every row must have a non-null rebuilt checksum, `matches = true`, and the
frozen checksum must match the source evidence from step 1. Save the command
output. A migration success without matching ranking checksums does not pass
the gate.

## 4. Cleanup

Delete the `restore-drill-*` branch after capturing evidence. Reconfirm that
production connection settings and production data were never changed.
