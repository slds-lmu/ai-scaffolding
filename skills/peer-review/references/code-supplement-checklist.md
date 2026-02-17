# Code and Data Supplement Checklist
*Adapted from Biometrical Journal standards for computational reproducibility*

Apply this checklist to evaluate code and data supplements in statistical papers.

## Reproducibility

### Completeness
- [ ] Supplement contains ALL code and data to reproduce ALL figures, tables, and results
- [ ] Master scripts or Makefiles automate full reproduction workflow
- [ ] Different simulation settings executed via parameters, not manual code edits
- [ ] No "copy-paste" programming with near-identical script variants

### Traceability
- [ ] Comments state which figure/table each code section produces
- [ ] Output filenames match manuscript numbering (Table1.csv, Figure2.png)
- [ ] Results saved with descriptive filenames in organized folders

### Randomization
- [ ] RNG seeds set for exact reproducibility
- [ ] Monte Carlo errors verified to be negligible (results stable across reruns)

### Data Restrictions
- [ ] If data cannot be shared: synthetic/anonymized pseudo-data provided
- [ ] Original data available to editors for audit if needed

### Computational Cost
- [ ] For long-running code: intermediate results provided
- [ ] Parameters documented to reduce runtime for spot-checks
- [ ] Spot-checks possible without full rerun

## Documentation (README)

- [ ] Format: .txt, HTML, or PDF (not .docx)
- [ ] Software versions: OS, language versions, all package versions
- [ ] For R: `sessionInfo()` output included
- [ ] Reproducible environment option provided (Docker, renv, packrat)?
- [ ] GitHub packages: commit hash or release tag + installation instructions
- [ ] Clear instructions: which scripts, in what order, for which outputs
- [ ] Any manual steps documented with exact file/line/edit details
- [ ] Data documentation: provenance, licensing, data dictionaries
- [ ] File listing with folder structure and content descriptions

## Coding Standards

### Format
- [ ] ASCII/UTF-8 encoding
- [ ] English for all names, comments, documentation
- [ ] Consistent formatting: spacing, line lengths (≤80-100 chars), indentation
- [ ] Proper file extensions (.R, .py, .sas, not .txt or .pdf)

### Organization
- [ ] Code split by functionality with descriptive filenames
- [ ] Imports/dependencies at file top
- [ ] Sensible folder structure
- [ ] Functions documented (inputs, outputs, purpose)

### Quality
- [ ] No copy-paste code; reusable functions/loops instead
- [ ] Master scripts handle iteration over settings
- [ ] No repeated manual edits required
- [ ] Analysis code separated from function definitions
- [ ] No extraneous/commented-out code
- [ ] No global workspace modifications (no `rm(list=ls())`)
- [ ] No auto-installing packages without user consent
- [ ] Relative paths only (no `C:/Users/...`); or absolute paths documented

### Platform Independence
- [ ] Avoid OS-specific commands (`windows()`, `windowsFonts()`)
- [ ] Use `file.path()` or similar for cross-platform paths
- [ ] R packages as source (.tar.gz), not Windows binaries (.zip)
- [ ] Case-sensitive path names verified

### Compiled Code
- [ ] Source code + Makefiles/build instructions provided
- [ ] Pre-compiled executables included

## Red Flags
- "Run script1.R, then manually change line 47, then run script2.R..."
- Hard-coded paths to author's local filesystem
- Missing package versions or `sessionInfo()`
- Code in Word documents or PDFs
- Results only reproducible on author's machine
- Intermediate results missing for expensive computations
- Simulation code absent from supplement
