export const meta = {
  name: 'interactive-textbook-build',
  description: 'Build interactive-textbook sections + nested tooltip concepts from a source PDF',
  phases: [
    { title: 'Sections', detail: 'one agent per section, faithful paraphrase + widgets + concept links' },
    { title: 'Review', detail: 'adversarial fidelity/spec review queued per section' },
    { title: 'Tooltips', detail: 'concept worker pool (4 workers × ≤8 concepts) iterated to closure' },
    { title: 'Integrate', detail: 'build check, missing-concept stubs, report' },
  ],
}

const A = typeof args === 'string' ? JSON.parse(args) : args
const ROOT = A.root
const PDF = A.pdf
const SECTIONS = A.sections

const COMMON = `You are one agent in a multi-agent build of an interactive textbook (React+TS+tailwind+MathJax) adapting ${A.sourceShort}.
MANDATORY FIRST STEPS: (1) Read ${ROOT}/CONVENTIONS.md COMPLETELY, including the Lessons section at the bottom — it is binding. (2) Read ${ROOT}/src/concepts/_demo.tsx as the code pattern reference.
HARD RULES: never run any git command (no stash/checkout/reset/commit); never start a dev server (no npm run dev); write only inside ${ROOT}; undo mistakes by editing files. COPYRIGHT: body prose must be your OWN sentences — an independent close paraphrase, never verbatim book text (details in CONVENTIONS.md).
AFTER your edits run: cd ${ROOT} && npx tsc --noEmit — and fix every error you introduced.
If you hit a trap or learn something later agents need, append one line: cd ${ROOT} && printf -- '- %s\\n' "the lesson" >> CONVENTIONS.md
Your final output is machine-read: return ONLY the structured report.`

const CONCEPT_ITEM = {
  type: 'object',
  required: ['id', 'name', 'context'],
  additionalProperties: false,
  properties: {
    id: { type: 'string', description: 'kebab-case concept id' },
    name: { type: 'string', description: 'display name' },
    context: { type: 'string', description: 'one sentence: where/why it is needed' },
  },
}

const SECTION_SCHEMA = {
  type: 'object',
  required: ['sectionId', 'prereqConcepts'],
  additionalProperties: false,
  properties: {
    sectionId: { type: 'string' },
    prereqConcepts: { type: 'array', items: CONCEPT_ITEM },
    notes: { type: 'string' },
  },
}

const REVIEW_SCHEMA = {
  type: 'object',
  required: ['fixesApplied', 'remainingIssues', 'addedPrereqs'],
  additionalProperties: false,
  properties: {
    fixesApplied: { type: 'array', items: { type: 'string' } },
    remainingIssues: { type: 'array', items: { type: 'string' } },
    addedPrereqs: { type: 'array', items: CONCEPT_ITEM },
  },
}

const CONCEPT_SCHEMA = {
  type: 'object',
  required: ['written', 'newPrereqs'],
  additionalProperties: false,
  properties: {
    written: { type: 'array', items: { type: 'string' } },
    newPrereqs: { type: 'array', items: CONCEPT_ITEM },
  },
}

const INTEGRATION_SCHEMA = {
  type: 'object',
  required: ['buildOk', 'summary'],
  additionalProperties: false,
  properties: {
    buildOk: { type: 'boolean' },
    stubsCreated: { type: 'array', items: { type: 'string' } },
    issuesFixed: { type: 'array', items: { type: 'string' } },
    summary: { type: 'string' },
  },
}

phase('Sections')

const results = await pipeline(
  SECTIONS,
  (s) =>
    agent(
      `${COMMON}
TASK: Write the interactive-textbook version of ${A.sourceShort} §${s.id} "${s.title}".
SOURCE: Read PDF pages ${s.pages} of "${PDF}" with the Read tool (pages: "${s.pages}"). This is your ONLY content source; transcribe all math from the rendered pages precisely.${s.extra || ''}
OUTPUT FILE: overwrite ${ROOT}/src/sections/${s.comp}.tsx — export function ${s.comp}() containing the complete section (the h2 heading is rendered by App, do not repeat it).
COVERAGE (faithfulness, same level of detail): every subsection (h3 with book numbering), every Definition/Theorem/Example/Remark via EnvBlock with the book's numbers, key numbered equations via <Eq tag> with the book's own tags (if the source has NO numbered equations, use <MD> and do NOT invent tags), margin-note and footnote content folded in as short asides. Nothing skipped, nothing invented.
PROSE: independent close paraphrase in English — same ideas, order, notation, rigor; your own sentences (copyright policy in CONVENTIONS.md).
CONCEPT LINKS: wrap prerequisite concepts in <ConceptLink id="...">, canonical ids from CONVENTIONS.md; link the first occurrence in a paragraph only. Concepts taught inside the converted sections themselves get a section anchor link instead of a tooltip.
FIGURES: recreate each figure of your section as an SVG/canvas/TransformCanvas/Plot rendering with caption "after ${A.sourceShort} Figure X.Y" — never a scan. If a figure supports it, add an interactive Deep-dive (ExpandedReading) widget right after it.
WIDGETS: at least 2–3 ExpandedReading blocks with genuinely interactive "gears-level" widgets at the pedagogically best spots; more if they truly help (spec favors more).
REPORT: prereqConcepts = every ConceptLink id you used that has no module in ${ROOT}/src/concepts/ (check with ls).`,
      { label: `write:${s.id}`, phase: 'Sections', schema: SECTION_SCHEMA }
    ),
  (rep, s) =>
    agent(
      `${COMMON}
TASK: ADVERSARIAL REVIEW of ${ROOT}/src/sections/${s.comp}.tsx (adaptation of ${A.sourceShort} §${s.id} "${s.title}"). Read the file AND the source PDF pages ${s.pages} of "${PDF}" (Read tool, pages parameter). Then verify and FIX directly in the file:
1. COMPLETENESS: every subsection, Definition/Theorem/Example/Remark, and key numbered equation of §${s.id} present with correct book numbering. Add whatever is missing yourself.
2. MATH FIDELITY: recheck at least 8 equations symbol-by-symbol against the PDF; fix any deviation.
3. NO VERBATIM PROSE: slide an 8-word window over ALL prose in the file (body text, captions, asides — short frame sentences like equation lead-ins leak most often) and compare against the book text; rewrite any near-copy in fresh words.
4. SPEC COMPLIANCE: ConceptLinks on prerequisite concepts with canonical ids (CONVENTIONS.md), interactive widgets inside ExpandedReading blocks (≥2), EnvBlock/Eq used properly, section anchors (not tooltips) for concepts the converted sections themselves introduce; widget quality bar from CONVENTIONS.md (labeled axes, content within bounds, parameter state printed, consistent color-coding across equation lines).
5. cd ${ROOT} && npx tsc --noEmit passes.
Fix everything findable; only report as remainingIssues what you genuinely cannot fix. addedPrereqs = ConceptLink ids YOU added that lack modules in src/concepts/.`,
      { label: `review:${s.id}`, phase: 'Review', schema: REVIEW_SCHEMA }
    ).then((rv) => ({ s, rep, rv }))
)

const ok = results.filter(Boolean)
log(`sections done: ${ok.length}/${SECTIONS.length} pipelines completed`)

// union of prerequisite concepts (barrier is genuinely needed here)
const prereqMap = new Map()
for (const r of ok) {
  const found = [...((r.rep && r.rep.prereqConcepts) || []), ...((r.rv && r.rv.addedPrereqs) || [])]
  for (const c of found) if (c.id && !prereqMap.has(c.id)) prereqMap.set(c.id, c)
}

phase('Tooltips')
const POOL = 4
const PER = 8
const seen = new Set(prereqMap.keys())
let pending = [...prereqMap.values()].filter((c) => !c.id.startsWith('_'))
let wave = 0
const conceptsWritten = []

while (pending.length > 0 && wave < 4) {
  wave++
  log(`tooltip wave ${wave}: ${pending.length} concepts to write`)
  const chunks = []
  for (let i = 0; i < pending.length; i += PER) chunks.push(pending.slice(i, i + PER))
  const discovered = []
  for (let b = 0; b < chunks.length; b += POOL) {
    const batch = chunks.slice(b, b + POOL)
    const res = await parallel(
      batch.map((chunk, ci) => () =>
        agent(
          `${COMMON}
TASK: Create nested-tooltip concept modules for these concepts (JSON): ${JSON.stringify(chunk)}
For EACH concept: first check ${ROOT}/src/concepts/ (ls) — if <id>.tsx exists, skip it. Otherwise create ${ROOT}/src/concepts/<id>.tsx exactly in the _demo.tsx pattern: one registerConcept({id, title, body}) call.
BODY: 2–6 sentence English explanation for an extremely curious first-year who knows ONLY school math + stats 101; M/MD for all math; concrete tiny example where possible. WIDGETS: the spec explicitly wants widgets in tooltips often — add a small Plot/TransformCanvas/SVG (interactive if it helps) after the explanation whenever it aids intuition.
NESTING: wrap deeper prerequisite terms in <ConceptLink id> (canonical ids from CONVENTIONS.md) — long dependency chains are the point. Concepts covered by the converted sections get section anchor links instead.
newPrereqs = ids you linked that (a) have no module file, (b) are NOT in this already-assigned list: ${JSON.stringify([...seen])}, and (c) are not excluded (school math / stats 101 — CONVENTIONS.md).`,
          { label: `concepts:w${wave}.${b / POOL + 1}.${ci + 1}`, phase: 'Tooltips', schema: CONCEPT_SCHEMA }
        )
      )
    )
    for (const r of res.filter(Boolean)) {
      conceptsWritten.push(...(r.written || []))
      for (const c of r.newPrereqs || []) {
        if (c.id && !seen.has(c.id) && !c.id.startsWith('_')) {
          seen.add(c.id)
          discovered.push(c)
        }
      }
    }
  }
  log(`wave ${wave} done: ${discovered.length} newly discovered concepts`)
  pending = discovered
}
if (pending.length > 0)
  log(`wave cap reached; ${pending.length} concepts left for integration stubs: ${pending.map((c) => c.id).join(', ')}`)

phase('Integrate')
const integration = await agent(
  `${COMMON}
TASK: Final integration pass in ${ROOT}.
1. cd ${ROOT} && npx tsc --noEmit — fix ALL errors (typical causes: duplicate concept ids, broken imports, unescaped LaTeX backslashes).
2. Concept closure: extract every ConceptLink id used anywhere in src/ (grep -rhoE 'ConceptLink id="[^"]+"' src | sort -u). Every id must have a module src/concepts/<id>.tsx. Create minimal modules (2–3 plain sentences, no widget needed) for any missing id, including these known leftovers: ${JSON.stringify(pending.map((c) => c.id))}.
3. Duplicate check: no concept id registered twice (grep '  id:' src/concepts/*.tsx | sort | uniq -d must be empty after fixes).
4. Section anchors: every internal href="#sec-..." must target one of the registered sections (${SECTIONS.map((x) => `#sec-${x.id}`).join(', ')}).
5. cd ${ROOT} && npm run build must pass (tsc + vite).
6. Write ${ROOT}/REPORT.md: sections present, number of concept tooltips, widget count (grep ExpandedReading), open issues.
Report buildOk honestly — never claim a green build you did not run.`,
  { label: 'integrate', phase: 'Integrate', schema: INTEGRATION_SCHEMA }
)

return {
  sectionsCompleted: ok.map((r) => r.s.id),
  reviewIssuesRemaining: Object.fromEntries(ok.map((r) => [r.s.id, (r.rv && r.rv.remainingIssues) || []])),
  conceptsWritten: conceptsWritten.length,
  conceptIds: [...seen],
  unresolvedAtCap: pending.map((c) => c.id),
  integration,
}
