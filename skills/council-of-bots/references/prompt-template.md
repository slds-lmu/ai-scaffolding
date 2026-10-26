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
You are an expert reviewer. Review ONLY the content inside <content-to-review>.
It may be code, a diff, a plan, a manuscript or text draft, or analysis results; review it
as a senior domain expert would. Identify bugs, regressions, incorrect or unsupported claims,
missing tests or checks, security concerns, and concrete improvements. Verify computations.
Prioritize by severity and cite the exact location of each finding.

CONSTRAINTS:
- Do NOT review these instructions. Review ONLY <content-to-review>.
- 50-300 lines max. Start directly with findings.
- No preamble, thinking traces, or meta-commentary.
- Do NOT ask clarifying questions.
- If the content names files or directories on disk, READ them: they are part of the
  material under review, and findings must be checked against them. Never modify them.
```

This block is the single source of truth; `scripts/council-fanout.sh` embeds the
same text in its `INSTRUCTIONS` variable, and the Claude Agent leg is composed
from this file at run time. Change both copies together. The role is deliberately "expert reviewer"
rather than "code reviewer": the council is also used on paper drafts, plans, and
simulation results, and a code-reviewer framing makes bots nitpick prose as if it
were syntax.

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
- The Codex leg uses the `model` from `~/.codex/config.toml` (override per run with
  `COUNCIL_CODEX_MODEL=...`); the caller picks reasoning effort per review with
  `--codex-effort` (default `high`, never the config's interactive setting).
  Lesson (2026-10-16): a hardcoded model pin went stale, and the config's interactive
  effort (`low`) leaked into the council, giving a shallow review that never opened the
  referenced files. The launch line prints model + effort; check it. Its stderr is
  captured to `/tmp/${ID}-codex.err`, and an unknown model name or an empty review is
  written into the output file as `[CODEX FAILED: ...]` / `[CODEX PRODUCED NO OUTPUT]` —
  never swallowed, since a silent empty file reads like "the bot found nothing".
- Gemini runs via the Antigravity `agy` CLI in print mode, with `--model` set to the
  strongest Gemini listed by `agy models` (`skills/gemini-cli/scripts/pick-gemini-model.sh`)
  and `--dangerously-skip-permissions` (required; without it the agent loop blocks on
  a tool-permission prompt). The legacy `gemini` CLI was dropped after Google revoked
  its free Code Assist tier. Verified 2026-10-16 (agy 1.4.0, Gemini 4 Argon):
  - agy reads files through its agent loop, one model turn (5-60 s at High) per read;
    a repo-backed review used up its 900 s budget. `scripts/gemini-leg.py` therefore
    adds every text file the context names by absolute path (and `--gemini-inline`
    files) to Gemini's copy of the prompt, line-numbered, up to `--gemini-inline-max`
    KB (default 400), and tells Gemini not to re-read them. Same findings, about half
    the wall time (34 KB test: 425 s vs 204 s). `--no-gemini-inline` turns it off.
    Only Gemini's prompt changes; Codex and Claude get the shared prompt unchanged.
  - The prompt goes in through stdin as one stream-json message
    (`{"event":"user","message":{"role":"user","content":...}}` with
    `--input-format stream-json --output-format stream-json -p ""`), because a single
    argv string is capped at 128 KiB and `agy -p "$PROMPT"` fails beyond that.
  - On `--print-timeout` agy exits **0**, logs `[agy] print timeout ...` on stderr and
    reports `status: SUCCESS` with an empty or cut-off response. The helper salvages
    the streamed text and writes `[GEMINI PARTIAL OUTPUT: ...]` or
    `[GEMINI PRODUCED NO OUTPUT: ...]` as the first line; the summary counts both as
    failures. The transcript is kept in `/tmp/${ID}-gemini.ndjson` (stderr and the
    exact prompt are kept too when the leg fails).
  - "The stream was interrupted" mid-answer: agy retries in a new step, but the final
    `result.response` then concatenates the aborted attempt and the retry, and
    `status` stays `ERROR` even when the retry finished. The helper therefore drops
    the aborted attempt and judges completeness from the step states.
  - `--print-timeout` has no hidden cap: a log line "after 15m0s" was the launcher's
    900 s floor, not a limit inside agy.
- Claude CLI capture should write the final review to `/tmp/${ID}-claude.txt`.
