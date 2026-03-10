---
name: validate-plan
description: Compare a GitHub issue plan against an actual implementation (PR diff or current codebase) and flag gaps, undocumented divergences, or a stale plan. Run from your Claude Code CLI session after implementation is complete. Prompts you to run update-plan if divergences are found.
---

# validate-plan

Reads a GitHub issue plan and compares it against what was actually built. Flags gaps and divergences, then prompts to run `update-plan --from=implementation` if the plan is stale.

Run this from your Claude Code CLI session after a PR is merged or implementation is complete. Do not run from the nanoclaw agent.

## Step 1: Gather inputs

Ask the user (via AskUserQuestion if not provided):
- Issue number and repo
- What to compare against:
  - A merged PR (provide PR number)
  - The current working directory (compare plan against files on disk)
  - A specific branch

## Step 2: Fetch the plan

```bash
gh issue view <number> --repo <owner/repo> --json title,body,number,url
```

Extract the `## Implementation Plan` section. If no such heading exists, use the full body.

Also check for a local plan file at `plans/issue-<number>.md` — if it exists and is newer than the issue body, note that the local file may have additional context.

## Step 3: Fetch the implementation

### If comparing against a PR:

```bash
gh pr view <pr-number> --repo <owner/repo> --json title,body,mergedAt,files,commits
gh pr diff <pr-number> --repo <owner/repo>
```

### If comparing against the working directory:

Read the relevant files identified in the plan. Use `git log --oneline -20` and `git diff main...HEAD` to understand recent changes.

### If comparing against a branch:

```bash
git diff main...<branch> --name-only
git diff main...<branch>
```

## Step 4: Compare plan to implementation

For each item in the `## Implementation Plan`:

- **Implemented as specified**: file was changed, approach matches — mark OK
- **Implemented differently**: file was changed but approach differs from plan — flag
- **Not implemented**: plan step not reflected in any changed file — flag
- **Extra changes**: files changed that are not mentioned in the plan — flag

Also check:
- Were any plan-specified files NOT touched?
- Were any files touched that the plan said should not be changed?
- Does the PR/commit description reference the issue (`Closes #N`, `Fixes #N`)?

## Step 5: Produce a validation report

Output a report in this format:

```
Plan Validation Report — Issue #<N>: <title>

Compared against: PR #<M> / branch <name> / working directory
Date: <today>

SUMMARY: <X> items match, <Y> divergences, <Z> unimplemented steps

--- MATCHES ---
✓ <plan step or file> — implemented as specified

--- DIVERGENCES ---
✗ <plan step or file>
  Plan said: <what the plan specified>
  Actually: <what was found in the diff/files>

--- NOT IMPLEMENTED ---
? <plan step or file> — no matching changes found

--- EXTRA CHANGES (not in plan) ---
+ <file or area> — changed but not mentioned in plan
```

## Step 6: Prompt for action

If there are divergences or unimplemented steps, use AskUserQuestion:

> The plan has [N] divergences from the implementation. Would you like to update the issue to reflect what was actually built?
> - Yes — run update-plan to document divergences
> - No — leave the issue as-is

If the user selects yes, invoke the `update-plan` skill with `--from=implementation`, passing the issue number, PR number, and the divergences identified in this report.

If the plan matches exactly, confirm:
> Plan validation passed. The implementation matches the plan. No updates needed.

Optionally suggest closing the issue if it is still open:
```bash
gh issue close <number> --repo <owner/repo>
```
