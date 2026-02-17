# Simulation Study Checklist
*Adapted from Morris et al. (2019), Statistics in Medicine*

Apply this checklist to evaluate simulation studies in statistical papers.

## 1. Aims
- [ ] **Clarity**: Objectives explicitly stated (evaluating bias, comparing methods, assessing robustness)?
- [ ] **Relevance**: Aims align with method's intended use or address literature gap?
- [ ] **Scope**: Appropriate framing (proof-of-concept vs. stress-testing vs. realistic evaluation)?

## 2. Data-Generating Mechanisms (DGMs)
- [ ] **Transparency**: DGMs fully described (parametric models, resampling procedures)?
- [ ] **Justification**: Factors varied with rationale (realism, edge cases)?
- [ ] **Design**: Factorial variation of factors? Simple and complex scenarios included?
- [ ] **Well-specified DGMs**: At least some DGMs where each method's assumptions hold (correct distribution, truth within hypothesis space, identifiability satisfied)? Coverage should be near nominal here — if not, something is wrong with the implementation, not the method.
- [ ] **Misspecified DGMs**: Deliberate, realistic assumption violations included (distributional, structural, capacity)? Violations varied in severity? Each method tested under both favorable and unfavorable conditions?
- [ ] **No home-court advantage**: DGMs not exclusively tailored to the proposed method's assumptions?
- [ ] **Reproducibility**: Code/data provided to regenerate datasets?

## 3. Estimands
- [ ] **Definition**: Target of inference clearly defined?
- [ ] **Alignment**: Estimands match aims (marginal vs. conditional effects)?
- [ ] **Identifiability**: Non-identifiability constraints explained if applicable?

## 4. Methods
- [ ] **Comparators**: Relevant state-of-the-art methods included?
- [ ] **Implementation**: Code provided for all methods? Convergence issues reported?
- [ ] **Fair comparison**: All methods use appropriate/default settings (not misconfigured to disadvantage competitors)?
- [ ] **Failure handling**: Non-convergence and method failures documented? Failure rates reported per method × DGM?

## 5. Performance Measures
- [ ] **Appropriateness**: Metrics aligned with aims (bias, SE, coverage, power, MSE)?
- [ ] **Hypothesis testing**: Type I error AND power reported?
- [ ] **Monte Carlo error**: MCSEs reported for key metrics?
- [ ] **Sample size**: n_sim justified to control MCSE?
- [ ] **Missing data**: Non-convergence/missing estimates documented and addressed?

## 6. Reproducibility & Code
- [ ] **Availability**: Scripts for data generation, analysis, and evaluation provided?
- [ ] **Random seeds**: Seeds set and stored? Parallelization streams managed?
- [ ] **Documentation**: Dependencies, software versions, computational steps detailed?

## 7. Reporting & Presentation
- [ ] **Structure**: Aims, DGMs, Estimands, Methods, Performance clearly sectioned (ADEMP)?
- [ ] **Clarity**: Tables/figures compare methods side-by-side? MCSEs visible?
- [ ] **Exploration**: Raw results visualized (distributions, zip plots)?
- [ ] **Limitations**: Weaknesses acknowledged (restricted DGMs, computational constraints)?

## 8. Interpretation
- [ ] **Claims supported**: No overstatement (e.g., "scalable" without large-n evidence)?
- [ ] **Generalizability**: Conclusions reflect scope of DGMs tested?
- [ ] **Fair reporting**: Competing methods fairly represented (not misconfigured)?

## Red Flags
- Single DGM scenario only
- No comparison to baselines
- Missing MCSE or n_sim justification
- "Proof of concept" framed as comprehensive evaluation
- Competing methods configured suboptimally
- Code supplement incomplete or non-executable
- All DGMs satisfy the proposed method's assumptions (home-court advantage)
- No misspecification testing (robustness unknown)
- Proposed method wins on every metric in every scenario (suspiciously good — likely selective reporting)
- Post-hoc metric or scenario selection (ADEMP not locked before results)

## Key References
- Morris TP, White IR, Crowther MJ (2019). Using simulation studies to evaluate statistical methods. *Statistics in Medicine* 38:2074-2102.
- Burton A, Altman DG, Royston P, Holder RL (2006). The design of simulation studies in medical statistics. *Statistics in Medicine* 25:4279-4292.
