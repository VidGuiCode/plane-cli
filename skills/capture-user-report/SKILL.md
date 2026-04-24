---
name: capture-user-report
description: Use when the user submits, pastes, forwards, or describes a bug report, feature feedback, or field report for plane-cli (this repo). Captures the raw report verbatim into `context/research/user-reports/` using the intake template, and optionally drives the triage write-up in `context/research/lessons-learned/` and the roadmap entry in `docs/roadmap.md`. Triggers on pasted bug reports, "here's a user report", "a user hit this bug", "feedback from <someone>", or similar intake phrasings.
---

# Capture User Report

This skill turns an incoming user report into a stable, searchable artifact in the repo with minimal friction. It is the canonical intake flow for `plane-cli`.

## Three-stage flow

1. **Inbox (always do this)** — drop the raw report into `context/research/user-reports/`, verbatim, using the template below. This is cheap, idempotent, and the only required step.
2. **Triage (do if the user wants a fix now, or if the cause is obvious)** — write an analysis doc in `context/research/lessons-learned/` with code pointers (`file:line` format), likely cause, and suggested fixes. Update the inbox file's `Triage:` field to link the lessons-learned doc.
3. **Roadmap (do if the user wants it queued for a release)** — add or update the matching release section in `docs/roadmap.md`, linking the lessons-learned doc (not the raw report).

Stages 2 and 3 are optional. If the user just said "capture this", stop after stage 1 and ask whether to triage.

## Filename convention

`context/research/user-reports/YYYY-MM-DD-short-slug.md`

- Date = the day the report was **received** (today, unless the user says otherwise).
- Slug = 3–5 kebab-case words summarizing the issue.

Examples:
- `2026-04-17-label-flag-silently-dropped.md`
- `2026-04-24-due-flag-silent-noop-on-update.md`

## Intake template

```markdown
# <one-line summary>

- Received: YYYY-MM-DD
- Source: <who / what channel>
- CLI version: <reported version, or "unknown">
- Severity (reporter's framing): <low / medium / high>
- Triage: <new | in-progress | resolved | wontfix> — link to lessons-learned doc or PR when written up

## Report (verbatim)

> <paste the user's report here, unedited, as a blockquote>

## Notes

<optional: anything obvious worth flagging during intake. Do NOT do deep analysis here — that goes in lessons-learned.>
```

- Quote the report as a markdown blockquote (`> ` prefix on each line) so it's visually separated from your notes and can't be mistaken for your own words.
- Preserve code blocks, shell output, and exact wording. Do not paraphrase or summarize.
- If the report is long, do not trim it — the whole point of the inbox is to have the raw material.

## Triage write-up (stage 2)

File path: `context/research/lessons-learned/<slug>.md` — matching slug, no date prefix.

Structure:
- One-line summary + severity at the top
- **Symptoms** — observable behavior
- **Reproducer** — minimal commands to trigger
- **What works** — adjacent flags or flows that succeed, to narrow the surface
- **What we know about the code path** — `file:line` pointers using the relative-path format `[src/commands/issue.ts:521](../../../src/commands/issue.ts:521)`
- **Likely cause** — one paragraph hypothesis
- **Suggested fixes** — numbered, concrete
- **Test coverage gap** — what test would have caught this

After writing the lessons-learned doc, update the inbox file's `Triage:` field to point at it.

## Roadmap entry (stage 3)

In `docs/roadmap.md`, under the target version's `### Bug fixes` (or `### Features` / `### Reliability`), link the lessons-learned doc:

```markdown
- **<short title>** — <one-sentence description>. See [context/research/lessons-learned/<slug>.md](../context/research/lessons-learned/<slug>.md).
```

If the target version doesn't exist yet, create a new `## vX.Y.Z` section at the bottom, above the "Items beyond …" trailer. Update that trailer's version number to match.

## What NOT to do

- **Do not** put the raw report in `lessons-learned/` — that folder is for triage output, not intake.
- **Do not** edit the user's words. Quote verbatim.
- **Do not** create a roadmap entry without a lessons-learned doc to link to.
- **Do not** skip the inbox stage even if the fix is obvious and trivial. The raw capture has its own value: it preserves what the user actually said, which gets paraphrased out of commit messages and PR descriptions.

## Quick sanity check before finishing

- [ ] File exists at `context/research/user-reports/YYYY-MM-DD-<slug>.md`
- [ ] Frontmatter fields are all filled (no placeholder angle-brackets left)
- [ ] Report body is a blockquote, verbatim
- [ ] If you did stage 2: lessons-learned doc exists and `Triage:` field links to it
- [ ] If you did stage 3: roadmap entry exists and links the lessons-learned doc (not the raw report)

## Related

- `context/research/user-reports/README.md` — full folder-level docs for the inbox (lives with the reports themselves)
- `context/docs/briefs/agent.md` — top-level agent briefing for this repo
