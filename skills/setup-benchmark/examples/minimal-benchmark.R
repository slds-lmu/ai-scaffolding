# =============================================================================
# MINIMAL BENCHMARK EXAMPLE
# Comparing regularized regression methods across sample sizes and sparsity
# =============================================================================

library(tidyverse)
library(glmnet)
library(furrr)

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------

config <- list(
  n_reps = 100,
  seed = 42,
  p = 50,
  n_workers = parallel::detectCores() - 1
)

# -----------------------------------------------------------------------------
# DGP settings - USE expand_grid, NOT data.frame!
# -----------------------------------------------------------------------------

dgp_settings <- expand_grid(
  n = c(100, 200, 500),
  sparsity = c(0.1, 0.3),
  snr = c(2, 5)
) |>
  mutate(dgp_id = row_number())

# -----------------------------------------------------------------------------
# Method settings - methods as a DATA FRAME with configurations
# -----------------------------------------------------------------------------

method_settings <- tribble(
  ~method_id,
  ~method_name,
  ~alpha,
  ~lambda_rule,
  1,
  "ridge",
  0.0,
  "lambda.min",
  2,
  "lasso",
  1.0,
  "lambda.min",
  3,
  "lasso_1se",
  1.0,
  "lambda.1se",
  4,
  "enet_0.5",
  0.5,
  "lambda.min"
)

cat(sprintf(
  "DGPs: %d | Methods: %d | Reps: %d | Total fits: %d\n",
  nrow(dgp_settings),
  nrow(method_settings),
  config$n_reps,
  nrow(dgp_settings) * nrow(method_settings) * config$n_reps
))

# -----------------------------------------------------------------------------
# Data generation
# -----------------------------------------------------------------------------

generate_data <- function(n, sparsity, snr, p, seed) {
  set.seed(seed)

  # Covariates
  X <- matrix(rnorm(n * p), n, p)

  # True coefficients (sparse)
  n_nonzero <- max(1, floor(p * sparsity))
  beta_true <- rep(0, p)
  nonzero_idx <- sample(p, n_nonzero)
  beta_true[nonzero_idx] <- rnorm(n_nonzero)

  # Signal and noise
  signal <- X %*% beta_true
  noise_sd <- sd(signal) / sqrt(snr)
  y <- signal + rnorm(n, 0, noise_sd)

  list(
    X = X,
    y = as.vector(y),
    beta_true = beta_true,
    nonzero_idx = nonzero_idx
  )
}

# -----------------------------------------------------------------------------
# Fitting - takes method_row (data frame row), not just method name
# -----------------------------------------------------------------------------

fit_method <- function(data, method_row) {
  # ALWAYS time fits
  t0 <- Sys.time()

  cv_fit <- cv.glmnet(
    x = data$X,
    y = data$y,
    alpha = method_row$alpha,
    nfolds = 5
  )

  fit_time <- as.numeric(difftime(Sys.time(), t0, units = "secs"))

  lambda <- cv_fit[[method_row$lambda_rule]]
  beta_hat <- as.vector(coef(cv_fit, s = lambda))[-1]

  list(
    beta_hat = beta_hat,
    lambda = lambda,
    cv_fit = cv_fit,
    fit_time = fit_time
  )
}

# -----------------------------------------------------------------------------
# Metric extraction - returns tibble with all columns, NAs on failure
# -----------------------------------------------------------------------------

extract_metrics <- function(fit, data, method_row) {
  beta_hat <- fit$beta_hat
  beta_true <- data$beta_true

  # Estimation metrics
  mse <- mean((beta_hat - beta_true)^2)
  bias <- mean(beta_hat - beta_true)

  # Selection metrics
  selected <- which(abs(beta_hat) > 1e-10)
  true_nonzero <- data$nonzero_idx

  tp <- length(intersect(selected, true_nonzero))
  sensitivity <- if (length(true_nonzero) > 0) tp / length(true_nonzero) else NA
  precision <- if (length(selected) > 0) tp / length(selected) else NA
  f1 <- if (
    !is.na(sensitivity) && !is.na(precision) && (sensitivity + precision) > 0
  ) {
    2 * sensitivity * precision / (sensitivity + precision)
  } else NA

  tibble(
    method_id = method_row$method_id,
    method_name = method_row$method_name,
    mse = mse,
    bias = bias,
    n_selected = length(selected),
    sensitivity = sensitivity,
    precision = precision,
    f1 = f1,
    fit_time = fit$fit_time,
    success = TRUE,
    error_msg = NA_character_
  )
}

#' Create failure row with NA metrics
make_failure_row <- function(method_row, error_msg) {
  tibble(
    method_id = method_row$method_id,
    method_name = method_row$method_name,
    mse = NA_real_,
    bias = NA_real_,
    n_selected = NA_integer_,
    sensitivity = NA_real_,
    precision = NA_real_,
    f1 = NA_real_,
    fit_time = NA_real_,
    success = FALSE,
    error_msg = error_msg
  )
}

# -----------------------------------------------------------------------------
# Single replication runner
# -----------------------------------------------------------------------------

run_one_replication <- function(
  dgp_row,
  rep_id,
  task_seed,
  method_settings,
  p
) {
  # Generate data ONCE per replication
  data <- generate_data(
    n = dgp_row$n,
    sparsity = dgp_row$sparsity,
    snr = dgp_row$snr,
    p = p,
    seed = task_seed
  )

  # Fit ALL methods to SAME data
  results <- map_dfr(seq_len(nrow(method_settings)), function(j) {
    method_row <- method_settings[j, ]

    tryCatch(
      {
        fit <- fit_method(data, method_row)
        extract_metrics(fit, data, method_row)
      },
      error = function(e) {
        make_failure_row(method_row, conditionMessage(e))
      }
    )
  })

  # Add identifiers
  results |>
    mutate(
      dgp_id = dgp_row$dgp_id,
      n = dgp_row$n,
      sparsity = dgp_row$sparsity,
      snr = dgp_row$snr,
      rep_id = rep_id,
      seed = task_seed
    )
}

# -----------------------------------------------------------------------------
# Main: parallel execution with furrr
# -----------------------------------------------------------------------------

# Generate task seeds upfront
set.seed(config$seed)
n_tasks <- nrow(dgp_settings) * config$n_reps
task_seeds <- sample.int(.Machine$integer.max, n_tasks)

# Build task grid
tasks <- expand_grid(
  dgp_id = dgp_settings$dgp_id,
  rep_id = seq_len(config$n_reps)
) |>
  mutate(
    task_id = row_number(),
    seed = task_seeds[task_id]
  ) |>
  left_join(dgp_settings, by = "dgp_id")

# Setup parallel
plan(multicore, workers = config$n_workers)

cat(sprintf(
  "Running %d tasks on %d workers...\n",
  nrow(tasks),
  config$n_workers
))

# Run with furrr
results_df <- future_map_dfr(
  seq_len(nrow(tasks)),
  function(i) {
    task <- tasks[i, ]
    dgp_row <- task # task already has all dgp columns from left_join
    run_one_replication(
      dgp_row,
      task$rep_id,
      task$seed,
      method_settings,
      config$p
    )
  },
  .options = furrr_options(
    globals = c(
      "generate_data",
      "fit_method",
      "extract_metrics",
      "make_failure_row",
      "run_one_replication",
      "method_settings",
      "config"
    ),
    packages = c("tidyverse", "glmnet"),
    seed = TRUE
  ),
  .progress = TRUE
)

# Cleanup parallel
plan(sequential)

# -----------------------------------------------------------------------------
# Check for failures
# -----------------------------------------------------------------------------

n_failures <- sum(!results_df$success)
if (n_failures > 0) {
  cat(sprintf(
    "\nWarning: %d fits failed out of %d\n",
    n_failures,
    nrow(results_df)
  ))
  failures <- results_df |> filter(!success)
  print(failures |> count(method_name, error_msg))
}

# -----------------------------------------------------------------------------
# Summary with Monte Carlo SEs (excluding failures)
# -----------------------------------------------------------------------------

summary_stats <- results_df |>
  filter(success) |>
  summarise(
    mean_mse = mean(mse),
    se_mse = sd(mse) / sqrt(n()),
    mean_f1 = mean(f1, na.rm = TRUE),
    se_f1 = sd(f1, na.rm = TRUE) / sqrt(sum(!is.na(f1))),
    mean_n_selected = mean(n_selected),
    n_success = n(),
    n_failed = sum(
      !results_df$success[
        results_df$method_name == first(method_name) &
          results_df$n == first(n) &
          results_df$snr == first(snr)
      ]
    ),
    .by = c(n, sparsity, snr, method_name)
  )

cat("\n=== MSE by Method and Sample Size ===\n")
summary_stats |>
  select(n, sparsity, snr, method_name, mean_mse) |>
  pivot_wider(names_from = method_name, values_from = mean_mse) |>
  arrange(n, sparsity, snr) |>
  print(n = 20)

cat("\n=== F1 Score (Variable Selection) ===\n")
summary_stats |>
  select(n, sparsity, snr, method_name, mean_f1) |>
  pivot_wider(names_from = method_name, values_from = mean_f1) |>
  arrange(n, sparsity, snr) |>
  print(n = 20)

# -----------------------------------------------------------------------------
# Diagnostic: Single fit inspection (uncomment to debug)
# -----------------------------------------------------------------------------

# debug_single_fit <- function(dgp_id = 1, method_id = 1, seed = 1) {
#     dgp_row <- dgp_settings[dgp_id, ]
#     method_row <- method_settings[method_id, ]
#
#     data <- generate_data(
#         n = dgp_row$n,
#         sparsity = dgp_row$sparsity,
#         snr = dgp_row$snr,
#         p = config$p,
#         seed = seed
#     )
#
#     fit <- fit_method(data, method_row)
#     metrics <- extract_metrics(fit, data, method_row)
#
#     # Compare truth vs estimate
#     par(mfrow = c(1, 2))
#
#     plot(data$beta_true, fit$beta_hat,
#          xlab = "Truth", ylab = "Estimate",
#          main = sprintf("%s on DGP %d (n=%d, snr=%g)",
#                         method_row$method_name, dgp_id, dgp_row$n, dgp_row$snr))
#     abline(0, 1, col = "red")
#
#     # Residual distribution
#     resid <- fit$beta_hat - data$beta_true
#     hist(resid, main = "Residuals (Estimate - Truth)", xlab = "Residual")
#     abline(v = 0, col = "red", lty = 2)
#
#     par(mfrow = c(1, 1))
#
#     cat(sprintf("Fit time: %.3f sec\n", fit$fit_time))
#     cat(sprintf("MSE: %.4f\n", metrics$mse))
#     cat(sprintf("N selected: %d (true nonzero: %d)\n",
#                 metrics$n_selected, length(data$nonzero_idx)))
#
#     list(data = data, fit = fit, metrics = metrics)
# }
