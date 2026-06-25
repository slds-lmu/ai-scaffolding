---
name: make-quiz
description: |
  Create comprehensive quiz questions in R/exams format for FMM course slide sets.
  Use when the user asks to: create quiz questions, make Moodle quizzes, generate
  R/exams questions, write exam questions for a slide set, or says "/make-quiz".
  Produces schoice, mchoice, and num questions at mixed difficulty levels. Output
  renders to Moodle XML via exams2moodle(). Questions are in German.
---

# Make Quiz Questions (R/exams)

Create quiz questions in R/exams format for FMM lecture slide sets.

## Workflow

### 1. Read and Analyze Slides

Read the .Rmd file in `/slides/`. Identify:
- Definitions and theorems
- Important properties and relationships
- Practical examples and calculations
- Common misconceptions or tricky points

### 2. Plan Question Coverage

Aim for **10-15 questions** per slide set:

| Category | Difficulty | ~Share |
|----------|-----------|--------|
| Definitions (basic understanding) | Easy | 30-40% |
| Properties (conceptual understanding) | Easy/Medium | |
| Calculations (concrete computations) | Easy/Medium | 50-60% |
| Relationships (connections between concepts) | Medium | |
| Deep concepts (synthesis, advanced) | Medium/Hard | 0-10% |

### 3. Question Types

- **num**: Numerical calculations with tolerance. Parametrize with random values where sensible. Include step-by-step solutions.
- **schoice**: Single correct answer. 3-5 options. Good for definitions.
- **mchoice**: Multiple correct answers. 4-6 options. Mix true/false statements.
- **NO cloze questions** -- they don't work well in Moodle.

### 4. Question Template

````r
```{r data generation, echo = FALSE, results = "hide"}
# Difficulty: Easy/Medium/Hard
library(exams)  # if needed

# Generate parameters if applicable
# Calculate solution -- use calculated values in Answerlist and Solution
```

Question
========
[Clear, precise question text in German]

[Standard LaTeX only!]

Answerlist
----------
* [Option 1]
* [Option 2]
* [Option 3]

Solution
=========
[Detailed explanation in German]

[Step-by-step calculation if applicable]

Answerlist
----------
* [Richtig/Falsch. Explanation for option 1]
* [Richtig/Falsch. Explanation for option 2]
* [Richtig/Falsch. Explanation for option 3]

Meta-information
================
exname: [Short descriptive name]
extype: schoice/mchoice/num
exsolution: [solution string]
exshuffle: FALSE
extol: [tolerance for num type]
````

### 5. CRITICAL: Standard LaTeX Only

Quiz questions render in Moodle with standard MathJax. Custom macros will NOT work.

| NEVER use | ALWAYS use instead |
|-----------|--------------------|
| `\bx`, `\by`, `\bA`, `\bX` | `\mathbf{x}`, `\mathbf{y}`, `\mathbf{A}`, `\mathbf{X}` |
| `\bbeta`, `\btheta` | `\boldsymbol{\beta}`, `\boldsymbol{\theta}` |
| `\R`, `\N`, `\C` | `\mathbb{R}`, `\mathbb{N}`, `\mathbb{C}` |
| `\wh{x}`, `\wt{x}` | `\hat{x}`, `\tilde{x}` |
| `\eps` | `\varepsilon` or `\epsilon` |

### 6. Formatting Rules

- **NO extra text after Answerlist in Solution section** (no "Zusammenfassung:", "Bemerkung:" with bullets)
- **Match exsolution length to answer count**: schoice has exactly one "1"; mchoice has as many positions as options
- **exshuffle**: TRUE when order doesn't matter, FALSE when order is meaningful

### 7. File Organization

- Create subfolder: `/quiz/[chapter-name]/`
- Descriptive filenames: `[concept]_[aspect]_[difficulty].Rmd`
- One question per file

### 8. Review Checklist

For each question verify:
- Question makes sense and is clearly worded
- Solutions marked as correct are actually correct
- All correct solutions are marked
- Explanations use correct course terminology
- Numerical calculations are verified (run in R)
- `exsolution` metadata matches the given solutions exactly

### 9. Test and Verify

```r
library(exams)
questions <- list.files("[chapter-folder]", pattern = "\\.Rmd$", full.names = TRUE)
exams::exams2moodle(questions, n = 1, name = "test_quiz")
warnings()
```

Check: XML file created, no warnings, reasonable file size.

### 10. Clean Up and Render

Delete temporary files, then use the Makefile in `/quiz`:

```bash
make 04-lgs-quiz -B
```

## Output Summary

After creating questions, provide:

1. **Summary table**: filename, type, difficulty, brief description
2. **Coverage analysis**: concepts covered, difficulty distribution, type distribution
3. **Test results**: question count, export confirmation, warnings (should be none)

## Examples

See [references/examples.md](references/examples.md) for complete template questions — one per type
(num with parametrization, schoice conceptual, mchoice properties).

## Bundled Scaffolding

This skill includes ready-to-use infrastructure for the quiz directory.

### Setting up a new quiz directory

Copy these files into the quiz root (e.g., `quiz/`):

- [assets/Makefile](assets/Makefile) -- Auto-discovers chapter subdirs, renders to Moodle XML and HTML.
  Usage: `make 04-lgs-quiz -B`
- [assets/.gitignore](assets/.gitignore) -- Ignores generated output files.

### Scripts

- [scripts/test_rendering.R](scripts/test_rendering.R) -- Test all questions across all chapters.
  Run from quiz root: `Rscript test_rendering.R [moodle|html]`.
  Auto-discovers chapter directories matching `[0-9]+-*` pattern.
- [scripts/fix_latex_macros.sh](scripts/fix_latex_macros.sh) -- Batch-replace custom LaTeX macros
  (`\bx`, `\R`, etc.) with standard MathJax-compatible LaTeX in all .Rmd files.
  Run from quiz root: `bash fix_latex_macros.sh`

### Prerequisites

R packages: `exams` (CRAN). No other dependencies.

## Common Pitfalls

- Using custom LaTeX macros (always use standard LaTeX)
- Extra text after Answerlist (causes exsolution/solutionlist mismatch)
- Creating cloze questions (split into separate questions instead)
- Too many hard questions (keep most Easy/Medium)
- Missing parametrization (add randomization for calculations)
- Wrong exshuffle (use FALSE when order matters)
