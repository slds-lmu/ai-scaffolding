# Structural, rhetorical, and formatting tells

## Structural & rhetorical
- **Rule-of-three overuse** ("efficient, scalable, and robust"; relentless triads) → vary
  list length; break some triads into prose.
- **Persistent parallelism / uniform paragraph shape** (claim → three supports → mini-
  summary, every time) → break symmetry; vary sentence and paragraph length.
- **Self-narrating signposting** ("First… Second… Third…", "we contribute three things",
  "this section will…") → keep functional signposts, cut the outline-narration.
- **Vacuous topic sentences** ("This method has several important advantages.") → open
  with the specific advantage.
- **Summary sentence restating the previous sentence** → delete the restatement.
- **Inflated significance / over-claiming**, incl. the "this rules out an entire family/
  class" flourish → state precisely what is and isn't shown, with assumptions; calibrate
  to the evidence.
- **Hedge-then-pivot & stacked hedges** ("While X may be true, it is important to
  consider Y…"; "may/might/could" pile-ups) → commit; keep one warranted qualifier. In a
  peer-review/Gutachten profile, a direct evaluative judgment is the genre, not
  overclaiming — don't manufacture a hedge where the reviewer means to be direct.
- **Bullets where prose belongs** → write connected argument as prose; bullets only for
  genuinely parallel discrete items.
- **Abstraction without specifics** → prefer the effect size / coverage number / CI
  width / citation over a vague "substantially improves".
- **Paragraph-reshuffle smell** — if paragraphs could be reordered without breaking the
  argument, it's a list dressed as prose, not an argument; each paragraph should depend
  on the one before it.
- **Notability/legacy puffery** ("stands as a testament to", "marking a pivotal moment",
  "symbolizing an enduring shift") applied to routine events or results → delete if the
  sentence works without it.

## Punctuation & formatting
- **Em-dash density** — AI over-uses em-dashes; **but the em-dash alone is not a tell**
  (long human pedigree, and this user's own prose uses them deliberately). Convert
  *routine* dashes to commas/colons/periods; keep purposeful ones. Don't purge on sight
  and don't adopt a hard "zero em-dashes" rule.
- Bold-for-emphasis overuse, esp. "**Bold lead-in:** restated sentence" as a bullet
  opener — a strong ChatGPT signature; drop bold lead-ins in prose.
- Title-case headings → sentence case (JSS/JCGS and most journal house styles). Keep
  `{#anchors}` and cross-ref keys unchanged.
- **Narrative/dramatized section titles (research-paper profile)** — headings that
  tell the story or assert the claim instead of naming the topic: "Shipping it: the
  cluster-robust default", "What robust covariance cannot do", "The bootstrap-t
  confirms, rather than closes, the gap", "Demonstration: the X collapse",
  colon-plus-drama constructions generally. Sober replacements name the subject:
  "Software implementation", "Limitations", "Case study: <data>", "Undercoverage in
  <setting>". The claim belongs in the section's first sentence, not its title.
  (Registered from PI feedback 2026-07-21; applies to papers/theses, NOT to
  teaching material or blog-register prose, where narrative headings can be
  appropriate.)
- Non-sequential heading levels, decorative horizontal rules before headings, emoji as
  bullet markers or section dividers, reflexive nested bullets → remove.
- Curly ("smart") quotes where the surrounding document uses straight quotes, or vice
  versa — match the document's existing convention, don't impose one.
- Inline-header bullet lists ("- **Cost:** it is expensive.") used as a substitute for a
  real sentence → write the sentence.

## Sources
Wikipedia *Signs of AI writing* / WikiProject AI Cleanup; NPR/Forbes/TechSpot coverage;
Max-Planck & Tübingen–Northwestern word-frequency studies (Scientific American, PMC,
arXiv:2409.01754); Colin Gorrie (Dead Language Society) incl. the em-dash counter-
caveat; "not X, it's Y" analyses (refine.so, Medium); editor lists (Inc., Grammarly,
WisBlawg); Turnitin/academic-integrity guidance (with false-positive caveats); Strunk &
White; Williams *Style*; Schimel *Writing Science*; Nature/PNAS; JSS Style Guide; ASA
Style Guide. Cross-checked against several public Claude-Code "de-slop"/"humanizer"
skills (stephenturner/skill-deslop, blader/humanizer, conorbronsdon/avoid-ai-writing,
hardikpandya/stop-slop) for phrasing/structure ideas — none of their word lists are
calibrated for academic/statistical prose, hence the firewall in `SKILL.md`.
