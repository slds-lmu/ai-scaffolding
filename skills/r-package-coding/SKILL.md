---
name: r-package-coding
description: R package development standards for AI coding agents. Use when writing R package code (not scripts/analysis), implementing S3 objects, writing roxygen2 documentation, or working with checkmate/cli/purrr/vctrs. Covers naming conventions, pure functions, validation patterns, and package workflow.
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
- ~50 lines max per function
- Required args first, optional with defaults after
- Cyclomatic complexity < 10 per function
- **Run `air format .` after every major edit** (not just before commit). A pre-commit hook enforces this, so formatting early avoids wasted cycles.

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

### Helper Functions
Extract common patterns to reduce duplication:

### Anti-Patterns in Testing

| Avoid | Problem | Do Instead |
|-------|---------|------------|
| Global `set.seed()` | Tests coupled by execution order | Seed inside each `test_that()` |
| `expect_is(x, "class")` only | Doesn't verify behavior | Add structural/value checks |
| Reusing variable names | Hard to read, accidental bugs | Unique names per test |
| Commented-out expectations | False confidence in coverage | Delete or fix |
| "Does not crash" tests | No behavioral verification | Assert on outputs |

### File Organization
Split large test files by topic

## Workflow

```r
# R console: development cycle
devtools::load_all()   # Interactive test
devtools::test()       # Run tests
```

### Pre-Commit Requirements (MANDATORY)

**Before every commit, run these steps in order. No exceptions.**

1. **Format**: `air format .` in the terminal. A pre-commit hook enforces this—committing unformatted code will fail.
2. **Document & check** (for non-trivial changes—new/changed exports, roxygen edits, NAMESPACE changes, new dependencies, test additions): run `devtools::document()` then `devtools::check()` in R. Both must pass before committing.

Skip step 2 only for minor internal edits (e.g., tweaking logic inside an unexported helper with no doc or test changes).

**Important**: Always run `devtools::document()` before `devtools::test()` or `devtools::check()`. This regenerates the NAMESPACE file from `@importFrom` and `@export` directives. Skipping this step after adding imports causes "object not found" errors even for exported functions.

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

## Checklist

Before commit:
- [ ] **`air format .`** (terminal) — always, no exceptions
- [ ] **`devtools::document()` then `devtools::check()`** — for any non-trivial change
- [ ] Pure functions (no globals)
- [ ] Complete roxygen2 with examples
- [ ] checkmate validation at boundaries
- [ ] cli formatting for messages
- [ ] Native pipe `|>` and lambda `\(x)`
- [ ] Functions < 50 lines
- [ ] No dead/commented-out code
- [ ] Long param lists grouped into control objects
- [ ] Tests for new functionality
