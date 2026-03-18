# Adapter: Codex

Use this adapter when the host is Codex.

## Launch Pattern

Use `multi_tool_use.parallel` to start the council work in one response whenever possible.

Recommended external launcher:

```bash
bash ~/.claude/skills/council-of-bots/scripts/council-fanout.sh \
  /tmp/${ID}-context.md --claude-via-cli [--no-codex] [--no-gemini] [--no-claude]
```

If the context references files on disk, add one or more:

```bash
--add-dir /abs/path/root
```

so the Claude CLI leg can read those files.

## Background Pattern

From Codex, the reliable concurrent pattern is:

1. start the launcher with `functions.exec_command`
2. use a short `yield_time_ms`
3. if the tool returns a session ID, keep working
4. later poll it with `functions.write_stdin`

Do not rely on detached `nohup ... &` wrappers for the Claude CLI leg.

## Collection

Read:

- `/tmp/${ID}-codex.txt`
- `/tmp/${ID}-gemini.txt`
- `/tmp/${ID}-claude.txt`

Then synthesize under the shared protocol.
