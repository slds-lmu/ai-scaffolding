---
name: setup-benchmark
description: |
  Monte Carlo experiment design for comparing statistical methods. Use when
  the user asks to "set up a benchmark", "create a simulation study",
  "compare methods across DGPs", "design a Monte Carlo experiment",
  "run a coverage study", or needs guidance on: (1) benchmark architecture
  and data flow, (2) parallelization with furrr/future, (3) truth function
  design and constraint matching, (4) seed management and reproducibility,
  (5) performance measures and Monte Carlo SEs. R-specific with tidyverse/furrr
  patterns. Implements ADEMP framework (Morris et al. 2019).
---

# Monte Carlo Benchmark Setup

This skill guides the setup of Monte Carlo experiments comparing statistical methods across data-generating processes (DGPs). Follow the ADEMP framework (Morris et al. 2019) and these principles to avoid common bugs.

## ADEMP Framework for Planning

Before writing code, define each element clearly:

| Element | Question | Example |
|---------|----------|---------|
| **A**ims | What do we want to learn? | "Compare coverage of CI methods under model misspecification" |
| **D**ata-generating mechanisms | How is data simulated? | Sample sizes, SNR levels, truth function types |
| **E**stimands | What parameters are targeted? | Regression coefficients, smooth functions, predictions |
| **M**ethods | What approaches are compared? | Different estimators, penalty choices, basis functions |
| **P**erformance measures | How is success quantified? | Bias, coverage, RMSE, empirical SE |

**Write out ADEMP before coding.** This becomes your methods section.

**Simulation types** (clarify which one you're running):
- **Proof-of-concept**: Show a new method works (few DGPs, illustrative)
- **Stress-test**: Find where a method breaks (extreme parameter values)
- **Comparison**: Rank methods fairly (full factorial, multiple metrics, many reps)

See `references/study-design.md` for detailed guidance on each type.

## Factorial Design for DGPs

The **final production design** should vary factors **factorially** to capture interactions (OAT is fine during Phase 2a screening — see `references/development-workflow.md`):

```r
# WRONG for final design: One-at-a-time (misses interactions)
settings <- bind_rows(
    tibble(n = c(100, 500, 1000), snr = 10),
    tibble(n = 500, snr = c(5, 10, 50))
)

# RIGHT for final design: Full factorial
settings <- expand_grid(
    n = c(100, 500, 1000),
    snr = c(5, 10, 50)
)
```

If full factorial is infeasible, use fractional factorial design or justify exclusions.

**Well-specified and misspecified DGPs**: Every benchmark needs both:
- **Well-specified settings** — the method's assumptions hold (correct error distribution, truth within the model's hypothesis space and identifiable from the data, structural assumptions satisfied). These establish that the method works *when it should*.
- **Deliberately misspecified settings** — specific assumptions are violated in controlled ways (wrong error distribution, truth exceeding model capacity, violated structural assumptions). These reveal robustness and failure modes.

Testing only under well-specification is incomplete (no robustness information); testing only under misspecification is unfair. During Phase 2 piloting, verify that your "well-specified" DGPs actually are (check convergence, coverage ≈ nominal), and that your violations produce the intended effect. See `references/study-design.md` for a taxonomy of violations and how to introduce them.

**Alternative for continuous parameter spaces**: Use **Latin Hypercube Sampling** when factors are continuous (e.g., SNR ∈ [1, 100]) rather than discretizing into arbitrary grid levels:

```r
library(lhs)
design <- randomLHS(n = 50, k = 3)  # 50 scenarios, 3 factors
scenarios <- tibble(
    n = round(qunif(design[, 1], 50, 2000)),
    snr = qunif(design[, 2], 1, 50),
    rho = qunif(design[, 3], 0, 0.9)
)
```

Rule of thumb: ~10 × d scenarios (d = number of factors) for reasonable coverage. See `references/study-design.md` for details.

## Sample Size: Choosing n_sim

Choose n_sim based on required Monte Carlo SE precision for your key performance measure.

**For coverage** (most common):
```
n_sim = E(Coverage) × (1 - E(Coverage)) / (MC_SE_required)²
```

| Target Coverage | MC SE Required | n_sim Needed |
|-----------------|----------------|--------------|
| 95% | 0.5% | 1,900 |
| 95% | 1.0% | 475 |
| 50% (worst case) | 0.5% | 10,000 |

**For bias**: MC_SE(Bias) = EmpSE / sqrt(n_sim). If EmpSE ≈ 0.2 and you need MC_SE < 0.005, then n_sim > 1,600.

**Always report Monte Carlo SEs** with performance estimates. 93% of simulation studies fail to do this (Morris et al. 2019).

## Core Architecture: One Dataset, All Methods

Structure benchmarks so each simulated dataset is fit by all **applicable** methods before moving to the next replication.

**Note:** Not all methods may apply to all DGPs. Define a function to determine valid combinations:

```r
get_applicable_methods <- function(dgp_row, method_settings) {
    # Example: some methods only work with gaussian errors
    if (dgp_row$error_dist != "gaussian") {
        method_settings <- filter(method_settings, supports_nongaussian)
    }
    # Example: some methods require minimum sample size
    method_settings <- filter(method_settings, min_n <= dgp_row$n)
    method_settings
}
```

This avoids running methods on DGPs where they're known to fail or be inappropriate.

```
for each (dgp, rep):
    data <- generate_data(dgp, seed)
    for each method:
        result <- fit_and_evaluate(data, method, truth)
```

This ensures fair comparison (same data), efficient computation (data generated once), and easier debugging.

## Seed Management

Set seed **once** at the beginning, store states for reproducibility:

```r
# Set base seed ONCE
set.seed(config$base_seed)

# Generate all task seeds upfront
task_seeds <- sample.int(.Machine$integer.max, n_total_tasks)

# Store RNG state at start of each rep for debugging
for (i in seq_len(n_reps)) {
    rng_state <- .Random.seed
    set.seed(task_seeds[i])
    # ... generate and analyze data
}
```

**Never** set.seed inside a loop to the same value. **Never** let methods that use internal RNG reset the global seed.

For parallel runs with `furrr`, use `seed = TRUE` in `furrr_options()` to enable L'Ecuyer-CMRG parallel-safe RNG. This generates one independent stream per task via `nextRNGStream()`, reproducible regardless of worker count. Set `set.seed()` before the `future_map()` call. See Parallelization section below and `references/r-packages.md` for details.

## Performance Measures

Store estimates data: θ̂ᵢ, SE(θ̂ᵢ), and indicators per (dgp, method, estimand, rep).

| Measure | Definition | MC SE Formula |
|---------|------------|---------------|
| Bias | E[θ̂] - θ | EmpSE / √n_sim |
| Empirical SE | √Var(θ̂) | EmpSE / √(2(n_sim-1)) |
| Coverage | Pr(CI contains θ) | √(Cov×(1-Cov)/n_sim) |
| Relative error in ModSE | (ModSE - EmpSE)/EmpSE | See Morris et al. Table 6 |

**Bias-eliminated coverage**: Compare CI to θ̄ instead of θ to decompose whether undercoverage is from bias vs wrong SE.

## Truth Function Design

Truth functions MUST satisfy the same constraints as the model:

```r
# If model centers with Simpson weights:
f_true <- function(x, weights) {
    raw <- sin(2 * pi * x)
    raw - weighted.mean(raw, weights)  # Same weights as model!
}
```

See `references/truth-functions.md` for weight types and constraint patterns.

## Metric Aggregation Strategy

Aggregate at the **term level**, not pointwise:

```r
# RIGHT: Store term-level summaries
tibble(
    term = "f(x)",
    coverage = mean(lower <= truth & truth <= upper),
    bias = mean(estimate - truth),
    rmse = sqrt(mean((estimate - truth)^2))
)
```

Exception: Store pointwise only when diagnosing WHERE coverage fails.

## Parallelization

Use `furrr` with **explicit exports** and `seed = TRUE` for reproducibility:

```r
plan(multisession, workers = parallel::detectCores() - 1)

set.seed(config$base_seed)  # Set BEFORE future_map for reproducibility

furrr_opts <- furrr_options(
    globals = c("generate_data", "fit_method", "extract_metrics",
                "truth_functions"),  # ALL user functions
    seed = TRUE  # L'Ecuyer-CMRG: one independent stream per task
)

results <- future_map_dfr(tasks, run_task, .options = furrr_opts, .progress = TRUE)
```

**Minimize data transfer**: Avoid exporting large objects to workers. If workers need large lookup tables, have them load data on first use rather than passing via `globals`. See `references/r-packages.md`.

## Threats to Validity

Simulation studies have their own methodological pitfalls. Watch for these:

1. **Design variability dwarfing method differences** (Chen et al. 2016): Different random scenario draws can produce larger performance swings than actual method differences.
   *Mitigation*: sufficient replications, paired comparisons, report MC SEs.
2. **Over-optimism / garden of forking paths** (Niessl et al. 2022): Trying many configurations and reporting only favorable ones.
   *Mitigation*: lock ADEMP before seeing results.
3. **Resampling-from-dataset pitfall** (Morris et al. 2019): Bootstrap DGPs limit conclusions to one dataset's distribution.
   *Mitigation*: prefer parametric DGPs; state limitation if resampling is necessary.
4. **Scenario selection bias**: DGPs that favor one method.
   *Mitigation*: include settings where each method is expected to win.

**Three pillars of trustworthy benchmarks**: (1) multiple metrics (3-5), (2) enough scenarios across conditions, (3) sufficient replications with MC SEs.

**Practical significance thresholds**: Set before running. A difference is meaningful only if it exceeds both 2× MC SE and a pre-set practical threshold (e.g., ±2% coverage, >10% RRMSE difference). Use normalized measures (RRMSE = RMSE / RMSE_baseline) for cross-DGP comparability.

See `references/study-design.md` for the full discussion, red-flag checklist, and pre-registration guidance.

## Bug Checklist

See `references/bug-checklist.md` for detailed code examples:

1. `expand_grid()` not `data.frame()` for factorial design
2. `rep(x, each=n)` vs `rep(x, times=n)` correct
3. All functions exported to parallel workers
4. Truth uses same centering weights as model
5. Truth evaluated on same grid as coefficients
6. Truth functions satisfy model constraints
7. Seeds managed correctly (not reset in loop)
8. Term-level aggregation (not pointwise)
9. Same data for all methods within rep
10. Failures logged, not silently dropped
11. **k_model > k_truth** for penalized splines (avoid smoothing bias)
12. **k_truth consistent** across term types (so wiggliness means the same thing)
13. **Equivalent-design instability**: conclusions change with different seeds (increase n_reps)
14. **Metric/scenario cherry-picking**: lock ADEMP before results
15. **Resampling-from-dataset overgeneralization**: prefer parametric DGPs
16. **RNG pollution in sub-operations**: When injecting `set.seed()` inside a pipeline step (e.g., contamination after data generation), save/restore the RNG state with `on.exit()` — otherwise downstream workers get polluted state
17. **Defensive dedup assertions**: When resuming interrupted runs, verify duplicated rows have identical *deterministic* metrics (not timing) before dropping: `identical(first[check_cols], dupe[check_cols])` — `all.equal` on the full row fails because `time` is non-deterministic
18. **Semi-synthetic DGP amplitude**: Real data has high inter-subject variability — use `amp_sd >= 0.5` for realistic amplitude, never `amplitude = "none"` for real-data-derived DGPs

## Development Workflow

Building a benchmark is iterative. Follow these phases and **never skip review gates**:

0. **Known-answer validation**: Verify infrastructure on a trivial problem (e.g., OLS on linear model → ~95% coverage)
1. **Single-fit debugging**: Run `debug_single_fit()` to verify one (dgp, method) works
- **R1. Code review gate**: Run `/codex` or `/council-of-bots` reviews on all new files before piloting. Parallelize: assign 2-3 files per reviewer, spawn up to 3 reviewers concurrently. Fix all HIGH/CRITICAL findings, re-run known-answer tests.
2. **Pilot calibration**: Screen factors one-at-a-time → find informative ranges → check interactions → screen methods → choose final design
3. **Timing estimation**: Time a few reps, extrapolate to full run
4. **Small-scale validation**: Run n_rep=10-50, check metrics look right
- **R2. Pre-production review**: Run `/council-of-bots` on pilot results + any code changes. Verify failure rates, metric plausibility, and expected rankings before committing to full run.
5. **Full production run**: Final n_rep with incremental saves
- **R3. Results review**: Run `/council-of-bots` on final results before reporting. Check rankings match theory, MC SEs support conclusions, no suspicious patterns.

**Always record computation times** in your metrics (add `fit_time` to output tibbles). This enables timing estimation and helps identify slow methods.

See `references/development-workflow.md` for detailed guidance on piloting, debugging, review gate procedures, and diagnostic visualizations.

## When Coverage Fails

| Symptom | Likely Cause | Diagnostic |
|---------|--------------|------------|
| ~50% | Estimate/truth misaligned | Check constraint matching |
| ~34% | Centering weight mismatch | Compare Simpson vs rectangular |
| ~80% | Slight bias or SE underestimation | Check bias-eliminated coverage |
| Varies by term | Per-term constraint issues | Check each term separately |
| SE ratio >> 1 | Smoothing bias (k_model too small) | Increase model basis dimension |

**Key insight**: Bias dominates coverage as n_obs increases. If bias is constant, coverage deteriorates with larger samples.

See `references/development-workflow.md` for the SE ratio diagnostic and smoothing bias diagnosis workflow.

## Visualization

Beyond standard tables, use these diagnostic plots designed for simulation output:

- **Zip plot**: CIs ranked by |z-score|, colored by coverage — reveals patterns in non-coverage
- **Lollipop plot**: Point estimate ± MC CI per method/scenario — compact method comparison
- **Nested loop plot**: Performance across all factorial settings in one panel — interaction detection
- **Heat map**: DGP rows × method columns, fill = metric — overview of large designs
- **Paired comparison (Bland-Altman)**: Plot method differences (not raw values) to exploit paired design

The `rsimsum` package generates zip, lollipop, nested loop, and heat plots via `autoplot()`. See `references/visualization.md` for R code and `references/r-packages.md` for the package ecosystem.

## Reporting

Structure results by ADEMP. For tables:
- Rows: DGP settings
- Columns: Methods (side-by-side for comparison)
- Performance measures in separate panels

**Always include**:
- Monte Carlo SEs (in parentheses or as CI bars)
- Number of replications
- Proportion of failures/non-convergence

## Files

- `references/bug-checklist.md` - 15 critical bugs with code examples (general, spline-specific, study design)
- `references/code-template.md` - Complete R benchmark template
- `references/truth-functions.md` - Truth function design patterns
- `references/development-workflow.md` - Iterative development guide (Phase 0 validation, piloting, debugging, SE ratio diagnostics)
- `references/performance-measures.md` - Performance measure definitions, MC SE formulas, normalized measures
- `references/study-design.md` - Simulation study design principles (types, threats to validity, pre-registration)
- `references/visualization.md` - Reporting plots (zip, lollipop, nested loop, heat map, paired comparison)
- `references/r-packages.md` - R package ecosystem (rsimsum, simChef, lhs, furrr details)
- `examples/minimal-benchmark.R` - Minimal working benchmark with timing and diagnostics

## References

- Morris TP, White IR, Crowther MJ. Using simulation studies to evaluate statistical methods. *Statistics in Medicine*. 2019;38:2074-2102.
- Chen RB, Hsu YW, Hung Y, Wang W. Discrete-event simulation and Monte Carlo methods. *JSPI*. 2016;170:61-75.
- Niessl C, Herrmann M, Greven S. Over-optimism in benchmark studies and the multiplicity of design and analysis options. *WIREs DMKD*. 2022;12:e1441.
