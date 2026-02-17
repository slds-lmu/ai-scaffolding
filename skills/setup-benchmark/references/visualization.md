# Visualization for Simulation Studies

Reporting and diagnostic plots beyond basic scatter/histogram diagnostics. These exploit the structured, repeated-measures nature of simulation output.

For single-fit diagnostic plots (truth vs estimate, z-score distribution, coverage heatmap), see `development-workflow.md`.

---

## Zip Plot (Morris et al. 2019)

Confidence intervals ranked by |z-score|, colored by whether they cover the truth. Reveals patterns in non-coverage (e.g., non-coverage concentrated at extremes).

```r
zip_plot <- function(theta_hat, se_hat, theta_true, alpha = 0.05) {
    z <- qnorm(1 - alpha / 2)
    ci_lower <- theta_hat - z * se_hat
    ci_upper <- theta_hat + z * se_hat
    covered <- ci_lower <= theta_true & theta_true <= ci_upper
    z_score <- (theta_hat - theta_true) / se_hat

    df <- tibble(
        rank = rank(abs(z_score)),
        ci_lower = ci_lower,
        ci_upper = ci_upper,
        covered = covered,
        theta_true = theta_true
    ) |> arrange(rank)

    ggplot(df, aes(x = rank)) +
        geom_linerange(aes(ymin = ci_lower, ymax = ci_upper, color = covered),
                       linewidth = 0.3) +
        geom_hline(yintercept = theta_true, linetype = "dashed") +
        scale_color_manual(values = c("TRUE" = "blue", "FALSE" = "red")) +
        labs(x = "Rank of |z-score|", y = "Estimate (with CI)",
             title = "Zip plot") +
        theme_minimal()
}
```

With `rsimsum`: `autoplot(s, type = "zip")` produces this automatically.

---

## Lollipop Plot

Point estimate ± CI for each method within each scenario. Good for comparing a handful of methods across settings.

```r
lollipop_plot <- function(summary_df) {
    # summary_df has columns: method, scenario, estimate, mc_se
    ggplot(summary_df, aes(x = estimate, y = method)) +
        geom_point() +
        geom_linerange(aes(xmin = estimate - 1.96 * mc_se,
                           xmax = estimate + 1.96 * mc_se)) +
        facet_wrap(~ scenario, scales = "free_x") +
        labs(x = "Performance measure (± MC 95% CI)", y = NULL) +
        theme_minimal()
}
```

With `rsimsum`: `autoplot(s, type = "lolly")`.

---

## Nested Loop Plot

Shows performance across all factorial settings in a single panel. X-axis cycles through the innermost factor, panels or color for outer factors. Best for exploring interactions.

```r
# Using rsimsum (recommended — handles nesting automatically)
library(rsimsum)

s <- simsum(
    data = results,
    estvarname = "estimate",
    true = "theta_true",
    se = "se_hat",
    methodvar = "method",
    by = c("n", "snr")
)

autoplot(s, type = "nlp", stats = "cover")
```

---

## Heat Map

DGP rows × method columns, fill = performance measure. Compact summary of large factorial designs.

```r
heatmap_plot <- function(summary_df, fill_var = "coverage") {
    ggplot(summary_df, aes(x = method, y = scenario_label, fill = .data[[fill_var]])) +
        geom_tile() +
        geom_text(aes(label = round(.data[[fill_var]], 2)), size = 3) +
        scale_fill_gradient2(
            low = "red", mid = "white", high = "blue",
            midpoint = ifelse(fill_var == "coverage", 0.95, 0)
        ) +
        labs(x = "Method", y = "DGP Setting") +
        theme_minimal() +
        theme(axis.text.x = element_text(angle = 45, hjust = 1))
}
```

---

## Bland-Altman / Paired Method Comparison

Exploit the paired design (same data for all methods) by plotting differences rather than raw values:

```r
paired_comparison <- function(results, method_a, method_b, metric = "rmse") {
    wide <- results |>
        select(rep, dgp_id, method, all_of(metric)) |>
        pivot_wider(names_from = method, values_from = all_of(metric))

    wide <- wide |> mutate(
        mean_val = (.data[[method_a]] + .data[[method_b]]) / 2,
        diff_val = .data[[method_a]] - .data[[method_b]]
    )

    ggplot(wide, aes(x = mean_val, y = diff_val)) +
        geom_point(alpha = 0.3) +
        geom_hline(yintercept = 0, linetype = "dashed") +
        geom_hline(yintercept = mean(wide$diff_val), color = "blue") +
        labs(x = sprintf("Mean %s", metric),
             y = sprintf("Difference (%s - %s)", method_a, method_b),
             title = "Paired method comparison") +
        theme_minimal()
}
```

Paired differences have lower variance than marginal comparisons, making method differences easier to detect.

---

## References

- Morris TP, White IR, Crowther MJ. Using simulation studies to evaluate statistical methods. *Statistics in Medicine*. 2019;38:2074-2102.
- Gasparini A. rsimsum: Summarise results from Monte Carlo simulation studies. *JOSS*. 2018;3(26):739.
