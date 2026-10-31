# HeadShotz collaboration guide

Reference this file when asking your local model to work on the project. Also read `AGENTS.md`.

## Checkout and verified access

Verified on October 29, 2026:

| Item | Value |
| --- | --- |
| Repository | https://github.com/jdubb357/headshotz |
| Local folder | `/Users/a.cypert/Documents/Applications/headshotz` |
| Repository owner | `jdubb357` |
| Authenticated GitHub account | `austinkc91` |
| Repository permission | `WRITE` |
| Default branch | `main` |
| Austin's working branch | `cypert/dev` |
| GitHub CLI | `/Users/a.cypert/.local/bin/gh` |

GitHub CLI authentication and Git remote read access were verified. The existing Git credential helper is `osxkeychain`. No credentials need to be copied into the project. The branch was created locally from `origin/main`; check its current remote status before assuming it has been published. No push or PR creation was performed as part of this setup.

The local Git setting `push.default=current` is configured. This does not protect `main`; always check the branch and use an explicit push target.

## What the GitHub terms mean

- **Repository (repo):** the project files and their version history.
- **Clone:** download a local copy of the repo and its history.
- **Branch:** a separate line of development. Changes committed on `cypert/dev` do not change `main`.
- **Commit:** a saved snapshot of selected local changes.
- **Push:** upload local commits to a branch on GitHub.
- **Fetch:** update your local knowledge of GitHub branches without modifying working files.
- **Pull:** fetch and integrate remote commits into the current branch. Inspect the current branch and changes first.
- **Issue:** a GitHub item for a bug, feature request, or discussion of work.
- **Pull request (PR):** a proposal to merge one branch into another, with a diff, discussion, and review. Opening one does not change `main`.
- **Merge:** integrate the proposed changes into the destination branch. Leave this to the owner unless Austin explicitly requests otherwise.

## Start every session

Run commands in this folder:

```sh
cd /Users/a.cypert/Documents/Applications/headshotz
git status --short --branch
git branch --show-current
git remote -v
gh auth status
gh repo view jdubb357/headshotz --json viewerPermission,defaultBranchRef
git fetch origin
```

Confirm the remote is `jdubb357/headshotz` and the branch is `cypert/dev`. If the branch is wrong, inspect and preserve local changes before switching. Do not switch branches while another model is working in this checkout.

If `gh` is not found, use its absolute path above, or add it to PATH for the current shell:

```sh
export PATH="/Users/a.cypert/.local/bin:$PATH"
gh --version
```

The local model must have a shell/terminal execution tool, access to this folder, network access to GitHub, and permission to use the Mac's existing credential store. A Markdown file cannot grant those runtime permissions. If the model runs in a container or sandbox, the Mac's CLI and keychain may not be available there. Report the exact error and configure that runtime separately; do not copy credentials into this repository. If login expires, have Austin run `gh auth login` interactively. Never use `gh auth token` or display credential files.

## Find requested work

```sh
gh issue list --repo jdubb357/headshotz --state open --limit 100
gh issue list --repo jdubb357/headshotz --state all --limit 100
gh pr list --repo jdubb357/headshotz --state open --limit 100
```

For an actual item, replace `123` with its number:

```sh
gh issue view 123 --repo jdubb357/headshotz --comments
gh pr view 123 --repo jdubb357/headshotz --comments
gh pr diff 123 --repo jdubb357/headshotz
```

At the initial check on October 29, 2026, there were no open or closed issues, no open PRs, and no roadmap or feature wishlist in the repo. Discussions were disabled. This is a historical snapshot; query GitHub again for current work. Do not infer requested features from that empty backlog.

## Implement and verify

Stay on `cypert/dev` for the shared work unless Austin asks for a separate feature branch. Make a focused change, inspect the diff, and verify the behavior that changed.

This checkout is a static browser game using Three.js and PeerJS, with `index.html`, `style.css`, and JavaScript files at the root. There was no package manifest or test runner in the initial checkout. Inspect the current project before choosing build/test commands; do not invent an `npm test` workflow.

If Python 3 is installed, a local preview can be served with:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open http://127.0.0.1:8000 in a browser. Verify the affected gameplay or UI, inspect console errors, and test multiplayer with multiple clients when changing networked behavior. Check `sw.js` and browser service-worker/cache state if stale assets appear. Stop the preview server when finished.

Before a commit:

```sh
git status --short --branch
git diff --check
git diff
```

Stage only the intended files by name. Review the staged diff, then commit with a concrete description. Do not blindly use `git add .` in a shared checkout. Do not include secrets, generated clutter, or unrelated work.

## Publish work and open a pull request

Use this sequence when Austin asks to push or submit the work. Do not execute the placeholder values literally.

1. Verify `git branch --show-current` prints `cypert/dev` and that only intended changes are staged.
2. Commit the reviewed files with `git commit -m "Describe the completed change"`.
3. Upload the branch:

```sh
git push -u origin cypert/dev
```

4. Check for an existing PR so you do not create a duplicate:

```sh
gh pr list --repo jdubb357/headshotz --head cypert/dev --state open
```

5. If there is no open PR, write a short PR description to a temporary file such as `/tmp/headshotz-pr.md` using a file-writing tool. Describe the problem, resulting behavior, validation, and any remaining limitations. Then create a draft:

```sh
gh pr create --repo jdubb357/headshotz --base main --head cypert/dev --draft --title "Describe the change" --body-file /tmp/headshotz-pr.md
```

Use `Closes #123` only when the work actually resolves that issue. A draft signals the work is still being prepared. If an open PR already exists for this branch, additional pushes update it automatically. Return the PR URL to Austin. Codex should also attach created PRs to the chat using its available PR attachment tool.

To inspect checks and the finished proposal:

```sh
gh pr view --repo jdubb357/headshotz
gh pr checks --repo jdubb357/headshotz
```

There may be no automated checks configured. Say what was actually tested. Leave merging to the repo owner unless Austin explicitly requests it. Opening a PR is not permission to merge it or publish/deploy the game.

## Bring in newer changes safely

With a clean working tree and no other model editing this checkout:

```sh
git fetch origin
git log --oneline --left-right HEAD...origin/main
git merge origin/main
```

This brings your buddy's `main` changes into the current working branch. If conflicts occur, inspect both versions and preserve both contributors' intent. Do not resolve by blindly choosing one whole side. If Git reports a problem, stop and understand it before proceeding; do not force-push or reset away work.

Once a remote `cypert/dev` exists, use `git fetch origin` and inspect `HEAD...origin/cypert/dev` before integrating another contributor's commits. `git merge --ff-only origin/cypert/dev` safely handles the case where your local branch is only behind. If the branches diverge, inspect and reconcile the commits rather than overwriting either history.

After a PR is merged, check GitHub and coordinate with Austin before choosing whether to continue on `cypert/dev` or start a fresh branch from `origin/main`, especially after a squash merge.

## Suggested prompt for the local model

> Work in `/Users/a.cypert/Documents/Applications/headshotz`. Read `AGENTS.md` and `COLLABORATION.md` first. Verify the current branch is `cypert/dev` and inspect existing changes. Use your shell tool and the authenticated `gh` CLI to inspect GitHub issues and PRs. Implement the task I give you, preserve other work, and verify the affected behavior. Keep changes off `main`. When I ask you to submit the work, commit the intended files, push `cypert/dev`, and open or update a draft PR targeting `main`. Report what changed, what you tested, and the PR URL. Leave merging to the owner unless I explicitly ask for it.
