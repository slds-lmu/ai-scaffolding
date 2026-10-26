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

Two ways this goes wrong silently: calling `set.seed()` inside the loop with the
same value makes every replicate draw the same data, so n_sim is effectively 1
while the Monte Carlo SEs claim otherwise; and a method that resets the global
seed internally (some bootstrap and CV wrappers do) makes subsequent replicates
correlated with it. Seed once per task from the pre-drawn `task_seeds`, and wrap
any sub-step that needs its own seed in an RNG save/restore (`on.exit()`, see
item 16 of the Bug Checklist below).

With `furrr` there are two seeding strategies. Pick one; combining them is
double seeding, and the outer one silently loses.

- **Pre-drawn per-task seeds** (what the template and the example do, and the
  default for benchmarks): draw `task_seeds` once as above, call
  `set.seed(task$seed)` inside each task, and pass `furrr_options(seed = NULL)`.
  `NULL` tells future you are handling RNG yourself, so it neither injects a
  stream nor warns about in-task RNG use. Results are reproducible regardless
  of worker count or chunking, and any single task can be re-run in isolation
  by its id, which is what makes failures debuggable.
- **`furrr_options(seed = TRUE)`**: future assigns one L'Ecuyer-CMRG stream per
  element via `nextRNGStream()`, derived from the `.Random.seed` at the time of
  the call, so `set.seed()` once before `future_map()`. Also reproducible
  regardless of worker count, but a task's stream depends on its position in
  the call, so re-running one task alone means recreating the whole sequence.
  Use it when the tasks have no natural id to seed from.

Never `set.seed()` inside a task *and* pass `seed = TRUE`. See
`references/r-packages.md` for how the streams work.

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

Truth functions have to satisfy the same constraints as the model. If the model
centers a smooth with Simpson weights and the truth is centered with rectangular
weights (or not at all), estimand and estimate differ by a constant offset that no
amount of data removes, and coverage collapses toward 50% or 34% (see "When
Coverage Fails"):

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

Use `furrr` with the per-task seeding from the Seed Management section, and
let future find the globals itself:

```r
# Pin BLAS threads BEFORE plan(): each multisession worker is a fresh R process
# that inherits these and otherwise spawns its own OpenBLAS pool (7 workers × 8
# threads on 8 cores measured a 10× slowdown). For fork-based mclapply this is
# too late — set OPENBLAS_NUM_THREADS=1 in the shell that launches Rscript.
Sys.setenv(OPENBLAS_NUM_THREADS = "1", OMP_NUM_THREADS = "1", MKL_NUM_THREADS = "1")
plan(multisession, workers = parallelly::availableCores(omit = 1))

set.seed(config$base_seed)  # Set BEFORE future_map for reproducibility

furrr_opts <- furrr_options(
    seed = NULL,                 # tasks call set.seed(task$seed) themselves; TRUE here
                                 # would double-seed (see Seed Management)
    packages = c("mgcv")         # only for what future cannot infer from the globals:
                                 # S3 methods reached via dispatch, functions called by
                                 # string (do.call("fn")), formula specials
)

results <- future_map_dfr(tasks, run_task, .options = furrr_opts, .progress = TRUE)
```

Do not hand-list `globals`. future walks the call graph of `run_task` recursively,
exports every helper it reaches (top-level definitions and `source()`d files
included), and attaches the packages those globals live in, so a bare `gam()` call
brings mgcv along by itself. In furrr, anything other than a plain `TRUE` for
`globals` (a character vector, a named list, or `structure(TRUE, add = ...)`)
replaces that auto-detection entirely, and the first helper you did not list kills
every worker with `could not find function` (observed; the tryCatch error handler
then dies on the same missing helper). `parallelly::availableCores()` respects
SLURM, cgroup and `mc.cores` limits where `detectCores()` does not.

**Minimize data transfer**: a large object referenced inside `run_task` is
auto-exported to every worker. If workers need a big lookup table, have them load
it on first use instead. See `references/r-packages.md`.

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
3. Helpers visible to workers: defined at top level, `packages =` listed, no hand-written `globals`
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
2. **Smoke tests**: Verify end-to-end executability with **absolute minimum settings** — see below.
3. **Pilot calibration**: Screen factors one-at-a-time → find informative ranges → check interactions → screen methods → choose final design
4. **Timing estimation**: Time a few reps, extrapolate to full run
5. **Small-scale validation**: Run n_rep=10-50, check metrics look right
- **R2. Pre-production review**: Run `/council-of-bots` on pilot results + any code changes. Verify failure rates, metric plausibility, and expected rankings before committing to full run.
6. **Full production run**: Final n_rep with incremental saves
- **R3. Results review**: Run `/council-of-bots` on final results before reporting. Check rankings match theory, MC SEs support conclusions, no suspicious patterns.

R1–R3 are the whole apparatus. Do not add code-hash stamps that force reruns, decision
rules registered in advance for a throwaway pilot, amendment ledgers, or further gates
unless the user asks: record software versions and verify equivalence by rerunning a
sample. A threshold fixed in advance helps to read a result; it is not a verdict that
ends the discussion.

**Before R2, put one check page per DGP in front of the user** (computed, not eyeballed):
the identifiability conditions the method's documentation states, evaluated directly at
every design cell (the software may test a weaker condition and stay silent); the range
of the generated responses; signal against noise; the relative error of a first fit;
and every distinct warning the fits printed, with counts. Anything odd on the page
blocks production until it is explained.

**Always record computation times** in your metrics (add `fit_time` to output tibbles). This enables timing estimation and helps identify slow methods.

**Smoke tests must be fast.** When verifying code runs end-to-end, minimize ALL expensive dimensions simultaneously: smallest n, fewest/cheapest DGP cells, coarsest grids, 1–2 reps. The goal is to exercise every code path (fit, extract, save, aggregate), not to produce meaningful statistics. Exclude expensive factor levels (large n, fine grids) entirely — if the code works for n=20 on a 30×40 grid, it works for n=80 on a 90×120 grid. Test expensive settings only when you specifically need to verify scaling behavior or timing. Always run smoke tests in background and parallelize.

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

Always pair a location with its spread (boxplots, violins, or pointranges with
median + IQR): a bare mean hides the Monte Carlo variability that decides whether
a difference between methods is real, which is the one question the plot exists
to answer. Use interpretable ratio-scale labels (`0.1, 0.5, 1, 2, 10`) on log
axes, not raw log values. Prefer pointranges over bar charts. See `references/visualization.md` for these rules
and the diagnostic plot catalog (zip, lollipop, nested loop, heat map, Bland-Altman).

The `rsimsum` package generates zip, lollipop, nested loop, and heat plots via `autoplot()`. See `references/r-packages.md` for the package ecosystem.

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

## Hard-won lessons (verified in past studies)

- **Never write speculative findings in reports.** Always compute summary
  statistics in code and generate prose from them (e.g., Quarto `results: asis`
  chunks with `cat(sprintf(...))`). Speculative findings reliably drift from
  data — verified in a session where 6/7 key findings were factually wrong.
- **Before running a "does method X fail under misspecification?" experiment on
  real data, first CHECK that the real data actually violates X's assumption.**
  It is a cheap diagnostic (an ACF, a variogram, a residual check) and it decides
  whether the expensive run can answer anything at all: if the real data happens to
  satisfy the assumed model, the arm is not a misspecification probe and the result
  is uninterpretable. Pair it with a *synthetic* cell where the truth is known to
  violate the assumption — the real-data arm confounds misspecification with every
  other feature of real data, so the synthetic cell is usually the sharper test.
- **A competitor is only as strong as its nuisance-parameter estimator.** Before
  concluding "modelling the dependence doesn't help", check how the dependence
  parameter was estimated. A crude moment estimator can make a correctly specified
  competitor look weak (a lag-1 moment ρ̂ found 0.45 against a truth of 0.90; the
  fREML-profiled ρ̂ found 0.90 and beat the method we were advocating).
- **Never let a replicate error out and get dropped.** If a per-rep constraint can
  render a replicate infeasible (e.g. `sigma_e^2 = var(eta)/snr - v_phase` going
  negative), the reps that die are systematically the *extreme* ones — here, the most
  strongly correlated, i.e. exactly where the methods fail hardest. Silently dropping
  them is **selection on the outcome**, and it biases the study toward "nothing is
  wrong here". Reparameterize so every rep is feasible (use the *nominal* nuisance
  quantity, not the realized one) and record the realized value as a diagnostic.
- **Lag-1 autocorrelation is not "the" dependence strength — use the long-run-variance
  ratio `1 + 2 Σ_k ρ_k`.** That is what deflates the effective sample size. A
  slowly-decaying plateau ACF had lag-1 `0.36` but LRV ratio `5.3`, while an AR(1)
  matched to that same lag-1 has LRV only `2.1` — so an AR(1) working covariance cannot
  match both, and the gap is a *quantitative prediction* of how it fails. Corollary:
  don't assume a "smooth" process has lag-1 ACF ≈ 1 — measure it. A phase component
  `a·φ(t)·η'(t)` inherits `η'`'s oscillation, giving `ρ(1) ≈ 0.5`, not ≈ 1.
- **Shipping a simulation to a collaborator's machine: same package version number ≠
  same code.** A collaborator's CRAN `refund` 0.1.40 lacked internals present in the
  local dev build "0.1-40"; every fit died only after a full production launch. Before
  relying on a non-CRAN function, `stopifnot(exists("fn", asNamespace("pkg")))` at
  startup, and bundle a source tarball of the local build (`R CMD build
  --no-build-vignettes`) with the scripts.
- **Resumable sim drivers: look tasks up by id (`grid[grid$task == i, ]`), never by row
  position**, so a filtered grid (cell regex, partial rerun) keeps seeds and cells
  aligned; and make chunk membership depend only on the grid, never on the core count,
  or resuming on a different machine strands/duplicates chunks.
- **Never read coverage off a pffr fit before a known-answer cell with a bump-shaped
  truth has passed.** pffr's default `bs.yindex` (k = 5) cannot represent a localized
  bump: it produced bump-shaped bias and 0.08 coverage that had been blamed on the
  pcre constraint (k = 20 → 0.31; the rest is genuine attenuation). Set
  `bs.yindex = list(bs = "ps", k = 20, m = c(2, 1))` explicitly.
- **Enumerate replicate jobs REP-MAJOR** (`order(rep_id, dgp_id)`), not cell-major. An
  interrupted or resumed run then leaves *equal reps per cell*, so a partial analysis
  stays comparable instead of silently contrasting a 50-rep cell with a 3-rep one.
- **`stats::acf()` re-demeans each series; on fit residuals this biases the ACF/LRV
  low.** Residuals are already centered by the fitted mean; per-curve re-demeaning
  drove a Bartlett-LRV of white noise to 0.83 (should be ~1) and of AR(0.8) at D=100
  to 5.3 (truncated-population value 7.1) — which silently wrecked an LRV-matched
  rho selector. Use `acf(x, demean = FALSE)` for residual dependence diagnostics, and
  invert the SAME truncated/tapered functional you measured with (not the untruncated
  textbook formula) when mapping an LRV estimate back to a parameter.
- **Simulated functional covariates for `ff()` terms need effective rank ≥ 1.5 × k_s**
  (eigenvalues of Cov(X) covering 99.5% of variance; Scheipl & Greven 2016). Below that
  the coefficient surface is only weakly identified and part of the truth can lie
  OUTSIDE the observed curves' span — a shared bias floor that makes absolute RMSE and
  coverage uninterpretable for every method (measured: 4–6% orthogonal truth energy at
  G=20 with rank 16 vs k_s=12). Two traps: (a) `ff()`'s built-in warning only fires at
  the much weaker `rank < k_s`, so a violation of the 1.5 rule is SILENT; (b) small G
  caps the rank at ~n regardless of the generator's basis dimension, so a design that is
  fine at G=80 can be broken at G=20. Check the rank per cell BEFORE running, and treat
  an "oracle-basis" arm whose k exceeds the covariate rank as no oracle at all.
- **Check that every dependence/misspecification scenario actually breaks the method
  before production** — compute the quantity that matters (true sampling SD / model SE of
  the estimands at fixed penalties, exact or by MC over the error process only), not a
  scalar summary. A misregistration scenario that looked plausible was null (ratio ≈ 1), and
  the design effect 1ᵀΣ1/trΣ is blind to sign-changing correlations (warp and damped-cosine
  errors with DE ≈ 1.2–1.7 still broke model SEs by 2×).
- **Plasmode truths favour the method that fitted them.** A truth taken from a REML fit is
  REML-shaped (and vice versa for NCV); in one real dataset the NCV/REML MSE ratio went from
  0.64 to 2.2 depending on the truth source. Use one truth per compared method as a factor.
  The truth source also changes the residual pool (residuals = data − that fit), so it is a
  sensitivity factor, not a controlled contrast; cross truth source × residual source to isolate it.
- **Check a real dataset's variable semantics empirically before building a plasmode on it.**
  Column suffixes lie (`_ap` in a gait dataset was the frontal plane, not sagittal: within-curve
  range 6° vs 31°); the wrong plane produced a headline "NCV loses 2.2×" that shrank to a G-dependent
  trade-off on the right variable. Plot/range-check candidate columns first.
- **Test a proposed mechanism synthetically before writing it into a summary.** "NCV loses because
  β is weakly identified" was refuted by six low-rank-covariate cells (NCV's gain got larger).
- **Report how good the estimates are in absolute terms before comparing methods.**
  Coverage, RMSE ratios and rankings say nothing about whether any method estimates the
  target usefully. In one study relative RMSE was first computed on day 10, after the
  first paper draft: the default method's coefficient surface had relative RMSE > 0.5
  in 37% of replicates, which changed the paper's recommendations. Store a relative
  error per estimand from the first pilot on.
- **Range-check the generated responses in every cell, especially for non-Gaussian
  families.** A Poisson generator whose linear predictor was scaled like the Gaussian
  one produced counts up to 1e143 and interval widths up to 1e118; this was written up
  as a finding about the methods until the user called the DGP unrealistic, after the
  locked benchmark had finished.
- **After the first cluster run of a study, read the logs and tabulate the distinct
  warnings; make each job assert what it actually ran.** A pilot of 2880 arms silently
  ran a different estimator because the cluster's older library ignored an argument;
  it passed a 162-assertion test suite and two review rounds, since the outputs looked
  plausible. A software warning about the design sat unread in the logs for eight days.
  Have the job record the loaded package builds and stop if the fitted object does not
  show the requested estimator or option.
- **An unexplained pattern is a blocker, not a footnote.** A collapse in one design
  corner filed as "no mechanism asserted", or result rows identical across arms that
  should differ and then hedged in the text, were both real defects (a design flaw, a
  stale build) that lived for weeks or days. Chase the cause before running more on top.
- **One engine.** New studies add rows to the design table or arguments to the one
  driver. A project that copied its driver for each new study ended with 38 copies
  (32,000 lines), and the same mistakes (order of operations in a summary, a correction
  applied twice, a centering convention) came back in the copies.
- **Do not hold the analysis for the last replicates.** Run it on what has landed
  (rep-major enumeration keeps cells comparable) and state what is missing. An analysis
  once waited three days for the tail of two cells out of 21,000 replicates.
- **Gaussian-copula generators: don't round-trip Gaussian responses through
  `qnorm(pnorm(z))`** — it returns `Inf` for |z| ≳ 8 (e.g. after a heteroskedastic scale
  factor). Pass latent values to each family and apply `pnorm()` only for non-Gaussian
  quantile draws.
