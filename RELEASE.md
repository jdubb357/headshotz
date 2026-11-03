# Build and run a reviewed release candidate

This workflow creates a standalone copy for testing or an operator-reviewed deployment. It does not publish, install a service, change the working branch, migrate the development database or establish production acceptance. Full issue #1 remains open; RELEASE_ACCEPTANCE.md records the wider requirements.

## Build and inspect

Use Node.js 24 or later, with no third-party runtime package installation. From the checkout:

```sh
node scripts/release.mjs build --out /tmp/headshotz-candidate --label extraction-candidate
```

The output directory must not exist and must be outside the checkout. The command prints a JSON result with the absolute path, file count, byte count and 64-character release ID. It includes the current saved files, including uncommitted changes; the ID describes their contents, not a Git commit or a completed feature. An existing destination is never replaced.

The deliberate runtime inventory includes the existing game, persistent raid client, public assets/libraries, server/shared modules, backup/moderation/operations tools and this runbook. Historical screenshots, tests, load fixtures, Git metadata, collaborator instructions, local accounts/databases, backup folders, environment files and credential stores are excluded. New relative imports or HTML/CSS resource references must resolve inside the package; dynamic asset collections come from the listed public asset trees. No arbitrary root-file glob copies personal files. Runtime symlinks/hardlinks are refused. Source files changing during the build fail the build and remove its new partial output.

Verify before handing off or starting it. Replace `EXPECTED_RELEASE_ID` with the ID printed by the reviewed build:

```sh
node scripts/release.mjs verify --root /tmp/headshotz-candidate --id EXPECTED_RELEASE_ID
```

Verification checks the manifest identity, every file's size/SHA-256, required references, extra files/directories and links. Keep the expected ID through a trusted channel. Hashes detect corruption/substitution against that pinned ID; they are not a publisher signature or a source-code security review. An ID copied from an untrusted package cannot authenticate that package.

## Start an isolated local candidate

Create a separate absolute data directory whose parent exists. Never put saves inside the release folder. For example, create a fresh disposable local test directory, then use its exact path:

```sh
mkdir -m 700 /tmp/headshotz-candidate-data
RAID_DATA_DIR=/tmp/headshotz-candidate-data PORT=8022 node /tmp/headshotz-candidate/scripts/start-release.mjs --id EXPECTED_RELEASE_ID
```

Open http://127.0.0.1:8022/raid-online.html. This creates a new local account database, separate from the checkout's saves. The default host remains loopback. Ctrl-C/SIGTERM forwards to the server's normal drain/checkpoint/shutdown path. Repeated terminal/process-group interrupts or termination signals during cleanup are handled without aborting the checkpoint. Do not run two simulations against one data directory. The starter does not run a shell and does not forward GitHub credentials, credential-store paths, Node loader flags or unrelated environment variables to its child.

The starter verifies the pinned release before opening the database, requires a separate absolute data path short enough for the private control socket, validates port/region/voice configuration and sets the operational build ID to the verified release ID. A non-loopback listener requires secure cookies and an HTTPS reverse proxy. The Node simulation still does not terminate TLS. Normal schema/lease compatibility checks apply, including refusal of a newer database or active simulation lease.

## Production installation layout

Use separate locations owned by the chosen service account:

| Location | Purpose |
| --- | --- |
| `/srv/headshotz/releases/RELEASE_ID` | Verified code/assets; treat as immutable |
| `/srv/headshotz/data` | SQLite/WAL/checkpoints and private operations socket |
| `/srv/headshotz/backups` | Private backup bundles, copied to reviewed off-host storage |
| Environment supplied by the process manager | Host/port/region/secure cookies and voice relay configuration |

The builder uses owner-only directory/file permissions. If installing under another service account, arrange ownership and read access explicitly. Do not make save directories or backup bundles public to solve permissions problems. Keep credentials and `.env` files outside the release; extra files cause verification failure.

Configure the process manager to run the exact Node binary, candidate's `scripts/start-release.mjs` and pinned ID as the service account, with a separate absolute `RAID_DATA_DIR`. Do not use the developer's shell profile. `RAID_BUILD_ID` is derived by the starter; do not override it. Configure `HOST`, `PORT`, `RAID_REGION`, `RAID_SECURE_COOKIES` and `RAID_ICE_SERVERS` using the documented server settings. Production HTTPS must preserve the public Host header. Provider choice, costs, TLS, TURN, external monitoring and service ownership remain deployment-specific work; no public host has been installed by this workflow.

## Update and rollback

1. Build and verify a new candidate in a new directory. Run automated checks and a separate-data gameplay acceptance drill before considering it for release.
2. Follow OPERATIONS.md to drain admission, finish active raids, create/verify the recovery backup and stop the old process.
3. Change the process manager's code path and pinned ID together, retaining the separate data path. Start the reviewed candidate. The service performs supported migration only after lease checks.
4. Check readiness and private operations status for the exact build ID/schema, then use designated test accounts for an authenticated prepare/deploy/reconnect/settlement flow. Resume admission only after the required acceptance checks.
5. For rollback, verify the old candidate against its own trusted ID and confirm that its supported schema can open the current data. Do not lower schema markers. If code cannot read the migrated data, use the separately approved restore-into-new-directory procedure; that data-loss decision is not automated here.

Building or verifying is not permission to deploy publicly, merge, reset saves or change repository settings. Keep the full acceptance ledger and measured limits with the release review.

The verified starter forwards a validated `RAID_MAX_OPERATORS` setting (default 27, integer 1–1024). Invalid values fail before launching/opening saves. The service enforces the whole-host budget across maps and preserves existing bodies when a configured limit is lowered. Choose the limit from actual hosted measurements; see PERFORMANCE.md for the reference cost envelope and OPERATIONS.md for private capacity status.
