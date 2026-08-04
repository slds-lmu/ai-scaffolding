# Scientific-writing checklist

Use this for research papers, abstracts, thesis chapters, and empirical grant text.
Adapt study-specific items to the field and article type. This is a writing and
reporting audit, not a substitute for checking the science, code, or data.

## Boundary: edit prose; do not invent science

- Make a direct edit only when the existing manuscript supports it.
- Mark missing evidence, methods, results, limitations, or decisions as **AUTHOR
  QUERY** and say exactly what is needed.
- Never add a plausible citation, number, analysis choice, causal assumption,
  limitation, data-availability claim, or preregistration statement from inference.
- Preserve distinctions among planned, performed, exploratory, and post hoc analyses.
- Use the reporting guideline appropriate to the design (for example CONSORT, STROBE,
  PRISMA, or a field-specific equivalent). Do not treat this general checklist as a
  replacement for it.

## Register and narration (research papers)

Generalized from repeated author feedback on statistical manuscripts; these are
pattern CLASSES — when one instance is flagged or found, sweep the whole
document for the class before reporting done.

- [ ] **Narrative first, complications later.** State the main line without
  inline qualifications; move digressions and caveat pile-ups to a discussion
  or appendix (keep every caveat *somewhere* — just not in the reader's first
  pass). Immediate hedging reads defensive ("why we tried that, since we found
  that").
- [ ] **No process narration.** Report results and conclusions, not the
  project's history ("a dedicated study closed the gap we had flagged…" →
  state the finding). Corollary: present the LOGICAL order, not the
  development order — deriving the general method first and the evaluated
  variant as its licensed approximation is fine even when development ran the
  other way.
- [ ] **No confessional disclosure frames.** "One disclosure belongs up
  front:" → keep the honesty content as one plain factual clause; drop the
  mea-culpa framing and reader hand-holding.
- [ ] **No internal codenames or infrastructure references.** Arm/gate/study
  codenames (incl. letter-study labels and experiment codes), amendment or
  cell numbers, archive file paths in captions/prose ("read live from
  results/….csv"), and internal checks-and-balances vocabulary ("the rank
  audit disqualifies", "sanctioned use", "claims gate") → name things by what
  they are and state the scientific fact ("excluded for lack of covariate
  rank"). Genuine user-facing API names stay. Table columns get descriptive
  labels; codenames survive only in non-rendered source comments and a single
  reproducibility appendix mapping.
- [ ] **No drama.** No suspense or interest-manufacturing constructions:
  "has a price, paid exactly where…", "carries the news", "the pattern is the
  finding", "not the whole story", extended metaphors (bets/winnings/stakes,
  dials), chiasmus, meta discourse markers ("Stated plainly:"). State the
  fact; the section title names the TOPIC, the claim goes in the first
  sentence (see structural-tells on headings).
- [ ] **Precision on software-default claims.** Do not call a specific
  estimator "the default" when the shipped default is a policy that resolves
  to different estimators by regime; state the policy and its resolution rule.
- [ ] **Re-verify promoted numbers.** Any number moved from a source comment,
  note, or memory into reader-visible text must be recomputed against the data
  at promotion time (a bound that was true of one subset is quietly false of
  another).

## Scientific argument

- [ ] State the research question, objective, or hypothesis precisely enough that the
  reader can tell what the study answers.
- [ ] Identify the gap or problem with specific prior work; do not manufacture novelty
  by saying that an area is “underexplored” or “poorly understood” without support.
- [ ] Make the claimed contribution match what the paper actually establishes.
- [ ] Give each paragraph one argumentative job. Connect it to the previous paragraph;
  if paragraphs can be freely reordered, rebuild the argument rather than polishing
  transitions.
- [ ] Distinguish evidence from interpretation. Make the warrant between a result and
  its conclusion explicit when it is not obvious.
- [ ] Define the population, setting, estimand, conditions, and time frame to which each
  main claim applies.

## Claims and evidence

- [ ] Trace each empirical or literature claim to a reported result or a specific,
  relevant citation. A citation must support the exact claim, not merely concern the
  same topic.
- [ ] Distinguish the present study's findings from prior evidence and from the authors'
  interpretation.
- [ ] Report magnitude and direction, with uncertainty where applicable; do not replace
  them with “significant,” “substantial,” or “improved.”
- [ ] Do not equate statistical significance with practical importance, evidence of no
  effect with failure to reject, or a p-value with the probability that a hypothesis is
  true. Do not let a threshold alone determine the conclusion.
- [ ] Do not infer a difference because one estimate is statistically significant and
  another is not; report the direct comparison. Do not claim equivalence or “no effect”
  from a non-significant test unless the design and analysis support that conclusion.
- [ ] Match causal verbs to the design and assumptions. Use association language when
  causal identification is not justified; name important assumptions when a causal
  claim is intended.
- [ ] Calibrate certainty to the evidence. Preserve warranted hedges and scope
  conditions, but replace vague hedging with the actual source of uncertainty.
- [ ] Address credible alternative explanations, bias, confounding, measurement error,
  multiplicity, model dependence, and limited generalizability where relevant.
- [ ] State limitations specifically and explain how each affects interpretation; avoid
  ritual “further research is needed” paragraphs.

## Methods and reproducibility

- [ ] Describe the design, data source or sampling, inclusion/exclusion rules,
  variables or interventions, procedures, and analysis well enough for a qualified
  reader to evaluate and, where feasible, reproduce the work.
- [ ] State consequential analytic choices: preprocessing, missing-data handling,
  transformations, model specification, tuning, multiplicity control, sensitivity
  analyses, and software/version details where relevant.
- [ ] Identify deviations from a protocol, preregistration, or analysis plan and label
  exploratory analyses honestly.
- [ ] Provide or accurately describe access to data, code, materials, metadata, and the
  computational environment when applicable; explain genuine restrictions.
- [ ] Keep Methods, Results, tables, figures, supplement, and code/data availability
  statements consistent with one another.

## Complete and unbiased reporting

- [ ] Report all stated primary and secondary outcomes, including null, negative, and
  inconvenient results; do not selectively emphasize favorable analyses.
- [ ] Give denominators and absolute counts where percentages alone could mislead.
- [ ] Report exclusions, attrition, missingness, and analysis sample sizes where they
  affect interpretation.
- [ ] Separate results from speculation, avoid duplicate reporting across prose and
  tables/figures, and put the main findings first.
- [ ] Ensure the abstract reflects the design, main results, uncertainty, and
  limitations without stronger claims than the body.
- [ ] Include ethics approval, consent, funding, conflicts, and author or AI-use
  disclosures when the field, venue, or study requires them.

## Section-function check

| Section | Good scientific writing does | Bad scientific writing does |
|---|---|---|
| Title/abstract | Identify the design and central result accurately; make the abstract stand alone | Advertise, overgeneralize, or omit uncertainty and key limitations |
| Introduction | Establish the specific problem, relevant evidence, gap, and objective | Give a generic history, citation dump, or unsupported novelty claim |
| Methods | Explain what was done and why with enough detail to evaluate the study | Hide consequential choices behind “standard methods” or retrospective rationale |
| Results | Follow the stated questions; report estimates, uncertainty, and all relevant outcomes | Interpret selectively, duplicate tables, or narrate only favorable findings |
| Discussion | Answer the question, compare with relevant evidence, explain limits, and bound implications | Repeat results, imply causation from association, or end in generic uplift |

## Sources behind this checklist

These sources support the checklist's general principles; use the appropriate
discipline-specific reporting standard for a real manuscript.

- [ICMJE Recommendations: Preparing a Manuscript for Submission](https://www.icmje.org/recommendations/browse/manuscript-preparation/preparing-for-submission.html)
  — clear objectives; reproducible methods; complete results; supported conclusions;
  limitations and disclosures.
- [EQUATOR Network: reporting guidelines](https://www.equator-network.org/toolkits/writing-research/)
  — study-design-specific minimum reporting items.
- [National Academies, *Reproducibility and Replicability in Science*](https://www.nationalacademies.org/read/25303/chapter/3)
  — transparent methods, data, code, and explicit uncertainty.
- [ASA Statement on Statistical Significance and P-Values](https://www.amstat.org/asa/files/pdfs/p-valuestatement.pdf)
  — full reporting, effect importance, and conclusions not based on a threshold alone.
- [Center for Open Science, TOP Guidelines](https://www.cos.io/initiatives/top-guidelines)
  — protocol, analysis-plan, materials, code, data, and reporting transparency.
- [Gopen and Swan, “The Science of Scientific Writing”](https://www.ispdhome.org/common/Uploaded%20files/ispd/earlycareer/writing_and_publishing/TheScienceOfScientificWriting_Gopen_Swan.pdf)
  — reader expectations, topic position, stress position, and logical linkage.
- [NCBI Style Guide: Grammar Reminders and Technical Writing](https://www.ncbi.nlm.nih.gov/books/NBK993/)
  — precise word choice and intentional active/passive voice.
