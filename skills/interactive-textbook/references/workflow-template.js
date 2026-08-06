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
Start by (1) reading ${ROOT}/CONVENTIONS.md completely, including the Lessons section, and (2) reading ${ROOT}/src/sections/_demo.mdx and ${ROOT}/src/concepts/_demo-concept.mdx as authoring references. Read the demo's companion widget before writing interactivity.
Work only inside ${ROOT}; do not run git commands or a development server, and undo mistakes by editing files. Copyright policy: body prose uses your own sentences as an independent close paraphrase, never verbatim book text (details in CONVENTIONS.md).
After editing, run cd ${ROOT} && npm run typecheck:mdx && npm run test:mdx, then fix every error you introduced. Plain tsc does not inspect generated JSX inside .mdx.
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
OUTPUT FILE: overwrite the body of ${ROOT}/src/sections/${s.comp}.mdx — MDX, NOT TSX. Preserve its exported id/title; App renders the h2, so do not repeat it. Maths is written as in the source: $x^2$, $$ … $$, and $$ {#eq-4.12}, with single backslashes. Use the English directive forms from CONVENTIONS.md unless the output language is German. Braces are escaped only in PROSE; braces inside $…$ are ordinary TeX. Anything dynamic or preformatted with inline formatting goes into an imported .tsx widget under src/sections/widgets/.
COVERAGE (faithfulness, same level of detail): every subsection (Markdown h3 with book numbering), every Definition/Theorem/Lemma/Corollary/Example/Remark/Algorithm through its directive with the book's number, key numbered equations through numbered $$ blocks with the book's own tags (if the source has NO numbered equations, use unnumbered $$ and do NOT invent tags), margin-note and footnote content folded in as short asides. Nothing skipped, nothing invented.
PROSE: independent close paraphrase in English — same ideas, order, notation, rigor; your own sentences (copyright policy in CONVENTIONS.md).
STYLE: obey the "Prose style" section of CONVENTIONS.md. Hard budget: at most ONE dash per 300 words of your section, never two in one sentence — use commas, colons, full stops, parentheses, subordinate clauses instead, and vary them. No repeated formula phrases, no throat-clearing, varied sentence length.
CONCEPT LINKS: wrap prerequisite concepts with :c[text]{#canonical-id} (or German :k), using ids from CONVENTIONS.md; link the first occurrence in a paragraph only. Concepts taught inside the converted sections themselves get a Markdown section link such as [text](#sec-4.2), not a tooltip.
FIGURES: recreate each figure in a companion SVG/canvas widget with caption "after ${A.sourceShort} Figure X.Y" — never a scan. If a figure supports exploration, import the widget into an immediately following :::deepdive block.
WIDGETS: at least 2–3 :::deepdive blocks with genuinely interactive "gears-level" companion widgets at the pedagogically best spots; more if they truly help (spec favors more).
REPORT: prereqConcepts = every :c/:k id you used that has neither ${ROOT}/src/concepts/<id>.mdx nor a legacy <id>.tsx module (check with ls).`,
      { label: `write:${s.id}`, phase: 'Sections', schema: SECTION_SCHEMA }
    ),
  (rep, s) =>
    agent(
      `${COMMON}
TASK: ADVERSARIAL REVIEW of ${ROOT}/src/sections/${s.comp}.mdx (adaptation of ${A.sourceShort} §${s.id} "${s.title}"). Read the file AND the source PDF pages ${s.pages} of "${PDF}" (Read tool, pages parameter). Then verify and FIX directly in the file:
1. COMPLETENESS: every subsection, Definition/Theorem/Lemma/Corollary/Example/Remark/Algorithm, and key numbered equation of §${s.id} present with correct book numbering. Add whatever is missing yourself.
2. MATH FIDELITY: recheck at least 8 equations symbol-by-symbol against the PDF; fix any deviation.
3. NO VERBATIM PROSE: slide an 8-word window over ALL prose in the file (body text, captions, asides — short frame sentences like equation lead-ins leak most often) and compare against the book text; rewrite any near-copy in fresh words.
4. SPEC COMPLIANCE: :c/:k links on prerequisite concepts with canonical ids (CONVENTIONS.md), imported interactive widgets inside deep-dive directives (≥2), environment/numbered-equation directives used properly, Markdown section links (not tooltips) for concepts the converted sections themselves introduce; widget quality bar from CONVENTIONS.md (labeled axes, content within bounds, parameter state printed, consistent color-coding across equation lines).
5. MDX: cd ${ROOT} && npm run test:mdx stays green, and the section compiles (the build typechecks generated JSX).
6. PROSE STYLE (CONVENTIONS.md "Prose style"): count the dashes in the file (grep -o) against its word count. Budget is one per 300 words; rewrite the excess with commas/colons/full stops/parentheses/subordinate clauses, varying the choice, and keep only dashes that earn their interruption. Also list the phrases you find repeated ≥4× and thin them out.
7. cd ${ROOT} && npm run build passes (tsc + MDX typecheck + vite).
Fix everything findable; only report as remainingIssues what you genuinely cannot fix. addedPrereqs = :c/:k ids YOU added that lack both .mdx and .tsx modules in src/concepts/.`,
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
For EACH concept: first check ${ROOT}/src/concepts/ (ls). If either <id>.mdx or legacy <id>.tsx exists, skip it. Otherwise create ${ROOT}/src/concepts/<id>.mdx in the _demo-concept.mdx pattern: begin with export const title = "…"; and then write the body. There is no YAML frontmatter. The MDX typecheck rejects the same id in both .mdx and .tsx.
BODY: 2–6 sentence English explanation for an extremely curious first-year who knows ONLY school math + stats 101; $…$/$$…$$ for all math; concrete tiny example where possible. WIDGETS: the spec explicitly wants widgets in tooltips often — import a small companion .tsx widget using Plot/TransformCanvas/SVG when it aids intuition.
NESTING: wrap deeper prerequisite terms with :c[text]{#id}, using canonical ids from CONVENTIONS.md — long dependency chains are the point. Concepts covered by the converted sections get Markdown section links instead.
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
1. cd ${ROOT} && npm run typecheck:mdx && npm run test:mdx — fix ALL errors (typical causes: duplicate concept ids across .mdx/.tsx, broken widget imports, prose expressions, or malformed directives).
2. Concept closure: extract ids from BOTH MDX link forms and legacy JSX. Run rg -o --no-filename ':[kc]\\[[^]]*\\]\\{#[A-Za-z0-9._-]+\\}|<ConceptLink[[:space:]][^>]*id=("[^"]+"|\\{[\x27"][^\x27"]+[\x27"]\\})' src, then normalize the part after # or inside id="…" and sort uniquely. Every used id must have either src/concepts/<id>.mdx or src/concepts/<id>.tsx. Create a minimal .mdx module with export const title and 2–3 plain sentences for every missing id, including these known leftovers: ${JSON.stringify(pending.map((c) => c.id))}.
3. Duplicate check: rely on npm run typecheck:mdx; it rejects an id registered by more than one .mdx/.tsx file.
4. Section anchors: every Markdown ](#sec-...) link and legacy href="#sec-..." must target one of the registered sections (${SECTIONS.map((x) => `#sec-${x.id}`).join(', ')}).
5. cd ${ROOT} && npm run build must pass (tsc + MDX typecheck + vite).
6. Write ${ROOT}/REPORT.md: sections present, number of concept tooltips, widget count (count :::deepdive/:::vertiefung plus legacy ExpandedReading), open issues.
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
