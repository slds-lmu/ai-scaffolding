---
name: peer-review
description: Generate rigorous, evidence-based peer reviews for statistical and methodological papers. Use when asked to review a manuscript, evaluate a statistical paper, write referee comments, or assess methodological research. Produces structured reviews with Summary, Major Issues, and Minor Issues sections. Includes specialized checklists for evaluating simulation studies (Morris et al. 2019) and code/data supplements. Always outputs reviews using the provided Quarto template.
---

# Statistical Peer Review Skill

Generate rigorous, evidence-based peer reviews for statistical and methodological papers.

## Workflow

1. **Read the manuscript** carefully, creating a scratchpad of issues organized by section
2. **Apply checklists** from `references/` for simulation studies and code supplements if present
3. **Research** relevant literature on the web to verify claims and find context
4. **Create review** using the Quarto template in `assets/rev_template.qmd`
5. **Output** the review as a `.qmd` file

## Review Structure

Every review must have three sections:

### 1. Summary
- State paper's goals, methods, and claims in 2-3 sentences
- List key strengths (novel algorithms, code availability, well-designed simulations)
- State major weaknesses upfront (unsupported claims, missing comparisons, poor reproducibility)
- Example opener: *"The paper proposes [method]. While [strength], the evaluation is incomplete and [weakness]..."*

### 2. Major Issues
Use descriptive headings (e.g., "**Exaggerated scalability claims**"). For each issue:
- Cite specific page, equation, table, figure, or code line
- Contrast with prior work where relevant
- Propose actionable fixes

### 3. Minor Issues
Bullet points for:
- Notation inconsistencies
- Unclear language
- Minor unsupported claims
- Typos, figure readability
- Code quality issues

## Evaluation Criteria

Assess against five dimensions:

| Criterion | Key Questions |
|-----------|--------------|
| **Methodology** | Appropriate techniques? Identifiability? Convergence proofs? |
| **Reproducibility** | Code quality? Documentation? Dependencies managed? |
| **Empirical Claims** | Sufficient power? Appropriate baselines? Effect sizes reported? |
| **Scholarly Integrity** | Citation gaps? Overstated novelty? Misrepresented prior work? |
| **Presentation** | Consistent notation? Readable figures? Clear writing? |

## Tone Guidelines

- **Direct but collegial**: Use *"The authors fail to address..."* not *"It might be helpful to consider..."*
- **Technically precise**: Reference equations, code, prior work to ground critiques
- **Constructive**: Every criticism should include a path to resolution
- **Fair**: Acknowledge genuine contributions; don't dismiss good work over minor flaws

## Specialized Checklists

For papers with simulation studies, apply: `references/simulation-study-checklist.md`

**For papers with simulation studies**: Also invoke the `setup-benchmark` skill (via the Skill tool) to gain access to deep domain knowledge on Monte Carlo experiment design. This enables you to evaluate:
- Whether DGPs include both well-specified and deliberately misspecified settings (not just "home-court" scenarios)
- Whether coverage diagnostics are adequate (SE ratio, bias-eliminated coverage)
- Whether Monte Carlo SEs are reported and sufficient
- Whether the DGP design is factorial, space-filling, or unjustifiably narrow
- Whether truth functions satisfy identifiability constraints
- Whether practical significance thresholds are pre-specified
- Red flags from the study-design literature (Niessl et al. 2022, Morris et al. 2019)

For papers with code/data supplements, apply: `references/code-supplement-checklist.md`

## Output Format

Always use the Quarto template at `assets/rev_template.qmd`:
1. Copy template to working directory
2. Update YAML frontmatter (title with manuscript ID, subtitle with paper title)
3. Write review content in the template structure
4. Output as `.qmd` file

## Common Critique Patterns

**Unsubstantiated claims**: *"The authors claim [X] (p.Y) but provide no evidence. The cited results show [contrary finding]."*

**Missing comparisons**: *"No comparison to [standard method] is included, making it impossible to assess practical utility."*

**Reproducibility gaps**: *"The supplement omits [simulation/analysis] code; results cannot be verified."*

**Misspecified baselines**: *"The comparison to [method] uses non-default/suboptimal settings (line X), unfairly disadvantaging it."*

**Overstated novelty**: *"The proposed [technique] is equivalent to [prior work] with minor modifications."*
