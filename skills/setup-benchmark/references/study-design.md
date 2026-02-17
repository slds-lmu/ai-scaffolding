# Simulation Study Design Principles

General methodology lessons drawn from Morris et al. (2019), Chen et al. (2016), Levy & Steinberg (2010), and Niessl et al. (2022).

---

## Simulation Types

Not all simulation studies have the same goal. Clarify the type before designing:

| Type | Goal | Design Implication |
|------|------|--------------------|
| **Proof-of-concept** | Show a new method works at all | Few DGPs, focus on illustrative settings |
| **Stress-test** | Find where a method breaks | Extreme parameter values, boundary conditions |
| **Comparison** | Rank methods fairly across conditions | Full factorial design, multiple metrics, many replications |

Most benchmarks are **comparisons**. Proof-of-concept studies need fewer scenarios but must still report Monte Carlo SEs. Stress-tests should push parameters to extremes (very low SNR, small n, high dimensionality).

---

## Space-Filling Designs

When the parameter space is **continuous** (e.g., SNR ∈ [1, 100], correlation ∈ [0, 0.9]), full factorial designs on a discretized grid are inefficient. Use **Latin Hypercube Sampling** instead:

```r
library(lhs)

# Generate 50 scenarios over 4 continuous factors
n_scenarios <- 50
lhs_design <- randomLHS(n_scenarios, 4)

# Scale to actual parameter ranges
scenarios <- tibble(
    n = round(qunif(lhs_design[, 1], min = 50, max = 2000)),
    snr = qunif(lhs_design[, 2], min = 1, max = 50),
    correlation = qunif(lhs_design[, 3], min = 0, max = 0.9),
    missingness = qunif(lhs_design[, 4], min = 0, max = 0.3)
)
```

**When to use which:**

| Design | When | Package |
|--------|------|---------|
| `expand_grid()` | Few discrete factors (≤4 factors, ≤5 levels each) | base/tidyr |
| `randomLHS()` | Continuous factors, large parameter space | `lhs` |
| `maximinLHS()` | Same, but need better space coverage | `lhs` |
| Fractional factorial | Many discrete factors, need to reduce runs | `FrF2` |

**Rule of thumb**: ~10 × d scenarios (where d = number of factors) gives reasonable coverage of the parameter space (Levy & Steinberg 2010).

---

## Threats to Validity

### 1. Design Variability Dwarfing Method Differences

Chen et al. (2016) showed with a borehole function example that different random draws of the same experimental design can produce larger performance swings than the difference between methods. **Mitigation:**
- Use enough replications (check MC SEs)
- Run the same methods on the same data (paired design)
- Report paired differences, not marginal summaries

### 2. Resampling-from-Dataset Pitfall

Morris et al. (2019) warn that resampling from a real dataset (bootstrap-style DGP) limits generalizability: conclusions apply only to the observed data distribution. **Mitigation:**
- Prefer parametric DGPs that capture the key features of real data
- If using resampling, state this limitation explicitly
- Consider hybrid approaches: fit a parametric model to real data, then simulate from it

### 3. Over-Optimism and the Garden of Forking Paths

Niessl et al. (2022) document how researcher degrees of freedom in simulation studies lead to over-optimistic conclusions:
- Trying many DGP configurations, reporting only favorable ones
- Choosing performance metrics after seeing results
- Tweaking method tuning parameters post-hoc
- Selective reporting of scenarios where the proposed method wins

**Mitigation:**
- Lock ADEMP before the first full run (see Pre-Registration Mindset below)
- Report all pre-specified metrics and scenarios, including unfavorable ones
- Label any post-hoc analyses as exploratory

### 4. Scenario Selection Bias

Choosing DGP settings that favor one method over others. **Mitigation:**
- Include settings where each method is expected to perform well
- Include "neutral" settings not designed to favor any method
- Use space-filling designs to reduce selection bias

---

## Well-Specified and Misspecified DGPs

A well-designed benchmark tests methods under conditions where their assumptions hold *and* conditions where they don't. This is not optional — without both, you cannot distinguish "method works" from "method is robust" from "method fails gracefully."

### What "Well-Specified" Means Operationally

A DGP is well-specified for a given method when **all** of the following hold:

1. **Distributional assumptions are correct** — if the method assumes Gaussian errors, the DGP generates Gaussian errors
2. **The truth is within the model's hypothesis space** — the true function can be represented (or well-approximated) by the model. For spline methods: k_model ≥ k_truth + 4 (see `bug-checklist.md` #11). For linear models: the true relationship is linear. For parametric models: the true parameters are within the parameter space.
3. **The truth is identifiable from the data** — the truth satisfies the same identifiability constraints as the model (centering, sum-to-zero, etc. — see `truth-functions.md`), and there is enough data for the model to distinguish the signal
4. **Structural assumptions hold** — independence when assumed, correct covariance structure, no unmeasured confounders when not modeled, etc.

**Verification during Phase 2 piloting**: For your intended well-specified DGPs, check that (a) coverage is approximately nominal (e.g., ~95% for 95% CIs), (b) bias is small, and (c) convergence rate is high. If not, the DGP may not actually be well-specified for that method — investigate before proceeding.

### Taxonomy of Deliberate Violations

Each type of misspecification tests a different aspect of robustness. Choose violations that are **realistic** (they occur in practice) and **relevant** to your research question.

| Violation Type | What You Change in the DGP | What It Tests | Example |
|----------------|---------------------------|---------------|---------|
| **Distributional** | Error distribution differs from assumption | Robustness to non-normality, heavy tails, skewness | Gaussian method tested with t(3) or skew-normal errors |
| **Functional form / capacity** | Truth exceeds model's hypothesis space | Bias from underfitting, smoothing bias | Truth with k=20 wiggles fit by model with k=8 basis |
| **Structural** | Violate independence, stationarity, or homoscedasticity | Sensitivity to dependency structure | i.i.d. method tested with AR(1) correlated errors |
| **Omitted variable / confounding** | Generate data with a variable the model doesn't include | Bias from omitted variables | True model includes x₂, fitted model omits it |
| **Boundary / edge case** | Parameters at or near boundary of parameter space | Numerical stability, boundary behavior | Variance component near zero, correlation near ±1 |

### How to Introduce Violations in Practice

**Principle**: Change one assumption at a time relative to the well-specified baseline. This lets you attribute performance changes to specific violations.

```r
# Well-specified baseline
dgp_baseline <- list(
    n = 500, snr = 10,
    error_dist = "gaussian",    # matches method assumption
    k_truth = 6,                # within model capacity (k_model = 12)
    correlation = 0             # matches independence assumption
)

# Violation: distributional
dgp_heavy_tails <- modifyList(dgp_baseline, list(error_dist = "t3"))
dgp_skewed     <- modifyList(dgp_baseline, list(error_dist = "skew_normal"))

# Violation: capacity (truth exceeds model)
dgp_complex_truth <- modifyList(dgp_baseline, list(k_truth = 15))

# Violation: structural (correlated errors)
dgp_correlated <- modifyList(dgp_baseline, list(correlation = 0.5))
dgp_strong_corr <- modifyList(dgp_baseline, list(correlation = 0.8))

# Combine into design: well-specified + targeted violations
dgp_settings <- bind_rows(
    tibble(!!!dgp_baseline, violation = "none"),
    tibble(!!!dgp_heavy_tails, violation = "heavy_tails"),
    tibble(!!!dgp_skewed, violation = "skewed_errors"),
    tibble(!!!dgp_complex_truth, violation = "exceeds_capacity"),
    tibble(!!!dgp_correlated, violation = "moderate_correlation"),
    tibble(!!!dgp_strong_corr, violation = "strong_correlation")
) |> mutate(dgp_id = row_number())
```

**Crossing violations with other factors**: Once you have identified informative ranges for nuisance factors (SNR, n) in Phase 2, cross them with the violation types. A method might tolerate heavy tails at high SNR but fail at low SNR — this interaction is important to discover.

### Calibrating Violation Severity

Not all violations are equally severe. A t(30) distribution is barely distinguishable from Gaussian; t(3) is a serious departure. During Phase 2 screening, sweep the severity of each violation to find the range where methods start to degrade:

- **Distributional**: vary degrees of freedom (t(3), t(5), t(10), t(30)) or skewness parameter
- **Capacity**: vary k_truth from well within model capacity to well beyond it
- **Structural**: vary correlation strength from 0 to near 1

The informative zone (from Phase 2b) applies here too: find where methods start to degrade but haven't completely broken down.

### Avoiding Unfair Comparisons

Cross-reference with the "Scenario Selection Bias" threat above. The well-specified/misspecified split specifically guards against two failure modes:

1. **Home-court advantage**: If all DGPs satisfy Method A's assumptions but violate Method B's, the comparison is rigged. Every method in the comparison should have at least some DGPs where its assumptions hold.
2. **Straw-man misspecification**: If violations are so extreme that no method could reasonably handle them, you're not learning anything useful. Violations should be realistic — the kind of departures that occur in real data applications.

---

## Pre-Registration Mindset

**Lock the ADEMP framework before seeing any results.** This means:

1. **Define all DGP settings** before running
2. **Fix performance metrics** before running
3. **Set practical significance thresholds** before running
4. **Commit to reporting all results**, including unfavorable ones

You don't need formal pre-registration, but writing down ADEMP in a document (or code comments) before the first full run prevents unconscious p-hacking of simulation studies.

---

## Three Pillars of a Trustworthy Benchmark

### 1. Multiple Metrics (3-5)

No single metric tells the full story. A minimum set:
- **Bias** — is the method systematically off?
- **Coverage** — are CIs calibrated?
- **RMSE or MSE** — overall accuracy
- Optional: power, computation time, convergence rate

### 2. Enough Scenarios

Methods should be compared across a range of conditions, not a single "sweet spot." Vary at least:
- Sample size
- Signal-to-noise ratio
- One domain-specific factor (e.g., missingness, correlation structure)

### 3. Sufficient Replications with MC SEs

Every performance estimate must have a Monte Carlo SE small enough to distinguish methods. See `performance-measures.md` for formulas and `SKILL.md` for n_sim guidance.

---

## Practical Significance Thresholds

Set **before running** to avoid post-hoc rationalization:

| Metric | Example Threshold | Rationale |
|--------|-------------------|-----------|
| Coverage | ±2% from nominal | Smaller differences rarely matter in practice |
| Relative RMSE difference | >10% | Below this, methods are practically equivalent |
| Bias | > 0.1 × EmpSE | Bias smaller than this is negligible |
| Computation time | >2× difference | Matters only if absolute time is large |

**Decision framework**: A difference is "real" if (1) it exceeds the MC SE by a comfortable margin (e.g., 2×) AND (2) it exceeds the practical significance threshold. Both conditions must hold.

---

## Red-Flag Checklist for Untrustworthy Benchmarks

When reading or reviewing simulation studies, watch for:

- [ ] **No MC SEs reported** — impossible to judge if differences are noise
- [ ] **Single metric only** — method "wins" on one measure, may lose on others
- [ ] **Single scenario** — no evidence of generalizability
- [ ] **Proposed method wins everywhere** — suspiciously good; likely selective reporting
- [ ] **No failure rates** — methods that crash are silently excluded
- [ ] **DGPs match proposed method's assumptions** — unfair home-court advantage
- [ ] **Resampling-only DGPs** — conclusions limited to one dataset's distribution
- [ ] **Tuning parameters optimized for proposed method** — competitors use defaults
- [ ] **No timing information** — faster-but-worse methods may be preferable
- [ ] **Post-hoc metric selection** — metrics chosen after seeing which ones favor the method

---

## References

- Morris TP, White IR, Crowther MJ. Using simulation studies to evaluate statistical methods. *Statistics in Medicine*. 2019;38:2074-2102.
- Chen RB, Hsu YW, Hung Y, Wang W. Discrete-event simulation and Monte Carlo methods for evaluating the performance of computer experiments. *Journal of Statistical Planning and Inference*. 2016;170:61-75.
- Levy MS, Steinberg DM. Computer experiments: A review. *AStA Advances in Statistical Analysis*. 2010;94:311-324.
- Niessl C, Herrmann M, Greven S. Over-optimism in benchmark studies and the multiplicity of design and analysis options when interpreting their results. *WIREs Data Mining and Knowledge Discovery*. 2022;12:e1441.
