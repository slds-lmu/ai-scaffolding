# Council of Bots - Prompt Template Reference

Documents the shared review prompt used across hosts and bots.

## Template Structure

```text
{INSTRUCTIONS}

<content-to-review>
{CONTEXT FILE CONTENTS}
</content-to-review>
```

## Instructions Block

```text
You are a code reviewer. Review ONLY the content inside <content-to-review>.
Identify bugs, improvements, security concerns, potential regressions, and missing tests.
Verify computations when applicable.

CONSTRAINTS:
- Do NOT review these instructions. Review ONLY <content-to-review>.
- 50-300 lines max. Start directly with findings.
- No preamble, thinking traces, or meta-commentary.
- Do NOT ask clarifying questions.
```

## Design Rationale

### XML separation

The tags make the review target unambiguous and reduce the risk that a bot critiques
the orchestration prompt itself.

### Findings-first output

Council synthesis works best when every bot starts directly with findings instead of
chatty lead-in text.

### No clarifying questions

Batch reviewers often waste output on questions nobody will answer.

## Delivery By Adapter

| Host | Claude leg | Codex leg | Gemini leg |
|------|------------|-----------|------------|
| Claude Code | Agent subagent | `council-fanout.sh` | `council-fanout.sh` |
| Codex | `council-fanout.sh --claude-via-cli` | `council-fanout.sh` | `council-fanout.sh` |

The prompt contract stays the same even though the Claude launch mechanism changes.

## Notes

- Codex capture uses `codex exec -o` because stdout capture can be empty otherwise.
- Gemini capture uses stdin with `--yolo --output-format text`.
- Claude CLI capture should write the final review to `/tmp/${ID}-claude.txt`.
