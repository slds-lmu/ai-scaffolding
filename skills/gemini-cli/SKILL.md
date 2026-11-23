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
  On timeout agy prints `[agy] print timeout after ...` to stderr and returns an empty
  or cut-off answer. agy 1.4.0 exited **0** here (stream-json even said
  `status: SUCCESS`); the changelog says newer versions exit 3. Check stderr, not just
  the exit code. There is no hidden cap on the value (verified 2026-10-16).
- Choose the model by task difficulty, because the strongest model's quota is scarce
  (see "Quota errors"). Use the strongest for hard or high-stakes work such as
  derivations, statistical methods and subtle bugs: Google's models lag the frontier
  even at their best. Use Flash for routine work:
  `pick-gemini-model.sh high "" flash`. With no third argument,
  `scripts/pick-gemini-model.sh` prints the strongest (newest major version, then
  Ultra > Pro or codename > Flash > Flash-Lite, then newest minor, then the script's
  `RANK2` order of Pro and codename families; an unranked new codename prints a
  warning), at High effort. Never hardcode a label; they disappear
  (`Gemini 3.1 Pro (High)` vanished in Oct 2026).
- List currently available model labels with `agy models`. Reasoning effort is
  encoded in the model label. To choose it, pass the effort to the picker:
  `pick-gemini-model.sh medium` returns the strongest family's `(Medium)` variant
  (default `high`; `xhigh` picks `(XHigh)`, offered by Neon and Hydrogen in agy 1.5.13;
  a missing variant falls back to the family's nearest effort). agy also has a session-level
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
model given by `--gemini-model` and `--gemini-effort` (`strongest` by default; the
council skill says how to choose). If that model's quota is exhausted, it reruns on the
strongest remaining family (`pick-gemini-model.sh EFFORT "Family A|Family B"`) and starts
the review with a `[GEMINI FALLBACK: ...]` line. To force one exact label and disable the
fallback:

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

## Quota errors (`RESOURCE_EXHAUSTED`, 429, "Individual quota reached")

These are real, but they do not mean "Gemini is used up". Observed 2026-11-04 (agy 1.5.0):

- The limit applied per model family: Argon High and Low both returned 429 while Flash
  High and Low answered on the same login. So try the next family before reporting
  (a no-tool call is enough):
  `agy -p "Reply with exactly: PONG" --model "<label>" --print-timeout 90s`
- The usage page in the Gemini app (gemini.google.com, "Nutzungslimits") does not show
  this limit. It read 1 % used with a different reset time during these 429s, so a low
  number there does not contradict agy. agy has no quota subcommand; the
  `Resets in ...` text in the error is the only reading.
- All six logged 429s computed to a reset on a Monday at 09:13:15 CET (Nov 2 and Nov 9),
  which suggests a weekly window. In the one fully logged window, Argon ran out after
  about 20 council runs on Nov 2-3; cost per run varies, so treat that as a rough scale.
  Find affected runs with `grep -l 'Individual quota' ~/.gemini/antigravity-cli/log/*`.
- Report these as "Argon quota exhausted, resets in X", and name the model that answered
  instead. The council launcher falls back by itself (see "Council reviews"), except
  with `COUNCIL_GEMINI_MODEL` set.
