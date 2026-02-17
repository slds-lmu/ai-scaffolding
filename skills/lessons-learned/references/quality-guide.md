# Quality Guide: Good vs Bad Lessons

## Good Lessons

Each is actionable, specific, non-obvious, and verified.

### MEMORY.md one-liners

```markdown
- `tf_register` rejects `tfd_irreg` — must interpolate to regular grid first
- Air formatter pre-commit hook: re-stage files after formatting, then NEW commit (don't amend)
- Codex CLI frequently returns 0-byte output; Gemini is most reliable council bot
```

### Topic file entries (with code)

```markdown
## RNG Save/Restore for Sub-operations
When injecting `set.seed()` inside a pipeline step (e.g., contamination after generation),
save/restore the RNG state:
  old_seed <- if (exists(".Random.seed", envir = .GlobalEnv)) .Random.seed else NULL
  on.exit({ if (!is.null(old_seed)) .Random.seed <<- old_seed }, add = TRUE)
  set.seed(seed + 10000L)
Without this, downstream code gets polluted RNG state.
```

### Skill additions

```markdown
# Added to setup-benchmark bug checklist:
16. **RNG pollution in sub-operations**: save/restore with `on.exit()` when using
    `set.seed()` inside pipeline steps
```

## Bad Lessons (do NOT persist these)

### Too vague
- "RNG can be tricky in simulations" — no actionable fix
- "Be careful with parallel code" — everyone knows this

### Too obvious
- "Always test your code before committing" — common knowledge
- "Use version control" — not a lesson

### Too specific / ephemeral
- "The bug was on line 347 of sim-dgp.R" — line numbers change
- "Took 3.2 hours to run Study 3" — timing is session-specific
- "RcppArmadillo 15+ needs flag X in Makevars" — one-time migration, won't recur
- "Push to fabian-s/registr fork, then PR to upstream" — repo-specific config

### Project config masquerading as lessons
- "origin = julia-wrobel/registr, fork = fabian-s/registr" — just a fact about this repo
- "rhub platform ubuntu-clang maps to r-devel-linux-x86_64-debian-clang" — lookup table, not insight
- "Rd cross-refs need \link[pkg:topic]{text}" — easily found in roxygen2 docs

These are useful *within the session* but don't justify permanent memory. They're either
one-time setup, easily re-discoverable, or too specific to one project to generalize.

### Speculative / unverified
- "I think the fda.usc package might have a memory leak" — not confirmed
- "This pattern probably works for all S3 classes" — only tested on one

### Duplicates existing content
- Repeating what's already in CLAUDE.md or a skill's SKILL.md
- Rewording an existing MEMORY.md entry

## Decision Heuristic

Ask: "If a fresh Claude session hit this exact situation, would this lesson save
significant time or prevent a mistake?" If yes → persist. If no → skip.
