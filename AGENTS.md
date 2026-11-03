# Working on HeadShotz

Read `COLLABORATION.md` before making changes or using GitHub.

- This checkout belongs to Austin. His local model handles most implementation; Codex helps when requested.
- Extraction Raids is an additional, opt-in HeadShotz game mode. Preserve the main menu and existing modes, including Battle Royale, Squad Royale, arena/team modes, and the original cooperative Extraction. Keep raid-specific progression, equipment loss, accounts, and deployment rules scoped to raids; do not turn the whole game into an extraction shooter or require raid setup to play other modes.
- Work on `cypert/dev` by default. Inspect the branch and working tree before editing. Preserve any existing work from the user or another model.
- Never commit or push directly to `main`. Never merge a pull request, enable auto-merge, force-push, delete remote branches, or change repository settings unless Austin explicitly requests that action.
- Make focused changes, verify the affected behavior, and explain what changed and what was tested.
- Use `git` for local version control and the authenticated `gh` CLI for GitHub. If `gh` is absent from PATH on Austin's Mac, try `/Users/a.cypert/.local/bin/gh`.
- Reading issues and PRs is fine. Commit, push, and open a PR when requested or included in the current task. Do not post comments, request reviews, create issues, or message collaborators without authorization.
- Do not discard, overwrite, stash, or commit someone else's unrelated changes. If two models are active, coordinate file ownership or use separate worktrees; do not switch this shared checkout's branch while another model is editing it.
- Keep credentials in the existing credential store. Never print tokens or add them to files, prompts, commits, or remote URLs.

These are workflow instructions, not enforced GitHub branch protection. Explicit user instructions take precedence.
