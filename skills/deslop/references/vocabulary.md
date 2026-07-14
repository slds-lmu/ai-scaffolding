# Vocabulary and phrase lists

Cross-check every hit against the firewall in `SKILL.md` §Step 0 before cutting —
sense, not spelling, decides. These lists are drawn from Wikipedia's *Signs of AI
writing* / WikiProject AI Cleanup, word-frequency studies (Max-Planck / Tübingen–
Northwestern, arXiv:2409.01754), and several public "de-slop"/"humanizer" style
guides, cross-referenced against what actually shows up in academic and technical
prose.

## Inflated verbs
delve, leverage *(non-technical sense)*, harness, foster/cultivate, underscore/
highlight/emphasize, showcase, boast(s), unlock/unleash, utilize, streamline,
facilitate, spearhead, bolster, garner, navigate (a landscape), align with, encompass,
enhance, elevate, empower, catalyze, reimagine → use plain equivalents ("use", "show",
"has", "help") or delete and let the fact stand.

## Inflated adjectives
pivotal/crucial/vital/essential/key, seamless/effortless, robust *(non-technical)*,
nuanced/intricate/multifaceted, meticulous/rigorous-as-praise/comprehensive,
notable/remarkable/profound, invaluable, cutting-edge/innovative/groundbreaking/
transformative/state-of-the-art, rich/vibrant/dynamic/holistic, enduring, compelling,
exceptional, sophisticated, world-class → cut, or state *why* concretely (with a
number).

## Inflated nouns
tapestry/mosaic, realm/landscape/sphere/arena, testament, journey, plethora/myriad/
array/wealth-of, cornerstone/hub/linchpin, synergy/underpinnings/interplay,
ecosystem *(non-technical)*, thought leadership, best practices, paradigm, game-changer
→ name the actual things or give the number.

## Adverb/connector crutches
moreover/furthermore/additionally (AI cycles a tiny set at 3–5× the human rate — vary
or delete), notably/importantly/crucially as sentence openers, essentially/basically/
fundamentally/arguably/ultimately (filler — delete), undoubtedly/clearly/of course
(false confidence — delete or support), genuinely/truly/quite frankly (hollow
intensifiers).

## Copula avoidance
AI text tends to avoid a plain "is/are" in favor of "serves as", "stands as", "boasts",
"features", "maintains", "represents", "marks". If the sentence works with a plain "is",
use it — that's not a stylistic downgrade, it's the correct register for most technical
and factual claims.

## Formulaic phrases and constructions
- "It is important/worth noting that…" → delete the frame, keep the fact.
- **Negative parallelism / antithesis** — "not just X — it's Y", "not merely X but Y":
  the most recognizable AI fingerprint. State Y plainly; reserve the contrast for a rare,
  genuine pivot.
- "plays a pivotal/crucial role in" → say what it *does*.
- "stands as a testament to", "a rich tapestry of", "in the realm/world of", "navigating
  the landscape of", "at its core/heart", "when it comes to" → open on the subject.
- Vacuous scene-setting openers ("In today's … world", "In an era of…") → open on
  substance.
- "In this section we explore…", "In conclusion/Overall/To sum up" (section-enders that
  add nothing), "The key takeaway is", "That said", "Needless to say" → cut.
- **Vague authority / weasel wording** — "studies suggest", "experts agree", "it is
  widely believed", "research shows", "some argue": in any evidence-based writing,
  **cite the specific work or drop the claim.** (Highest priority — see P0 in SKILL.md.)
- Superficial "-ing" tack-on for fake depth ("...the model, highlighting its importance
  to the field.") → cut the tack-on or replace with a concrete, sourced claim.
- Formulaic "Despite its [strengths], [subject] faces [generic challenges]" sections,
  and generic upbeat closers ("the future looks promising", "further work is needed" with
  nothing specific) → replace with the actual open question or limitation.
- Any leftover chatbot scaffolding ("Certainly!", "Here's a breakdown", "I hope this
  helps!", "Great question!", sign-offs) → delete on sight (should not exist in
  submitted prose, but check).
- Elegant-variation synonym-cycling — swapping a defined term for a "fresher" synonym
  purely to avoid repetition (calling the same estimator "the approach", then "the
  technique", then "the method") → repeat the exact term; see DO principle 9.
