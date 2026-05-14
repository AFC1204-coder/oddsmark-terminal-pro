# Daily Main Test Agent

Ready-to-create scheduled agent spec. Paste into Anthropic Console → Agents →
Create Scheduled Agent, or re-run via the `schedule` skill.

## Metadata

- **Name**: `sportbet-daily-main-test`
- **Cron**: `0 6 * * *` (every day 06:00 UTC)
- **Repo scope**: `afc1204-coder/sport-bet-pro`
- **Permissions**: read repo, write issues and comments. NO commit, NO PR
  create, NO merge, NO file edits.
- **Token budget**: 50,000 total per run (health check, not investigation)
- **Model**: haiku preferred (cheap daily run)

## Prompt

```
You are running the daily health check on afc1204-coder/sport-bet-pro. Your
job is to verify that `main` is in a shippable state. Never commit code,
never open PRs.

Steps:
1. Fetch `main`. Run in order:
   a. npm ci
   b. npx tsc --noEmit --skipLibCheck
   c. npx vitest run

2. If every step succeeds, do nothing and exit. No issue, no comment, no
   noise. Silence = success.

3. If ANY step fails:
   a. Capture the last 100 lines of stderr + stdout from the failing command.
   b. Get the current main HEAD SHA via mcp__github__get_commit.
   c. Check if there is already an open GitHub issue tagged `regression`
      for the same failing command (search by title prefix
      "main regression: <command>"). Use mcp__github__list_issues with
      labels=regression and state=open.
   d. If yes → add a comment via mcp__github__add_issue_comment with today's
      date, the new HEAD SHA, and the new captured output. Do NOT open a
      duplicate issue.
   e. If no → open a new issue via mcp__github__issue_write with:
      - title: "main regression: <command name> failing"
      - labels: ["regression"]
      - body: the captured output inside a code fence, the HEAD SHA, and a
        one-line summary of which step failed.

4. Never edit files. Never commit. Exit cleanly even on failure.

Hard limit: 50k tokens total. Abort and report if you approach the budget.

Repo: afc1204-coder/sport-bet-pro. Owner: afc1204-coder.
```

## Why these choices

- **Daily not hourly**: main regressions are rare. Hourly creates noise;
  daily catches overnight breaks before the work day starts.
- **06:00 UTC**: runs before European working hours so the first dev to
  open the repo sees the issue already filed.
- **Silence on success**: the agent only writes when something is broken.
  No "all green" comments cluttering the repo. Zero-noise default.
- **Dedupe by title prefix**: if main has been broken for 3 days, you get
  ONE issue with 3 comments, not 3 issues. The agent must check first.
- **50k token ceiling**: this is a health check, not a fix-it loop.
  Anything beyond "run commands + report output" is out of scope.
- **No write access to code**: same gate as weekly-audit. Human investigates
  and fixes. The agent just raises the alarm.

## Operational notes

- First run: the agent will try to `npm ci`. If the repo has large native
  deps (node-gyp modules), the run may be slow. Test once manually after
  creating the agent to calibrate runtime.
- The Postgres trigger tests (`bet_verifications_guard`) require a live DB
  and are excluded from vitest by design — the agent is not expected to run
  them.
- If you change CI (e.g. add eslint, add a build step), update the prompt
  to include the new commands in the "Steps" block.
