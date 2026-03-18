# CRAN Extra Checks

Ad-hoc requirements CRAN reviewers enforce that `R CMD check` does not catch.
Work through systematically before submission.

Based on https://github.com/DavisVaughan/extrachecks and CRAN policies.

## Table of Contents

- [DESCRIPTION Title](#description-title)
- [DESCRIPTION Description Field](#description-description-field)
- [Authors and Copyright](#authors-and-copyright)
- [Function Documentation](#function-documentation)
- [Examples](#examples)
- [URLs and Links](#urls-and-links)
- [README](#readme)
- [Code Policies](#code-policies)
- [Files and Licensing](#files-and-licensing)
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

## Code Policies

| Rule | Fix |
|------|-----|
| No `T`/`F` | `TRUE`/`FALSE` |
| No `options(warn = -1)` | `suppressWarnings()` |
| No `installed.packages()` | `requireNamespace()` |
| No `.Internal()` | Use public API |
| No `:::` to base undocumented objects | Find alternative |
| No `set.seed()` without user control | Add `seed` parameter |
| No `q()` in R code | Remove |
| No writing to user dirs | `tempdir()` or `tools::R_user_dir()` with consent |
| Max 2 cores in examples/tests/vignettes | Check parallel code |
| Restore `par()`/`options()`/`setwd()` | `on.exit()` |
| `print()`/`cat()` must be suppressible | Use `message()` or `verbose` param |
| Internet access must fail gracefully | `tryCatch()` with informative message |
| Handle HTTP 429/403 | Retry logic or graceful degradation |

## Files and Licensing

- Data + docs max 5 MB each; source tarball preferably < 10 MB
- All bundled third-party files must have compatible licenses
- Only include `+ file LICENSE` when needed (MIT/BSD require it)
- Preserve original copyright notices on derived code

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
