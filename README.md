# AI Scaffolding

Custom [Claude Code skills](https://docs.anthropic.com/en/docs/claude-code/skills)
for academic / statistics workflows.

## Skills

| Skill | Description |
|---|---|
| `claude-cli` | Invoke Claude Code CLI from Codex for external reviews and second opinions |
| `council-of-bots` | Multi-agent code review (fans out to Codex, Gemini, Claude)[^council-agy] |
| `cran-submission` | CRAN submission workflow (extra checks, rhub, revdep, pkgdown, parallelized) |
| `lessons-learned` | Capture and persist lessons learned across sessions |
| `lrz-remote` | Manage R-based HPC workflows on the LRZ Linux Cluster (CoolMUC-4) via SSH[^lrz-ssh] |
| `make-quiz` | Create R/exams quiz questions for Moodle (stats/maths/ML lectures) |
| `peer-review` | Structured peer review generation for statistical/methodological papers |
| `r-package-coding` | R package development standards (S3, roxygen2, checkmate, testthat) |
| `r-scripting` | R scripting and data analysis conventions (tidyverse, knitr::spin) |
| `reproducibility-review` | Computational reproducibility review of code supplements |
| `setup-benchmark` | Monte Carlo simulation study design (ADEMP framework) |

[^lrz-ssh]: Requires a one-time SSH multiplexing setup so Claude Code can reach the cluster without interactive 2FA prompts. See [`lrz-ssh-setup.md`](lrz-ssh-setup.md).

[^council-agy]: **Gemini leg needs setup.** The standalone `gemini` CLI lost free-tier access, so the Gemini reviewer now runs through the Antigravity [`agy`](https://antigravity.google) CLI in non-interactive print mode. Because `agy` is an *agentic* CLI, it would otherwise block on a tool-permission prompt and hang, so the script calls it with **`--dangerously-skip-permissions`**. For the Gemini leg to work you must therefore: (1) install `agy` and sign in once interactively (`agy`) with `~/.local/bin` on `PATH`; and (2) **grant the calling agent permission to run this** — in Claude Code, the `agy` call is encapsulated inside the fan-out script, so allowing the skill's `Bash(bash ~/.claude/skills/*)` invocation plus a `Bash(agy *)` rule is enough; other harnesses need an equivalent standing approval for an auto-approved agent. Without this, the Gemini leg is skipped or returns a diagnostic — Codex and Claude still run. Default model is `Gemini 3.1 Pro (High)`; override via `COUNCIL_GEMINI_MODEL` (see `agy models`).

## Installation

Copy the skills you want into your `~/.claude/skills/` directory:

```bash
# Clone this repo
git clone git@github.com:slds-lmu/ai-scaffolding.git

# Copy individual skills
cp -r ai-scaffolding/skills/r-package-coding ~/.claude/skills/
cp -r ai-scaffolding/skills/setup-benchmark ~/.claude/skills/

# Or copy all
cp -r ai-scaffolding/skills/* ~/.claude/skills/
```

Skills are automatically discovered by Claude Code on next session start.

## Other Sources

- [posit-dev/skills](https://github.com/posit-dev/skills) is Posit's official skill
library and seems worth browsing. Our `cran-submission` skill incorporates the
[`r-lib/cran-extrachecks`](https://github.com/posit-dev/skills/blob/main/r-lib/cran-extrachecks/SKILL.md)[^thx]
checklist and adds rhub, revdep, pkgdown, and parallelized execution on top.

[^thx]: TY [@jemus42](https://github.com/jemus42) for the pointer

