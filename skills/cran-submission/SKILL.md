---
name: cran-submission
description: >
  Finalize R packages for CRAN submission. Use when the user wants to: submit a
  package to CRAN, prepare for CRAN release, run pre-submission checks, do
  reverse dependency checks (revdep), run cross-platform checks via rhub,
  verify pkgdown builds, review CRAN policies compliance, or says
  "/cran-submission". Covers the full workflow from pre-flight checks through
  submission and post-acceptance steps. Complements r-package-coding (development)
  with release-specific procedures.
---

# CRAN Submission

End-to-end workflow for preparing and submitting an R package to CRAN.

## Workflow Overview

1. **Pre-flight**: Verify version, NEWS, cran-comments.md, git state
2. **Local checks**: `R CMD check --as-cran` with current R-devel
3. **Extra checks**: CRAN-specific requirements `devtools::check()` misses
4. **pkgdown**: Verify site builds (if present)
5. **Cross-platform checks**: rhub / win-builder
6. **Reverse dependency checks**: revdepcheck (updates only)
7. **Update cran-comments.md**: Summarize results
8. **Submit**: `devtools::submit_cran()`
9. **Post-acceptance**: Tag release, bump dev version

Adapt based on context: first submission vs update, patch vs minor/major.

## Parallelization Strategy

**Most steps are independent and MUST run concurrently.** After pre-flight
(Step 1), launch as many steps as possible in parallel:

### Parallel group A (launch simultaneously after Step 1)
- **Step 2** (local check): Run via background Agent (`Bash` with
  `run_in_background: true`): `Rscript -e 'devtools::check(remote=TRUE, manual=TRUE)'`
- **Step 4** (pkgdown): Run via background Agent if pkgdown is present:
  `Rscript -e 'pkgdown::build_site()'`
- **Step 5** (rhub): Kick off `rhub::rhub_check()` -- runs remotely on GitHub
  Actions, results arrive asynchronously. Also `devtools::check_win_devel()`.
- **Step 6** (revdep): Run via background Agent (long-running):
  `Rscript -e 'revdepcheck::revdep_check(num_workers=4)'`

### Sequential / main thread
- **Step 3** (extra checks): Do this yourself in the main thread while the
  background checks run -- review DESCRIPTION, documentation, URLs, code
  policies. This is the part that benefits from agent reasoning.
- **Step 7** (cran-comments.md): Collect results from all parallel steps,
  then write.
- **Steps 8-9**: Sequential, after everything passes.

### Implementation pattern
```
# In a single message, launch all background work:
Agent(prompt="Run devtools::check(remote=TRUE, manual=TRUE) in R...",
      run_in_background=true)
Agent(prompt="Run pkgdown::build_site() in R...",
      run_in_background=true)
Agent(prompt="Run revdepcheck::revdep_check(num_workers=4) in R...",
      run_in_background=true)
Bash(command="Rscript -e 'rhub::rhub_check(...)'",
     run_in_background=true)
Bash(command="Rscript -e 'devtools::check_win_devel()'",
     run_in_background=true)
# Then proceed with Step 3 (extra checks) in the main thread.
# When background tasks complete, collect results for Step 7.
```

Do NOT serialize these steps. The whole point is that `devtools::check` takes
minutes, `revdep_check` takes hours, and rhub/win-builder are remote -- use
that time for the manual review work in Step 3.

## Step 1: Pre-Flight

```r
# Ensure clean git state
# git status -- no uncommitted changes

# Verify version bump
desc::desc_get_version()

# Create/update required files
usethis::use_news_md()          # if missing
usethis::use_cran_comments()    # if missing

# Optional: generate GitHub release checklist
usethis::use_release_issue()
```

Check that:
- `NEWS.md` documents all user-visible changes for this version
- `LICENSE` year matches current year
- `.Rbuildignore` is up to date
- No dev-only files leak into the tarball

## Step 2: Local Checks

**Run in background Agent** -- do not wait; proceed to Step 3.

```r
devtools::check(remote = TRUE, manual = TRUE)
```

Must pass with **0 errors, 0 warnings, 0 notes** (or notes explained in
cran-comments.md). Test against R-devel when possible.

## Step 3: CRAN Extra Checks (main thread)

Do this in the main thread while background checks run. These are ad-hoc
requirements CRAN reviewers enforce but `R CMD check` does not catch. See [references/cran-extrachecks.md](references/cran-extrachecks.md)
for the full checklist. Key areas:

### DESCRIPTION
- **Title**: Title Case, < 65 chars, no "for R"/"A Toolkit for", software names
  in single quotes. Use `tools::toTitleCase()`.
- **Description**: 3-4 sentences, never starts with "This package"/pkg name,
  expand all acronyms, software names in single quotes, function names unquoted.
- **Authors@R**: Must include `[cph]` role.
- **License year**: Must match submission year.

### Documentation
- Every exported function needs `@return` (even `@keywords internal`).
- Every exported function with meaningful return needs `@examples`.
- No commented-out example code. No gratuitous `\dontrun{}`.
- Guard examples needing suggested packages with `@examplesIf`.

### README
- If `README.Rmd` exists, edit that (not `.md`) then `devtools::build_readme()`.
- Include `install.packages("pkg")` instructions.
- No relative links to `.Rbuildignore`d files.

### URLs
```r
urlchecker::url_check()    # find problems
urlchecker::url_update()   # fix redirects
```
All URLs must be HTTPS, no redirects. Leave aspirational CRAN badge URLs as-is.

### Code Policies
- No `T`/`F` -- use `TRUE`/`FALSE`
- No `options(warn = -1)` -- use `suppressWarnings()`
- No `installed.packages()` -- use `requireNamespace()`
- Restore `par()`, `options()`, `setwd()` via `on.exit()`
- Never write outside `tempdir()` (except `tools::R_user_dir()` with consent)
- Max 2 cores in examples/tests/vignettes
- Handle network failures gracefully with informative messages

## Step 4: pkgdown Verification

**Run in background Agent.** Skip if the package has no pkgdown site. Otherwise:

```r
# Validate configuration
pkgdown::check_pkgdown()

# Full site build (the real test)
pkgdown::build_site()
```

Common issues:
- `url` in `_pkgdown.yml` must match `URL` in DESCRIPTION
- All exported functions must appear in a custom reference index
- All vignettes must appear in a custom articles index
- Examples that error will break the build

## Step 5: Cross-Platform Checks (rhub)

**Fire-and-forget** -- these run remotely. Launch via background Bash, then
move on. Results arrive asynchronously (GitHub Actions / email).

### R-hub v2 (GitHub Actions based)

```r
# One-time setup (creates .github/workflows/rhub.yaml)
rhub::rhub_setup()
# Then commit and push the workflow file

# Verify setup
rhub::rhub_doctor()

# List available platforms
rhub::rhub_platforms()

# Run checks (interactive platform selection)
rhub::rhub_check()
```

**Recommended platforms for CRAN submission:**
- `linux` -- Ubuntu latest
- `macos-arm64` -- macOS ARM
- `windows` -- Windows latest
- `nosuggests` -- without Suggested packages (catches unguarded imports)
- `clang-asan` -- address sanitizer (for compiled code)
- `valgrind` -- memory checker (for compiled code)

### Win-builder (alternative for Windows)

```r
devtools::check_win_devel()    # R-devel on Windows
devtools::check_win_release()  # R-release on Windows
```

Results arrive by email. These are the same machines CRAN uses.

### R Consortium runners (no GitHub needed)

```r
rhub::rc_new_token()   # one-time per email
rhub::rc_submit()      # submit checks
```

## Step 6: Reverse Dependency Checks

**Run in background Agent** (can take hours). **Skip for first submissions.**
Required for updates, especially if the API changed.

```r
# One-time setup
usethis::use_revdep()  # creates revdep/ directory

# Run checks (safe to interrupt and resume)
revdepcheck::revdep_check(num_workers = 4)

# In a SEPARATE R session, monitor progress:
revdepcheck::revdep_summary()

# Generate reports when done
revdepcheck::revdep_report()
# Creates: revdep/README.md, revdep/problems.md, revdep/failures.md
```

### Interpreting Results

| Flag | Meaning |
|------|---------|
| `+`  | No new failures |
| `-`  | New failures introduced |
| `i-` | Installation newly fails |
| `t-` | Newly times out |
| `i+`/`t+` | Pre-existing issue (not your fault) |

### If Revdeps Break

1. Determine if breakage is a false positive, pre-existing, or real
2. For real breakage from intentional API changes:
   - Contact affected maintainers **at least 2 weeks** before submission
   - Provide patches or PRs where possible
3. Document everything in `cran-comments.md`

### Custom revdep additions

Implement an unexported `release_extra_revdeps()` in the package to include
additional packages beyond the auto-detected set.

## Step 7: Update cran-comments.md

**Barrier step** -- wait for all background Agents and remote checks to
complete before writing. Collect and summarize all results here.

Template:

```markdown
## R CMD check results

0 errors | 0 warnings | 0 notes

## Test environments

- local: [OS], R x.y.z
- GitHub Actions: ubuntu-latest (R-devel, release, oldrel-1),
  macOS-latest (release), windows-latest (release)
- R-hub: [platforms tested]
- win-builder: R-devel

## Reverse dependencies

Checked X reverse dependencies. No new issues found.

(Or: Y packages showed new failures. Details in revdep/cran.md.
Affected maintainers were notified on YYYY-MM-DD.)
```

For resubmissions, add a section explaining how previous feedback was addressed.

## Step 8: Submit

```r
# Bump version (removes .9000 dev suffix)
usethis::use_version("minor")  # or "major" / "patch"

# Submit
devtools::submit_cran()
```

- Confirm via email link (mandatory)
- Check status: https://CRAN.R-project.org/incoming/
- Do not resubmit while a version is pending
- If resubmitting: increment version number and explain changes

## Step 9: Post-Acceptance

```r
usethis::use_github_release()     # tag + GitHub release
usethis::use_dev_version(push = TRUE)  # bump to x.y.z.9000
```

Also:
- Close the release milestone on GitHub
- Publish blog post / changelog announcement if applicable

## Quick Reference

| Function | Purpose |
|----------|---------|
| `usethis::use_release_issue()` | GitHub checklist issue |
| `usethis::use_version()` | Bump version |
| `devtools::check(remote=TRUE, manual=TRUE)` | Full local check |
| `devtools::submit_cran()` | Submit to CRAN |
| `devtools::build_readme()` | Re-render README |
| `urlchecker::url_check()` | Find URL problems |
| `tools::toTitleCase()` | Format DESCRIPTION Title |
| `pkgdown::check_pkgdown()` | Validate pkgdown config |
| `rhub::rhub_check()` | Cross-platform checks |
| `revdepcheck::revdep_check()` | Reverse dep checks |
| `devtools::check_win_devel()` | Win-builder check |
