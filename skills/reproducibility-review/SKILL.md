---
name: reproducibility-review
description: |
  Review code and data supplements of scientific papers for computational reproducibility. Use when asked to: review a code supplement, check if a paper's code is reproducible, audit a simulation study, evaluate a scientific paper's data and code, or assess computational reproducibility. Actively executes code (fixing minor issues), runs reduced simulations, and compares outputs against reported results. Outputs a structured markdown review document.
---

# Reproducibility Review

Review code and data supplements for computational reproducibility. Actively execute code, fix minor issues, run reduced simulations, and verify results match the paper.

## Workflow

### 1. Read the Paper

Start by reading the paper PDF (and supplement PDF if provided):
- Understand what analyses/simulations were performed
- Catalog all figures, tables, and numerical results to reproduce
- Note computational methods, sample sizes, iterations, parameters
- Understand the scientific claims being made

### 2. Examine Supplement Structure

Assess the code supplement:
```
- List all files and folder structure
- Identify README and documentation
- Locate main/master scripts vs. helper functions
- Identify data files, code files, output files
- Note programming languages used
```

### 3. Fetch External Code Dependencies

If the paper or supplement references external code repositories (GitHub, GitLab, Bitbucket, Zenodo, etc.), **attempt to clone or download them** before proceeding:

- Scan the paper, README, and code files for URLs pointing to repositories or archives
- For GitHub/GitLab repos: `git clone` the repository into a subdirectory of the working folder (e.g., `external/repo-name/`)
- For Zenodo/Figshare/archive URLs: download and extract
- For R packages on GitHub: install via `remotes::install_github()` or `pak::pak()`
- For Python packages on GitHub: install via `uv pip install git+https://...`
- If a specific commit, tag, or release is referenced, check that out
- If the repo is private or unavailable, document this as a finding (not a failure of the supplement)

**Rationale:** Many papers split code across the supplement and external repositories. The supplement is the primary unit of review, but easily accessible external code (public repos, archived releases) should be fetched and included in the review scope. Only flag "missing code" for components that are truly inaccessible.

**Document:** which external dependencies were fetched, from where, and which version/commit.

### 4. Environment Setup

Install dependencies flexibly:
- Parse README for stated requirements
- For R: install packages from `library()`/`require()` calls
- For Python: install from `requirements.txt` or `import` statements. Always use `uv`.
- For Julia, MATLAB, Stata, etc.: follow documented setup
- Document all packages installed and versions

### 5. Execute Code with Fixes

Run all code, fixing minor issues as needed:

**Apply these fixes:**
- Wrong file paths → adjust to actual structure
- Missing imports → add required imports
- Path case sensitivity → fix capitalization
- Deprecated functions → update to current equivalents
- Minor syntax errors → correct obvious typos
- Working directory issues → set appropriately

**Document every fix** — these become review items.

### 6. Run Reduced Simulations

**For simulation studies**: Invoke the `setup-benchmark` skill (via the Skill tool) before running reduced simulations. This gives you domain knowledge to evaluate whether the simulation design is sound (well-specified and misspecified DGPs, factorial design, coverage diagnostics, Monte Carlo SEs, practical significance thresholds) and to make informed decisions about what to reduce without destroying the study's ability to support its conclusions.

For computationally intensive code, create reduced versions targeting < 1 hour runtime:

**Reduction strategies:**
- Monte Carlo replications: 1000 → 50-100
- Sample sizes: reduce if studying asymptotics
- Parameter grid: keep boundaries + middle, drop dense interior
- CV folds: 10 → 3-5
- Bootstrap iterations: reduce proportionally

**Verify qualitative consistency:**
- Do method rankings hold?
- Are key patterns preserved?
- Do conclusions remain supported?

**For unavoidably long computations:**
1. Write a setup script for the reduced run
2. Create handoff document: what's done, what's running, what remains
3. Ask user to run script and resume session with handoff
4. Or: launch subagents to run different settings in parallel while continuing review

### 7. Verify Results

Compare generated outputs to paper:
- Figures: visual/qualitative match
- Tables: values match within rounding
- Text results: numerical claims verified
- Reduced runs: patterns consistent with full results

### 8. Generate Review

Output markdown using template in `assets/review-template.md`.

**Severity levels:**
- **Critical**: Blocks reproduction (missing code/data, crashes, fundamentally wrong results)
- **Major**: Significantly impedes reproduction (missing docs, manual steps needed, partial failures)
- **Minor**: Does not block reproduction (style issues, missing but inferable info)
- **Suggestions**: Best practices not followed

## Principles

**Fix before complaining** — If fixable in 30 seconds, fix it and note as minor issue.

**Verify, don't trust** — Run the code. Check outputs. Compare to paper.

**Be constructive** — Goal is helping authors improve their supplement.

**Document thoroughly** — Another reviewer should understand exactly what you did.

**Qualitative over exact** — For reduced runs, patterns and rankings matter more than exact numbers.

## References

- `references/checklist.md` — Complete checklist for documentation, completeness, organization, quality, reproducibility
- `assets/review-template.md` — Output template for the review document
