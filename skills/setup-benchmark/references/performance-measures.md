# Performance Measures and Monte Carlo Standard Errors

Based on Morris, White & Crowther (2019), Table 6.

## Notation

- θ: true value of estimand
- θ̂ᵢ: estimate from repetition i
- θ̄: mean of θ̂ᵢ across repetitions
- n_sim: number of simulation repetitions
- Var̂(θ̂ᵢ): model-based variance estimate from rep i
- ModSE: average model SE = √(mean of Var̂(θ̂ᵢ))
- EmpSE: empirical SE = SD of θ̂ᵢ across reps

---

## Performance Measures with Monte Carlo SEs

### Bias

**Definition**: E[θ̂] - θ

**Estimate**:
```r
bias <- mean(theta_hat) - theta_true
```

**Monte Carlo SE**:
```r
mc_se_bias <- sd(theta_hat) / sqrt(n_sim)
```

---

### Empirical Standard Error

**Definition**: √Var(θ̂)

**Estimate**:
```r
emp_se <- sd(theta_hat)
```

**Monte Carlo SE**:
```r
mc_se_emp_se <- emp_se / sqrt(2 * (n_sim - 1))
```

---

### Mean Squared Error (MSE)

**Definition**: E[(θ̂ - θ)²] = Bias² + Var(θ̂)

**Estimate**:
```r
mse <- mean((theta_hat - theta_true)^2)
```

**Monte Carlo SE**:
```r
mc_se_mse <- sqrt(sum((theta_hat - theta_true)^2 - mse)^2 / (n_sim * (n_sim - 1)))
```

---

### Average Model SE

**Definition**: √E[Var̂(θ̂)]

**Estimate**:
```r
mod_se <- sqrt(mean(var_hat))
```

**Monte Carlo SE** (approximate):
```r
mc_se_mod_se <- sqrt(var(var_hat) / (4 * n_sim * mod_se^2))
```

---

### Relative % Error in Model SE

**Definition**: 100 × (ModSE / EmpSE - 1)

**Estimate**:
```r
rel_error_se <- 100 * (mod_se / emp_se - 1)
```

**Monte Carlo SE** (approximate):
```r
mc_se_rel_error <- 100 * (mod_se / emp_se) * sqrt(
    var(var_hat) / (4 * n_sim * mod_se^4) + 1 / (2 * (n_sim - 1))
)
```

---

### Coverage

**Definition**: Pr(θ̂_low ≤ θ ≤ θ̂_upp)

**Estimate**:
```r
coverage <- mean(ci_lower <= theta_true & theta_true <= ci_upper)
```

**Monte Carlo SE**:
```r
mc_se_coverage <- sqrt(coverage * (1 - coverage) / n_sim)
```

---

### Bias-Eliminated Coverage

**Definition**: Pr(θ̂_low ≤ θ̄ ≤ θ̂_upp)

Use to decompose whether undercoverage is due to bias or incorrect SE.

**Estimate**:
```r
theta_bar <- mean(theta_hat)
be_coverage <- mean(ci_lower <= theta_bar & theta_bar <= ci_upper)
```

**Monte Carlo SE**:
```r
mc_se_be_coverage <- sqrt(be_coverage * (1 - be_coverage) / n_sim)
```

**Interpretation**:
- If coverage < 95% but bias-eliminated coverage ≈ 95%: bias is the problem
- If both are low: SE estimation is also problematic

---

### Power / Type I Error

**Definition**: Pr(pᵢ ≤ α)

**Estimate**:
```r
power <- mean(p_values <= alpha)
```

**Monte Carlo SE**:
```r
mc_se_power <- sqrt(power * (1 - power) / n_sim)
```

---

### Relative % Increase in Precision (B vs A)

**Definition**: 100 × (Var(θ̂_A) / Var(θ̂_B) - 1)

**Estimate**:
```r
rel_precision <- 100 * ((emp_se_A / emp_se_B)^2 - 1)
```

**Monte Carlo SE** (approximate):
```r
mc_se_rel_precision <- 200 * (emp_se_A / emp_se_B)^2 *
    sqrt((1 - cor(theta_hat_A, theta_hat_B)^2) / (n_sim - 1))
```

---

## Choosing n_sim

### Based on Coverage

For expected coverage p with required MC SE:

```r
n_sim <- p * (1 - p) / mc_se_required^2
```

| Expected Coverage | MC SE Required | n_sim |
|-------------------|----------------|-------|
| 95% | 0.5% | 1,900 |
| 95% | 1.0% | 475 |
| 50% (worst case) | 0.5% | 10,000 |
| 50% (worst case) | 1.0% | 2,500 |

### Based on Bias

If EmpSE ≈ σ and you need MC_SE(Bias) < δ:

```r
n_sim <- (sigma / delta)^2
```

| EmpSE | MC SE Required | n_sim |
|-------|----------------|-------|
| 0.1 | 0.005 | 400 |
| 0.2 | 0.005 | 1,600 |
| 0.2 | 0.01 | 400 |

---

## Complete R Function

```r
#' Compute performance measures with Monte Carlo SEs
#'
#' @param theta_hat Vector of estimates
#' @param se_hat Vector of model SEs (or NULL)
#' @param theta_true True parameter value
#' @param alpha Nominal significance level (default 0.05)
#'
#' @return Tibble of performance measures with MC SEs
compute_performance <- function(theta_hat, se_hat = NULL, theta_true, alpha = 0.05) {
    n_sim <- length(theta_hat)
    theta_bar <- mean(theta_hat)

    # Bias
    bias <- theta_bar - theta_true
    mc_se_bias <- sd(theta_hat) / sqrt(n_sim)

    # Empirical SE
    emp_se <- sd(theta_hat)
    mc_se_emp_se <- emp_se / sqrt(2 * (n_sim - 1))

    # MSE
    mse <- mean((theta_hat - theta_true)^2)
    mc_se_mse <- sqrt(sum(((theta_hat - theta_true)^2 - mse)^2) / (n_sim * (n_sim - 1)))

    result <- tibble::tibble(
        measure = c("Bias", "EmpSE", "MSE"),
        estimate = c(bias, emp_se, mse),
        mc_se = c(mc_se_bias, mc_se_emp_se, mc_se_mse)
    )

    # If model SEs provided
    if (!is.null(se_hat)) {
        var_hat <- se_hat^2
        mod_se <- sqrt(mean(var_hat))
        mc_se_mod_se <- sqrt(var(var_hat) / (4 * n_sim * mod_se^2))

        rel_error <- 100 * (mod_se / emp_se - 1)
        mc_se_rel_error <- 100 * (mod_se / emp_se) * sqrt(
            var(var_hat) / (4 * n_sim * mod_se^4) + 1 / (2 * (n_sim - 1))
        )

        # Coverage
        z <- qnorm(1 - alpha / 2)
        ci_lower <- theta_hat - z * se_hat
        ci_upper <- theta_hat + z * se_hat

        coverage <- mean(ci_lower <= theta_true & theta_true <= ci_upper)
        mc_se_coverage <- sqrt(coverage * (1 - coverage) / n_sim)

        be_coverage <- mean(ci_lower <= theta_bar & theta_bar <= ci_upper)
        mc_se_be_coverage <- sqrt(be_coverage * (1 - be_coverage) / n_sim)

        result <- dplyr::bind_rows(result, tibble::tibble(
            measure = c("ModSE", "RelErrorSE%", "Coverage", "BiasElimCoverage"),
            estimate = c(mod_se, rel_error, coverage, be_coverage),
            mc_se = c(mc_se_mod_se, mc_se_rel_error, mc_se_coverage, mc_se_be_coverage)
        ))
    }

    result
}
```

---

## Normalized Performance Measures

When comparing methods across DGPs with different scales, raw RMSE is not comparable. Use **relative** measures that normalize by a baseline (Chen et al. 2016):

### Relative RMSE (RRMSE)

Normalize RMSE by a trivial baseline (e.g., intercept-only model, oracle, or the worst method):

```r
# RRMSE relative to a trivial estimator
rrmse <- function(theta_hat, theta_true, trivial_rmse) {
    rmse <- sqrt(mean((theta_hat - theta_true)^2))
    rmse / trivial_rmse
}

# Example: normalize by intercept-only (predicts mean of y)
trivial_pred <- mean(y_train)
trivial_rmse <- sqrt(mean((trivial_pred - theta_true)^2))
rrmse_method <- rrmse(theta_hat, theta_true, trivial_rmse)
```

**Interpretation**: RRMSE < 1 means the method beats the baseline; RRMSE = 0.5 means it halves the error.

### Relative Bias

```r
# Relative bias as fraction of empirical SE
rel_bias <- bias / emp_se
```

Values |rel_bias| < 0.1 are typically negligible.

---

## Practical Significance Thresholds

Set thresholds **before running** to prevent post-hoc rationalization. A difference between methods is meaningful only if:

1. **Statistically significant**: Difference exceeds 2× its MC SE
2. **Practically significant**: Difference exceeds a pre-set threshold

| Metric | Suggested Threshold | Rationale |
|--------|---------------------|-----------|
| Coverage | ±2 percentage points | Smaller differences rarely matter clinically |
| RRMSE | >10% relative difference | Below this, methods are interchangeable |
| Bias | > 0.1 × EmpSE | Smaller bias is absorbed by variance |

**Decision rule**: Report a method as "better" only when both conditions hold. If statistical but not practical, report as "statistically distinguishable but practically equivalent."

---

## Automated Computation with rsimsum

The `rsimsum` package computes all measures above (with MC SEs) from a single data frame. See `r-packages.md` for usage details and `visualization.md` for diagnostic plots.

---

## Reporting Guidelines

1. **Always report MC SEs** - in parentheses next to estimates, or as confidence interval bars in plots

2. **Don't over-report precision** - round to digits justified by MC SE:
   - Coverage 94.7% (MC SE 0.5%) → report as "95% (0.5%)" or "94.7% (0.5%)"
   - Bias 0.00234 (MC SE 0.005) → report as "0.00 (0.01)"

3. **Report n_sim** and justify the choice based on required precision

4. **Report non-convergence rate** as first performance measure

5. **Structure tables** with:
   - Methods as columns (for side-by-side comparison)
   - DGP settings as rows
   - MC SEs in parentheses at smaller font

---

## References

- Morris TP, White IR, Crowther MJ. Using simulation studies to evaluate statistical methods. *Statistics in Medicine*. 2019;38:2074-2102. Table 6.
- Chen RB, Hsu YW, Hung Y, Wang W. Discrete-event simulation and Monte Carlo methods. *JSPI*. 2016;170:61-75.
