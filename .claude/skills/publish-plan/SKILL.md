---
name: publish-plan
description: Publish a local plan file or in-chat plan to a GitHub issue. Creates a new issue or updates an existing one. Agent-side skill designed to run under a Planning PAT (Contents read, PR read, Issues read+write). Also runnable from a developer's Claude Code CLI session.
---

# publish-plan

Publishes a plan to a GitHub issue. Use this when a plan has been drafted in chat or as a local markdown file and is ready to be shared with the team on GitHub.

## Safety note

This skill is designed to run under a Planning PAT with Issues read+write scope only. If running under full personal GitHub credentials, you MUST prompt for explicit confirmation before every `gh` command that writes anything, showing the exact command to be run. Never batch write operations without a confirmation step between them.

## Step 1: Determine the source

Ask the user (via AskUserQuestion if context is ambiguous):

- Is the plan in the current chat conversation, or in a local file?
- If a local file: what is the path?
- Should this create a new issue, or update an existing one?
  - If updating: what is the issue number?
- What repo should the issue be created in? (e.g. `owner/repo`)
  - If GH_TOKEN is set, check: `gh repo list --limit 5` to suggest likely repos.

## Step 2: Compose the issue body

### If plan is in chat

Synthesize the current plan from the conversation into a structured markdown document using the standard plan file format:

```
---
status: draft
---

## Context

[Background, goals, constraints discussed in chat]

## Implementation Plan

[Actionable steps, file changes, approach decisions]
```

Do not include chat back-and-forth, exploratory discussion, or alternatives that were ruled out. The issue body should be the clean, decided plan only.

### If plan is a local file

Read the file. If it has YAML front matter, preserve it (stripping local-only fields like `imported`). Use the file content as-is.

## Step 3: Publish to GitHub

### Creating a new issue

Run:
```bash
gh issue create --repo <owner/repo> --title "<title>" --body "<body>"
```

If running under full credentials (not a Planning PAT), show the command and ask for confirmation before running.

After creation, print the issue URL.

### Updating an existing issue

First, show the user the current issue body:
```bash
gh issue view <number> --repo <owner/repo>
```

Then show what the new body will be and ask for confirmation before overwriting.

Run:
```bash
gh issue edit <number> --repo <owner/repo> --body "<new body>"
```

If running under full credentials, require explicit confirmation before running.

## Step 4: Update local file (if applicable)

If the plan came from a local file, update its YAML front matter to record the issue number and repo:

```yaml
---
issue: <number>
repo: <owner/repo>
status: draft
published: <today's date>
---
```

## Step 5: Confirm

Tell the user the issue URL and current status label. Suggest next steps:
- Share the issue URL with teammates for review
- Use `update-plan --from=comments` to pull in feedback from issue comments
- Add a `ready-for-dev` label when the plan is finalized: `gh issue edit <number> --repo <owner/repo> --add-label ready-for-dev`
