# Reproducibility Review Checklist

Detailed checklist for evaluating code and data supplements of scientific papers.

## 1. Documentation (README)

### README Presence and Format
- [ ] README file exists (`README.txt`, `README.md`, or `README.pdf`)
- [ ] README is human-readable (not embedded in code comments)

### Environment Documentation
- [ ] Software versions documented (OS, language version, package versions)
- [ ] For R: `sessionInfo()` output included after loading all packages
- [ ] For Python: `requirements.txt`, `environment.yml`, or `pip freeze` output
- [ ] For other languages: equivalent dependency specification
- [ ] Environment reproducibility tools used (Docker, renv, conda, etc.) — note as positive

### Execution Instructions
- [ ] Clear instructions on which scripts to run and in what order
- [ ] Working directory or setup requirements specified
- [ ] Any manual steps clearly documented with exact instructions
- [ ] Master script or Makefile provided (preferred over manual instructions)

### Data Documentation
- [ ] All datasets documented with provenance
- [ ] Data dictionaries or variable definitions provided
- [ ] Licensing/IP information for external data
- [ ] Instructions for obtaining restricted data (if applicable)

### File Structure
- [ ] Listing of files and folders with explanations
- [ ] Logical organization described

## 2. Completeness

### Code Completeness
- [ ] Code provided for ALL figures in paper
- [ ] Code provided for ALL tables in paper
- [ ] Code provided for ALL numerical results mentioned in text
- [ ] Code provided for supplementary material results
- [ ] External code dependencies (GitHub repos, etc.) referenced and accessible
  - If publicly accessible: clone/download and include in review scope
  - Only flag as "missing" if truly inaccessible (private repo, dead link, no URL given)

### Data Completeness
- [ ] All required input data files present
- [ ] If data restricted: synthetic/pseudo-data provided
- [ ] If data restricted: original data available to reviewers (ideal)
- [ ] External data sources linked and documented

### Output Completeness
- [ ] Expected outputs clearly defined
- [ ] Sample outputs or intermediate results provided for verification

## 3. Code Organization

### File Structure
- [ ] Sensible folder structure (e.g., `data/`, `code/`, `results/`)
- [ ] Code separated from input data and output results
- [ ] Descriptive file names (no `x001.R`, `untitled.py`)
- [ ] No spaces in file names
- [ ] Correct file extensions (`.R`, `.py`, `.m`, etc.)

### Master Script
- [ ] Single entry point script exists (`main.R`, `master.py`, `Makefile`)
- [ ] Running master script reproduces all results
- [ ] No manual interventions required (or clearly documented if unavoidable)

### Code Modularity
- [ ] Function definitions separated from analysis scripts
- [ ] Functions loaded via imports/source, not copy-pasted
- [ ] No copy-paste programming (duplicated code blocks)
- [ ] Reusable code in functions, called with different parameters

### Path Handling
- [ ] No absolute paths (e.g., `C:\Users\...`, `/home/user/...`)
- [ ] Relative paths used throughout
- [ ] Platform-independent path construction (e.g., `file.path()` in R, `os.path.join()` in Python)

## 4. Code Quality

### Style and Formatting
- [ ] Consistent formatting throughout
- [ ] Proper indentation
- [ ] Reasonable line length (≤120 characters)
- [ ] Spaces around operators and after commas
- [ ] English used for all names and comments

### Cleanliness
- [ ] No commented-out code blocks
- [ ] No dead/unused code
- [ ] No extraneous debug statements
- [ ] No `rm(list=ls())` or equivalent workspace clearing
- [ ] No automatic package installation without user consent

### Documentation
- [ ] Functions documented (inputs, outputs, purpose)
- [ ] Complex logic explained in comments
- [ ] Comments indicate which figure/table code produces

### Output Handling
- [ ] Figures saved programmatically with descriptive names
- [ ] Tables saved as structured data (not console output)
- [ ] File names match manuscript numbering (preferred)
- [ ] Results saved to dedicated output folder

## 5. Reproducibility

### Random Number Generation
- [ ] Seeds set before any stochastic operations
- [ ] Same seed produces identical results
- [ ] Seeds documented or easily locatable

### Simulation Studies
- [ ] Settings iterated programmatically (not manual code edits)
- [ ] Parameter combinations handled via loops/functions
- [ ] Intermediate results saved with descriptive names
- [ ] Results aggregation automated

### Computational Tractability
- [ ] Total runtime documented or estimable
- [ ] For long computations: intermediate results provided
- [ ] Parameters to reduce runtime documented
- [ ] Spot-check verification possible without full re-run

### Platform Independence
- [ ] No OS-specific commands (or alternatives documented)
- [ ] Works on Windows, Mac, Linux (or requirements stated)
- [ ] Case-sensitivity in paths considered

## 6. Result Verification

### Output Matching
- [ ] Generated figures match manuscript figures
- [ ] Generated tables match manuscript tables
- [ ] Numerical results match reported values
- [ ] Small discrepancies explainable (rounding, Monte Carlo error)

### Reduced-Run Verification
- [ ] Limited runs produce qualitatively similar results
- [ ] Rank ordering of methods preserved
- [ ] Key patterns and conclusions supported
- [ ] Monte Carlo error bounds reasonable

## Severity Levels

When reporting issues, classify by severity:

**Critical** — Blocks reproduction entirely:
- Missing essential code or data
- Code crashes with unfixable errors
- Results fundamentally inconsistent with paper

**Major** — Significantly impedes reproduction:
- Missing documentation for key steps
- Substantial manual intervention required
- Some results not reproducible
- Poor code organization requiring extensive navigation

**Minor** — Does not block reproduction but should be fixed:
- Style inconsistencies
- Missing but inferable documentation
- Suboptimal organization
- Cosmetic issues

**Suggestions** — Best practices not followed:
- Could use better tooling (Makefile, renv, etc.)
- Code could be more modular
- Documentation could be more detailed
