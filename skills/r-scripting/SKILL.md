---
name: r-scripting
description: >
  R coding standards for scripts, data analysis, and tidyverse workflows, covering script
  structure, pure functions, early returns, purrr patterns, error handling, air formatting,
  and knitr::spin literate demos that render to PDF/HTML. Use whenever you write or clean
  up an R script, analysis file, simulation driver, or teaching demo that is not part of a
  package, even if the user just says "write me an R script for X", "tidy this analysis",
  or "make a demo for the lecture". For code inside a package use r-package-coding instead.
---

# R Scripting

## Core Principles

- **Clear over clever** - readability trumps brevity
- **Explicit over implicit** - all function inputs as arguments (no globals)
- **Functional over imperative** - prefer `map()` over loops when clearer

---

## Design Principles

### Top-Down Design

Decompose problems before coding:
1. **Problem** → high-level subtasks
2. **Subtasks** → smaller pieces
3. **Code** → implement bottom-up

Start with the big picture, then drill down.

### DRY (Don't Repeat Yourself)

Extract repeated code into functions—errors fix in one place, changes propagate automatically.

```r
# BAD: Copy-paste
result_a <- data_a |> filter(x > 0) |> mutate(y = log(x)) |> summarize(m = mean(y))
result_b <- data_b |> filter(x > 0) |> mutate(y = log(x)) |> summarize(m = mean(y))

# GOOD: Abstraction
compute_log_mean <- function(data) {
  data |> filter(x > 0) |> mutate(y = log(x)) |> summarize(m = mean(y))
}
results <- map(list(data_a, data_b), compute_log_mean)
```

### One Task Per Function

Keep functions short (~20-50 lines). If a function does multiple things, split it.

---

## Naming

```r
# Functions: snake_case verbs
calculate_mean <- function(x) mean(x, na.rm = TRUE)
filter_outliers <- function(data, threshold = 3) { ... }

# Variables: descriptive, plural for collections
patient_ages <- c(25, 32, 41)
model_predictions <- predict(fit)

# Constants: UPPER_SNAKE_CASE
MAX_ITERATIONS <- 1000
DEFAULT_ALPHA <- 0.05
```

---

## Formatting

```r
# Assignment: use <-
result <- x + y

# Pipes: one operation per line
result <- raw_data |>
  filter(age > 18) |>
  mutate(log_income = log(income)) |>
  summarize(mean = mean(log_income))

# Lambda (R ≥ 4.1)
map(data, \(x) x^2 + 1)
```

- 2 spaces indentation, ~80 chars/line
- Native pipe `|>`, not `%>%` (same rule as `r-package-coding`; mixing the two
  in one project is the thing to avoid). Keep `%>%` only when editing an
  existing script that already uses it throughout.
- Run `air format .` after every major edit, not just before commit; where a
  pre-commit hook enforces it, formatting late costs a failed-commit cycle.

---

## Functions

```r
my_function <- function(data, threshold = 0.05, verbose = FALSE) {
  # 1. Validate
  stopifnot(
    "data must be data.frame" = is.data.frame(data),
    "threshold must be positive" = threshold > 0
  )
  # 2. Early return for edge cases
  if (nrow(data) == 0) return(NULL)
  # 3. Main logic
  process_data(data, threshold)
}
```

### Pure Functions (Critical)

```r
# BAD: global dependency
THRESHOLD <- 0.05
filter_data <- function(df) df |> filter(p < THRESHOLD)

# GOOD: explicit argument
filter_data <- function(df, threshold = 0.05) df |> filter(p < threshold)
```

**All inputs must be explicit arguments.** Same inputs → same outputs.

---

## Control Flow

### Return Early, Keep Happy Path Flat

Handle edge cases and errors first, then let the main logic flow with minimal indentation.

```r
# BAD: Deeply nested
process <- function(x, method) {
  if (!is.null(x)) {
    if (is.numeric(x)) {
      if (method == "mean") {
        return(mean(x))
      } else {
        return(median(x))
      }
    }
  }
  return(NA)
}

# GOOD: Early returns, flat happy path
process <- function(x, method = c("mean", "median")) {
  if (is.null(x)) return(NA)
  if (!is.numeric(x)) return(NA)
  method <- match.arg(method)  # Homogenize input

  switch(method,
    mean = mean(x),
    median = median(x)
  )
}
```

### Homogenize Inputs Early

Normalize variants at the start, then work with a single form:

```r
# Homogenize string inputs
method <- match.arg(method)  # Pick from predefined choices
type <- tolower(type)        # Case-insensitive

# Homogenize NULL to default
arg <- arg %||% default_value
```

### Vectorized Conditions

```r
# Simple binary (dplyr's if_else is type-stable and has a `missing =`
# argument; base ifelse silently drops attributes such as Date/factor)
result <- if_else(x > 0, "pos", "neg")

# Multiple conditions
category <- case_when(
  score >= 90 ~ "A",
  score >= 80 ~ "B",
  TRUE ~ "F"
)

# Discrete options
result <- switch(method,
  "mean" = mean(x, na.rm = TRUE),
  "median" = median(x, na.rm = TRUE),
  stop("Unknown method: ", method)
)
```

---

## Functional Programming (purrr)

```r
# Typed output
map_dbl(data, compute_value)
map_lgl(data, is_valid)

# Multiple inputs
map2(x, y, \(a, b) a + b)
pmap(list(x, y, z), \(a, b, c) a * b + c)

# Error handling
safe_mean <- possibly(mean, otherwise = NA)
```

---

## Data Manipulation (tidyverse)

```r
result <- raw_data |>
  filter(!is.na(value)) |>
  mutate(log_value = log(value), scaled = scale(value)) |>
  group_by(category) |>
  summarize(n = n(), mean = mean(value)) |>
  arrange(desc(mean))

# Multiple columns
df |> mutate(across(where(is.numeric), scale))
df |> summarize(across(where(is.numeric), list(mean = mean, sd = sd)))
```

---

## Error Handling

```r
# Validation with messages (R ≥ 4.0)
stopifnot(
  "x must be numeric" = is.numeric(x),
  "denom cannot be zero" = all(denom != 0)
)

# Informative errors
if (x < 0) {
  stop("x must be non-negative, got x = ", x,
       "\nTry using abs(x) or filtering negatives")
}

# Try-catch
result <- tryCatch(
  risky_computation(data),
  error = function(e) { message("Failed: ", e$message); NULL }
)
```

---

## Script Structure

```r
# Setup -----------------------------------------------------------------------

library(tidyverse)
DATA_PATH <- "data/input.csv"

# Functions -------------------------------------------------------------------

compute_stats <- function(x) { ... }

# Main ------------------------------------------------------------------------

data <- read_csv(DATA_PATH)
results <- compute_stats(data)
write_csv(results, "output/results.csv")
```

**Section headers**: Use `# Section Name ----` or `# Section Name ------` format (dashes to ~col 80). RStudio recognizes these for code folding. **Never** use multi-line `# ====` block headers.

---

## Anti-Patterns

### Code Examples

```r
# BAD: magic numbers
significant <- filter(results, p < 0.05)
# GOOD
ALPHA <- 0.05
significant <- filter(results, p < ALPHA)

# BAD: repetition
summary_a <- data_a |> filter(valid) |> summarize(m = mean(val))
summary_b <- data_b |> filter(valid) |> summarize(m = mean(val))
# GOOD
calc_summary <- function(d) d |> filter(valid) |> summarize(m = mean(val))
summaries <- map(list(data_a, data_b), calc_summary)

# BAD: swallowing errors
try(risky(x), silent = TRUE)
# GOOD
tryCatch(risky(x), error = function(e) { message("Failed: ", e$message); NA })
```

### Code Smells & Fixes

| Smell | Problem | Fix |
|-------|---------|-----|
| Long functions (>50 lines) | Hard to understand/test | Extract subtasks into helpers |
| Long parameter lists | Unwieldy API | Group related args into list |
| Data clumps | Variables that always appear together | Unify into single object/list |
| Dead/commented-out code | Confusion, maintenance burden | Delete (Git has history) |
| Deep nesting | Hard to follow | Return early, flatten logic |
| High cyclomatic complexity | Many paths = many bugs | Target < 10 per function |

### Cyclomatic Complexity

Measure with `cyclocomp` package—target < 10 per function:

```r
cyclocomp::cyclocomp(my_function)
```

---

## Comments

```r
# GOOD: explain WHY
# Log transform to normalize right-skewed distribution
data <- mutate(data, log_val = log(value + 1))

# GOOD: document assumptions
# Assumes data sorted by date
rolling <- zoo::rollmean(values, k = 7)
```

---

## Teaching Demos with knitr::spin

For literate R scripts that render to PDF/HTML, see `knitr-spin-reference.md` in this skill folder.

Key points: use `#'` prefix for prose, `#+` for chunk options, interleave code and explanation.

---

## Tools

```r
# R console: check style
lintr::lint("script.R")
```

```bash
# Terminal: auto-format (run before commit)
air format script.R
air format .  # Format all R files
```

---

## Quick Checklist

- [ ] Functions pure (all inputs as args)
- [ ] No magic numbers (use named constants)
- [ ] Informative error messages
- [ ] Comments explain *why*, not *what*
- [ ] Works in fresh R session
- [ ] Functions < 50 lines (cyclomatic complexity < 10)
- [ ] No dead/commented-out code
- [ ] Run `air format .` before commit
- [ ] For demos: see `knitr-spin-reference.md`

## Hard-won lessons (past sessions)

- **Never modify a script file while a process is still executing it.** Both `Rscript`
  and `bash` parse top-level statements *incrementally by byte offset*, so rewriting the
  file shifts the offsets and the running job dies mid-run with a spurious parse error
  (e.g. `unexpected ','`). Two ways this bites: (a) committing an `.R` script in a repo
  with a formatter pre-commit hook, which rewrites it on disk — commit only after the run
  completes; (b) editing a helper you launched, e.g. `council-fanout.sh`, while its
  `wait` loop is still live. Edit after, or copy the script and run the copy.
  - **The danger window is only the initial top-level PARSE, which is over once the run
    prints output / spawns workers.** So if you must commit a driver you're about to run,
    do it *fully* first (Air-fail → re-stage → re-commit) and only then launch. The trap is
    launching *between* a failed Air commit and its retry — the retry then rewrites the file
    under the running job. (Survivable if parsing already finished, but don't rely on it;
    verify with `lsof <file>` + a parse-error grep if it happens.)
- **`tibble::tibble()` (and `mutate()`) also evaluate SEQUENTIALLY**: once a column named
  `cell` or `bias2` exists, later arguments see that column, not the local variable of the
  same name (`tibble(cell = cell$cell, dev = f(cell$fit_family))` errors with "$ operator
  is invalid for atomic vectors"; `tibble(b2 = b2[1], b2_se = sd(b2[-1]))` silently gives NA).
  Compute such values before the call or give locals distinct names.
- **`dplyr::summarise()` evaluates its arguments SEQUENTIALLY — never reuse a
  column name you have just overwritten.** This fails *silently*, not loudly:
  ```r
  summarise(coverage = mean(coverage),                  # coverage is now a SCALAR
            mc_se = sd(coverage) / sqrt(n()))           # -> sd(scalar) = NA
  ```
  Two failure modes seen in one session: (a) every `mc_se` in a 108-row results
  CSV came out `NA`; (b) in a paired-contrast script, `cov0 = mean(cov0)` before
  `sd(coverage - cov0)` silently turned a **paired** contrast into an unpaired
  one — the means agree, so only the SEs betray it (0.12 vs 0.31). Compute SDs/SEs
  **before** the means, or use distinct names.
- **Never pipe a long-running command through `grep`/`tail`/`head`.** The pipe
  buffers all stdout until the command exits (no progress visibility), and the
  reported exit code is the pipe's *last* stage, masking the real command's
  failure. Instead: `cmd > /tmp/log 2>&1` (foreground or `run_in_background`),
  then `grep`/`Read` the log file and inspect the command's own exit code.
- **Pin BLAS threads BEFORE `future::plan(multisession)`.** If R links
  `openblas-pthread`, then *each* worker process spawns its own thread pool — 7 workers
  × 8 threads on 8 cores. Measured 10× slowdown (a `pffr` fit took 77 s instead of
  7.1 s). Set the env vars before `plan()`: multisession workers are fresh R processes
  that inherit the parent environment and read it when OpenBLAS loads.
  **For fork-based `mclapply` even in-script `Sys.setenv()` is TOO LATE**: the parent's
  OpenBLAS pool is sized when the library loads at R startup and forked children inherit
  it (observed again 2026-07-11: 7 workers × 8 threads, load 54, ~4× slowdown). Pin at
  the SHELL instead: `OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 Rscript ...`.
  ```r
  Sys.setenv(OPENBLAS_NUM_THREADS = "1", OMP_NUM_THREADS = "1", MKL_NUM_THREADS = "1")
  ```
  Verify with `ps -eo pcpu,nlwp,comm`: workers should show `nlwp=2`, not 9+.
- **Never pass `globals` to `furrr_options()` "just to be explicit".**
  `furrr_options(globals = structure(TRUE, add = c("f1", "f2")))` silently breaks
  future's recursive global auto-detection: every worker then dies with
  `could not find function`, and even the `tryCatch` error handler fails on a missing
  helper. Omit `globals` — auto-detection walks the call graph correctly.
- **`R_LIBS_USER=<lib>` REPLACES the personal library** (deps vanish, `library()`
  fails); use `R_LIBS=<lib>` (additive, prepended) for isolated test installs.
