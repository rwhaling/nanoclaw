---
name: update-plan
description: Update a GitHub issue plan from one of four sources — issue comments, chat conversation, implementation outcome, or a local plan file. Agent-side variants (--from=comments, --from=chat) are designed for the Planning PAT. Developer-side variants (--from=implementation, --from=file) require full gh CLI access.
---

# update-plan

Updates a GitHub issue body to reflect new information. The source of the update determines which variant to use.

## Safety note

The `--from=comments` and `--from=chat` variants are designed to run under a Planning PAT with Issues read+write scope. If running under full personal GitHub credentials, prompt for explicit confirmation before every `gh` command that writes anything.

## Determine the variant

If the user did not specify a variant, ask via AskUserQuestion:

> What is the source of the update?
> - Comments — synthesize new issue comments into the plan body
> - Chat — update the plan based on decisions made in this conversation
> - Implementation — append post-implementation notes after a PR is merged
> - File — overwrite the issue body from a local plan file

---

## Variant: --from=comments

Use when new comments have been added to the issue and their content should be folded into the plan body.

### Step 1: Fetch current state

```bash
gh issue view <number> --repo <owner/repo> --json body,comments,updatedAt
```

### Step 2: Identify new comments

Find comments posted after the last body edit (compare timestamps). If all comments are old, tell the user there is nothing new to fold in.

### Step 3: Synthesize

Read the new comments. For each comment:
- If it proposes a change to the plan: incorporate it into the relevant section of the body
- If it asks a question that has been answered: fold the answer into the plan
- If it is a +1/acknowledgment/emoji: ignore

Do not include the raw comment text in the body. Synthesize cleanly into the existing plan structure.

### Step 4: Show diff and confirm

Show the user what will change in the issue body. Ask for confirmation before writing.

### Step 5: Update

```bash
gh issue edit <number> --repo <owner/repo> --body "<updated body>"
```

---

## Variant: --from=chat

Use when decisions have been made in the current chat conversation that should be reflected in the issue.

### Step 1: Fetch current issue body

```bash
gh issue view <number> --repo <owner/repo> --json body,number,title,url
```

### Step 2: Identify what changed

Review the current conversation. Identify:
- Decisions made that are not yet in the issue body
- Corrections to the existing plan
- New open questions that should be captured
- Anything explicitly ruled out that should be noted

Do not include exploratory discussion or alternatives that were rejected. Only include decided, actionable content.

### Step 3: Show diff and confirm

Show the user a summary of what will change and the new body. Ask for confirmation.

### Step 4: Update

```bash
gh issue edit <number> --repo <owner/repo> --body "<updated body>"
```

If running under full credentials, show the exact command and require confirmation before running.

---

## Variant: --from=implementation

Use after a PR has been merged to append post-implementation notes documenting what diverged from the plan.

Run from your Claude Code CLI session (requires full gh CLI access to read PRs).

### Step 1: Gather inputs

Ask the user (via AskUserQuestion if not provided):
- PR number or URL that implemented this issue
- Issue number and repo
- Any specific divergences or discoveries to capture

### Step 2: Read the PR

```bash
gh pr view <pr-number> --repo <owner/repo> --json title,body,mergedAt,files
gh pr diff <pr-number> --repo <owner/repo>
```

### Step 3: Compare plan to implementation

Read the local plan file (if available at `plans/issue-<number>.md`) or fetch the issue body. Compare the `## Implementation Plan` section against the actual PR diff and files changed.

Identify:
- Steps in the plan that were implemented differently than specified
- Files changed that were not mentioned in the plan
- Files mentioned in the plan that were not changed
- Discoveries made during implementation (unexpected dependencies, edge cases, etc.)
- Test results and any failures that required plan changes

### Step 4: Compose post-implementation notes

Write a `## Post-Implementation Notes` section:

```markdown
## Post-Implementation Notes

Merged: PR #<number> on <date>

### What diverged from the plan

[List specific plan steps that were implemented differently, and why]

### Unexpected discoveries

[Edge cases, dependencies, or constraints found during implementation]

### Test results

[Summary of what was tested and outcome]
```

If nothing diverged and there are no discoveries, write a brief confirmation: "Implemented as specified. No divergences."

### Step 5: Update the issue

Show the user the proposed post-implementation notes section and ask for confirmation. Then append it to the issue body:

```bash
gh issue edit <number> --repo <owner/repo> --body "<existing body + new section>"
```

Optionally close the issue:
```bash
gh issue close <number> --repo <owner/repo> --comment "Implemented in PR #<pr-number>"
```

---

## Variant: --from=file

Use when a local plan file has been edited and the changes should be pushed back to the GitHub issue.

### Step 1: Read the local file

Read the plan file (default: `plans/issue-<number>.md`). Extract:
- YAML front matter (issue number, repo)
- Full body content (excluding front matter)

### Step 2: Show diff

Fetch the current issue body:
```bash
gh issue view <number> --repo <owner/repo> --json body
```

Show a diff between the current issue body and the local file content.

### Step 3: Confirm and update

Ask for confirmation, then update:
```bash
gh issue edit <number> --repo <owner/repo> --body "<file content without front matter>"
```

If running under full credentials, require explicit confirmation before running.
