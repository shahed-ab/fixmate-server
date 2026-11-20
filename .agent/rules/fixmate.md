COMMIT GATE:
- Never run git. I commit myself. You only give me commit commands.
- After finishing a step, STOP. Do not start the next step until I say "committed, start <step>".
- End your final message with a commit list: for each commit give the message and the exact files. 3 to 6 small, logical commits per step.
- Never mix files from two steps in one commit.

STEP TRIGGER:
- When I say "start <ID>" (for example "start S2"), read ONLY the section "## <ID>" in docs/STEPS.md, plus the PLAN.md sections it names. Do not read other sections of STEPS.md.
- Execute only that step, then finish with the commit list and STOP.

## Repository layout (TWO SEPARATE GIT REPOS)

This project consists of TWO separate git repos:
- ROOT repo: `D:\assignment 9\fixmate` (remote: fixmate-server). Contains `server/`, `docs/`, `design/`, `.agent/`. `client/` is in its `.gitignore`.
- CLIENT repo: `D:\assignment 9\fixmate\client` (remote: fixmate-client).

### Commit Output Format Rules:
1. Label each commit block clearly as "CLIENT REPO" or "ROOT REPO".
2. Every block starts with a `cd` line to the correct folder, followed by `git remote -v`, so the user can verify the remote before committing.
3. CLIENT REPO commits use paths relative to `client/` (never prefix with `client/`).
4. `docs/` files (like `docs/PROGRESS.md`) always go in a separate ROOT REPO commit, never mixed with client files.
5. Every block ends with `git push`.
6. Give each block as ready-to-paste PowerShell.

ENV AND SECRETS:
- You may create and edit server/.env and client/.env.local yourself, and keep .env.example files in sync (same keys, empty values).
- When a step needs a value I have not provided (MongoDB URI, BETTER_AUTH_SECRET, Stripe keys, ImgBB key, webhook secret, production URLs), ask me ONCE at the start of the step, listing every missing value in one short message. Wait for my reply, then write them into the right file. For BETTER_AUTH_SECRET, generate a random 32+ character value yourself instead of asking.
- Server and client must use the same MONGODB_URI and DB_NAME. Check this when you write them.
- Never print secret values back in chat, in logs, or in any file except the .env files. Never put secrets in code, docs, README or commit messages.
- Before every commit confirm .env and .env.local are listed in .gitignore and are not staged. If one is staged, unstage it and STOP.
- Use Stripe TEST keys only (sk_test_..., pk_test_..., whsec_...).
