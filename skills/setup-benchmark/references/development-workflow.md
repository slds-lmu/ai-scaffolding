# Benchmark Development Workflow

Building a benchmark is iterative. This guide covers the trial-and-error process that real benchmark development requires.

---

## Development Phases

| Phase | Goal | What You Do |
|-------|------|-------------|
| 0. Known-answer validation | Does infrastructure give correct results on a trivial problem? | Run a case with known analytical answer |
| 1. Single-fit debugging | Does one (dgp, method) work? | Run `debug_single_fit()`, inspect output manually |
| **R1. Code review gate** | **Is the code correct and idiomatic?** | **Run code reviews on all new files (see Code Review Gates)** |
| 2. Pilot calibration | What DGP ranges give meaningful results? | Screen factors → find informative ranges → check interactions → screen methods → choose final design |
| 3. Timing estimation | How long will full run take? | Time a few reps, extrapolate |
| 4. Small-scale validation | Does coverage/RMSE look right? | Run n_rep=10-50, check metrics against expectations |
| **R2. Pre-production review** | **Are results and code ready for full run?** | **Council-of-bots review of pilot results + code** |
| 5. Full production run | Final results | Run with full n_rep, incremental saves |
| **R3. Results review** | **Are results trustworthy?** | **Council-of-bots review of production results** |

**Do not skip phases.** Most bugs appear in Phase 0-2 and are expensive to discover in Phase 5. Review gates (R1-R3) catch bugs that self-review misses — they are not optional.

---

## Phase 0: Known-Answer Validation

Before testing your actual methods, verify that the entire pipeline (data generation → fitting → metric extraction → aggregation) produces correct results on a **trivial problem with a known answer**.

**Strategy**: Use OLS on a correctly-specified linear model. Coverage should be ~95%, bias should be ~0, and RMSE should match the theoretical SE.

```r
validate_infrastructure <- function(n_reps = 500, n_obs = 200, seed = 42) {
    set.seed(seed)

    results <- map_dfr(seq_len(n_reps), function(i) {
        # Trivial DGP: y = 2 + 3*x + noise
        x <- runif(n_obs)
        y <- 2 + 3 * x + rnorm(n_obs, sd = 1)

        fit <- lm(y ~ x)
        ci <- confint(fit)["x", ]

        tibble(
            rep = i,
            estimate = coef(fit)["x"],
            se = summary(fit)$coefficients["x", "Std. Error"],
            ci_lower = ci[1],
            ci_upper = ci[2],
            covered = ci[1] <= 3 & 3 <= ci[2]
        )
    })

    # Check results
    coverage <- mean(results$covered)
    mc_se_cov <- sqrt(coverage * (1 - coverage) / n_reps)
    bias <- mean(results$estimate) - 3
    mc_se_bias <- sd(results$estimate) / sqrt(n_reps)

    cat(sprintf("Coverage: %.1f%% (MC SE: %.1f%%) — expect ~95%%\n",
                coverage * 100, mc_se_cov * 100))
    cat(sprintf("Bias: %.4f (MC SE: %.4f) — expect ~0\n", bias, mc_se_bias))

    # Fail loudly if infrastructure is broken
    stopifnot(
        "Coverage outside [90%, 99%] — pipeline likely broken" =
            coverage > 0.90 && coverage < 0.99,
        "Bias too large — pipeline likely broken" =
            abs(bias) < 3 * mc_se_bias
    )

    cat("Infrastructure validation PASSED\n")
    invisible(results)
}
```

**When to use this**: Always run Phase 0 once when setting up a new benchmark. If you change the metric extraction or aggregation code, re-run it.

---

## Phase 1: Single-Fit Debugging

Create a function that runs one (dgp, method) combination and returns everything for inspection:

```r
debug_single_fit <- function(dgp_id = 1, method_id = 1, seed = 1, plot = TRUE) {
    dgp_row <- dgp_settings[dgp_id, ]
    method_row <- method_settings[method_id, ]

    # Generate data
    data <- generate_data(dgp_row, seed)

    # Fit model
    t0 <- Sys.time()
    fit <- fit_method(data, method_row)
    fit_time <- as.numeric(difftime(Sys.time(), t0, units = "secs"))

    # Extract metrics
    metrics <- extract_metrics(fit, data, method_row)

    # Diagnostic plots
    if (plot) {
        par(mfrow = c(1, 2))
        # Truth vs estimate
        plot(data$truth$values, get_estimate(fit),
             xlab = "Truth", ylab = "Estimate",
             main = sprintf("%s (DGP %d)", method_row$method_name, dgp_id))
        abline(0, 1, col = "red")

        # Residual distribution
        resid <- get_estimate(fit) - data$truth$values
        hist(resid, main = "Residuals", xlab = "Estimate - Truth")
        abline(v = 0, col = "red", lty = 2)
        par(mfrow = c(1, 1))
    }

    list(
        dgp_row = dgp_row,
        method_row = method_row,
        data = data,
        fit = fit,
        metrics = metrics,
        fit_time = fit_time
    )
}
```

**Checklist for Phase 1:**
- [ ] Does `generate_data()` return expected structure?
- [ ] Does `fit_method()` run without errors?
- [ ] Does `extract_metrics()` return expected columns?
- [ ] Do estimates look reasonable in truth vs estimate plot?
- [ ] Is fit time acceptable? (Extrapolate to full run)

---

## Phase 2: Pilot Calibration

Pilot calibration is the most intellectually demanding phase. With many DGP factors (SNR, n, error distribution, correlation, sparsity, ...) and many method settings, the combinatorial space explodes. Running a full factorial pilot is wasteful and slow. Instead, work through these sub-steps to systematically narrow the design space.

### 2a. One-at-a-Time (OAT) Screening

**Goal**: Identify which DGP factors matter and where the interesting range is.

**Why OAT first?** A full factorial is better for the *final* design where you need to estimate interactions precisely. But for *screening* — finding which factors matter at all and roughly where — OAT is efficient and sufficient. With k factors and m levels each, OAT costs k × m runs vs m^k for a full factorial.

**How**: Fix all factors at a sensible default (e.g., moderate SNR, moderate n). Vary one factor at a time across a wide range. Use only **1–2 fast reference methods** (not all methods), with 5–10 reps per setting. This keeps runtime manageable.

```r
sweep_one_factor <- function(factor_name, factor_values, defaults, method_ids = 1:2,
                             n_reps = 5) {
    results <- map_dfr(factor_values, function(val) {
        dgp_row <- defaults
        dgp_row[[factor_name]] <- val

        map_dfr(seq_len(n_reps), function(rep) {
            data <- generate_data(dgp_row, seed = rep)
            map_dfr(method_ids, function(m_id) {
                fit <- fit_method(data, method_settings[m_id, ])
                extract_metrics(fit, data, method_settings[m_id, ]) |>
                    mutate(!!factor_name := val, rep = rep,
                           method = method_settings$method_name[m_id])
            })
        })
    })
    results
}

# Example: sweep SNR while holding everything else at defaults
defaults <- list(n = 500, snr = 10, error_dist = "normal", correlation = 0)
snr_sweep <- sweep_one_factor("snr", c(1, 2, 5, 10, 20, 50, 100), defaults)
```

### 2b. Identify the "Informative Zone" Per Factor

**Goal**: For each factor, find the range where methods differentiate meaningfully.

Plot RMSE (or your primary metric) vs the swept factor, colored by method. This **calibration profile plot** reveals three zones:
- **"All perfect" zone**: High SNR / large n — all methods perform well, no differentiation
- **Informative zone**: Methods spread apart, some do better than others
- **"All broken" zone**: Very low SNR / tiny n — all methods fail, no useful signal

```r
calibration_profile_plot <- function(sweep_results, factor_name,
                                     metrics = c("rmse", "coverage")) {
    summary <- sweep_results |>
        summarise(
            across(all_of(metrics), list(mean = mean, se = ~ sd(.) / sqrt(n()))),
            convergence_rate = mean(success),
            .by = c(all_of(factor_name), method)
        )

    plots <- map(metrics, function(m) {
        ggplot(summary, aes(x = .data[[factor_name]], y = .data[[paste0(m, "_mean")]],
                            color = method)) +
            geom_line() +
            geom_pointrange(aes(
                ymin = .data[[paste0(m, "_mean")]] - 2 * .data[[paste0(m, "_se")]],
                ymax = .data[[paste0(m, "_mean")]] + 2 * .data[[paste0(m, "_se")]]
            )) +
            labs(y = m, title = paste(m, "vs", factor_name)) +
            theme_minimal()
    })

    patchwork::wrap_plots(plots, ncol = 1)
}

calibration_profile_plot(snr_sweep, "snr")
```

**Operational criteria** for trimming: A setting is *informative* if:
1. Methods differentiate — RMSE spread across methods exceeds a practical threshold (see `study-design.md` for practical significance thresholds)
2. Not all methods fail — convergence rate > some minimum (e.g., 80%)

Trim the range: drop the "all perfect" and "all broken" ends. Keep 3–5 levels within the informative zone per factor.

### 2c. Check Interactions on a Reduced Design

**Goal**: After screening identifies k ≤ 4 important factors with narrowed ranges, check whether factors interact.

A factor interaction means the effect of factor A depends on the level of factor B. If interactions are absent, you can set factor levels independently. If interactions are strong, you need to include those factor combinations in the final design.

**Design rule**:
- If ≤ 3 factors with ≤ 3 levels each → run a small factorial (≤ 27 cells)
- If more factors or levels → use a Latin Hypercube Sample (LHS) with ~10 × d points (see `study-design.md` for LHS construction)

Still use the 1–2 fast reference methods, 5–10 reps.

```r
# Example: 3 factors × 3 levels = 27 cells
interaction_grid <- expand_grid(
    snr = c(3, 10, 30),
    n = c(200, 500, 1000),
    correlation = c(0, 0.3, 0.7)
) |> mutate(dgp_id = row_number())

interaction_results <- map_dfr(seq_len(nrow(interaction_grid)), function(i) {
    dgp_row <- as.list(interaction_grid[i, ])
    map_dfr(1:5, function(rep) {
        data <- generate_data(dgp_row, seed = rep)
        fit <- fit_method(data, method_settings[1, ])
        extract_metrics(fit, data, method_settings[1, ]) |>
            mutate(dgp_id = i, snr = dgp_row$snr, n = dgp_row$n,
                   correlation = dgp_row$correlation)
    })
})

# Look for interactions: does effect of SNR depend on correlation?
ggplot(interaction_results |> summarise(rmse = mean(rmse), .by = c(snr, correlation)),
       aes(x = factor(snr), y = rmse, color = factor(correlation), group = correlation)) +
    geom_line() + geom_point() +
    labs(title = "SNR × Correlation interaction", color = "Correlation") +
    theme_minimal()
```

If lines are roughly parallel, there is no interaction — you can vary these factors independently. If lines cross or diverge, include both factors in a crossed design.

### 2d. Method Screening

**Goal**: Bring in all candidate methods, but only on a small subset of DGP settings.

Pick 2–3 representative DGP settings from 2b/2c: one "easy" (methods should all work), one "moderate" (methods should differ), one "hard" (pushes limits). Run all methods × these 2–3 DGPs × 5–10 reps.

**Check for**:
- Methods that crash or fail to converge → investigate or drop
- Method settings that are clearly dominated (worse on every metric than another setting of the same method) → drop now, before the full run
- Unexpected runtime outliers → flag for Phase 3 timing

```r
# Representative DGP settings from screening
representative_dgps <- dgp_settings |> filter(dgp_id %in% c(3, 8, 15))  # easy, moderate, hard

method_screen <- map_dfr(seq_len(nrow(representative_dgps)), function(i) {
    dgp_row <- representative_dgps[i, ]
    map_dfr(1:10, function(rep) {
        data <- generate_data(dgp_row, seed = rep)
        map_dfr(seq_len(nrow(method_settings)), function(j) {
            tryCatch({
                fit <- fit_method(data, method_settings[j, ])
                extract_metrics(fit, data, method_settings[j, ]) |>
                    mutate(dgp_id = dgp_row$dgp_id, rep = rep)
            }, error = function(e) {
                tibble(method_name = method_settings$method_name[j],
                       dgp_id = dgp_row$dgp_id, rep = rep,
                       success = FALSE, error_msg = conditionMessage(e))
            })
        })
    })
})

# Failure rate by method
method_screen |>
    summarise(failure_rate = 1 - mean(success, na.rm = TRUE), .by = method_name) |>
    arrange(desc(failure_rate))
```

### 2e. Choose the Final Design

**Goal**: Assemble the DGP grid for the production run based on everything learned in 2a–2d.

**Principles**:
1. **Concentrate levels in the informative zone** — where methods actually differ. Don't waste reps on settings where all methods are equivalent.
2. **Include one "easy" and one "hard" anchor** — these provide context (sanity check and stress test) even if methods don't differentiate much.
3. **For discrete factors** (e.g., error distribution, covariance structure): include all levels that produced meaningfully different results in 2a–2c.
4. **State the expected design size**: number of DGP cells × number of methods × n_reps = total fits. Cross-check with Phase 3 timing estimates.

```r
# Document the final design
dgp_settings <- expand_grid(
    snr = c(3, 10, 30),          # informative zone from 2b, plus anchors
    n = c(200, 500, 1000),
    error_dist = c("normal", "t5")  # both mattered in screening
) |> mutate(dgp_id = row_number())

cat(sprintf("Final design: %d DGP cells × %d methods × %d reps = %d total fits\n",
            nrow(dgp_settings), nrow(method_settings), config$n_reps,
            nrow(dgp_settings) * nrow(method_settings) * config$n_reps))
```

### Pilot Calibration Checklist

1. [ ] OAT screening completed for each DGP factor (2a)
2. [ ] Calibration profile plots reviewed; informative zone identified per factor (2b)
3. [ ] Interactions checked on reduced design; crossed factors identified (2c)
4. [ ] All candidate methods tested on representative DGPs; failures and dominated methods dropped (2d)
5. [ ] Final DGP grid documented with rationale for each factor/level choice (2e)
6. [ ] Expected total fits computed and cross-checked with timing estimates (→ Phase 3)

---

## Phase 3: Timing Estimation

**Always measure timing before scaling up.**

```r
pilot_with_timing <- function(dgp_settings, method_settings, n_reps = 5) {
    cat("Running timing pilot...\n")

    timings <- map_dfr(seq_len(nrow(dgp_settings)), function(i) {
        dgp_row <- dgp_settings[i, ]

        t0 <- Sys.time()
        for (rep in seq_len(n_reps)) {
            data <- generate_data(dgp_row, seed = rep)
            for (j in seq_len(nrow(method_settings))) {
                fit <- fit_method(data, method_settings[j, ])
            }
        }
        elapsed <- as.numeric(difftime(Sys.time(), t0, units = "secs"))

        tibble(
            dgp_id = i,
            n = dgp_row$n,
            n_reps = n_reps,
            total_secs = elapsed,
            secs_per_rep = elapsed / n_reps
        )
    })

    # Extrapolate to full run
    n_total_reps <- nrow(dgp_settings) * config$n_reps
    estimated_serial <- sum(timings$secs_per_rep) * config$n_reps
    estimated_parallel <- estimated_serial / config$n_workers

    cat(sprintf("\nTiming summary:\n"))
    cat(sprintf("  Per-rep time by DGP: %.1f - %.1f sec\n",
                min(timings$secs_per_rep), max(timings$secs_per_rep)))
    cat(sprintf("  Total reps: %d\n", n_total_reps))
    cat(sprintf("  Estimated serial time: %.1f hours\n", estimated_serial / 3600))
    cat(sprintf("  Estimated parallel time (%d workers): %.1f hours\n",
                config$n_workers, estimated_parallel / 3600))

    timings
}
```

**Rule of thumb:** If estimated parallel time > 1 hour, use incremental saves per DGP.

---

## Phase 4: Small-Scale Validation

Run with reduced n_reps (10-50) and check:

```r
# Quick validation run
config_validation <- config
config_validation$n_reps <- 20

# Run benchmark
results_pilot <- run_benchmark(dgp_settings, method_settings, config_validation)

# Check metrics
validate_pilot <- function(results) {
    summary <- results |>
        filter(success) |>
        summarise(
            coverage = mean(coverage),
            bias = mean(bias),
            rmse = mean(rmse),
            .by = c(method_name, dgp_id)
        )

    # Coverage should be roughly 90-95% (if using 95% CIs)
    coverage_check <- summary |>
        filter(coverage < 0.80 | coverage > 0.99)

    if (nrow(coverage_check) > 0) {
        cat("WARNING: Coverage outside expected range:\n")
        print(coverage_check)
    } else {
        cat("Coverage looks reasonable (80-99% range)\n")
    }

    # Bias should be small relative to RMSE
    bias_check <- summary |>
        mutate(rel_bias = abs(bias) / rmse) |>
        filter(rel_bias > 0.5)

    if (nrow(bias_check) > 0) {
        cat("WARNING: Large relative bias:\n")
        print(bias_check)
    } else {
        cat("Relative bias looks reasonable (<50% of RMSE)\n")
    }

    summary
}
```

---

## Debugging: Bisect the Pipeline

When results look wrong, check each stage in order:

### Stage 1: Data Generation

```r
# Check truth
data <- generate_data(dgp_settings[1, ], seed = 1)

# Is truth what you expect?
plot(data$grid, data$truth$values, type = "l", main = "Truth function")

# Are constraints satisfied?
if (!is.null(data$weights)) {
    centered_mean <- weighted.mean(data$truth$values, data$weights)
    cat(sprintf("Centering check: %.2e (should be ~0)\n", centered_mean))
}

# Is noise level correct?
signal_var <- var(data$signal)
noise_var <- var(data$y - data$signal)
empirical_snr <- signal_var / noise_var
cat(sprintf("Empirical SNR: %.1f (target: %.1f)\n", empirical_snr, dgp_settings$snr[1]))
```

### Stage 2: Fit Object

```r
fit <- fit_method(data, method_settings[1, ])

# Did it converge?
# (Method-specific checks here)

# Are coefficients reasonable?
summary(get_estimate(fit))

# Warnings during fitting?
# (Check for messages about convergence)
```

### Stage 3: Metric Extraction

```r
# Are grids aligned?
cat(sprintf("Truth grid length: %d\n", length(data$grid)))
cat(sprintf("Estimate length: %d\n", length(get_estimate(fit))))

# Is truth interpolated correctly (if needed)?
# Compare truth at estimate grid points

# Check SE extraction
se <- get_se(fit)
cat(sprintf("SE range: [%.4f, %.4f]\n", min(se), max(se)))
```

### Stage 4: Aggregation

```r
# Check dimensions before/after aggregation
results_raw <- extract_metrics(fit, data, method_settings[1, ])
cat(sprintf("Metrics per fit: %d rows, %d cols\n", nrow(results_raw), ncol(results_raw)))

# Are you averaging over the right dimensions?
# (Should be term-level, not pointwise)
```

---

## Diagnostic Visualizations

These examples are domain-specific; adapt to your methods.

### Truth vs Estimate Scatter

```r
plot_truth_vs_estimate <- function(truth, estimate, se = NULL, title = "") {
    plot(truth, estimate, xlab = "Truth", ylab = "Estimate", main = title)
    abline(0, 1, col = "red")

    if (!is.null(se)) {
        # Add CI whiskers
        arrows(truth, estimate - 1.96*se, truth, estimate + 1.96*se,
               length = 0.02, angle = 90, code = 3, col = "gray50")
    }
}
```

### Z-Score Distribution

```r
plot_zscore_distribution <- function(estimate, truth, se, expected_sd = 1) {
    z <- (estimate - truth) / se

    hist(z, breaks = 30, freq = FALSE,
         main = sprintf("Z-scores (SD = %.2f, expected = %.2f)", sd(z), expected_sd),
         xlab = "Z-score")

    # Overlay standard normal
    curve(dnorm(x), add = TRUE, col = "red", lwd = 2)

    # Quantile-quantile
    qqnorm(z); qqline(z, col = "red")
}
```

### Coverage Heatmap (for functional data)

```r
plot_coverage_heatmap <- function(results, grid_var, group_var) {
    # results should have columns: grid_var, group_var, covered (logical)
    coverage_by_location <- results |>
        group_by(across(all_of(c(grid_var, group_var)))) |>
        summarise(coverage = mean(covered), .groups = "drop")

    ggplot(coverage_by_location, aes(x = .data[[grid_var]], y = .data[[group_var]], fill = coverage)) +
        geom_tile() +
        scale_fill_gradient2(low = "red", mid = "white", high = "blue",
                             midpoint = 0.95, limits = c(0.8, 1)) +
        theme_minimal() +
        labs(title = "Coverage by location", fill = "Coverage")
}
```

---

## Code Review Gates

Code review gates use external AI agents (Codex, Gemini, or council-of-bots) to catch bugs that self-review misses. Benchmarks have complex data flow (DGP → fit → metrics → aggregation) where subtle bugs propagate silently — a wrong index or off-by-one produces plausible-looking but incorrect results.

### Gate R1: Post-Implementation Code Review

**When**: After all benchmark files are written and Phase 0/1 pass, but *before* running the pilot.

**What to review**: Every file in the benchmark. Group files by responsibility (2-3 files per reviewer) and run reviews in parallel.

**Grouping pattern** for a typical benchmark:
- Group A: data generation + metrics (correctness of DGPs and performance measures)
- Group B: method wrappers + config/design (correct method calls, valid design tables)
- Group C: runner + analysis (parallelization safety, aggregation correctness)

**How to run**: Use `/codex` (for single-reviewer) or `/council-of-bots` (for multi-agent). Spawn up to 3 reviewers in parallel, each assigned a file group. The review prompt should include:
1. The file contents
2. The ADEMP plan (so reviewers know intent)
3. Specific review concerns: error handling, metric formulas, seed management, boundary cases

```
Review {files} for the following benchmark:
[paste ADEMP summary]
Focus on: correctness of metric formulas, error handling in tryCatch,
seed management, boundary cases, and consistency with the plan.
```

**What to fix**: Address all HIGH/CRITICAL findings before proceeding. MEDIUM findings fix now if quick, defer if not. LOW findings are optional.

**Severity guide**:
- CRITICAL: Wrong metric formula, silent data loss, seed collision
- HIGH: Missing error handling that crashes workers, aggregation bug
- MEDIUM: Style issues, redundant code, missing edge case guards
- LOW: Naming conventions, documentation gaps

### Gate R2: Pre-Production Review

**When**: After pilot calibration (Phase 2-4), before the full production run (Phase 5).

**What to review**: Pilot results + any code changes made during calibration. Use `/council-of-bots` to get diverse perspectives.

**Review prompt**:
```
Review these pilot results for a benchmark comparing [methods] across [DGPs].
[paste summary tables: failure rates, metric ranges, timing estimates]
[paste any code changes since R1]

Check for:
1. Are failure rates acceptable (<5% for well-specified DGPs)?
2. Do metric ranges look plausible (not all zeros, not all identical)?
3. Are there unexpected patterns (method X should beat Y on this DGP)?
4. Is timing feasible for full run?
5. Any code changes introduce new bugs?
```

### Gate R3: Results Review

**When**: After the full production run completes, before reporting results.

**What to review**: Final results tables, figures, and statistical analysis.

**Review prompt**:
```
Review these benchmark results comparing [methods] across [DGPs].
[paste key tables and figures]
Check for:
1. Do rankings match theoretical expectations for well-specified DGPs?
2. Are MC SEs small enough to support conclusions?
3. Any suspicious patterns (identical results, unexplained failures)?
4. Do figures accurately represent the data?
```

### Practical Tips

- **Parallelize reviews**: Always run multiple reviewers concurrently. The wall-clock cost of 3 parallel reviews ≈ 1 serial review.
- **Fix findings incrementally**: Apply fixes from completed reviews while waiting for others.
- **Re-run validation after fixes**: After applying review fixes, re-run Phase 0 known-answer tests to ensure fixes didn't break anything.
- **Track what was reviewed**: Note which files were reviewed and by whom. This creates an audit trail.

---

## Incremental Saving for Long Runs

For benchmarks >1 hour, save after each DGP:

```r
run_benchmark_incremental <- function(dgp_settings, method_settings, config) {
    output_dir <- config$output_dir
    dir.create(output_dir, recursive = TRUE, showWarnings = FALSE)

    for (dgp_id in dgp_settings$dgp_id) {
        output_file <- file.path(output_dir, sprintf("dgp_%03d.rds", dgp_id))

        # Skip if already done (for resume capability)
        if (file.exists(output_file)) {
            cat(sprintf("Skipping DGP %d (already done)\n", dgp_id))
            next
        }

        dgp_row <- dgp_settings |> filter(dgp_id == !!dgp_id)
        cat(sprintf("Running DGP %d/%d...\n", dgp_id, nrow(dgp_settings)))

        results <- run_dgp_replications(dgp_row, method_settings, config)

        saveRDS(results, output_file)
        cat(sprintf("  Saved: %s\n", output_file))
    }

    # Combine all results
    all_files <- list.files(output_dir, "dgp_.*\\.rds", full.names = TRUE)
    all_results <- map_dfr(all_files, readRDS)

    saveRDS(all_results, file.path(output_dir, "combined_results.rds"))
    all_results
}
```

---

## Pre-Run Checklist

### Before Writing Code

- [ ] ADEMP defined (Aims, DGPs, Estimands, Methods, Performance measures)
- [ ] Sample size justified (Monte Carlo SE calculation)
- [ ] DGP parameters chosen based on calibration
- [ ] Constraint requirements documented

### Before Running Pilot (Gate R1)

- [ ] All benchmark files written and pass Phase 0/1
- [ ] **Code reviews completed** on all files (parallel, 2-3 files per reviewer)
- [ ] All HIGH/CRITICAL review findings fixed
- [ ] Known-answer tests re-run after fixes (all pass)

### Before Running Full Benchmark (Gate R2)

- [ ] `debug_single_fit()` works for all DGP/method combinations
- [ ] Timing pilot completed, runtime acceptable
- [ ] Small-scale validation shows reasonable metrics
- [ ] **Council-of-bots review** of pilot results completed
- [ ] Incremental saves enabled (if runtime > 1 hour)
- [ ] Bug checklist reviewed (see `bug-checklist.md`)

### After Running (Gate R3)

- [ ] Check failure rate (should be <5% typically)
- [ ] Check coverage is in expected range
- [ ] Check Monte Carlo SEs are small enough
- [ ] **Council-of-bots review** of final results completed
- [ ] Save results with config (for reproducibility)

---

## Common Iteration Patterns

### Pattern: Coverage Too Low

1. Check constraint matching (most common)
2. Check grid alignment
3. Check SE extraction
4. Try moderate SNR only
5. Check method-specific issues (convergence, etc.)

### Pattern: Coverage Too High (>99%)

1. Check that CIs are not too wide
2. Check SNR is not too low
3. Verify SE formula is correct

### Pattern: High Variance Across Reps

1. Increase n_reps
2. Check seed management (are reps truly independent?)
3. Consider stratifying by difficult DGPs

### Pattern: One Method Always Fails

1. Check method-specific requirements
2. Add filtering for applicable methods
3. Log and report failures separately

---

## Diagnosing Coverage Problems

When coverage is low, systematically diagnose the root cause.

### SE Ratio Diagnostic

The **SE ratio** = (actual SD of estimate - truth) / (mean reported SE) is a critical diagnostic:

| SE Ratio | Interpretation | Action |
|----------|----------------|--------|
| ≈ 1.0 | SEs are correct | Coverage issues are elsewhere (centering, constraints) |
| >> 1 (e.g., 1.5-2+) | SEs underestimate uncertainty | Usually smoothing bias - increase k_model |
| << 1 | SEs overestimate uncertainty | Check for overfitting or wrong variance estimate |

```r
diagnose_se_ratio <- function(results, term_type) {
    # results should have columns: estimate, truth, se, term
    term_results <- results |> filter(term == term_type)

    actual_sd <- sd(term_results$estimate - term_results$truth)
    mean_se <- mean(term_results$se)
    se_ratio <- actual_sd / mean_se

    cat(sprintf("Term: %s\n", term_type))
    cat(sprintf("  Actual SD: %.4f\n", actual_sd))
    cat(sprintf("  Mean SE:   %.4f\n", mean_se))
    cat(sprintf("  SE ratio:  %.2f\n", se_ratio))

    if (se_ratio > 1.3) {
        cat("  -> SEs underestimate uncertainty (smoothing bias?)\n")
    } else if (se_ratio < 0.8) {
        cat("  -> SEs overestimate uncertainty\n")
    } else {
        cat("  -> SEs look correct\n")
    }

    se_ratio
}
```

Compute per term type to identify which terms have SE problems.

### Smoothing Bias and Basis Dimensions

For penalized spline methods (GAMs, P-splines), the model's basis dimension **must exceed** the truth's complexity.

**The problem:**
- If k_model < k_truth: Model cannot capture truth → smoothing bias → low coverage
- If k_model ≈ k_truth: Marginal capacity → some bias remains
- If k_model > k_truth: Model has capacity → coverage should be nominal

**Rule of thumb:**
```
k_model ≥ k_truth + 4
```

For example, if truth uses k=8 basis functions, use k_model ≥ 12.

**Consistent wiggliness across term types:**

If using a `wiggliness` parameter to control truth smoothness, ensure **k_truth is the same** for all term types. Otherwise, the same wiggliness value produces different effective smoothness:

```r
# WRONG: Different k means wiggliness=0.1 produces different smoothness
k_truth = list(
    ff_s = 8, ff_t = 8,      # 2D terms: smoother
    linear = 15, intercept = 15  # 1D terms: wigglier!
)

# RIGHT: Same k for all marginals
k_truth = list(
    ff_s = 8, ff_t = 8,
    linear = 8, intercept = 8
)
```

### Coverage Diagnosis Workflow

When coverage is low for a term:

1. **Compute SE ratio** for that term
2. If SE ratio >> 1:
   - Increase k_model and retest
   - If coverage improves → smoothing bias was the issue
   - Fix by ensuring k_model > k_truth + 4
3. If SE ratio ≈ 1:
   - SEs are correct, problem is elsewhere
   - Check truth/estimate alignment, centering conventions
4. If SE ratio << 1:
   - SEs overestimate uncertainty (coverage will be too high)
   - Check for overfitting or wrong variance estimate
   - Verify SE formula matches the estimator being used
