---
name: lessons-learned
description: >
  Capture and persist lessons learned from a session to compound knowledge over time.
  Triggers on "/lessons-learned", "what did we learn", "save lessons", "update skills
  with what we learned", or at the end of a complex multi-session task. PROACTIVE USE:
  This skill should also be suggested or invoked (1) when resuming from context
  compaction (the previous context likely contained unrecorded lessons), (2) after
  resolving a non-trivial bug or debugging session, (3) after significant friction
  or failed approaches that yielded insight, (4) after a council-of-bots review that
  surfaced fixes. Identifies reusable patterns, bug fixes, workflow insights, and tool
  quirks, then persists them to the right places: auto-memory (project-specific), skill
  files (reusable across projects), or both.
---

# Lessons Learned

Identify what was learned in this session and persist it so future sessions benefit.

## When to Run

- User explicitly asks (`/lessons-learned`, "save what we learned")
- End of a complex multi-session task (suggest proactively)
- After a significant debugging session that uncovered non-obvious behavior
- After a council-of-bots review that surfaced actionable fixes

## Selectivity Principle

**Default to NOT saving.** Memory files accumulate over time and consume context in
every future session. Each entry must earn its place. Ask: "Would a fresh Claude
session clearly benefit from knowing this?" If the answer is "maybe" — skip it.

Most sessions produce 0–2 lessons worth persisting. A session that yields 5+ is rare
and should prompt extra scrutiny. Prefer fewer high-signal entries over comprehensive
logs of everything that happened.

## Workflow

### 1. Mine the session for lessons

Review the conversation for insights that are **non-obvious, actionable, and verified**.
Skip anything a competent developer would figure out in context.

### 2. Scope and filter each candidate

Every candidate lesson has a **scope**:

| Scope | Bar | Destination | Example |
|-------|-----|-------------|---------|
| **Global** | Applies across most projects/sessions | `~/.claude/CLAUDE.md` or skill files | "R CMD check: use `--no-tests --no-vignettes` for fast iteration on compilation issues" |
| **Project** | Specific to this repo's setup/conventions | project MEMORY.md or topic file | "Air formatter pre-commit hook: re-stage then new commit" |

**Global lessons** have a higher bar: they must be useful regardless of which project
you're working on. Package-specific migration steps, repo-specific remote configs,
or one-time setup details are NOT global — they're project-specific at best, and
often not worth saving at all.

**Drop aggressively.** Filter out:
- One-time configuration steps unlikely to recur (e.g., "added flag X to Makevars")
- Project-specific facts with no transferable insight (e.g., "origin = user/repo")
- Details that are easily re-discoverable from docs or `--help`
- Anything that duplicates existing memory or skill content

### 3. Check for duplicates

Before writing anything:
- Read the current MEMORY.md and `~/.claude/CLAUDE.md`
- Read any relevant topic files linked from MEMORY.md
- Read the SKILL.md of any skill you plan to update
- Skip lessons already captured (even if worded differently)

### 4. Present lessons to user for approval

Show candidates **grouped by scope**, with clear destinations:

```
Global (applies across projects):
  1. [lesson] → ~/.claude/CLAUDE.md

Project-specific:
  2. [lesson] → MEMORY.md

Nothing else worth persisting from this session.
```

Ask which to persist. Default: all shown (but the list should already be selective).
If no lessons pass the bar, say so — an empty result is fine.

### 5. Persist

**Global** (`~/.claude/CLAUDE.md`, `~/.claude/skills/`):
- Read the target file first.
- Add concisely in the most natural location.
- Route by who needs to see it. `CLAUDE.md` is loaded into *every* session, so
  it should hold only lessons that apply regardless of task (git safety, shell
  gotchas, tool quirks). A lesson that only matters when doing X belongs in the
  skill for X: a simulation-study lesson goes into `setup-benchmark`'s
  references, a pkgdown gotcha into `r-package-coding`, and so on. CLAUDE.md has
  drifted toward being a catch-all; moving domain lessons into skills is a
  legitimate outcome of this step.
- Keep `CLAUDE.md` short — it was cut from 41 KB to ~9 KB in 2026-09 because
  every byte is paid in every session. An entry there is a rule of at most 2–3
  lines: no anecdotes, measurements, or dates (the story of how the lesson was
  learned goes with the detailed version in the skill or a memory file; CLAUDE.md
  gets at most a one-line pointer). Domain skills to route to include
  `quarto-latex-gotchas`, `agent-orchestration`, `setup-benchmark`, `r-scripting`,
  `r-package-coding`, `cran-submission`, `codex`. Check `wc -c ~/.claude/CLAUDE.md`
  before adding; if it exceeds ~12 KB, move or compress existing entries first.
- Skills are loaded into context on every trigger — keep additions minimal.
- For skills with reference files, prefer adding there over bloating SKILL.md.
- Edit skill files through `/skill-creator`: its writing guidance (explain the
  why instead of shouting MUST, keep the body lean, make the description
  trigger reliably) is what keeps a skill useful after twenty incremental
  additions.

**Project memory** (`~/.claude/projects/<project>/memory/`):
- MEMORY.md: Keep concise (<200 lines). One-liners. Link to topic files for detail.
- Topic files (e.g., `sim-patterns.md`): Longer explanations with code examples.
- If MEMORY.md is approaching 200 lines, consolidate or move detail to topic files.

### 6. Confirm

Summarize what was written and where:

```
Persisted 2 lessons:
- ~/.claude/CLAUDE.md: 1 item (R CMD check fast iteration)
- MEMORY.md: 1 item (Air formatter hook behavior)
```

## Quality Bar

See `references/quality-guide.md` for examples of good vs bad lessons.

Key principles:
- **Actionable over observational**: "Use `on.exit()` to save/restore RNG" not "RNG can be tricky"
- **Specific over vague**: Include the code pattern, the file path, the exact error message
- **Non-obvious over common knowledge**: Skip things any competent developer would know
- **Verified over speculative**: Only persist what was confirmed in this session
- **Concise over thorough**: A 2-line lesson that's always read beats a 20-line essay that's skipped
