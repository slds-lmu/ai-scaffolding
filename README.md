# AI Scaffolding

Custom [Claude Code skills](https://code.claude.com/docs/en/skills) for academic
statistics work: R development, simulation studies, HPC, peer review, scientific
writing, LaTeX/Quarto, and teaching.

Each skill is a folder under [`skills/`](skills/) with a `SKILL.md` (the
instructions the agent loads) plus optional reference files, scripts, and
templates. Skill names below link to the `SKILL.md`; the last column links to
the supporting files.

**Contents:**
[AI review & agent workflow](#ai-review--agent-workflow) ·
[R development](#r-development) ·
[Simulation studies & HPC](#simulation-studies--hpc) ·
[Reviewing & writing](#reviewing--writing) ·
[LaTeX & Quarto](#latex--quarto) ·
[Teaching](#teaching) ·
[Installation](#installation) ·
[Other sources](#other-sources)

## Skills

### AI review & agent workflow

| Skill | What it does | Supporting files |
|---|---|---|
| [`council-of-bots`](skills/council-of-bots/SKILL.md) | Multi-model review of code, diffs, plans, or drafts: fans out to Codex, Gemini, and Claude in parallel, then triages and synthesizes their feedback[^council-agy] | [shared protocol](skills/council-of-bots/references/shared-protocol.md), [prompt template](skills/council-of-bots/references/prompt-template.md), [Claude Code adapter](skills/council-of-bots/references/adapter-claude-code.md), [Codex adapter](skills/council-of-bots/references/adapter-codex.md), [fan-out script](skills/council-of-bots/scripts/council-fanout.sh), [Gemini leg](skills/council-of-bots/scripts/gemini-leg.py) |
| [`codex`](skills/codex/SKILL.md) | Use OpenAI's Codex CLI for second opinions, debugging, and diff reviews; flag reference verified against codex-cli 0.171 (used by `council-of-bots`) | — |
| [`gemini-cli`](skills/gemini-cli/SKILL.md) | Call Gemini through the Antigravity `agy` CLI for reviews and second opinions; picks the strongest available model (required by `council-of-bots`) | [model picker](skills/gemini-cli/scripts/pick-gemini-model.sh) |
| [`claude-cli`](skills/claude-cli/SKILL.md) | Call the Claude Code CLI from Codex for external reviews and second opinions | [CLI patterns](skills/claude-cli/references/cli-patterns.md), [run script](skills/claude-cli/scripts/claude-run.sh), [job-status script](skills/claude-cli/scripts/claude-job-status.sh) |
| [`lessons-learned`](skills/lessons-learned/SKILL.md) | Capture lessons from a session and persist them to memory or skill files | [quality guide](skills/lessons-learned/references/quality-guide.md) |

### R development

| Skill | What it does | Supporting files |
|---|---|---|
| [`r-package-coding`](skills/r-package-coding/SKILL.md) | R package development standards: naming, S3, roxygen2, checkmate/cli, testthat | — |
| [`r-scripting`](skills/r-scripting/SKILL.md) | Conventions for R scripts and data analysis (tidyverse); literate teaching demos with `knitr::spin` | [knitr::spin reference](skills/r-scripting/knitr-spin-reference.md) |
| [`cran-submission`](skills/cran-submission/SKILL.md) | CRAN release workflow: extra checks, rhub, revdep, pkgdown, run in parallel | [CRAN extra checks](skills/cran-submission/references/cran-extrachecks.md) |

### Simulation studies & HPC

| Skill | What it does | Supporting files |
|---|---|---|
| [`setup-benchmark`](skills/setup-benchmark/SKILL.md) | Monte Carlo study design for comparing statistical methods (ADEMP framework, furrr parallelization, seeds, MCSEs) | [study design](skills/setup-benchmark/references/study-design.md), [code template](skills/setup-benchmark/references/code-template.md), [truth functions](skills/setup-benchmark/references/truth-functions.md), [performance measures](skills/setup-benchmark/references/performance-measures.md), [visualization](skills/setup-benchmark/references/visualization.md), [development workflow](skills/setup-benchmark/references/development-workflow.md), [bug checklist](skills/setup-benchmark/references/bug-checklist.md), [R packages](skills/setup-benchmark/references/r-packages.md), [minimal example](skills/setup-benchmark/examples/minimal-benchmark.R) |
| [`lrz-remote`](skills/lrz-remote/SKILL.md) | Run R workflows on the LRZ Linux Cluster (CoolMUC-4) via SSH and SLURM[^lrz-ssh] | [SSH setup guide](lrz-ssh-setup.md) |

### Reviewing & writing

| Skill | What it does | Supporting files |
|---|---|---|
| [`peer-review`](skills/peer-review/SKILL.md) | Structured referee reports for statistical/methodological papers (Summary, Major, Minor issues) | [Quarto template](skills/peer-review/assets/rev_template.qmd), [simulation-study checklist](skills/peer-review/references/simulation-study-checklist.md), [code-supplement checklist](skills/peer-review/references/code-supplement-checklist.md) |
| [`reproducibility-review`](skills/reproducibility-review/SKILL.md) | Executes a paper's code/data supplement, runs reduced simulations, and compares outputs against the reported results | [checklist](skills/reproducibility-review/references/checklist.md), [review template](skills/reproducibility-review/assets/review-template.md) |
| [`deslop`](skills/deslop/SKILL.md) | Remove AI-writing tells without changing technical meaning; for manuscripts, also audit claim–evidence alignment and reporting quality | [vocabulary](skills/deslop/references/vocabulary.md), [structural tells](skills/deslop/references/structural-tells.md), [preserve checklist](skills/deslop/references/preserve-checklist.md), [jargon glossing](skills/deslop/references/jargon-glossing.md), [scientific-writing checklist](skills/deslop/references/scientific-writing-checklist.md), [scoring rubric](skills/deslop/references/scoring-rubric.md) |

### LaTeX & Quarto

| Skill | What it does | Supporting files |
|---|---|---|
| [`latexdiff`](skills/latexdiff/SKILL.md) | Track-changes PDFs between LaTeX versions (git revisions, Quarto/Rmd via keep-tex), incl. fixes for knitr-verbatim, bookmark, and JSS-template compile failures | — |
| [`quarto-latex-gotchas`](skills/quarto-latex-gotchas/SKILL.md) | Verified failure modes and fixes for Quarto/LaTeX builds (revealjs print/links/figures, JSS template, kableExtra, babel, unicode-math, TinyTeX, headless-Chrome printing) | — |

### Teaching

| Skill | What it does | Supporting files |
|---|---|---|
| [`make-quiz`](skills/make-quiz/SKILL.md) | R/exams quiz questions (schoice, mchoice, num) for Moodle, for stats/maths/ML lectures | [examples](skills/make-quiz/references/examples.md), [Makefile](skills/make-quiz/assets/Makefile), [rendering test](skills/make-quiz/scripts/test_rendering.R), [LaTeX macro fix](skills/make-quiz/scripts/fix_latex_macros.sh) |
| [`interactive-textbook`](skills/interactive-textbook/SKILL.md) | Create, extend, or simplify an interactive textbook or course companion from lecture notes (nested concept pop-ups, definition previews, widgets, MathJax); reuses an existing project's stack, with an optional React/MDX starter app | [conventions template](skills/interactive-textbook/references/conventions-template.md), [verification](skills/interactive-textbook/references/verification.md), [workflow template](skills/interactive-textbook/references/workflow-template.js), [starter app](skills/interactive-textbook/assets/app-template/) |
| [`explorable-widgets`](skills/explorable-widgets/SKILL.md) | Design, build, and review interactive teaching widgets (explorable explanations) and the prose around them | [design patterns](skills/explorable-widgets/references/design-patterns.md), [craft](skills/explorable-widgets/references/craft.md), [review rubric](skills/explorable-widgets/references/review-rubric.md) |

[^council-agy]: **Gemini leg needs setup.** The standalone `gemini` CLI lost free-tier access, so the Gemini reviewer now runs through the Antigravity [`agy`](https://antigravity.google) CLI in non-interactive print mode. Because `agy` is an *agentic* CLI, it would otherwise block on a tool-permission prompt and hang, so the script calls it with **`--dangerously-skip-permissions`**. For the Gemini leg to work you must therefore: (1) install `agy` and sign in once interactively (`agy`) with `~/.local/bin` on `PATH`; and (2) **grant the calling agent permission to run this** — in Claude Code, the `agy` call is encapsulated inside the fan-out script, so allowing the skill's `Bash(bash ~/.claude/skills/*)` invocation plus a `Bash(agy *)` rule is enough; other harnesses need an equivalent standing approval for an auto-approved agent. Without this, the Gemini leg is skipped or returns a diagnostic — Codex and Claude still run. The launcher picks a Gemini that `agy models` lists (via the `gemini-cli` skill's `pick-gemini-model.sh`, so install `gemini-cli` alongside `council-of-bots`): choose it with `--gemini-model strongest|flash|...` and `--gemini-effort`, or force one exact label via `COUNCIL_GEMINI_MODEL`. If a model family's quota is exhausted, it falls back to the strongest remaining one.

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

`council-of-bots` needs `gemini-cli` installed alongside it (for the Gemini
leg's model picker); `codex` is its flag reference for the Codex leg.
Claude Code discovers the skills at the next session start.

## Other sources

- [posit-dev/skills](https://github.com/posit-dev/skills) is Posit's official
  skill library and worth browsing. Our `cran-submission` skill incorporates its
  [`r-cran-extrachecks`](https://github.com/posit-dev/skills/blob/main/r-lib/r-cran-extrachecks/SKILL.md)[^thx]
  checklist and adds rhub, revdep, pkgdown, and parallelized execution on top.

[^thx]: TY [@jemus42](https://github.com/jemus42) for the pointer
