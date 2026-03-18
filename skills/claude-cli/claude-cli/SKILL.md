---
name: claude-cli
description: >
  Invoke Anthropic's Claude Code CLI from Codex for external reviews, second
  opinions, and file-based analysis. Use when the user asks to call Claude or
  Claude Code, compare Codex with Claude, run a quick one-shot prompt through
  Claude, or launch a background Claude review over many files, diffs, or a
  prepared context file.
---

# Claude CLI

Use this skill when you want a second model's output without leaving the current Codex session.
It covers both tiny prompts and large reviews where Claude should read files from disk.

## Quick Start

Quick prompt, foreground:

```bash
/home/fabians/.claude/skills/claude-cli/scripts/claude-run.sh \
  --prompt-text "Explain what tf_interpolate() does in 5 bullets." \
  --model sonnet
```

Large review, background:

Use Codex's long-running `exec_command` session for concurrency, not shell-detached `nohup`.
Launch the Claude command with a short `yield_time_ms`, keep the returned `session_id`,
continue your other work, and later poll that session with `write_stdin`.

Typical Codex sequence:

1. Write a prompt file if the task is non-trivial.
2. Start `scripts/claude-run.sh` via `functions.exec_command` with `yield_time_ms` around `1000`.
3. If the tool returns a session ID instead of final output, keep working.
4. Later call `functions.write_stdin` with empty input to poll the session.
5. When the command finishes, read `result.txt` or use the returned stdout.

## Workflow

1. Choose the prompt shape.
   Use `--prompt-text` for short questions.
   Use `--prompt-file` for long prompts, reviews, or anything involving variadic flags like `--add-dir` or `--allowedTools`.

2. Keep large reviews path-based.
   Inline only small snippets or diffs.
   For large codebases, create a context file with a neutral summary, numbered questions, and absolute file paths. Let Claude read the files itself.

3. Pass file access explicitly.
   Use `--target` for every file or directory Claude needs to read. The launcher adds the parent directories via `--add-dir=...`.
   Add extra roots with `--add-dir` when the prompt references other paths.

4. Default to read-only review tools.
   The launcher defaults to `Read,Grep,Glob` plus `--permission-mode bypassPermissions`.
   Only widen tools if the task genuinely needs edits or shell execution.

5. Prefer Codex session-based backgrounding.
   Detached shell backgrounding with `nohup ... &` was experimentally unreliable: Claude often wrote a valid answer but the process did not terminate cleanly.
   From Codex, the reliable concurrent pattern is a long-running `exec_command` session plus later polling with `write_stdin`.

6. Prefer JSON output for automation.
   The launcher stores the raw Claude response in `output.json` by default and extracts the final text into `result.txt`.
   Read `result.txt` for the answer and `stderr.log` if the job fails.

## Reliable Calling Rules

- Prefer stdin over a positional prompt whenever the command also uses `--add-dir` or `--allowedTools`. Both flags are variadic and can swallow a trailing prompt.
- If you call `claude` directly, use `--allowedTools=Read,Grep,Glob` and `--add-dir=/path` with the `=` form.
- Do not share `--continue` or `--resume` sessions across concurrent jobs. The launcher uses `--no-session-persistence` by default to avoid stale state.
- Unset `CLAUDECODE` before invoking the CLI. The launcher does this for you.
- Do not rely on shell-detached background runs. Use Codex's long-running exec sessions for concurrent work.

## Review Prompt Pattern

For reviews, write prompts like this:

```markdown
You are reviewing code for bugs, regressions, and missing tests.

Focus:
- API behavior
- edge cases
- tests

Files to inspect:
- /abs/path/file1.R
- /abs/path/file2.R

Questions:
1. What bugs or regressions do you see?
2. What tests are missing?
3. What changes are required before merge?
```

Keep the framing neutral. Do not preload Claude with your own diagnosis unless you explicitly want it to critique that diagnosis.

## Resources

- Script: `scripts/claude-run.sh`
  Launch Claude in the foreground and stage a reproducible job directory.
- Script: `scripts/claude-job-status.sh`
  Inspect a job directory produced by `claude-run.sh`.
- Reference: `references/cli-patterns.md`
  Concise notes on the tested invocation pattern, failure modes, and prompt design.

Read the reference if you need to call `claude` manually instead of going through the launcher.
