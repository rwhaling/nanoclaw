---
name: import-issue
description: Import a GitHub issue as a local Claude Code plan file and enter plan mode. Developer-side skill — run from your own Claude Code CLI session, not the agent. Fetches the Implementation Plan section from the issue, writes a local plan file with YAML front matter, and enters plan mode for review before implementation.
---

# import-issue

Fetches a GitHub issue and converts it into a local Claude Code plan file, then enters plan mode so you can review and approve before implementation begins.

Run this from your own Claude Code CLI session. Do not run this from the nanoclaw agent.

## Step 1: Get issue details

Ask the user (via AskUserQuestion if not provided):
- Issue number or full URL?
- Repo (`owner/repo`)? If a full URL was given, parse it from there.

Fetch the issue:
```bash
gh issue view <number> --repo <owner/repo> --json title,body,comments,labels,assignees,milestone,number,url
```

## Step 2: Check for unresolved comments

Read the `comments` array from the JSON output. If there are comments, check whether any appear to contain unresolved feedback or decisions that have not been folded into the issue body.

Signs of unresolved comments:
- Comments posted after the last body edit
- Comments that propose changes, ask questions, or suggest alternatives
- Comments that contain words like "should we", "what about", "I think", "actually"

If unresolved comments are found, use AskUserQuestion:

> There are [N] comments on this issue. Some may contain feedback not yet reflected in the plan body. Would you like to include a summary of the comments in the imported plan?
> - Yes — include a Discussion Summary section
> - No — import the plan body only

## Step 3: Parse the plan body

The issue body uses section headings to delimit content:

- Everything before `## Implementation Plan` is context/background
- `## Implementation Plan` and below is the actionable plan
- `## Post-Implementation Notes` (if present) contains post-merge errata

Extract:
- Full body (for context)
- The `## Implementation Plan` section (primary input to plan mode)
- The `## Post-Implementation Notes` section if present (include as reference)

If the issue body has no `## Implementation Plan` heading, treat the entire body as the plan and note this to the user.

## Step 4: Determine the output path

Default path: `plans/issue-<number>.md` relative to the repo root.

If a `plans/` directory does not exist, create it.

If a file already exists at that path:
- Show a diff between the existing file and the incoming issue content
- Use AskUserQuestion to ask whether to overwrite, merge, or abort
- Default: issue is source of truth, overwrite — but require confirmation

## Step 5: Write the local plan file

Write the file with YAML front matter:

```markdown
---
issue: <number>
repo: <owner/repo>
url: <issue url>
title: <issue title>
status: <label if present, else "draft">
imported: <today's date YYYY-MM-DD>
---

## Context

[Everything from the issue body before ## Implementation Plan]

## Implementation Plan

[The ## Implementation Plan section from the issue]

## Post-Implementation Notes

[The ## Post-Implementation Notes section, if present]

## Discussion Summary

[If user requested: concise summary of issue comments, attributed by author]
```

## Step 6: Enter plan mode

After writing the file, tell the user:

> Plan imported to `plans/issue-<number>.md`. Entering plan mode — review the plan below and approve to begin implementation.

Then enter plan mode using the plan file. Present the Implementation Plan section for review. Do not begin implementation until the user approves.

## Step 7: On approval

After plan mode approval, suggest:
- Create a feature branch: `git checkout -b feature/issue-<number>-<short-description>`
- Reference the issue in commits: `gh issue develop <number> --repo <owner/repo>` links commits to the issue automatically
- When done, open a PR that closes the issue: `gh pr create --title "..." --body "Closes #<number>"`
