
# Complete R Benchmark Template

This template provides a complete structure for Monte Carlo benchmarks. Adapt to your specific methods and DGPs.

```r
# =============================================================================
# BENCHMARK: [Your benchmark name]
# Description: [What methods are being compared, what DGPs]
# =============================================================================

# -----------------------------------------------------------------------------
# 1. SETUP
# -----------------------------------------------------------------------------

library(tidyverse)
library(furrr)

# Configuration
config <- list(
    n_reps = 1000,
    base_seed = 42,
    output_dir = "results/benchmark_name",
    n_workers = parallel::detectCores() - 1
)

# Create output directory
dir.create(config$output_dir, recursive = TRUE, showWarnings = FALSE)

# Parallel setup
plan(multisession, workers = config$n_workers)

# -----------------------------------------------------------------------------
# 2. DGP SETTINGS
# -----------------------------------------------------------------------------

# Use expand_grid for factorial design (NOT data.frame!)
dgp_settings <- expand_grid(
    n = c(100, 500, 1000),
    snr = c(5, 20, 50)
    # Add other DGP parameters here
) %>%
    mutate(dgp_id = row_number())

# Methods to compare - USE A DATA FRAME for method configurations
method_settings <- tribble(
    ~method_id, ~method_name, ~param1, ~param2,
    1,          "method_a",   10,      "fast",
    2,          "method_b",   10,      "accurate",
    3,          "method_b",   20,      "fast",
    4,          "method_c",   NA,      "default"
)

# Global constants (if needed)
p <- 50  # Example: number of predictors

cat(sprintf("DGP settings: %d configurations\n", nrow(dgp_settings)))
cat(sprintf("Methods: %d configurations\n", nrow(method_settings)))
cat(sprintf("Total fits: %d\n", nrow(dgp_settings) * nrow(method_settings) * config$n_reps))

# -----------------------------------------------------------------------------
# 3. DATA GENERATION
# -----------------------------------------------------------------------------

generate_data <- function(dgp_row, seed) {
    set.seed(seed)

    n <- dgp_row$n
    snr <- dgp_row$snr

    # CUSTOMIZE: Generate covariates
    X <- matrix(rnorm(n * p), n, p)  # Example: p covariates

    # CUSTOMIZE: Generate true parameters
    beta_true <- c(1, 2, rep(0, p - 2))  # Example: sparse coefficients

    # Signal and noise
    signal <- X %*% beta_true
    noise_sd <- sd(signal) / sqrt(snr)
    y <- signal + rnorm(n, 0, noise_sd)

    # Return data AND truth for evaluation
    list(
        # Data for fitting
        X = X,
        y = as.vector(y),
        # Truth for evaluation
        truth = list(
            beta = beta_true
            # Add other truth values as needed
        ),
        # Metadata
        dgp = dgp_row,
        seed = seed
    )
}

# -----------------------------------------------------------------------------
# 4. FITTING FUNCTIONS
# -----------------------------------------------------------------------------

fit_method <- function(data, method_row) {
    # method_row is a single-row data frame with method configuration
    # Access parameters via method_row$param1, method_row$param2, etc.

    # ALWAYS time the fit
    t0 <- Sys.time()

    fit <- switch(method_row$method_name,
        method_a = {
            # Example: use method_row$param1 as tuning parameter
            my_method_a(data, k = method_row$param1)
        },
        method_b = {
            # Example: use both param1 and param2
            my_method_b(data, k = method_row$param1, mode = method_row$param2)
        },
        method_c = {
            # Example: default settings
            my_method_c(data)
        },
        stop(sprintf("Unknown method: %s", method_row$method_name))
    )

    fit_time <- as.numeric(difftime(Sys.time(), t0, units = "secs"))
    fit$fit_time <- fit_time

    fit
}

# -----------------------------------------------------------------------------
# 5. METRIC EXTRACTION
# -----------------------------------------------------------------------------

extract_metrics <- function(fit, truth, method_row) {
    # Extract estimates from fit object
    # CUSTOMIZE THIS for your specific method output format

    estimate <- get_estimate(fit)  # Replace with actual extraction
    se <- get_se(fit)              # Replace with actual extraction
    true_values <- truth$values    # Replace with actual truth structure

    # 95% CI
    z <- qnorm(0.975)
    lower <- estimate - z * se
    upper <- estimate + z * se

    # Coverage (if CIs are available)
    covered <- (lower <= true_values) & (true_values <= upper)

    # Return aggregated metrics (NOT pointwise!)
    tibble(
        # Point estimates
        bias = mean(estimate - true_values),
        rmse = sqrt(mean((estimate - true_values)^2)),
        mae = mean(abs(estimate - true_values)),
        # Interval estimates (if applicable)
        coverage = mean(covered),
        avg_ci_width = mean(upper - lower),
        # ALWAYS include timing
        fit_time = fit$fit_time
    )
}


# -----------------------------------------------------------------------------
# 6. SINGLE REPLICATION RUNNER
# -----------------------------------------------------------------------------

run_one_replication <- function(rep_id, dgp_row, task_seed, method_settings) {
    # Generate data once for this replication
    data <- generate_data(dgp_row, task_seed)

    # Fit ALL methods to SAME data
    results <- map_dfr(seq_len(nrow(method_settings)), function(j) {
        method_row <- method_settings[j, ]

        tryCatch({
            fit <- fit_method(data, method_row)

            # Extract metrics
            extract_metrics(fit, data$truth, method_row) %>%
                mutate(
                    rep = rep_id,
                    dgp_id = dgp_row$dgp_id,
                    method_id = method_row$method_id,
                    method_name = method_row$method_name,
                    # Include DGP parameters for filtering
                    n = dgp_row$n,
                    snr = dgp_row$snr,
                    success = TRUE,
                    error_msg = NA_character_
                )

        }, error = function(e) {
            # Log failure, don't silently drop
            tibble(
                rep = rep_id,
                dgp_id = dgp_row$dgp_id,
                method_id = method_row$method_id,
                method_name = method_row$method_name,
                n = dgp_row$n,
                snr = dgp_row$snr,
                success = FALSE,
                error_msg = conditionMessage(e)
            )
        })
    })

    results
}

# -----------------------------------------------------------------------------
# 7. MAIN LOOP
# -----------------------------------------------------------------------------

# Generate all task seeds upfront for reproducibility
set.seed(config$base_seed)
n_total_tasks <- nrow(dgp_settings) * config$n_reps
task_seeds <- sample.int(.Machine$integer.max, n_total_tasks)

# Create task list
tasks <- expand_grid(
    dgp_id = dgp_settings$dgp_id,
    rep = 1:config$n_reps
) %>%
    mutate(
        task_id = row_number(),
        seed = task_seeds[task_id]
    ) %>%
    left_join(dgp_settings, by = "dgp_id")

cat(sprintf("Starting benchmark with %d tasks...\n", nrow(tasks)))

# Export functions to workers
furrr_opts <- furrr_options(
    globals = c(
        "method_settings",
        "generate_data", "fit_method", "extract_metrics",
        "run_one_replication"
        # Add any other helpers your methods need
    ),
    packages = c("tidyverse"),  # Add packages your methods need
    seed = NULL  # We manage seeds ourselves
)

# Run with progress
results <- future_map_dfr(
    1:nrow(tasks),
    function(i) {
        task <- tasks[i, ]
        dgp_row <- dgp_settings %>% filter(dgp_id == task$dgp_id)
        run_one_replication(task$rep, dgp_row, task$seed, method_settings)
    },
    .options = furrr_opts,
    .progress = TRUE
)

# Save raw results
saveRDS(results, file.path(config$output_dir, "raw_results.rds"))

# -----------------------------------------------------------------------------
# 8. AGGREGATION
# -----------------------------------------------------------------------------

# Check for failures
failures <- results %>% filter(!success)
if (nrow(failures) > 0) {
    warning(sprintf("%d tasks failed out of %d", nrow(failures), nrow(results)))
    saveRDS(failures, file.path(config$output_dir, "failures.rds"))
}

# Aggregate successful results
summary_stats <- results %>%
    filter(success) %>%
    group_by(dgp_id, n, snr, method_name) %>%
    summarise(
        n_reps = n(),
        # Bias
        mean_bias = mean(bias),
        se_bias = sd(bias) / sqrt(n()),
        # RMSE
        mean_rmse = mean(rmse),
        se_rmse = sd(rmse) / sqrt(n()),
        # Coverage (if applicable)
        mean_coverage = mean(coverage),
        se_coverage = sd(coverage) / sqrt(n()),
        .groups = "drop"
    )

saveRDS(summary_stats, file.path(config$output_dir, "summary_stats.rds"))

# Print summary table
cat("\n=== RMSE Summary ===\n")
summary_stats %>%
    select(n, snr, method_name, mean_rmse) %>%
    pivot_wider(names_from = method_name, values_from = mean_rmse) %>%
    arrange(n, snr) %>%
    print(n = 50)

cat("\nBenchmark complete!\n")
cat(sprintf("Results saved to: %s\n", config$output_dir))

# Cleanup parallel workers
plan(sequential)
```

## Key Customization Points

1. **DGP Settings** (Section 2): Add your DGP parameters to `expand_grid()`
2. **Method Settings** (Section 2): Define method configurations as a tibble with columns for each parameter
3. **generate_data()** (Section 4): Implement data generation, return data + truth
4. **fit_method()** (Section 5): Add fitting code for each method, using `method_row$param` for configuration
5. **extract_metrics()** (Section 6): Extract estimates/SEs, compute aggregated metrics

## Incremental Save Variant

For very long-running benchmarks, save after each DGP instead of at the end:

```r
# Run per-DGP (easier to resume)
for (dgp_id in dgp_settings$dgp_id) {
    dgp_row <- dgp_settings %>% filter(dgp_id == !!dgp_id)

    dgp_tasks <- tasks %>% filter(dgp_id == !!dgp_id)

    results <- future_map_dfr(
        1:nrow(dgp_tasks),
        function(i) {
            task <- dgp_tasks[i, ]
            run_one_replication(task$rep, dgp_row, task$seed)
        },
        .options = furrr_opts,
        .progress = TRUE
    )

    # Save per-DGP results
    saveRDS(results, file.path(
        config$output_dir,
        sprintf("dgp_%02d.rds", dgp_id)
    ))

    cat(sprintf("Completed DGP %d/%d\n", dgp_id, nrow(dgp_settings)))
}

# Combine all DGP results
all_results <- list.files(config$output_dir, "dgp_.*\\.rds", full.names = TRUE) %>%
    map_dfr(readRDS)
```
