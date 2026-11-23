---
name: codex
description: >
  Use OpenAI's Codex CLI as a second-opinion tool for debugging, code review, and
  analysis. Trigger on /codex, when the user asks for a Codex or GPT review or opinion,
  wants an independent review of a diff, commit, or branch, or is stuck on a bug and
  wants another model's take. Also the flag reference (exec, review, -s, -o, -m,
  --skip-git-repo-check) whenever council-of-bots or another skill needs to call
  Codex non-interactively.
---

# Codex CLI Integration

Verified against codex-cli 0.171.0 (2026-11-23).

## Model and effort

Pick the model size and reasoning effort to fit the task: a strong model at high
effort for reviews, derivations and hard debugging; a smaller model or lower effort
for quick, mechanical questions. Set both explicitly on every call. Don't rely on
`~/.codex/config.toml`, whose defaults may be tuned for interactive use. Check the
`model:` and `reasoning effort:` lines at the top of the Codex log to confirm what ran.

```bash
codex exec -m <model> -c model_reasoning_effort=<low|medium|high|xhigh|max> ...
```

## Two Modes

### 1. Code Review

`codex review` operates on git diffs directly — no file wrangling needed.
**Must be run from inside a git repo** (use `cd`, or `codex exec -C <repo> review`).

```bash
# Review uncommitted changes (staged + unstaged + untracked)
codex review --uncommitted

# Review changes against a branch
codex review --base main

# Review a specific commit
codex review --commit abc123
```

**`--uncommitted`, `--base` and `--commit` are each mutually exclusive with a custom
`[PROMPT]`** (verified 0.171.0, exit 2: "error: the argument '--uncommitted' cannot
be used with '[PROMPT]'"; 0.144.1 already rejected it for `--base`). To review a diff
*with* custom instructions, fall back to plain `codex exec` with repo access and tell
it to diff itself:

```bash
codex exec -s workspace-write -C <repo> -o /tmp/reply.txt - < prompt.txt
# prompt.txt starts with: "Review branch X vs base Y in this repository;
# obtain the changes yourself via `git diff Y...HEAD` ..." (for uncommitted changes:
# `git diff HEAD` plus the untracked files from `git ls-files --others
# --exclude-standard`; for a commit: `git show <sha>`)
```

**Important:** top-level `codex review` does NOT support `-m`, `-o` or other
`exec`-only flags (0.171.0: "unexpected argument '-m'").
To capture output, use shell redirection: `codex review --commit abc123 > /tmp/review.txt 2>&1`

`codex exec review` is the same thing nested under `exec`; it takes the same
`--uncommitted/--base/--commit` flags plus `-m` and `-o`. To pick the repo, put `-C`
before the subcommand: `codex exec -C <repo> review --uncommitted` (`codex exec review
-C` exits 2, verified 0.171.0).

### 2. General Questions (exec)

For debugging or analysis questions unrelated to a diff, use `codex exec`.
It is non-interactive by default (approval policy `never`), so no
approval-skipping flag is needed. **`--full-auto` is gone** (deprecated in codex-cli
0.144, rejected by 0.171); sandboxing is controlled by
`-s/--sandbox`:

| `-s` value | Meaning |
|---|---|
| `read-only` | Can read files, no writes — enough for pure opinion/analysis questions |
| `workspace-write` | Can edit and run things in the workspace — use when Codex should test hypotheses, run code, or produce files |
| `danger-full-access` | No sandbox — avoid |

Default to `workspace-write`: it lets Codex actually execute code to check its
claims (run a failing test, reproduce a bug) instead of reasoning from source
alone. Drop to `read-only` only when the user wants a strictly hands-off
opinion or the working tree must not be touched.

```bash
# Prompt as positional argument
codex exec -s workspace-write --skip-git-repo-check "Explain why this recursive CTE might not terminate"

# Capture output reliably with -o flag
codex exec -s workspace-write --skip-git-repo-check -o /tmp/reply.txt "$(cat /tmp/question.txt)"
```

### Reliable output capture with `-o` and stdin

The `-o <file>` flag (`--output-last-message`) writes the last agent message to a
file, which is the most reliable way to capture Codex output (stdout capture can
be empty when Codex performs agent actions instead of printing).

For structured prompts (e.g., council-of-bots), pipe via stdin with `-`:

```bash
echo "$PROMPT" | codex exec -s workspace-write --skip-git-repo-check -C /tmp -o /tmp/reply.txt -
```

The trailing `-` tells Codex to read the prompt from stdin. Combined with `-o`,
this ensures the response is written to the output file regardless of what agent
actions Codex takes internally.

**Gotchas:**
- Always use `--skip-git-repo-check` for general questions (not tied to a repo).
- When Codex has filesystem access and runs from a git repo directory, it may
  ignore the prompt and review local git history instead. For non-repo questions,
  run from a neutral directory: `codex exec -C /tmp ...`
- `--ephemeral` skips persisting a session file — fine for throwaway questions.

### Flag reference

| Flag | Available on | Purpose |
|------|-------------|---------|
| `-m <model>` | `exec`, `exec review` | Model override (choose per task, see above) |
| `-s <mode>` | `exec` | Sandbox: `read-only`, `workspace-write`, `danger-full-access` |
| `-o <file>` | `exec`, `exec review` | Write last agent message to file (most reliable output capture) |
| `--uncommitted` | `review`, `exec review` | Review staged+unstaged+untracked changes |
| `--base <branch>` | `review`, `exec review` | Review changes against a branch |
| `--commit <sha>` | `review`, `exec review` | Review a specific commit |
| `-C <dir>` | `exec` | Set working directory |
| `--skip-git-repo-check` | `exec`, `exec review` | Required when running outside a git repository |
| `-c key=value` | all | Ad-hoc config override, e.g. `-c model_reasoning_effort="medium"` |

**Do NOT use `-m` or `-o` with top-level `codex review`** — it will error; use `codex exec review`.
**Do not use `--full-auto`** — rejected by 0.171 (exit 2); `exec` never prompts, use `-s` for sandbox level.
**Outside a git repo**, `codex exec` requires `--skip-git-repo-check` or it will fail.

## Guidelines

- Provide complete functions, not snippets — Codex needs full context.
- Be specific: "Why does AC refinement fail after block 1477?" beats "Why does this fail?"
- Evaluate Codex suggestions critically — verify against specs and tests before applying.
- For long questions, use the file-based pattern (`/tmp/question.txt` -> `/tmp/reply.txt`).
- Always run as a **background Bash command** — Codex can take a while.

## Gotchas

- **Lost uncommitted Codex edits are recoverable**: `~/.codex/sessions/<y>/<m>/<d>/rollout-*.jsonl`
  stores every `apply_patch` payload (JSON-escaped twice; `*** Add File` entries carry the
  whole file). `grep -l <filename>` the rollouts, unescape, replay the hunks with a small
  Python applier — recovered three files + located the source of a copied PNG this way.
- **`codex exec` (workspace-write) inside a git WORKTREE cannot commit**: the
  worktree's git metadata lives under the main repo's `.git/worktrees/…`, outside
  the sandbox → `index.lock: read-only`. Let codex leave changes unstaged and
  commit on its behalf after review.
- **Codex can hit its usage limit mid-task**: `codex exec` exits 1 with NO `-o` file
  and a "retry after <time>" line at the log tail. Check the log tail before assuming a
  crash; its unfinished edits stay in the working tree and it leaves scratch dotfiles
  (`.something.R`) in the workspace — review both, don't `git clean` blindly.
- **R does not start under `-s read-only`** (it cannot create `R_TempDir`): use
  `workspace-write` whenever Codex should run R to check a claim.
