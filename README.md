# HeadShotz
Free browser multiplayer FPS (Three.js + PeerJS). No ads, no purchases. Open the link, create a room, share the invite link.

Extraction Raids is an optional additional game mode. The main menu and existing Battle Royale, Squad Royale, arena/team modes, and cooperative Extraction remain available. Raid accounts, stash progression, and equipment-loss rules belong to that mode.

For Austin's local development and GitHub workflow, read [COLLABORATION.md](COLLABORATION.md). Coding agents should also read [AGENTS.md](AGENTS.md).

The persistent raid service and its separate development client are documented in [SERVER.md](SERVER.md). Run regression checks with `node --test tests/*.test.*`.

Build, verify and start a standalone candidate with separate save data using [RELEASE.md](RELEASE.md). Packaging does not deploy the game or complete the full release acceptance criteria.

## Run and test

Persistent raids require **Node.js 24 or later**:

```sh
node server/main.mjs
```

Open [the HeadShotz main menu](http://127.0.0.1:8020/) and choose the mode you want to play. Selecting Extraction Raids opens [the raid client](http://127.0.0.1:8020/raid-online.html); other modes do not require a raid account. The service saves raid accounts and gear in the ignored `.raid-data/` folder. GitHub Pages alone cannot run this persistent backend.

```sh
node --test tests/*.test.*
```

The current handoff passes 1,083 automated tests. Chrome, Firefox and WebKit engine checks cover a paid raid from preparation through extraction and banking. Detailed evidence and remaining real-network, physical-device and production checks are recorded in [RELEASE_ACCEPTANCE.md](RELEASE_ACCEPTANCE.md) and [PERFORMANCE.md](PERFORMANCE.md).
