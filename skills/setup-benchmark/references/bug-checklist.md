# Bug Checklist: 15 Critical Benchmark Bugs

Each bug below caused silent failures or incorrect results in real benchmark development. Check every item before running.

**Organization**: Bugs 1-10 are general simulation infrastructure bugs. Bugs 11-12 are spline/GAM-specific. Bugs 13-15 are study design pitfalls.

---

## 1. Grid Construction: `data.frame()` vs `expand_grid()`

**Symptom**: Immediate crash or wrong number of rows

**Wrong**:
```r
# data.frame() recycles vectors - does NOT create factorial cross
settings <- data.frame(
    n = c(100, 500),
    snr = c(5, 20, 50)
)
# Result: 3 rows with recycled n values (100, 500, 100)
```

**Right**:
```r
# expand_grid() creates full factorial design
settings <- tidyr::expand_grid(
    n = c(100, 500),
    snr = c(5, 20, 50)
)
# Result: 6 rows - all combinations of n and snr
```

---

## 2. Matrix Construction: `rep(x, each=n)` vs `rep(x, times=n)`

**Symptom**: Silently wrong functional effects, bizarre coefficient patterns

**Context**: Building a matrix where each column should contain repeated values

**Wrong**:
```r
# Want: column j has value w[j] repeated n times
# rep(w, each=n) gives: w1,w1,w1,...,w2,w2,w2,...
W <- matrix(rep(weights, each = n_obs), nrow = n_obs)
# Result: First column has w1, w2, w3, ... (WRONG)
```

**Right**:
```r
# rep(w, times=n) gives: w1,w2,w3,...,w1,w2,w3,...
W <- matrix(rep(weights, times = n_obs), nrow = n_obs, byrow = TRUE)
# Result: Each row is the full weight vector (CORRECT)
```

**Diagnostic**: Print dimensions and first few rows/columns to verify structure.

---

## 3. Parallel Exports: Missing Functions in Workers

**Symptom**: "object 'my_function' not found" errors during parallel execution

**Wrong**:
```r
plan(multisession, workers = 4)

# Functions defined in main script
generate_data <- function(...) { ... }
fit_model <- function(...) { ... }

# Workers can't see these functions!
results <- future_map(tasks, ~{
    data <- generate_data(.)  # ERROR: not found
})
```

**Right**:
```r
plan(multisession, workers = 4)

generate_data <- function(...) { ... }
fit_model <- function(...) { ... }

# Explicitly export all functions
opts <- furrr_options(
    globals = c("generate_data", "fit_model", "helper1", "helper2"),
    seed = TRUE
)

results <- future_map(tasks, ~{
    data <- generate_data(.)  # Works
}, .options = opts)
```

---

## 4. Centering Weight Mismatch

**Symptom**: ~34% coverage instead of ~90%, systematic bias in smooth terms

**Context**: Model centers smooth terms using Simpson's rule weights, but truth uses rectangular

**Wrong**:
```r
# Truth centered with uniform/rectangular weights
f_true <- function(x) {
    raw <- sin(2 * pi * x)
    raw - mean(raw)  # Uniform weights
}
```

**Right**:
```r
# Truth centered with Simpson's rule weights (matching pffr/mgcv)
f_true <- function(x, simpson_weights) {
    raw <- sin(2 * pi * x)
    raw - weighted.mean(raw, simpson_weights)
}

# Simpson weights for n points
simpson_weights <- function(n) {
    if (n < 3 || n %% 2 == 0) stop("n must be odd and >= 3")
    w <- rep(c(4, 2), length.out = n)
    w[1] <- w[n] <- 1
    w / sum(w)
}
```

---

## 5. Grid Alignment: Truth vs Coefficients

**Symptom**: Pointwise comparisons are meaningless, RMSE/coverage wrong

**Wrong**:
```r
# Truth defined on grid of 50 points
truth_grid <- seq(0, 1, length.out = 50)
truth_values <- f_true(truth_grid)

# Coefficients extracted on different grid
coef_grid <- seq(0, 1, length.out = 40)
coefs <- coef(model)

# Direct comparison is wrong - grids don't match!
rmse <- sqrt(mean((coefs - truth_values)^2))
```

**Right**:
```r
# Option A: Use same grid for both
eval_grid <- seq(0, 1, length.out = 50)
truth_values <- f_true(eval_grid)
coefs <- predict(model, newdata = data.frame(x = eval_grid))

# Option B: Interpolate truth to coefficient grid
truth_interp <- approx(truth_grid, truth_values, xout = coef_grid)$y
rmse <- sqrt(mean((coefs - truth_interp)^2))
```

---

## 6. Constraint Satisfaction: Truth Functions

**Symptom**: Intercept absorbs bias, smooth term estimates shifted

**Context**: Models impose identifiability constraints (e.g., smooth terms sum to zero)

**Wrong**:
```r
# Truth function doesn't satisfy constraint
f_true <- function(x) x^2  # Not centered

# Model estimates f(x) - mean(f(x)), comparing to f(x) is wrong
```

**Right**:
```r
# Truth function satisfies same constraint as model
f_true_constrained <- function(x, weights) {
    raw <- x^2
    raw - weighted.mean(raw, weights)
}

# Verify constraint is satisfied
stopifnot(abs(weighted.mean(f_true_constrained(grid, w), w)) < 1e-10)
```

---

## 7. Seed Reproducibility and Independence

**Symptom**: Results not reproducible, or worse: correlated datasets across reps

**Wrong** (Morris et al. 2019 example):
```r
# DANGER: If you generate seeds by single RNG steps, datasets overlap!
# Example: n_obs = n_sim = 4, first step is runif(n_obs)
# rep 1: x = (0.13, 0.14, 0.45, 0.02)
# rep 2: x = (0.14, 0.45, 0.02, 0.35)  # Shares 3/4 values with rep 1!
# rep 3: x = (0.45, 0.02, 0.35, 0.91)  # Shares values with reps 1 and 2!
```

**Also Wrong**:
```r
# Single set.seed at top - parallel workers ignore it
set.seed(123)
results <- future_map(1:100, ~{
    rnorm(10)  # Different each run due to worker randomness
})
```

**Right**:
```r
# Set seed ONCE at start, generate ALL task seeds upfront
set.seed(123)
task_seeds <- sample.int(.Machine$integer.max, n_total_tasks)

# Store RNG state at start of each rep (for debugging)
for (i in seq_len(n_reps)) {
    rng_state <- .Random.seed  # Can restore this to debug rep i
    set.seed(task_seeds[i])
    # ... generate and analyze data
}

# For parallel: use furrr's L'Ecuyer streams
results <- future_map(1:100, ~{
    rnorm(10)
}, .options = furrr_options(seed = 123))  # Reproducible, independent streams
```

**Key principles** (Morris et al. 2019, Section 4.1):
1. Set seed ONCE at beginning
2. Store RNG state at start of each rep (enables debugging)
3. For parallel, use separate streams (R: `rstream` package or furrr's built-in)
4. Never set seed to same value inside a loop

---

## 8. Output Size Explosion

**Symptom**: Memory exhaustion, slow aggregation, huge files

**Wrong**:
```r
# Storing pointwise results
results <- map_dfr(reps, ~{
    tibble(
        rep = .,
        x = eval_grid,           # 100 points
        estimate = coefs,
        se = ses,
        truth = truth_values
    )
})
# 1000 reps × 100 points × 10 DGPs × 3 methods = 3M rows
```

**Right**:
```r
# Aggregate to term level inside the loop
results <- map_dfr(reps, ~{
    coefs <- get_coefs(model)
    tibble(
        rep = .,
        term = "f(x)",
        rmse = sqrt(mean((coefs - truth)^2)),
        coverage = mean(lower <= truth & truth <= upper),
        bias = mean(coefs - truth)
    )
})
# 1000 reps × 10 DGPs × 3 methods × 5 terms = 150K rows
```

---

## 9. Method Comparability: Different Data

**Symptom**: Method differences confounded with data differences

**Wrong**:
```r
# Each (method, rep) gets different data
for (method in methods) {
    for (rep in 1:n_reps) {
        data <- generate_data()  # New data each time!
        fit <- fit_method(data, method)
    }
}
```

**Right**:
```r
# Same data for all methods within a replication
for (rep in 1:n_reps) {
    data <- generate_data(seed = rep)  # Fixed per rep
    for (method in methods) {
        fit <- fit_method(data, method)  # Same data
    }
}
```

---

## 10. Silent Error Dropping

**Symptom**: Missing results, biased summaries (only successful fits counted)

**Wrong**:
```r
results <- map(tasks, ~{
    tryCatch(
        run_task(.),
        error = function(e) NULL  # Silently dropped!
    )
}) %>% compact()  # Removes NULLs without logging
```

**Right**:
```r
# Define failure row constructor with same columns as success
make_failure_row <- function(method_row, error_msg) {
    tibble(
        method_id = method_row$method_id,
        method_name = method_row$method_name,
        mse = NA_real_,
        bias = NA_real_,
        coverage = NA_real_,
        success = FALSE,
        error_msg = error_msg
    )
}

results <- map_dfr(tasks, ~{
    tryCatch({
        run_task(.) |> mutate(success = TRUE, error_msg = NA_character_)
    }, error = function(e) {
        make_failure_row(., conditionMessage(e))
    })
})

# Check for failures
n_failures <- sum(!results$success)
if (n_failures > 0) {
    warning(sprintf("%d tasks failed out of %d", n_failures, nrow(results)))
    results |> filter(!success) |> count(method_name, error_msg) |> print()
}

# Summarize only successes
summary <- results |> filter(success) |> summarise(...)
```

---

## 11. Smoothing Bias: k_model Too Small

**Symptom**: Low coverage (60-80%) with SE ratio >> 1, especially for penalized spline methods

**Context**: When truth is generated with k_truth basis functions but model uses k_model < k_truth

**Wrong**:
```r
# Truth uses k=15 for linear terms
k_truth <- list(linear = 15, smooth = 8)

# Model uses default k=10
model <- gam(y ~ s(x, k = 10))
# Model can't capture truth → smoothing bias → low coverage
```

**Right**:
```r
# Ensure k_model > k_truth + 4
k_truth <- list(linear = 8, smooth = 8)

# Model uses k=12 (> 8 + 4)
model <- gam(y ~ s(x, k = 12))
```

**Diagnostic**: Compute SE ratio = actual_SD / mean_SE. If >> 1, try increasing k_model.

---

## 12. Inconsistent k_truth Across Term Types

**Symptom**: Some terms have good coverage, others don't, despite same wiggliness parameter

**Context**: Different term types use different k_truth, so same wiggliness produces different smoothness

**Wrong**:
```r
# 2D terms use k=8 each marginal, 1D terms use k=15
# With wiggliness=0.1:
# - 2D terms are smooth (well-estimated)
# - 1D terms are wiggly (hard to estimate)
k_truth <- list(
    ff_s = 8, ff_t = 8,
    linear = 15,
    intercept = 15
)
```

**Right**:
```r
# Same k for all terms - wiggliness means the same thing
k_truth <- list(
    ff_s = 8, ff_t = 8,
    linear = 8,
    intercept = 8
)
```

---

## 13. Equivalent-Design Instability

**Symptom**: Conclusions change when you re-run with different random scenario draws or a different seed

**Context**: Chen et al. (2016) showed that different random draws from the same experimental design can produce larger performance swings than the actual differences between methods. This is especially dangerous with space-filling designs or small factorial grids.

**Diagnostic**:
```r
# Run benchmark with two different base seeds
results_seed1 <- run_benchmark(settings, methods, config = list(base_seed = 1))
results_seed2 <- run_benchmark(settings, methods, config = list(base_seed = 2))

# Compare method rankings — should be stable
rank1 <- results_seed1 |> group_by(method) |> summarise(rmse = mean(rmse)) |> arrange(rmse)
rank2 <- results_seed2 |> group_by(method) |> summarise(rmse = mean(rmse)) |> arrange(rmse)
# If rankings change, increase n_reps or add scenarios
```

**Mitigation**: Increase n_reps until MC SEs are small relative to method differences. Report MC SEs so readers can judge stability.

---

## 14. Metric/Scenario Cherry-Picking

**Symptom**: Proposed method wins on all reported metrics/scenarios (suspiciously clean results)

**Context**: Niessl et al. (2022) document the "garden of forking paths" in simulation studies — researchers unconsciously (or consciously) select metrics, scenarios, and tuning parameters that favor their method.

**Wrong**:
```r
# Run benchmark, then decide which metrics to report
# "Coverage isn't great, but RMSE looks good — let's focus on RMSE"
# "Method works poorly for n=100, but n≥500 is fine — drop small n"
```

**Right**:
```r
# Lock ADEMP in a design document BEFORE running:
# - All metrics: bias, coverage, RMSE, computation time
# - All scenarios: n ∈ {100, 500, 1000}, snr ∈ {5, 10, 50}
# - Report ALL results, including unfavorable ones
```

**Mitigation**: Write the ADEMP specification (including all metrics and scenarios) before the first full run. Report all pre-specified results. If you add post-hoc analyses, label them clearly as exploratory.

---

## 15. Resampling-from-Dataset Overgeneralization

**Symptom**: Conclusions claimed to be general but based on bootstrap-from-one-dataset DGPs

**Context**: Morris et al. (2019) warn that resampling from a single real dataset limits conclusions to that dataset's distribution. The simulation tells you about method performance *on data like this specific dataset*, not in general.

**Wrong**:
```r
# Bootstrap DGP
generate_data <- function(real_data, n) {
    real_data[sample(nrow(real_data), n, replace = TRUE), ]
}
# Claim: "Method A is generally better than Method B"
```

**Right**:
```r
# Parametric DGP inspired by real data
fit <- lm(y ~ x1 + x2, data = real_data)
generate_data <- function(n, beta = coef(fit), sigma = sigma(fit)) {
    x <- MASS::mvrnorm(n, mu = colMeans(real_data[, c("x1","x2")]),
                       Sigma = cov(real_data[, c("x1","x2")]))
    y <- cbind(1, x) %*% beta + rnorm(n, sd = sigma)
    data.frame(y = y, x1 = x[,1], x2 = x[,2])
}
# Claim: "Method A is better under this parametric model"
```

**Mitigation**: Prefer parametric DGPs. If resampling from data, state this limitation and consider running additional parametric scenarios to test generalizability.

---

## Quick Verification Script

Run this before your main benchmark:

```r
verify_benchmark_setup <- function(settings, generate_data, fit_method,
                                    extract_metrics, truth_functions) {
    cat("Checking benchmark setup...\n")

    # 1. Grid construction
    stopifnot("Settings should use expand_grid" =
        nrow(settings) == prod(sapply(settings, n_distinct)))

    # 2. Single replication test
    data <- generate_data(settings[1, ], seed = 1)
    stopifnot("generate_data should return list" = is.list(data))

    # 3. Fit test
    fit <- fit_method(data, methods[1])
    stopifnot("fit_method should return model" = !is.null(fit))

    # 4. Metrics test
    metrics <- extract_metrics(fit, data$truth)
    stopifnot("metrics should be tibble" = inherits(metrics, "tbl_df"))
    stopifnot("metrics should have coverage" = "coverage" %in% names(metrics))

    # 5. Truth constraint check
    for (term in names(truth_functions)) {
        f <- truth_functions[[term]]
        grid <- data$grids[[term]]
        weights <- data$weights[[term]]
        centered_mean <- weighted.mean(f(grid), weights)
        stopifnot(sprintf("Truth for %s not centered", term) =
            abs(centered_mean) < 1e-8)
    }

    cat("All checks passed!\n")
}
```
