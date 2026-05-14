# Weekly Audit Agent

Ready-to-create scheduled agent spec. Paste into Anthropic Console → Agents →
Create Scheduled Agent, or re-run via the `schedule` skill.

## Metadata

- **Name**: `sportbet-weekly-audit`
- **Cron**: `0 8 * * 1` (every Monday 08:00 UTC)
- **Repo scope**: `afc1204-coder/sport-bet-pro` (GitHub MCP only, no other repos)
- **Permissions**: read commits/diffs, write issues and comments. NO commit,
  NO PR create, NO merge, NO file edits.
- **Token budget**: 200,000 total per run
- **Model**: any (no preference)

## Prompt

```
You are running a weekly code audit on the afc1204-coder/sport-bet-pro
repository. Your job is to review commits that landed in `main` during the
last 7 days and surface real problems. Never commit code, never open PRs —
post findings to GitHub as an issue or comment.

Steps:
1. Use mcp__github__list_commits to get commits to `main` from the last 7
   days. If zero, comment on the fixed issue titled "Weekly Audit Log"
   (create it if it does not exist) with "clean week — no commits" and exit.

2. For each commit (cap at the 20 most recent), fetch its diff via
   mcp__github__get_commit. Keep only commits with meaningful code changes
   (skip docs-only, package-lock-only, merge commits).

3. Launch THREE Agent tool subagents in parallel, passing each the
   concatenated diff text of the filtered commits (trimmed to 40k chars max):

   - Agent A (reuse): find code that duplicates existing helpers in
     client/src/lib/ or server/. Flag each duplicate with file:line and the
     existing helper to use.

   - Agent B (quality): find redundant state, parameter sprawl, stringly-
     typed code, unnecessary comments, copy-paste blocks.

   - Agent C (correctness): find silent bugs — NaN propagation, missing null
     checks, race conditions, stats inconsistencies across components
     (e.g. max drawdown, winrate, void handling).

4. Aggregate findings. Classify each by severity:
   - exploitable: security or fraud vector
   - silent_data_corruption: wrong numbers user sees, no error
   - correctness: wrong behavior but loud
   - code_quality: style, duplication, dead code

5. If any finding is severity "exploitable" or "silent_data_corruption",
   open a NEW GitHub issue tagged `audit` + `priority` with a clear title
   and the finding details. Otherwise, post a single comment to the
   "Weekly Audit Log" issue summarizing everything by severity.

6. Never edit files. Never commit. Never open PRs. Posting to issues is
   your only write surface.

Hard limit: if you approach 200k tokens total (including subagents), stop
and post what you have.

Repo: afc1204-coder/sport-bet-pro. Owner: afc1204-coder.
```

## Why these choices

- **Weekly not daily**: audit quality comes from reviewing meaningful batches
  of commits, not single-commit noise. Daily creates alarm fatigue.
- **Monday morning UTC**: issues land before the work week starts, not in the
  middle of Friday.
- **3 parallel subagents**: matches the simplify pattern that worked well in
  PR #6 — reuse, quality, correctness are independent concerns and parallel
  execution is faster + cheaper than sequential.
- **"Weekly Audit Log" fixed issue**: prevents issue spam on clean weeks.
  Only real findings get their own issue with `priority`.
- **No write access to code**: the agent can only post to GitHub issues.
  Human reviews + merges every fix. This is the "gate" in Level 2.
