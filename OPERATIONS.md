# HeadShotz raid operations

This is the development runbook for the persistent raid service. It does not declare issue #1 complete or authorize a production deployment. No hosting provider, public domain, external monitor/alert receiver, off-host backup destination, retention owner, TURN relay, or deployment budget has been configured. Use macOS for development and a reviewed macOS/Linux runtime for these Unix-socket tools. Use Node.js 24 or later.

## Runtime and private control channel

Keep immutable application code separate from the writable data directory. Set `RAID_DATA_DIR` to an absolute private location and `RAID_BUILD_ID` to the reviewed release identifier (letters, numbers, dot, underscore, hyphen; maximum 80 characters). Keep credentials in the deployment's existing secret store, outside application source and command output. Set `RAID_SECURE_COOKIES=1` for a public HTTPS deployment behind a reviewed reverse proxy; the development default is loopback HTTP.

```sh
RAID_DATA_DIR=/absolute/private/headshotz-data RAID_BUILD_ID=reviewed-build node server/main.mjs
```

The process creates `raid.sqlite` and its WAL/SHM files with owner-only permissions. Its local control socket is `RAID_DATA_DIR/.ops/control.sock`, inside a private directory, with mode 0600. The implementation supports control paths up to 96 bytes; use a shorter data path if startup rejects it. An existing active listener or non-socket file is never replaced. A stale owned socket is removed only after a refused connection and an inode check. Do not expose this socket through a public proxy or change its permissions to share it with players.

```sh
node scripts/ops.mjs status --socket /absolute/private/headshotz-data/.ops/control.sock
node scripts/ops.mjs dashboard --socket /absolute/private/headshotz-data/.ops/control.sock --out /absolute/private/ops-snapshot.html
```

Status includes build/schema/region, readiness/drain state, operator/raid counts, pending settlements, open reports, voice-session count, normalized request totals/latency/payload bytes, simulation execution timing/errors, tick-start intervals, process memory/CPU, and event-loop delay. It excludes usernames, account IDs, cookies, credential hashes, recovery codes, voice signals and query strings. The HTML dashboard is a saved snapshot, not a live monitor; rerun it for a fresh view. It refuses an existing output file and public repository output locations. Its default destination is the ignored private `.raid-backups` directory.

`GET /health/live` returns only an alive status. Health requests are network-only in the service worker and cannot fall back to cached readiness. `GET /health/ready` returns ready/not-ready with HTTP 200/503. Readiness checks the current simulation lease, supported schema, recent simulation activity, draining, and simulation failures. After a failed tick it stays unhealthy until a later transaction commits successfully; an idle timer alone cannot prove that writes recovered. Detailed metrics/control are not HTTP endpoints.

Diagnostics include tick failures, pending settlements observed for over 30 seconds, a simulation execution p95 over 50 ms, and a tick-start interval p95 over 75 ms. Track both execution and scheduling delay; a fast tick can still run too late under HTTP load. PERFORMANCE.md describes the isolated file-backed load runner, impairment model, provisional budgets and recorded results. Histograms/counters are bounded and cumulative since process startup. These thresholds are development diagnostics, not validated production capacity or service-level objectives. Integrate external collection, alert delivery, disk/backup freshness checks, and an operator response before public launch. Current IP throttles use the socket peer address; trusted proxy/client-address configuration and a production abuse review remain necessary.

## Drain and ordinary deployment

Drain prevents new deployments before any equipment debit. Existing operators continue moving, looting and settling; retrying their current deployment is allowed. Account/base operations remain available. Readiness changes to 503 so a deployment's routing layer can stop assigning new sessions.

```sh
node scripts/ops.mjs drain --socket /absolute/private/headshotz-data/.ops/control.sock --operator YOUR_OPERATOR_ID --reason deployment
node scripts/ops.mjs status --socket /absolute/private/headshotz-data/.ops/control.sock
```

1. Run the repository regression suite and applicable isolated browser/gameplay checks on the candidate code. Record the exact code/build identifier, schema compatibility and results. RELEASE.md provides the verified standalone package/startup workflow; production hosting and its deployment pipeline are not installed.
2. Enter drain. Inspect `activeOperators` and `pendingSettlements`; both must reach zero for an ordinary deployment. Investigate pending settlements instead of forcing them to succeed or granting client-side rewards. A maintenance window cannot silently convert active players into extracted players.
3. Create and verify a backup as described below. Keep the candidate's source and an executable previous compatible release separately from the data directory. Record the backup ID and checksum.
4. Stop the old process with SIGTERM, wait for exit, and confirm its control socket is gone. A zero exit indicates shutdown checkpointing completed. A checkpoint failure is logged without payloads and causes a nonzero exit. Do not launch a second simulation against the live database.
5. Switch the process manager to the reviewed code and the same absolute data directory. Run the candidate; migrations reject a newer unsupported schema and refuse an unexpired simulation lease. Schema 9 is the combat/medical compatibility boundary (following schema 8 matching, schema 7 utilities and schema 6 quest items): existing accounts, sessions and checkpoints are preserved, and older server code must not reopen the upgraded data. Check readiness, build/schema, recent errors, and one controlled account/deployment/settlement flow using designated test data.
6. The new process starts accepting deployments when healthy. If a routing layer is used, enable it only after readiness and rollout checks pass. Establish rollback criteria and an on-call owner before public rollout.

To cancel maintenance on a still-running process:

```sh
node scripts/ops.mjs resume --socket /absolute/private/headshotz-data/.ops/control.sock --operator YOUR_OPERATOR_ID --reason deployment
```

Lifecycle changes append operator audit events. If storage cannot record a drain, admission is still fenced, readiness stays false and `lifecycle_audit_failed` is reported/logged. Resume is refused while its audit cannot commit; after fixing storage, reissue drain/status/resume and confirm the alert clears. SIGTERM/SIGINT also enter drain before shutdown. Shutdown waits for HTTP requests, then closes lingering connections after a bounded interval, writes checkpoints, releases the simulation lease and closes the private socket. A forced/emergency restart can retain a vulnerable body only within the existing reconnect/deadline rules; use ordinary draining whenever possible. Never force-push, merge, change GitHub settings, or deploy publicly merely because these tools exist.

## Create and verify a backup

Use the application command, not a plain copy of `raid.sqlite` while its WAL may contain committed data.

```sh
node scripts/backup.mjs create --db /absolute/private/headshotz-data/raid.sqlite --out /absolute/private/backup-unique-directory --build reviewed-build
node scripts/backup.mjs verify --backup /absolute/private/backup-unique-directory
```

Omitting `--out` creates a uniquely named bundle under `.raid-backups/`, excluded from Git. The bundle contains the SQLite snapshot and a private manifest: ID/time/build/schema, byte length, SHA-256, page count, ownership-location counts, active deployment/checkpoint counts and audit head/count. It contains no plaintext session credentials or recovery codes, but the database includes private account/gameplay data and credential hashes; protect the whole bundle accordingly.

The command uses Node's SQLite online-backup API with a pinned read snapshot, so committed WAL data is included and another WAL connection can keep writing without creating a mixed snapshot. It verifies SQLite integrity, foreign keys, basic item/checkpoint consistency, metadata and checksum. Output directories/files are newly created and private; existing destinations and public repository paths are rejected. Incomplete new bundles are removed on failure. The live source is not modified. A long backup can retain WAL pages until the read transaction finishes; profile duration and disk headroom on representative data.

Checksums detect accidental changes; they are not a signature or proof that an untrusted backup is authentic. Use controlled/encrypted storage and trusted transfer, with keys held outside the repository. Set and validate an operator-approved backup cadence, retention, off-host copy, recovery-point target, recovery-time target and regular restore drill before production. No automatic pruning, scheduler or off-host transfer has been installed.

Implementation references: [Node.js SQLite backup](https://nodejs.org/download/release/v24.8.0/docs/api/sqlite.html), [SQLite online backup API](https://sqlite.org/backup.html).

## Restore to an isolated new directory

A restore never overwrites a live/previous data directory. Verify the source bundle first, supply an operator identifier and choose a raid policy explicitly.

```sh
node scripts/backup.mjs restore --backup /absolute/private/backup-unique-directory --out /absolute/private/restored-unique-directory --operator YOUR_OPERATOR_ID --raid-policy abort
```

| Policy | Behavior | Use |
| --- | --- | --- |
| `abort` | Marks active deployments aborted using the existing transactional compensation policy, refunds committed available owned gear/premiums once, clears active checkpoints, grants no scavenging XP/rewards, and never duplicates an item already banked elsewhere in the snapshot. Recovery-kit equipment is not banked. | An old recovery point or a deliberate incident abort, after impact review. |
| `resume` | Retains checkpoint positions, health, item state, action sequences and absolute deadlines; clears the old process lease. It does not shift time, heal players or grant outcomes. An old checkpoint may time out or disconnect on startup. | A fresh recovery point or an isolated checkpoint drill when those risk/time rules are acceptable. |

Both policies invalidate every restored session and recovery code, and clear readiness. A backup must not revive a previously revoked cookie or a recovery code spent after the recovery point. Players sign in with their password and generate new recovery codes. Existing settled results remain idempotent in the restored lineage. The new database gets a `backup_restored` audit record and a private restore receipt, including source checksum, policy and invalidation/compensation counts.

For a real recovery:

1. Fence the old writer and player traffic first. Preserve the failed data directory, WAL/SHM and logs for investigation. Never serve the old and restored copies as separate authoritative worlds for the same accounts.
2. Identify the verified recovery point and data/reward loss after it. Restoring a database rewinds state; it cannot preserve post-backup results that are absent from the bundle. Establish the player communication/reconciliation plan with the operator.
3. Restore to a new private directory. Review the receipt and counts, check the chosen raid policy, and run an isolated validation before routing real players to it.
4. Point the reviewed runtime at the new directory. Check health and operational status, sign-in/session invalidation, canonical item ownership, representative settled results, and compensation/resumption behavior. Keep the failed directory and backup unchanged until the incident is resolved under the retention policy.
5. Instruct players to sign in again and regenerate recovery codes. Do not promise lost post-backup progression or award unverified client claims.

The tool supports schemas 3–12 and migrates restored supported older snapshots to the current schema. It refuses unsupported/newer snapshots. Before supported migration, it clears simulation leases only in the copied target database; it never clears the live source lease. A rollback to older code is allowed only when that code supports the data schema. If a migration already occurred, restoring a reviewed pre-migration recovery point into a new directory is a separate data-loss decision; do not point old code at a newer database or erase schema checks.

## Recovery and deployment evidence

```sh
node --test tests/*.test.*
node --test tests/backup-operations.test.mjs tests/runtime-operations.test.mjs tests/operations-drill.test.mjs
```

The isolated process drill starts a real child service with temporary private data, creates a paid deployment, fires a round, backs up its live WAL, changes the source further, kills that source process, restores to a new directory, rejects the old session/recovery code, and signs in to the same item/sequence/ammunition state from the backup. It also verifies draining, safe active input, no duplicate reward/settlement, clean SIGTERM/socket cleanup, and checkpoint/authentication continuity after a normal restart. Another test writes through a separate WAL connection while backup pages remain and verifies a single consistent snapshot.

Additional tests reject tampering, symlink files, public/existing output locations and unsafe/active control paths; verify private file modes, compensation uniqueness, minimal health responses, and secret-free metrics/dashboard output. The generated dashboard was rendered and visually inspected during development. These are local drills; they do not establish off-host disaster recovery, public load capacity, hosting reliability, human incident response, or production readiness.

## Candidate packaging and startup

Use RELEASE.md for `scripts/release.mjs build/verify` and the candidate-owned `scripts/start-release.mjs --id EXPECTED_ID`. Build each reviewed candidate into a new directory outside the checkout. Keep database/WAL/control files in a separate absolute data directory, short enough for the 96-byte private socket-path limit. Pinned identity and file inventory are verified before startup can open the database. Normal drain/checkpoint signals, schema compatibility and the backup/rollback policies above still apply. The standalone process drill and packaged browser checks do not replace provider/HTTPS/on-call deployment acceptance.

## Host admission budget

`RAID_MAX_OPERATORS` defaults to 27 (allowed integer range 1–1024). Validate the actual host before raising it. The private status snapshot exposes `operatorCapacity` with limit, used, available and overCapacity; `operator_capacity_exceeded` alerts when a restart restores more bodies than the new limit. Living/downed/disconnected bodies and pending settlements retain slots. Existing bodies are preserved and may reconnect/finish; only new admissions are fenced. Fullness alone does not make the health endpoint unready or block existing actions. Whole-squad admission checks happen before inventory/insurance debits. This is separate from the nine-player per-raid limit and from maintenance draining.
