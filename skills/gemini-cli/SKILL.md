---
name: gemini-cli
description: >
  Call Google's Gemini models through the Antigravity `agy` CLI for independent
  reviews, critiques, second opinions, and council-of-bots workflows. Use when the
  user asks to call Gemini, compare Gemini with another model, review code or
  documents with Gemini, or troubleshoot Gemini council access. The standalone
  `gemini` Code Assist CLI is no longer a supported fallback for individual accounts.
---

# Gemini via Antigravity CLI

Use the installed Antigravity CLI, `agy`. Do not use the standalone `gemini`
binary: Gemini Code Assist for individuals rejects that client with
`IneligibleTierError` / `UNSUPPORTED_CLIENT`.

## One-shot invocation

Run Gemini non-interactively with:

```bash
agy -p "Your prompt" \
  --model "$(bash ~/.claude/skills/gemini-cli/scripts/pick-gemini-model.sh)" \
  --dangerously-skip-permissions \
  --print-timeout 10m \
  --output-format text
```

Important details:

- Pass the prompt as the argument to `-p`; do not pipe it through stdin.
- Keep `--dangerously-skip-permissions` for unattended reviews. Without it,
  non-trivial agent runs can block on a permission prompt.
- Set `--print-timeout` explicitly. Use a larger value for file-based reviews.
  On timeout agy exits **0**, prints `[agy] print timeout after ...` to stderr and
  returns an empty or cut-off answer (stream-json even says `status: SUCCESS`), so
  check stderr, never the exit code. There is no hidden cap on the value (verified
  2026-10-16).
- Always use Google's strongest available model: their models lag the frontier
  even at best. `scripts/pick-gemini-model.sh` prints it (newest major version,
  then Ultra > Pro > Flash, then newest minor, then High effort). Never hardcode
  a label; they disappear (`Gemini 3.1 Pro (High)` vanished in Oct 2026).
- List currently available model labels with `agy models`. Reasoning effort is
  encoded in the model label. To choose it, pass the effort to the picker:
  `pick-gemini-model.sh medium` returns the strongest family's `(Medium)` variant
  (default `high`; `xhigh`/`max` map to High). agy also has a session-level
  `--effort` flag, but how it interacts with a label's effort is untested, so
  select effort via the label.
- Add readable roots with repeated `--add-dir /absolute/path` flags when the
  prompt asks Gemini to inspect files outside the current working directory.

`agy` starts a local language-server process and writes state below `~/.gemini`.
In a restricted execution sandbox it can fail with a read-only-home or loopback
socket error. When that happens, rerun the same command outside the sandbox with
the user's approval; do not mistake it for an authentication failure.

## Council reviews

Use the council launcher rather than reconstructing the command:

```bash
bash ~/.claude/skills/council-of-bots/scripts/council-fanout.sh \
  /tmp/${ID}-context.md --no-claude
```

The launcher writes Gemini's response to `/tmp/${ID}-gemini.txt`. It picks the
strongest available Gemini via `scripts/pick-gemini-model.sh`; override this for
one invocation with:

```bash
COUNCIL_GEMINI_MODEL="MODEL LABEL FROM agy models" \
  bash ~/.claude/skills/council-of-bots/scripts/council-fanout.sh \
  /tmp/${ID}-context.md
```

For a Gemini-only council smoke test, pass `--no-codex --no-claude`.

## Large and binary inputs

Verified 2026-10-16 (agy 1.4.0, Gemini 4 Argon High): agy reads files through its
agent loop, one model turn of 5-60 s per read, plus 2-4 min for the final answer.
A repo-backed review with ~25 reads ran out of 900 s. Inlining the files into the
prompt halved the time on a 34 KB test (425 s -> 204 s, same findings), but only
when the prompt also says the inlined files must not be re-read; prefix lines with
numbers (`cat -n` style), otherwise cited line numbers drift.

Prompts over 128 KiB cannot go through `-p "$PROMPT"` (Linux caps one argv string
at 128 KiB). Send them on stdin as one stream-json message instead:

```bash
python3 -c 'import json,sys; print(json.dumps({"event":"user","message":{"role":"user","content":sys.stdin.read()}}))' \
  < prompt.md > prompt.ndjson
agy --model "$MODEL" --input-format stream-json --output-format stream-json \
  --dangerously-skip-permissions --print-timeout 15m -p "" < prompt.ndjson > out.ndjson
```

`-p ""` must be explicit and last (a bare `-p` swallows the next flag as its prompt).
In the output, `step_update` events carry `text_delta`s and tool calls with
`duration_seconds`; the final `result` event has `response`. The council launcher
(`council-fanout.sh` + `scripts/gemini-leg.py`) does all of this for council runs.

For ordinary text files, give Gemini the absolute paths in the prompt and grant
their common root with `--add-dir`, or inline them as above. For PDFs, extract relevant text first when
layout or images are not essential:

```bash
pdftotext document.pdf /tmp/document.txt
agy -p "Review /tmp/document.txt and report factual or methodological issues." \
  --add-dir /tmp --model "$(bash ~/.claude/skills/gemini-cli/scripts/pick-gemini-model.sh)" \
  --dangerously-skip-permissions --print-timeout 15m
```

Limit or split very large source material. Keep review prompts neutral and ask
for findings first rather than preloading Gemini with the host agent's diagnosis.

## Failure diagnosis

- `UNSUPPORTED_CLIENT` from `gemini`: wrong executable; switch to `agy`.
- Sign-in or unauthenticated message from `agy`: run `agy` interactively once to
  authenticate, then retry the non-interactive call.
- Read-only `~/.gemini` or `listen tcp 127.0.0.1 ... operation not permitted`:
  sandbox restriction; rerun outside the sandbox.
- Silent timeout on a substantive prompt: verify
  `--dangerously-skip-permissions` is present. If it is, the agent loop was
  probably still reading files: inline them (see above) or raise `--print-timeout`.
- `stream reading error ... connection timed out` in the agy log
  (`~/.gemini/antigravity-cli/cli.log`): a network stall killed the turn (seen
  2026-10-16 after 17 min); just re-run.
- Unknown model: run `agy models` and use the exact displayed label.
