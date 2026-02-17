# R Packages for Simulation Studies

Overview of the R package ecosystem for designing, running, and analyzing Monte Carlo simulation studies.

---

## rsimsum — Summarize Simulation Results

**Scope**: Post-processing. Computes performance measures with Monte Carlo SEs and generates diagnostic plots.

```r
library(rsimsum)

s <- simsum(
    data = results,
    estvarname = "estimate",    # column with point estimates
    true = "theta_true",        # column with true values (or scalar)
    se = "se_hat",              # column with SE estimates
    methodvar = "method",       # column identifying methods
    by = c("n", "snr")          # columns identifying DGP settings
)

# Summary with MC SEs
summary(s)

# Diagnostic plots
autoplot(s, type = "zip")      # Zip plot (coverage diagnostic)
autoplot(s, type = "lolly")    # Lollipop plot (method comparison)
autoplot(s, type = "nlp")      # Nested loop plot (factorial settings)
autoplot(s, type = "heat")     # Heat map
```

**Key feature**: Automatic MC SE computation for all performance measures (bias, coverage, MSE, relative error in model SE, etc.).

---

## simChef — Full Simulation Framework

**Scope**: End-to-end. Define DGPs, methods, and evaluators as modular "recipes" with caching and R Markdown reports.

```r
library(simChef)

experiment <- create_experiment(name = "coverage_study") |>
    add_dgp(dgp_function, name = "linear") |>
    add_method(method_function, name = "ols") |>
    add_evaluator(eval_function, name = "coverage") |>
    add_visualizer(viz_function, name = "heatmap")

results <- run_experiment(experiment, n_reps = 1000)
create_rmd(experiment)  # Auto-generate report
```

**Key feature**: Built-in caching avoids re-running completed scenarios. Good for large, evolving benchmarks.

---

## simhelpers — Skeleton and Evaluation Utilities

**Scope**: Scaffolding. Generates benchmark skeletons and provides row-wise evaluation helpers.

```r
library(simhelpers)

# Generate a simulation skeleton
create_skeleton(
    dgp_params = list(n = c(100, 500), snr = c(5, 20)),
    method_names = c("ols", "lasso"),
    file = "my_simulation.R"
)

# Evaluate performance row-by-row (useful inside purrr::pmap)
evaluate_by_row(
    data = results,
    est = "estimate",
    truth = "theta_true",
    se = "se_hat"
)
```

---

## MonteCarlo — Automated Grid Loops

**Scope**: Running simulations with automatic parallelization and LaTeX table output.

```r
library(MonteCarlo)

# Define simulation function (must return named list)
sim_func <- function(n, snr) {
    # ... generate data, fit, evaluate
    list(bias = bias_val, coverage = cov_val)
}

result <- MonteCarlo(
    func = sim_func,
    nrep = 1000,
    param_list = list(n = c(100, 500), snr = c(5, 20))
)

MakeTable(result)  # LaTeX table
```

**Key feature**: Automatic LaTeX table generation. Limited flexibility for complex designs.

---

## tidyMC — Tidy Monte Carlo Workflows

**Scope**: Running simulations with tidy interface and `future` parallelization.

```r
library(tidyMC)

mc_result <- future_mc(
    fun = sim_function,
    repetitions = 1000,
    n = c(100, 500),
    snr = c(5, 20),
    seed = 123
)

summary(mc_result)
plot(mc_result)
```

---

## lhs — Space-Filling Designs

**Scope**: Experimental design for continuous parameter spaces.

```r
library(lhs)

# Random Latin Hypercube (fast)
design <- randomLHS(n = 50, k = 4)

# Maximin Latin Hypercube (better coverage, slower)
design <- maximinLHS(n = 50, k = 4)

# Scale columns to parameter ranges
scenarios <- tibble(
    n = round(qunif(design[, 1], 50, 2000)),
    snr = qunif(design[, 2], 1, 50),
    rho = qunif(design[, 3], 0, 0.9),
    p = round(qunif(design[, 4], 5, 100))
)
```

See `study-design.md` for guidance on when to use space-filling vs factorial designs.

---

## furrr + L'Ecuyer-CMRG: Parallel Seed Details

`furrr` uses L'Ecuyer-CMRG (L'Ecuyer et al. 2002) for parallel-safe RNG when `seed = TRUE`:

```r
library(furrr)
plan(multisession, workers = 4)

results <- future_map(tasks, run_task,
    .options = furrr_options(
        seed = TRUE,              # Use L'Ecuyer-CMRG streams
        globals = c("run_task", "generate_data", "fit_method")
    ),
    .progress = TRUE
)
```

**How `seed = TRUE` works:**
1. Internally uses L'Ecuyer-CMRG to generate seed streams (does not permanently change your RNG kind)
2. Generates one independent RNG stream per task via `nextRNGStream()`
3. Each worker receives its stream — streams are statistically independent
4. Results are reproducible regardless of worker count or scheduling order

**Pitfall**: `seed = TRUE` uses the current `.Random.seed`. Set `set.seed()` before the `future_map()` call for full reproducibility.

**Minimizing data transfer to workers:**
```r
# SLOW: Large objects copied to every worker
furrr_options(globals = c("huge_lookup_table", "run_task"))

# FASTER: Workers load data themselves (lazy, once per worker)
run_task_self_contained <- function(task) {
    # Each worker has its own .GlobalEnv — this caches per worker,
    # not on the main process
    if (!exists("lookup", envir = .GlobalEnv)) {
        assign("lookup", readRDS("lookup.rds"), envir = .GlobalEnv)
    }
    # ... use lookup
}
```

---

## Comparison Table

| Package | Scope | Parallelization | Visualization | MC SEs | Caching |
|---------|-------|-----------------|---------------|--------|---------|
| **rsimsum** | Post-processing | — | zip, lolly, nlp, heat | Yes | — |
| **simChef** | End-to-end | future | R Markdown reports | Manual | Yes |
| **simhelpers** | Scaffolding | — | — | Manual | — |
| **MonteCarlo** | Running + tables | snowfall | — | Manual | — |
| **tidyMC** | Running | future | Basic | Manual | — |
| **lhs** | Design only | — | — | — | — |
| **furrr** | Parallelization | future | — | — | — |

**Recommended combination for most benchmarks:**
- `furrr` for parallel execution with proper seeding
- `rsimsum` for post-processing, MC SEs, and diagnostic plots
- `lhs` if you have continuous parameter spaces

---

## References

- Gasparini A. rsimsum: Summarise results from Monte Carlo simulation studies. *JOSS*. 2018;3(26):739.
- L'Ecuyer P, Simard R, Chen EJ, Kelton WD. An object-oriented random-number package with many long streams and substreams. *Operations Research*. 2002;50(6):1073-1075.
