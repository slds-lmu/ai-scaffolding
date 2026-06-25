# CRAN Extra Checks

Ad-hoc requirements CRAN reviewers enforce that `R CMD check` does not catch.
Work through systematically before submission.

Based on https://github.com/DavisVaughan/extrachecks and CRAN policies.

## Table of Contents

- [DESCRIPTION Title](#description-title)
- [DESCRIPTION Description Field](#description-description-field)
- [DESCRIPTION Other Fields](#description-other-fields)
- [Version Numbers](#version-numbers)
- [Authors and Copyright](#authors-and-copyright)
- [Function Documentation](#function-documentation)
- [Examples](#examples)
- [URLs and Links](#urls-and-links)
- [README](#readme)
- [Non-ASCII Characters](#non-ascii-characters)
- [Code Policies](#code-policies)
- [Files and Licensing](#files-and-licensing)
- [Common R CMD check NOTEs and Fixes](#common-r-cmd-check-notes-and-fixes)
- [Final Checklist](#final-checklist)

## DESCRIPTION Title

**Title Case required.** Use `tools::toTitleCase()` to verify.

**Remove redundant phrases:**
- "A Toolkit for" / "Tools for" / "for R" -- strip these

**Quote software/package names** in single quotes:
```
Title: Interface to 'Tiingo' Stock Price API
```

**Length**: under 65 characters.

```r
# BAD
Title: A Toolkit for the Construction of Modeling Packages for R
# GOOD
Title: Construct Modeling Packages
```

## DESCRIPTION Description Field

**Never start with:**
- "This package"
- The package name
- "Functions for"

**Length**: 3-4 sentences explaining purpose, utility, and problem domain.

**Quoting rules:**
- Software/package/API names (including 'R'): single quotes
- Function names: no quotes
- Publication titles only: double quotes

**Expand all acronyms** on first mention:
```r
# BAD
Description: Implements X-SAMPA processing.
# GOOD
Description: Implements Extended Speech Assessment Methods Phonetic
    Alphabet (X-SAMPA) processing.
```

**Citations** in author-year format with `<doi:10.prefix/suffix>` or
`<arXiv:...>` or `<https://...>`.

## DESCRIPTION Other Fields

Commonly missed fields and gotchas:

- **`BugReports`** — issue-tracker URL, feeds `utils::bug.report()`.
  `usethis::use_github_links()` fills this in.
- **`URL`** — whitespace/comma-separated list; project URL first, CRAN
  canonical URL or pkgdown site URL next.
- **`Encoding: UTF-8`** — required whenever any package file (DESCRIPTION,
  R/, NAMESPACE, man/) contains non-ASCII. Only `latin1` and `UTF-8` are
  portable. Omit unless needed.
- **`VignetteBuilder`** — when using RMarkdown vignettes, list BOTH
  `knitr, rmarkdown` (rmarkdown is only Suggested by knitr, so naming
  knitr alone leaves rmarkdown unavailable at check time). Common
  rejection cause.
- **`SystemRequirements`** — comma-separated with version constraints:
  `GNU make, C++17, Java (>= 11), libtiff-4 (>= 4.1.0)`. Declare the C++
  standard here (the per-package `CXX11`/`CXX14` Makevars macros are
  obsolete/removed).
- **`OS_type: unix`** or `windows` — restricts the platform the package
  runs on. Rarely appropriate.
- **`LazyData: true`** — makes `data/` objects available via `data()`
  without forcing load. Do NOT set if `data/` is empty (triggers a NOTE).
- **`Config/testthat/edition: 3`**, **`Config/testthat/parallel: true`**
  — edition 3 and parallel test execution.
- **`RoxygenNote`** — auto-maintained; don't hand-edit.
- **`Collate`** — only needed when S4 classes require specific file load
  order. `usethis::use_collate()` helps.

## Version Numbers

**Not decimal numbers.** Version ordering is component-wise:

```
0.9 < 0.75 < 0.100
```

because `9 < 75 < 100`. A very common trap when bumping `0.9` — the next
version must be `0.10` (or higher), not `0.91`.

- Format: `major.minor.patch` (three components preferred). A fourth
  component `.N` or `-N` is allowed for dev/patches.
- Dev suffix `.9000` is a convention (not enforced) for unreleased code.
- `R (>= x.y)` in Depends — do NOT pin patch level unless you need a
  specific patched fix (`R (>= 4.3)` not `R (>= 4.3.1)`).
- **NEWS.md** is parsed by CRAN (since R 3.4) when top-level headings
  match `# pkg 1.2.3`. No need for NEWS.Rd. Every submitted version needs
  an entry.

## Authors and Copyright

- `Authors@R` must include copyright holder: `role = c("aut", "cre", "cph")`
- For Posit-maintained packages, add:
  ```r
  person("Posit Software, PBC", role = c("cph", "fnd"),
         comment = c(ROR = "03wc8by49"))
  ```
- `LICENSE` file year must match current submission year
- ORCID via `comment = c(ORCID = "...")` in `person()`

## Function Documentation

### @return (strictly enforced)

Every exported function must have `@return`. No exceptions, including
`@keywords internal` functions.

```r
# Side-effect function
#' @return None, called for side effects.

# Normal function
#' @return A numeric vector of length \code{n}.
```

### @examples

Required for all exported functions with meaningful return values.

**Un-exported functions with examples** must use either:
- `pkg:::my_fun()` notation in examples, or
- `@noRd` to suppress .Rd file creation

## Examples

### Avoid \dontrun{}

Only valid when example truly cannot run (missing external software, API keys).

| Situation | Use instead |
|-----------|-------------|
| Expected error | `try()` |
| Slow example (>5s) | `\donttest{}` |
| Interactive-only | `if (interactive()) {}` |
| Needs suggested pkg | `@examplesIf rlang::is_installed("pkg")` |
| Needs auth/token | Custom predicate in `if()` |

### No commented-out code

```r
# BAD - will be rejected
#' @examples
#' # my_function(x)

# GOOD
#' @examples
#' my_function(1:10)
```

### Guarding with suggested packages

```r
# Entire example section
#' @examplesIf rlang::is_installed("dplyr")
#' library(dplyr)
#' my_data |> my_function()

# Individual block within examples
#' @examples
#' if (rlang::is_installed("dplyr")) {
#'   library(dplyr)
#'   my_data |> my_function()
#' }
```

## URLs and Links

```r
urlchecker::url_check()    # find problems
urlchecker::url_update()   # auto-fix redirects
```

- All URLs must use `https://`
- No redirecting URLs (except aspirational CRAN badges for new packages)
- Aspirational URLs to leave alone: CRAN badges, r-pkg.org badges,
  cranchecks.info URLs, package doc URLs that deploy after release

### Invalid file URIs

Relative links in README to files excluded by `.Rbuildignore` cause NOTEs:
```
Found the following (possibly) invalid file URI:
     URI: CODE_OF_CONDUCT.md
```

Fix: use `usethis::use_code_of_conduct()` (generates inline content) or
remove the link.

## README

- If `README.Rmd` exists, **only edit that file**, then run
  `devtools::build_readme()` to regenerate `README.md`
- Include `install.packages("pkgname")` instructions
- No relative links to `.Rbuildignore`d files
- All links must be full URLs (not relative paths)

## Non-ASCII Characters

**Critical**: CRAN's R-devel pretest builds the PDF manual with a LaTeX
toolchain that does not handle arbitrary Unicode. Non-ASCII characters in
roxygen comments (em-dashes `---`, tensor product `\u2297`, approx-equal
`\u2248`, smart quotes, etc.) cause fatal LaTeX errors when building the
PDF manual. This issue **passes `R CMD check` locally** (which builds HTML
help, not PDF) but **fails on CRAN's infrastructure**.

### Detection

```bash
# Must return empty -- any output means non-ASCII exists
grep -rPn '[^\x00-\x7F]' R/ vignettes/
```

Run this **before** `devtools::document()` so regenerated `.Rd` files are
also clean. Vignette `.Rnw`/`.Rtex` sources are also processed by LaTeX
and fail on the same characters.

### Common Offenders and Fixes

| Character | Name | Replacement |
|-----------|------|-------------|
| `\u2014` (--) | em-dash | `--` |
| `\u2013` (-) | en-dash | `-` |
| `\u2248` | approx-equal | `~` or `approx` |
| `\u2297` | tensor product | `x` or `\eqn{\otimes}` in Rd math |
| `\u2018`/`\u2019` | smart single quotes | `'` |
| `\u201c`/`\u201d` | smart double quotes | `"` |
| `\u2026` | ellipsis | `...` |

For mathematical symbols in roxygen, use `\eqn{}` LaTeX notation instead
of Unicode: `\eqn{A \otimes B}` rather than `A \u2297 B`.

## Code Policies

| Rule | Fix |
|------|-----|
| No `T`/`F` | `TRUE`/`FALSE` |
| No `options(warn = -1)` | `suppressWarnings()` |
| No `installed.packages()` | `requireNamespace()` |
| No `.Internal()` | Use public API |
| No `:::` to *other packages'* internals | Use `::` or ask maintainer to export |
| No `set.seed()` without user control | Add `seed` parameter |
| No `q()` in R code; no `assert`/`abort`/`exit`/`STOP` in C/C++/Fortran | Return with a condition |
| No writing to user dirs (incl. clipboard, `~`, `.Rprofile`) | `tempdir()` or `tools::R_user_dir()` with user opt-in |
| No `.GlobalEnv` mutation, no persistent `Sys.setenv`, no `<<-` across namespace | Package-scoped `new.env(parent=emptyenv())` |
| Max 2 cores in examples/tests/vignettes (incl. BLAS, OpenMP, data.table threads) | Check parallel code |
| Restore `par()`/`options()`/`setwd()` | `on.exit()` |
| `print()`/`cat()` must be suppressible | Use `message()` or `verbose` param |
| `.onAttach` uses `packageStartupMessage()` only | Never `cat`/`print`/`message` |
| Internet access must fail gracefully | `tryCatch()` with informative `message()`, not `stop()` |
| HTTPS only; handle HTTP 429/403 | Back off; no retry storms |
| No binary executables in sources | Ship sources only |
| Don't launch external apps (browsers, PDF viewers) without closing them | Gate on `interactive()` |
| No sending data to third parties without user consent | Explicit opt-in |
| Don't disable stack-checking, compiler diagnostics, or strip symbols | Leave defaults |
| No tampering with base/recommended packages | Don't modify stats/utils/... |

## Files and Licensing

- Data + docs max 5 MB each; source tarball preferably < 10 MB
- All bundled third-party files must have compatible licenses
- Only include `+ file LICENSE` when needed (MIT/BSD require it)
- Preserve original copyright notices on derived code

## Common R CMD check NOTEs and Fixes

### `no visible binding for global variable 'x'`

Caused by non-standard evaluation (dplyr, data.table, ggplot2). Two fixes:

```r
# Option 1: declare in zzz.R
utils::globalVariables(c("x", "y", "group_col"))

# Option 2: use the rlang .data pronoun (best for dplyr/ggplot2)
#' @importFrom rlang .data
my_fun <- function(df) dplyr::filter(df, .data$x > 0)
```

For data.table: also declare column names through `globalVariables()`, or
use `..var` / `.SD` / `get("var")` idioms.

### `no visible global function definition for 'fn'`

Missing `@importFrom pkg fn` or forgot to re-run `devtools::document()`
after adding imports. Always `document()` before `check()`.

### `Package suggested but not available for checking`

A Suggests package is referenced unconditionally somewhere. Wrap uses in
`requireNamespace()` / `@examplesIf` / `skip_if_not_installed()`. Verify
with `_R_CHECK_FORCE_SUGGESTS_=false`.

### `Found the following assignments to the global environment`

You have `<<-` or `assign(..., envir = .GlobalEnv)` in package code.
Replace with a package-local environment:

```r
.pkg_cache <- new.env(parent = emptyenv())
```

### `Unexported objects imported by ':::' calls`

`pkg:::internal` from another package is forbidden in CRAN submissions.
Ask the upstream maintainer to export, vendor the function, or find
another approach.

### `Unstated dependencies in examples/tests/vignettes`

A package is used in examples/tests/vignettes but missing from Suggests
(or Imports). Add it; CRAN's incoming queue checks with Suggests installed.

### `LazyData is specified without a lazy data database`

Package has `LazyData: true` but no `data/` directory (or empty one).
Remove the line.

### `Found no call to: 'R_registerRoutines'` / `'R_useDynamicSymbols'`

Compiled code lacks native routine registration. Generate a skeleton:

```r
tools::package_native_routine_registration_skeleton(".")
```

Then include `R_useDynamicSymbols(dll, FALSE)` in `src/init.c`. Rcpp
auto-generates this via `RcppExports.cpp`.

### `Found the following (possibly) invalid file URI`

Relative link in README points to a file excluded by `.Rbuildignore`
(CODE_OF_CONDUCT.md, CONTRIBUTING.md, etc.). Fix by inlining the content
or removing the link.

### `S3 methods shown with full name in documentation`

Multiple methods each generate a separate Rd page. Merge with `@rdname`
or `@describeIn`:

```r
#' @describeIn plot Plot method for `tfd` objects
#' @export
plot.tfd <- function(x, ...) { ... }
```

## Final Checklist

### Files and Structure
- [ ] `NEWS.md` documents this version's changes
- [ ] `cran-comments.md` exists with check results
- [ ] README has `install.packages()` instructions
- [ ] README has no relative links to `.Rbuildignore`d files
- [ ] If `README.Rmd` exists, it was edited and `devtools::build_readme()` was run

### DESCRIPTION
- [ ] Title: Title Case, < 65 chars, no redundant phrases, quoted software names
- [ ] Description: 3-4 sentences, proper start, expanded acronyms, correct quoting
- [ ] `Authors@R` includes `[cph]` role
- [ ] LICENSE year is current

### Documentation
- [ ] All exported functions have `@return`
- [ ] All exported functions with meaningful returns have `@examples`
- [ ] No commented-out example code
- [ ] No gratuitous `\dontrun{}`
- [ ] Suggested package examples guarded with `@examplesIf`

### URLs
- [ ] `urlchecker::url_check()` clean
- [ ] All HTTPS, no redirects (except aspirational CRAN URLs)

### Code
- [ ] No `T`/`F`, no `options(warn = -1)`, no `installed.packages()`
- [ ] `par()`/`options()`/`setwd()` restored via `on.exit()`
- [ ] Max 2 cores in examples/tests/vignettes
- [ ] Network access fails gracefully
