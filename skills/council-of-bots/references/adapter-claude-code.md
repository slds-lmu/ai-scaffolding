# Adapter: Claude Code

Use this adapter when the host is Claude Code.

## Launch Pattern

Run the external launcher for Codex and Gemini:

```bash
bash ~/.claude/skills/council-of-bots/scripts/council-fanout.sh \
  /tmp/${ID}-context.md [--no-codex] [--no-gemini] [--no-claude]
```

Launch the Claude leg as a background Agent in the same response unless Claude was disabled.

## Why

Inside Claude Code, the Agent path is the reliable inner-Claude adapter.
Do not replace it with `claude -p` for this skill.

## Agent Prompt

Use the same instructions as [prompt-template.md](prompt-template.md), but have the Agent:

- read `/tmp/${ID}-context.md`
- review it
- return the review directly

## Collection

- read `/tmp/${ID}-codex.txt` and `/tmp/${ID}-gemini.txt`
- use the Agent result as the Claude response
- synthesize under the shared protocol
