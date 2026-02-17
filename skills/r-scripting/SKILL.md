---
name: r-scripting
description: R coding standards for scripts and data analysis. Use for writing R scripts, data analysis, tidyverse workflows, or exploratory analysis. Includes guidance for creating teaching demos with knitr::spin (literate R scripts that render to PDF/HTML). Not for package development.
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
- Use native pipe `|>` (R ≥ 4.1) or `%>%`
- **Run `air format .` after every major edit** (not just before commit). A pre-commit hook enforces this, so formatting early avoids wasted cycles.

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
# Simple binary
result <- ifelse(x > 0, "pos", "neg")

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
