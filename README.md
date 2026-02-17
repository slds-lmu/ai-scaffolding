# AI Scaffolding

Custom [Claude Code skills](https://docs.anthropic.com/en/docs/claude-code/skills)
for academic statistics and R development workflows.

## Skills

| Skill | Description |
|---|---|
| `r-package-coding` | R package development standards (S3, roxygen2, checkmate, testthat) |
| `r-scripting` | R scripting and data analysis conventions (tidyverse, knitr::spin) |
| `setup-benchmark` | Monte Carlo simulation study design (ADEMP framework, furrr) |
| `peer-review` | Structured peer review generation for statistical/methodological papers |
| `reproducibility-review` | Computational reproducibility review of code supplements |
| `lessons-learned` | Capture and persist lessons learned across sessions |

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

## Context

Developed at the [Department of Statistics, LMU Munich](https://www.slds.stat.uni-muenchen.de/)
for use in statistical research, R package development, and teaching.
