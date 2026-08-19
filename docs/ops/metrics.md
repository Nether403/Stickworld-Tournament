# Operations metrics

Run these read-only queries against the pooled production database. Use UTC
timestamps and retain the output with incident or launch notes.

## Score-mismatch rate, last 15 minutes

The specified rate is mismatch rejects divided by verified submissions. The
query also shows both counts so a zero or small denominator is visible.

```sql
WITH recent AS (
  SELECT verification_status, reason_code
  FROM score_submissions
  WHERE verified_at >= now() - interval '15 minutes'
),
counts AS (
  SELECT
    count(*) FILTER (WHERE reason_code = 'SCORE_MISMATCH') AS mismatches,
    count(*) FILTER (WHERE verification_status = 'verified') AS verified
  FROM recent
)
SELECT
  mismatches,
  verified,
  round(mismatches::numeric / nullif(verified, 0), 6) AS mismatch_per_verified
FROM counts;
```

## Verification duration

Duration is an application-log metric. Filter Railway worker logs for JSON
objects whose `name` is `verify.duration_ms`, then inspect or aggregate their
numeric `durationMs` field by `gameId` and `gameVersion`. The same verification
also emits `verify.ok` or `verify.reject` with `reasonCode`.

## Abandoned attempts

```sql
SELECT
  g.slug AS game_id,
  count(*) AS abandoned
FROM attempts a
JOIN season_games sg ON sg.id = a.season_game_id
JOIN games g ON g.id = sg.game_id
WHERE a.status IN ('issued', 'active')
  AND a.expires_at < now()
GROUP BY g.slug
ORDER BY abandoned DESC, game_id;
```

## Verification backlog

```sql
SELECT
  state,
  count(*) AS jobs,
  min(created_at) AS oldest_created_at
FROM verification_jobs
WHERE state IN ('queued', 'locked')
GROUP BY state
ORDER BY state;
```

## Verification outcomes by game

```sql
SELECT
  g.slug AS game_id,
  ss.verification_status,
  coalesce(ss.reason_code, 'OK') AS reason_code,
  count(*) AS submissions
FROM score_submissions ss
JOIN runs r ON r.id = ss.run_id
JOIN attempts a ON a.id = r.attempt_id
JOIN season_games sg ON sg.id = a.season_game_id
JOIN games g ON g.id = sg.game_id
WHERE ss.created_at >= now() - interval '24 hours'
GROUP BY g.slug, ss.verification_status, coalesce(ss.reason_code, 'OK')
ORDER BY game_id, submissions DESC;
```
