# Jargon-glossing (secondary, lightweight check)

Separate from de-slopping, but worth a quick pass on the same document: every
non-standard abbreviation or ad-hoc label should be introduced on first use, so a
reasonably-familiar reader (not an insider, not someone with perfect recall of the
project) isn't left to infer it from context.

- **Standard field terms** don't need re-explaining to a domain-competent reader — e.g.
  for a statistics audience: CR1, CR2, HC/HC2/HC3, GEE, AR1, SNR, DGP, EDF. Don't
  over-gloss these; it reads as condescending and adds length for no benefit.
- **Genuinely niche-but-real terms** (used in the sub-field but not universal) get a
  one-line gloss at first use, not a footnote essay: e.g. "a *plasmode* simulation — one
  seeded from real data, keeping its dependence structure while fixing a known truth."
- **Project- or paper-specific codenames** (a study nickname, an internal label with no
  meaning outside this document) are the worst offenders: either introduce by role on
  first mention ("the oracle-basis leverage experiment, which we label F-ORC") or drop
  the bare code entirely and refer to the thing by what it does.
- If the same object gets two different labels across a document (a codename and a
  number, e.g. "Study W" that is later aliased to "Study 3"), pick one and use it
  consistently — don't make the reader track an alias table.
- Check whether a forward cross-reference precedes its definition (a term used at
  paragraph 3 but only defined in an appendix). Pull a one-line gloss forward to the
  first use; keep the full definition where it already lives.

This check does not touch equations, notation, or defined mathematical symbols — those
are covered by the paper's notation section, not this checklist.
