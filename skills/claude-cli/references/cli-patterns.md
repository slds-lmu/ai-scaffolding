# Claude CLI Patterns

Use this reference when you need the raw CLI behavior instead of the wrapper scripts.

## Stable Invocation Pattern

- Use `claude -p` for non-interactive execution.
- Prefer stdin for prompts:

```bash
cat /tmp/prompt.md | claude -p --output-format json
```

- Prefer `--output-format json` for automation and parse `.result`.
- Use `--no-session-persistence` for one-shot calls.
- Unset `CLAUDECODE` before launching Claude from another agent environment.

## Shell Pitfalls

- `--add-dir` is variadic.
- `--allowedTools` is variadic.
- A positional prompt placed after either flag can be swallowed.

Safe forms:

```bash
cat /tmp/prompt.md | claude -p \
  --allowedTools=Read,Grep,Glob \
  --add-dir=/abs/path/project \
  --output-format json
```

```bash
claude -p "Short prompt here" --allowedTools=Read,Grep,Glob
```

Avoid:

```bash
claude -p --allowedTools Read,Grep,Glob "This prompt may be swallowed"
```

## Review Guidance

Model choice (`--model` takes the aliases `fable`, `opus`, `sonnet`, or a full
model name; `--effort low|medium|high|xhigh|max` sets reasoning effort):

- Reviews, second opinions, and anything that needs judgment: `fable` (the
  strongest tier), or `opus` if that is unavailable. A second opinion from a
  weaker model than the one doing the work is rarely worth the round trip.
- Mechanical tasks (summarize a file, list the functions, convert a format):
  `sonnet`, which is faster and cheaper.

For small reviews:

- Inline the snippet or diff in the prompt.

For large reviews:

- Put the instructions in a context file.
- Use `--target` for each reviewed file or root directory; the launcher appends those
  paths to the staged prompt. List additional absolute paths in the context file.
- Add extra access roots via `--add-dir` when needed.

## Concurrency

- In Codex, use a long-running `exec_command` session to keep Claude running while you do other work.
- Start the command with a short `yield_time_ms`, note the returned `session_id`, and poll it later with `write_stdin`.
- Detached shell backgrounding with `nohup ... &` was not reliable in testing: `claude -p` often produced `output.json` but did not terminate cleanly for the wrapper.
- Do not reuse the same persisted session from concurrent jobs.

Suggested command shape for Codex:

```bash
$HOME/.claude/skills/claude-cli/scripts/claude-run.sh \
  --prompt-file /tmp/claude-review-context.md \
  --job-dir /tmp/claude-review-job \
  --target /abs/path/project/file1.R \
  --target /abs/path/project/file2.R \
  --model fable
```

Start that through `functions.exec_command`. If it returns a running session instead of a final answer, continue other work and poll the session later.

## Official Docs

- CLI reference: https://docs.anthropic.com/en/docs/claude-code/cli-reference
- Common workflows: https://docs.anthropic.com/en/docs/claude-code/common-workflows
- Settings and permissions: https://docs.anthropic.com/en/docs/claude-code/settings
