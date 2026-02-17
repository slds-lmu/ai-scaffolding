---
title: "Reproducibility Review"
date: "{{DATE}}"
paper: "{{PAPER_TITLE}}"
---

# Summary

{{OVERALL_ASSESSMENT: Brief 2-3 sentence summary of reproducibility status}}

**Verdict:** {{VERDICT: Reproducible / Partially Reproducible / Not Reproducible}}

# Supplement Overview

**Files received:**
{{LIST_OF_FILES}}

**Languages/Tools:** {{LANGUAGES}}

**Stated dependencies:** {{DEPENDENCIES}}

# Execution Attempts

## Environment Setup

{{DESCRIPTION_OF_SETUP_STEPS}}

**Packages installed:** {{PACKAGES}}

**Issues encountered:** {{SETUP_ISSUES}}

## Code Execution

### Successfully Executed
{{LIST_SUCCESSFULLY_RUN_SCRIPTS}}

### Required Fixes
{{LIST_OF_FIXES_APPLIED}}

### Failed to Execute
{{LIST_OF_FAILURES_WITH_REASONS}}

## Reduced Simulation Runs

**Original settings:** {{ORIGINAL_SETTINGS}}

**Reduced settings:** {{REDUCED_SETTINGS}}

**Runtime:** {{RUNTIME}}

**Qualitative comparison:** {{COMPARISON_ASSESSMENT}}

# Results Verification

## Figures

| Figure | Status | Notes |
|--------|--------|-------|
{{FIGURE_TABLE}}

## Tables

| Table | Status | Notes |
|-------|--------|-------|
{{TABLE_TABLE}}

## Numerical Results

{{NUMERICAL_RESULTS_VERIFICATION}}

# Issues Found

## Critical Issues

{{CRITICAL_ISSUES — or "None" if none}}

## Major Issues

{{MAJOR_ISSUES — or "None" if none}}

## Minor Issues

{{MINOR_ISSUES — or "None" if none}}

## Suggestions

{{SUGGESTIONS — or "None" if none}}

# Required Changes

Checklist of changes required before acceptance:

{{REQUIRED_CHANGES_CHECKLIST}}

# Appendix

## Environment Details

```
{{SESSION_INFO_OR_EQUIVALENT}}
```

## Execution Log

```
{{KEY_EXECUTION_OUTPUT}}
```
