# Truth Function Design Patterns

Truth functions are the known ground truth that simulated data is generated from. Proper truth function design is critical for valid coverage assessment.

## Core Principle: Constraint Matching

Truth functions MUST satisfy the same identifiability constraints as the model being fit. If they don't, the model will estimate something different from what you're comparing to, leading to systematically biased coverage.

## Common Constraints

### 1. Centering Constraint (Most Common)

Models like `mgcv::gam`, `refund::pffr`, and most penalized spline methods impose:
```
sum(w_j * f(x_j)) = 0
```
where `w_j` are integration weights over the evaluation grid.

**Truth must also satisfy this constraint.**

### 2. Sum-to-Zero Constraint

For factor smooths or random effects:
```
sum(f(level_j)) = 0
```

### 3. Boundary Constraints

Some splines impose `f(0) = 0` or `f(0) = f(1) = 0`.

---

## Integration Weight Types

Different models use different integration schemes. Using the wrong weights for truth centering causes systematic bias.

### Simpson's Rule Weights

Used by: `mgcv::gam`, `refund::pffr`, `brms`, and most penalized spline methods

```r
simpson_weights <- function(n) {
    # n must be odd and >= 3
    stopifnot(n >= 3, n %% 2 == 1)
    w <- rep(c(4, 2), length.out = n)
    w[1] <- w[n] <- 1
    w / sum(w)  # Normalize to sum to 1
}

# Example for 51-point grid
n <- 51
weights <- simpson_weights(n)
# weights[1] = 1/150, weights[2] = 4/150, weights[3] = 2/150, ...
```

### Trapezoidal Weights

Used by: Some simpler implementations

```r
trapezoidal_weights <- function(n) {
    w <- rep(1, n)
    w[1] <- w[n] <- 0.5
    w / sum(w)
}
```

### Rectangular (Uniform) Weights

Used by: Naive implementations, should NOT be assumed

```r
rectangular_weights <- function(n) {
    rep(1/n, n)
}
```

### How to Find What Your Model Uses

1. **Read the documentation**: Look for "integration" or "centering"
2. **Check the source**: Search for weight computation in fitting code
3. **Empirical test**: Fit to known data and check what centering is applied

```r
# Empirical test
fit <- gam(y ~ s(x), data = df)
sm <- fit$smooth[[1]]
# Check sm$X, sm$S, or internal weights
```

---

## Centering Truth Functions

### Pattern: Raw + Centering Wrapper

```r
# Define raw (uncentered) truth
f_raw <- function(x) sin(2 * pi * x)

# Create centered version
make_centered <- function(f_raw, grid, weights) {
    values <- f_raw(grid)
    offset <- weighted.mean(values, weights)

    function(x) {
        f_raw(x) - offset
    }
}

# Usage
grid <- seq(0, 1, length.out = 51)
weights <- simpson_weights(51)
f_true <- make_centered(f_raw, grid, weights)

# Verify
stopifnot(abs(weighted.mean(f_true(grid), weights)) < 1e-10)
```

### Pattern: Direct Centering

```r
# More explicit approach
f_true <- function(x, weights = NULL) {
    raw <- sin(2 * pi * x)

    if (is.null(weights)) {
        # Return uncentered (for plotting)
        return(raw)
    }

    # Center with provided weights
    raw - weighted.mean(raw, weights)
}

# Usage
eval_grid <- seq(0, 1, length.out = 51)
eval_weights <- simpson_weights(51)

# Centered for comparison
f_centered <- f_true(eval_grid, eval_weights)

# Uncentered for visualization
f_uncentered <- f_true(eval_grid)
```

---

## 2D and Functional-on-Functional Effects

For interaction surfaces `f(s,t)` or functional-on-functional effects `F(s,t)`:

### Marginal Centering

Some models center marginally:
```
sum_s w_s * f(s, t) = 0  for all t
sum_t w_t * f(s, t) = 0  for all s
```

```r
# Marginal centering for 2D function
center_2d_marginal <- function(F_matrix, ws, wt) {
    # F_matrix[i,j] = f(s_i, t_j)
    # ws = weights for s dimension
    # wt = weights for t dimension

    # Center over s for each t
    F1 <- F_matrix - outer(rep(1, length(ws)),
                           colSums(F_matrix * ws))

    # Center over t for each s
    F2 <- F1 - outer(rowSums(F1 * matrix(wt, nrow(F1), ncol(F1), byrow=TRUE)),
                     rep(1, length(wt)))

    F2
}
```

### Full Centering

Other models use full 2D centering:
```
sum_{s,t} w_s * w_t * f(s,t) = 0
```

```r
center_2d_full <- function(F_matrix, ws, wt) {
    W <- outer(ws, wt)  # 2D weight matrix
    global_mean <- sum(W * F_matrix)
    F_matrix - global_mean
}
```

---

## Smoothing Bias and SNR Sensitivity

### The Shrinkage Problem

Penalized methods shrink estimates toward smoothness. At extreme SNR, this causes systematic underestimation of function variability.

**Key insight**: Coverage will fail at very high SNR (>100) even with correct implementation. This is expected behavior, not a bug.

### SNR Regimes

| SNR | Coverage Behavior |
|-----|------------------|
| 1-5 | May be inflated (wide CIs dominate) |
| 5-50 | Should be ~90-95% (target range) |
| 50-100 | May drop slightly (shrinkage starts) |
| >100 | Will fail (~60-80%) due to shrinkage bias |

### Adjusting for Smoothing Bias

Option 1: **Restrict benchmark to moderate SNR**
```r
dgp_settings <- expand_grid(
    snr = c(5, 10, 20, 50)  # Avoid extreme values
)
```

Option 2: **Report smoothing regime separately**
```r
summary_stats %>%
    mutate(snr_regime = case_when(
        snr <= 10 ~ "low",
        snr <= 50 ~ "moderate",
        TRUE ~ "high"
    )) %>%
    group_by(snr_regime, method, term) %>%
    summarise(mean_coverage = mean(coverage))
```

Option 3: **Use spline-friendly truth functions**
Truth functions that are well-approximated by the spline basis will have less bias.

---

## Truth Function Library

### Smooth Functions (Low Frequency)

```r
# Sinusoidal (very smooth)
f_sin <- function(x) sin(2 * pi * x)

# Polynomial
f_poly <- function(x) 4 * x * (1 - x)

# Gaussian bump
f_bump <- function(x) exp(-10 * (x - 0.5)^2)
```

### Wiggly Functions (Higher Frequency)

```r
# High-frequency sine
f_wiggly <- function(x) sin(6 * pi * x)

# Damped oscillation
f_damped <- function(x) sin(6 * pi * x) * exp(-2 * x)

# Sum of sines
f_multi <- function(x) 0.5 * sin(2 * pi * x) + 0.3 * sin(6 * pi * x)
```

### Functions with Features

```r
# Step-like (hard for smoothers)
f_step <- function(x) tanh(20 * (x - 0.5))

# Peak
f_peak <- function(x) dnorm(x, mean = 0.5, sd = 0.1)

# Asymmetric
f_asym <- function(x) x^2 * sin(4 * pi * x)
```

### Creating Centered Versions

```r
# Create library of centered functions
make_truth_library <- function(grid, weights) {
    raw_fns <- list(
        smooth = function(x) sin(2 * pi * x),
        wiggly = function(x) sin(6 * pi * x) * exp(-2 * x),
        poly = function(x) 4 * x * (1 - x),
        bump = function(x) exp(-10 * (x - 0.5)^2)
    )

    # Center each
    centered <- map(raw_fns, ~{
        values <- .(grid)
        offset <- weighted.mean(values, weights)
        function(x) .(x) - offset
    })

    # Verify all are centered
    for (name in names(centered)) {
        check <- weighted.mean(centered[[name]](grid), weights)
        stopifnot(abs(check) < 1e-10)
    }

    centered
}
```

---

## Grid Alignment and Interpolation

### Problem: Different Grids

Truth defined on grid A, coefficients extracted on grid B.

### Solution 1: Use Same Grid

```r
# Define once, use everywhere
EVAL_GRID <- seq(0, 1, length.out = 51)

# Truth on this grid
truth_values <- f_true(EVAL_GRID)

# Coefficients on same grid
coefs <- predict(fit, newdata = data.frame(x = EVAL_GRID))
```

### Solution 2: Interpolate

```r
# Truth on fine grid
truth_grid <- seq(0, 1, length.out = 201)
truth_values <- f_true(truth_grid)

# Coefficients on coarser grid
coef_grid <- seq(0, 1, length.out = 51)
coefs <- predict(fit, newdata = data.frame(x = coef_grid))

# Interpolate truth to coefficient grid
truth_interp <- approx(truth_grid, truth_values, xout = coef_grid)$y

# Now compare
rmse <- sqrt(mean((coefs - truth_interp)^2))
```

### Solution 3: Model-Specific Extraction

Some models provide coefficient extraction on specific grids:

```r
# mgcv example
fit <- gam(y ~ s(x, k = 20), data = df)

# Get the smooth's knot locations
sm <- fit$smooth[[1]]
knots <- sm$knots

# Or use plot.gam's internal grid
plot_data <- plot(fit, select = 1, n = 100)[[1]]
eval_grid <- plot_data$x
```

---

## Validation Checklist

Before running benchmark, verify:

```r
validate_truth <- function(f_true, grid, weights, tolerance = 1e-8) {
    # 1. Function evaluates correctly
    values <- f_true(grid)
    stopifnot(is.numeric(values))
    stopifnot(length(values) == length(grid))
    stopifnot(all(is.finite(values)))

    # 2. Centering constraint satisfied
    centered_mean <- weighted.mean(values, weights)
    if (abs(centered_mean) > tolerance) {
        stop(sprintf(
            "Truth not centered: weighted mean = %.2e (tolerance = %.2e)",
            centered_mean, tolerance
        ))
    }

    # 3. Reasonable scale
    cat(sprintf("Truth range: [%.3f, %.3f]\n", min(values), max(values)))
    cat(sprintf("Truth SD: %.3f\n", sd(values)))

    invisible(TRUE)
}
```
