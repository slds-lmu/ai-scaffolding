# AI Scaffolding

Custom [Claude Code skills](https://docs.anthropic.com/en/docs/claude-code/skills)
for academic / statistics workflows.

## Skills

| Skill | Description |
|---|---|
| `claude-cli` | Invoke Claude Code CLI from Codex for external reviews and second opinions |
| `council-of-bots` | Multi-agent code review (fans out to Codex, Gemini, Claude) |
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

