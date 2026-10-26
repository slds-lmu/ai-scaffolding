---
name: r-package-coding
description: >
  R package development standards covering naming, pure functions, S3 design,
  checkmate/cli/purrr/vctrs, roxygen2 (incl. @examplesIf vs \donttest), testthat v3,
  Depends/Imports/Suggests discipline, and the format → document → check → pkgdown
  pre-commit workflow. Use whenever you write, refactor, test, document, or review code
  inside an R package (anything with a DESCRIPTION file), even if the user only says
  "add a function to the package", "fix this test", or "the check is failing". Not for
  standalone scripts or analyses (use r-scripting); for release work use cran-submission.
---

# R Package Development

Standards for R package development with minimal dependencies.

## Dependencies

**Preferred packages** (must earn their place):
- `checkmate` - input validation
- `cli` - user messaging
- `purrr` - functional patterns
- `vctrs` - vector classes

Avoid tidyverse in core packages.

### Depends / Imports / Suggests / Enhances

A package appears in exactly **one** field. Decision rules:

- **Imports**: default for required namespaces. Access with `::` or `@importFrom`.
  Never `library()`/`require()` inside package code.
- **Depends**: only when the user needs the package *attached* to the search path
  when calling yours. Almost always wrong — prefer Imports.
- **Suggests**: optional — used only in examples, tests, vignettes, or code paths
  gated by `requireNamespace()`. Package must function without them.
- **Enhances**: methods for another package's classes, accessed via `::`.
- **LinkingTo**: C/C++ headers only. Do NOT also list in Depends/Imports.

### Suggests discipline

Every use of a Suggested package must be guarded. If a package appears in
Suggests but you find an unguarded `::` call or `@importFrom` pointing to it,
either gate the call or move the package to Imports.

```r
# R code
if (!requireNamespace("pkg", quietly = TRUE)) {
  cli::cli_abort("Install {.pkg pkg} to use this feature.")
}
pkg::do_thing()

# Tests
skip_if_not_installed("pkg")

# Vignette chunks
#| eval: !expr requireNamespace("pkg", quietly = TRUE)

# Roxygen examples — prefer @examplesIf over \dontrun
#' @examplesIf requireNamespace("pkg", quietly = TRUE)
```

Verify discipline with `_R_CHECK_DEPENDS_ONLY_=true` (installs only hard deps)
and `_R_CHECK_FORCE_SUGGESTS_=false` (simulates missing Suggests).

## Design Principles

- **Top-down design**: Design before coding; decompose problems into subtasks, then implement
- **DRY**: One authoritative location for each piece of logic—changes propagate automatically
- **Single responsibility**: Each function does one thing well

## Naming Conventions

**Functions**: `snake_case` with consistent prefixes
```r
# Good: tf_smooth_data(), tf_derive(), tf_integrate()
# Bad: tfSmoothData(), calculate.metrics()
```

**S3 methods**: `generic.class` (e.g., `plot.tf`, `smooth.tfd`)

**Variables**: Descriptive, plurals for collections (`evaluations`, `arg_values`)

## Function Design

### Standard Structure
```r
my_function <- function(data, arg = NULL, verbose = TRUE) {
  # 1. Validate at entry
  assert_numeric(data)
  
  # 2. Set defaults
  arg <- arg %||% seq_along(data)
  
  # 3. Main logic
  result <- process(data, arg)
  
  # 4. Return
  result
}
```

### Pure Functions (Critical)

**All inputs must be explicit arguments—no globals, no hidden dependencies.**

```r
# BAD: Uses global
threshold <- 0.05
filter_sig <- function(data) filter(data, p < threshold)

# GOOD: Explicit
filter_sig <- function(data, threshold = 0.05) filter(data, p < threshold)
```

### Style Rules
- Native pipe `|>` (not `%>%`)
- Lambda `\(x)` (not `function(x)`)
- Required args first, optional with defaults after
- Functions around 50 lines and cyclomatic complexity below ~10 are heuristics,
  not limits: a 70-line function that is one linear computation is fine, a
  30-line function with five nested branches is not. When you exceed them, ask
  whether a subtask has a name; if it does, extract it.
- Run `air format .` after every major edit, not just before commit; the
  pre-commit hook rejects unformatted code, so formatting late costs a cycle.

### Long Parameter Lists

Group related arguments into control objects:

```r
# BAD: Too many arguments
fit_model <- function(data, method, tol, max_iter, verbose, trace, ...) { }

# GOOD: Group into control object
fit_model <- function(data, method, control = list(tol = 1e-6, max_iter = 100)) {
  control <- modifyList(list(tol = 1e-6, max_iter = 100), control)
  # Use control$tol, control$max_iter
}
```

## S3 Objects

```r
# Low-level constructor (no validation)
new_my_class <- function(data, meta) {
  structure(data, meta = meta, class = "my_class")
}

# User-facing (with validation)
my_class <- function(data, ...) {
  assert_numeric(data)
  new_my_class(data, process_meta(...))
}

# Method dispatch
my_generic <- function(x, ...) UseMethod("my_generic")
my_generic.default <- function(x, ...) .NotYetImplemented()
my_generic.my_class <- function(x, ...) { ... }
```

Use `vctrs` for vector-like classes; implement `vec_ptype2()` and `vec_cast()`.

### Prefer S3 Dispatch Over Type-Checking

Replace if-else chains with S3 methods:

```r
# BAD: if-else chain on type
process <- function(x) {
  if (is.character(x)) {
    # handle character...
  } else if (is.numeric(x)) {
    # handle numeric...
  } else if (is.list(x)) {
    # handle list...
  }
}

# GOOD: S3 dispatch
process <- function(x) UseMethod("process")
process.character <- function(x) { ... }
process.numeric <- function(x) { ... }
process.list <- function(x) { ... }
process.default <- function(x) cli::cli_abort("Unsupported type: {.cls {class(x)}}")
```

Benefits: extensible, clearer, each method is self-contained.

## Validation & Messaging

### checkmate at Boundaries
```r
assert_numeric(x, any.missing = FALSE, finite = TRUE)
assert_character(names, min.len = 1, unique = TRUE)
assert_choice(method, c("linear", "spline"))
assert_count(order, positive = TRUE)
```

### cli for Messages
```r
cli::cli_abort(c(
  "Problem description",
  "i" = "How to fix it"
))

cli::cli_warn("!" = "Something unexpected")
cli::cli_inform("i" = "Using default {.code k = {k}}")
```

**Formatting**: `{.arg x}`, `{.fn func}`, `{.cls class}`, `{.val value}`

## Documentation (roxygen2)

```r
#' One-line description (imperative voice)
#'
#' Longer description with details.
#'
#' @param x Type and constraints.
#' @param ... Passed to [other_function()].
#' @returns Type and structure.
#' @family group_name
#' @export
#' @examples
#' result <- my_function(1:10)
```

Cross-reference with `[function_name()]`. Document *why*, not just *what*.

### Conditional examples

Four forms with distinct semantics — pick the right one:

| Tag | Runs during `R CMD check`? | Runs on CRAN pretest? | When to use |
|-----|---------|-----------|-------------|
| (bare) | yes | yes | default |
| `\donttest{}` | not by default; yes with `--run-donttest` | **yes** (CRAN runs donttest) | slow but correct (>5s) |
| `@examplesIf cond` | only if `cond` is `TRUE` | only if `cond` is `TRUE` | needs suggested pkg, network, etc. |
| `\dontrun{}` | **never** | never | cannot run in CI (interactive GUI, needs credentials, writes user files) |

`\dontrun{}` is heavily over-used and CRAN reviewers routinely push back on it.
Default to `\donttest{}` or `@examplesIf` — these preserve checkable coverage.

```r
#' @examplesIf rlang::is_installed("dplyr")
#' library(dplyr)
#' my_data |> my_fun()
```

Mathematical notation: use `\eqn{LaTeX}{ASCII}` two-arg form — the second arg
is the plain-text fallback shown in the terminal help viewer, avoiding
non-ASCII issues:

```r
#' @param x A value such that \eqn{x \otimes y}{x (x) y} holds.
```

## Functional Patterns (purrr)

```r
# Typed outputs
results <- map(data, compute)
means <- map_dbl(data, mean, na.rm = TRUE)

# Multiple inputs
combined <- map2(x, y, \(a, b) a + b)
results <- pmap(list(x, y, z), \(a, b, c) a + b * c)

# Error handling
safe_fn <- possibly(risky_fn, otherwise = NA)
valid <- keep(items, is_valid)
```

Extract complex lambdas into named helpers.

## Testing (testthat v3)

### Basic Structure
```r
test_that("descriptive name", {
  # Arrange - ALL setup inside test_that()
  set.seed(42)  # Reproducibility INSIDE each test
  input <- setup_data()

  # Act
  result <- my_function(input)

  # Assert - verify behavior, not just types
  expect_equal(result, expected)
  expect_error(my_function(bad), "pattern")
})
```

### Critical Rules

**1. Isolation**: Each `test_that()` must be self-contained
```r
# BAD: Global state creates hidden coupling
set.seed(123)
global_data <- generate_data()

test_that("test 1", { ... uses global_data ... })
test_that("test 2", { ... uses global_data ... })

# GOOD: Each test is independent
test_that("test 1", {
  set.seed(123)
  data <- generate_data()
  ...
})
```

**2. Behavioral assertions, not just smoke tests**
```r
# BAD: Only checks types (smoke test)
expect_s3_class(result, "my_class")
expect_true(is.list(output))

# GOOD: Verifies actual behavior
expect_equal(dim(result), c(n, p))
expect_equal(result$coefficients, expected_coefs, tolerance = 1e-6)
expect_gt(cor(fitted, true_values), 0.95)
```

**3. Guard against edge cases**
```r
# BAD: Division can blow up
expect_lt(max(abs((a - b) / a)), 0.05)

# GOOD: Safe comparison
expect_lt(max(abs(a - b)), 0.05 * max(abs(a)) + 1e-10)
# Or use relative tolerance in expect_equal:
expect_equal(a, b, tolerance = 0.05)
```

**4. Verify structure, not just existence**
```r
# BAD: Doesn't verify contents
expect_true("truth" %in% names(attributes(result)))

# GOOD: Verifies structure and dimensions
truth <- attr(result, "truth")
expect_true(is.list(truth))
expect_named(truth, c("eta", "etaTerms", "beta", "epsilon"))
expect_equal(dim(truth$eta), c(n, n_grid))
```

**5. Test invariants and relationships**
```r
# Test that term predictions sum to response prediction
pred_terms <- predict(model, type = "terms")
pred_response <- predict(model, type = "response")
term_sum <- Reduce(`+`, pred_terms) + attr(pred_terms, "constant")
expect_equal(term_sum, pred_response, tolerance = 1e-6)
```

### Skipping tests

CRAN runs tests under tight time budgets and without internet. Gate anything
slow, non-deterministic, or environment-dependent:

```r
test_that("fits on real data", {
  skip_on_cran()               # slow / heavy / uses resources CRAN won't have
  skip_if_offline()            # needs network
  skip_if_not_installed("pkg") # needs a Suggests
  skip_on_os("windows")        # platform-specific
  # ...
})
```

Set random seeds inside each test; they are never set automatically.

`devtools::test()` sets `NOT_CRAN=true`; a bare `Rscript -e 'testthat::test_file(...)'`
does not, so `skip_on_cran()` tests silently skip there — set
`Sys.setenv(NOT_CRAN = "true")` first when reproducing a test run that way.

A segfault or heap error inside a test run is usually not your R code: reduce it to a
plain call of the dependency first (`R -d "gdb -batch -ex run -ex bt" -f repro.R` gives
the C backtrace), then guard your package against the input that triggers it and report
upstream.
To locate a heap overflow in compiled code, build the dependency with ASan into a
separate lib (Makevars `CFLAGS = -g -O1 -fsanitize=address -fno-omit-frame-pointer`,
`LDFLAGS = -fsanitize=address`; `R CMD INSTALL --no-test-load`, since the load test
runs without the runtime) and run with `LD_PRELOAD=$(gcc -print-file-name=libasan.so)
ASAN_OPTIONS=detect_leaks=0 R_LIBS=<lib>`. To measure an oversized allocation, read
`VmPeak` from `/proc/self/status`: calloc'd but untouched workspace never shows in RSS/VmHWM.

### Mocking

`testthat::with_mock()` is deprecated. Use `local_mocked_bindings()` for
scoped replacements:

```r
test_that("handles API timeout", {
  local_mocked_bindings(call_api = \(...) stop("timeout"))
  expect_error(fetch_data(), "timeout")
})
```

### Helper Functions

Put shared fixtures and generators in `tests/testthat/helper-*.R`; testthat
sources these before every test run (and `devtools::load_all()` picks them up
too), so tests stay short without hidden coupling through the global
environment.

### Anti-Patterns in Testing

| Avoid | Problem | Do Instead |
|-------|---------|------------|
| Global `set.seed()` | Tests coupled by execution order | Seed inside each `test_that()` |
| `expect_is(x, "class")` only | Doesn't verify behavior | Add structural/value checks |
| Reusing variable names | Hard to read, accidental bugs | Unique names per test |
| Commented-out expectations | False confidence in coverage | Delete or fix |
| "Does not crash" tests | No behavioral verification | Assert on outputs |

### File Organization

Mirror `R/` in `tests/testthat/` (`R/smooth.R` ↔ `test-smooth.R`), so
`devtools::test_active_file()` and `usethis::use_test()` find the right file
and a failing test points at the source file that owns the behavior.

## Workflow

```r
# R console: development cycle
devtools::load_all()   # Interactive test
devtools::test()       # Run tests
```

### Before every commit

1. **Format**: `air format .` in the terminal. The pre-commit hook runs Air on
   staged `.R` files and rejects the commit if anything changes, so formatting
   first saves a failed-commit/re-stage cycle (and the temptation to `git commit --amend` after a hook failure).
2. **Document & check** for anything that touches the public surface or the
   dependency graph (new/changed exports, roxygen edits, NAMESPACE, new
   dependencies, new tests): `devtools::document()` then `devtools::check()`.
   `document()` first, always: it regenerates NAMESPACE from `@importFrom` /
   `@export`, and a stale NAMESPACE produces "object not found" errors even
   for exported functions, which look like real bugs and are not.
3. **Sync pkgdown** when exports, vignettes/articles, or help-topic names
   change: update `_pkgdown.yml` (every exported topic in `reference:`, new
   articles in `articles:`/navbar), then `pkgdown::check_pkgdown()` (fast, no
   site build). `devtools::check()` does not flag a stale `_pkgdown.yml`; the
   gap only surfaces when the site builds, often in CI at release time.

For a purely internal edit (logic inside an unexported helper, no doc or test
change), step 1 is enough.

**File organization**: One concept per file, helpers at top, exports at bottom.
Use `# Section Name ----` or `# Section Name ------` format (dashes to ~col 80) for sections.
RStudio recognizes these for code folding. **Never** use multi-line `# ====` block headers.


## Anti-Patterns

| Avoid | Do Instead |
|-------|------------|
| Modifying inputs in place | Create explicit copy |
| Silent `tryCatch(..., error = \(e) NULL)` | Log with `cli::cli_warn()` |
| Magic numbers | Named constants |
| Complex inline lambdas | Named helper functions |
| Dead/commented-out code | Delete (Git has history) |
| Long functions (>50 lines) | Extract subtasks into helpers |
| Long parameter lists | Group into control object |
| Type-checking if-else chains | Use S3 methods |

## CRAN Submission

For preparing and submitting packages to CRAN (pre-flight checks, extra CRAN
checks, pkgdown verification, rhub cross-platform checks, revdep checks,
submission, post-acceptance), use the `cran-submission` skill (`/cran-submission`).

## Checklist

Before commit:
- [ ] **`air format .`** (terminal)
- [ ] **`devtools::document()` then `devtools::check()`** — for any change to the public surface or dependencies
- [ ] **`pkgdown::check_pkgdown()`** — when exports/vignettes/help topics change (keep `_pkgdown.yml` reference index + articles in sync)
- [ ] Pure functions (no globals)
- [ ] Complete roxygen2 with examples
- [ ] checkmate validation at boundaries
- [ ] cli formatting for messages
- [ ] Native pipe `|>` and lambda `\(x)`
- [ ] Functions short enough that each subtask has a name (~50 lines as a heuristic)
- [ ] No dead/commented-out code
- [ ] Long param lists grouped into control objects
- [ ] Tests for new functionality
