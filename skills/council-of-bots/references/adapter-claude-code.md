# Adapter: Claude Code

Use this adapter when the host is Claude Code.

## Launch Pattern

Run the external launcher for Codex and Gemini:

```bash
bash ~/.claude/skills/council-of-bots/scripts/council-fanout.sh \
  /tmp/${ID}-context.md [--no-codex] [--no-gemini] [--no-claude] \
  [--codex-effort LEVEL] [--gemini-effort LEVEL] [--timeout SECONDS] [--add-dir DIR]... \
  [--gemini-inline FILE]... [--no-gemini-inline] [--gemini-inline-max KB]
```

Use `--timeout` (a flag, since `VAR=x bash ...` prefixes break the permission rule) for
reviews in which the bots read files from disk; see SKILL.md. Name review files by full
absolute path in the context so the Gemini leg can inline them (SKILL.md, Step 1).

Launch the Claude leg as a background Agent in the same response unless Claude was
disabled, with `model: "fable"` (the strongest tier; fall back to `opus` if the
session cannot run it) and `run_in_background: true`.

## Why

Inside Claude Code, the Agent path is the reliable inner-Claude adapter;
`claude -p` hangs when called from within a session. The strongest model is
used because the council exists to catch what the working model missed, and a
weaker reviewer mostly reports what the working model already knows.

## Agent Prompt

Use the same instructions as [prompt-template.md](prompt-template.md), but have the Agent:

- read `/tmp/${ID}-context.md`
- review it
- return the review directly

## Collection

- read `/tmp/${ID}-codex.txt` and `/tmp/${ID}-gemini.txt`
- use the Agent result as the Claude response
- synthesize under the shared protocol
