// Optional Workflow-runtime adapter, not a Node CLI.
// Requires agent(), parallel(), phase(), log(), and injected args.
// Use only when parallel agent work is available and authorized.
// args: {
//   root, pdf, sourceShort,
//   sections: [{ id, comp, title, pages, extra? }],  // extra: text folded into that writer's prompt
//   concepts?: [{ id, name, context }],   // planned prerequisite pop-ups
//   concurrency?: 2,                        // 1..4 parallel agents
//   review?: true,                          // independent read-only per-section review
//   maxProposedConcepts?: 8,                // cap on writer-proposed, unplanned concepts
//   offline?: false,                        // deliverable: single-file HTML instead of hosted
// }
// The caller settles scope/audience/language in root/CONVENTIONS.md first and
// instantiates the MDX grammar for writers as root/AUTHORING.md (see
// conventions-template.md, "Setup").
export const meta = {
  name: 'interactive-textbook-build',
  description: 'Bounded section authoring, read-only review, one capped prerequisite wave',
  phases: [
    { title: 'Sections', detail: 'disjoint section ownership' },
    { title: 'Review', detail: 'read-only source review per section' },
    { title: 'Concepts', detail: 'planned plus capped proposed prerequisites, one wave' },
    { title: 'Integrate', detail: 'confirmed fixes and serial checks' },
  ],
}

const A = typeof args === 'string' ? JSON.parse(args) : args
if (!A || !A.root || !A.pdf || !A.sourceShort || !Array.isArray(A.sections) || !A.sections.length)
  throw new Error('Provide root, pdf, sourceShort, and a nonempty sections array')
const concurrency = A.concurrency ?? 2
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 4)
  throw new Error('concurrency must be an integer from 1 to 4')
const review = A.review ?? true
if (typeof review !== 'boolean') throw new Error('review must be a boolean')
const maxProposed = A.maxProposedConcepts ?? 8
if (!Number.isInteger(maxProposed) || maxProposed < 0 || maxProposed > 32)
  throw new Error('maxProposedConcepts must be an integer from 0 to 32')
const offline = A.offline ?? false
if (typeof offline !== 'boolean') throw new Error('offline must be a boolean')
const planned = A.concepts ?? []
if (!Array.isArray(planned)) throw new Error('concepts must be an array')
const unique = (items, key) => new Set(items.map(x => x[key])).size === items.length
if (!unique(A.sections, 'id') || !unique(A.sections, 'comp') || !unique(planned, 'id'))
  throw new Error('Section IDs/files and concept IDs must be unique')
const CONCEPT_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
for (const s of A.sections) {
  if (typeof s.id !== 'string' || !s.id || !/^S[A-Za-z0-9_-]+$/.test(s.comp) || !s.title || !s.pages)
    throw new Error('Each section needs a string id, safe S-prefixed comp, title, and pages')
  if (s.extra !== undefined && typeof s.extra !== 'string')
    throw new Error('Section extra must be a string when given')
}
for (const c of planned)
  if (typeof c.id !== 'string' || !CONCEPT_ID.test(c.id) || !c.name || !c.context)
    throw new Error('Each concept needs a kebab-case string id, name, and use context')

const COMMON = `Work inside ${A.root}. Read CONVENTIONS.md for the agreed audience,
language, notation, scope, source permissions, and optional/core distinction,
and AUTHORING.md for the MDX grammar (fence lengths, brace escaping, colons,
comparisons, labels). Use existing components and the MDX demo files.
Do not edit shared libraries, registries, generated files, or conventions
during parallel work. Do not run builds, npm run gen:numbers, typecheck:mdx,
git commands, or dev servers. You MAY run the two read-only checks
  node scripts/gen-numbers.mjs --check   and   npm run lint:numbers
to see whether your own file parses and contains no hand-typed numbers: a
"table is out of date" message or an error inside another writer's file is
not your error, and these checks do not replace the final serial typecheck.
Keep source errors and proposed convention changes in your report; the
student-facing text never says the source is wrong, it is simply correct and
the finding goes to the errata file named in CONVENTIONS.md.
Use labeled cross-references, not hand-typed result numbers. Preserve source
numbering where the adaptation keeps it; if the source numbers nothing, say so
and use unnumbered display math. No quotas of widgets, quizzes, verdicts, or
nested links. Every widget must add learning value beyond a static example; a
short invariant explanation can stay constant. Provide accessible controls and
check actual numerics against independent evidence.
Concept links: use only the planned concept IDs below or existing modules in
src/concepts/. Concepts this chapter itself introduces get an @sec: reference,
not a pop-up. If the audience genuinely needs a prerequisite that is not
planned, do NOT create it; list it under prerequisites in your report with the
exact place it is needed. Do not discover and generate recursive waves.
Planned concepts: ${JSON.stringify(planned)}.
Your report's id field must echo the id you were assigned.`

const PREREQ = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'name', 'context', 'where'],
  properties: {
    id: { type: 'string', description: 'kebab-case concept id' },
    name: { type: 'string' },
    context: { type: 'string', description: 'one sentence: why this audience needs it here' },
    where: { type: 'string', description: 'file and heading or label where the link is needed' },
  },
}

const REPORT = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'completed', 'issues'],
  properties: {
    id: { type: 'string', description: 'echo of the assigned section/concept id' },
    completed: { type: 'boolean' },
    issues: { type: 'array', items: { type: 'string' } },
    prerequisites: { type: 'array', items: PREREQ },
  },
}

function validReport(r) {
  return !!r && typeof r === 'object' && typeof r.id === 'string' &&
    typeof r.completed === 'boolean' && Array.isArray(r.issues) &&
    (r.prerequisites === undefined || Array.isArray(r.prerequisites))
}

// Runs `work` over `items` in batches of `concurrency`. Every reply stays
// paired with the item whose call produced it and must echo that item's id,
// so a truncated, reordered or swapped batch cannot credit one section's
// report to another. A thrown, missing, invalid or misattributed reply becomes
// a failed report for its own item only; the run continues so finished work
// is preserved and the integrator sees every gap.
async function batches(items, work) {
  const results = []
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency)
    let settled = []
    try {
      // the thunks never reject, so one failed worker cannot take its siblings down
      settled = await parallel(batch.map(item => () => Promise.resolve()
        .then(() => work(item))
        .then(reply => ({ id: item.id, reply }), error => ({ id: item.id, error }))))
    } catch (err) {
      log(`batch ${i / concurrency + 1} failed: ${err && err.message ? err.message : err}`)
    }
    // ids are unique (validated above), so the id captured in each thunk names
    // the originating item without relying on object identity across the runtime
    const byId = new Map()
    for (const entry of Array.isArray(settled) ? settled : [])
      if (entry && batch.some(item => item.id === entry.id)) byId.set(entry.id, entry)
    const failed = []
    for (const item of batch) {
      const entry = byId.get(item.id) ?? { reply: null }
      const reply = entry.reply
      if (validReport(reply) && reply.id === item.id) {
        results.push({ item, report: reply })
        continue
      }
      const why = 'error' in entry
        ? `Worker failed: ${entry.error && entry.error.message ? entry.error.message : entry.error}`
        : validReport(reply)
          ? `Report echoed id "${reply.id}" but was produced for "${item.id}"; discarded as misattributed`
          : 'No valid report was returned for this item; treat its output as unverified and re-run it'
      results.push({ item, report: { id: item.id, completed: false, issues: [why] } })
      failed.push(item.id)
    }
    if (failed.length) log(`no valid report for: ${failed.join(', ')}`)
  }
  return results
}

phase('Sections')
const sections = await batches(A.sections, s => agent(`${COMMON}
Write ${A.sourceShort} section ${s.id}: ${s.title} from PDF ${A.pdf}, pages
${s.pages}. Inspect the rendered pages for every formula; text extraction
corrupts notation.${s.extra ? ` Additional context for this section: ${s.extra}` : ''}
Own only src/sections/${s.comp}.mdx, companion widgets
prefixed ${s.comp} under src/sections/widgets/, and their uniquely named
numerical checks under scripts/verify/. Preserve exported id/title. Meet the
requested coverage without promoting optional source material to core. Write
clear original explanations consistent with the source permissions. Reuse
existing definitions. Report id "${s.id}", completed, unresolved issues, and
prerequisites you needed but were not allowed to create.`,
{ label: `write:${s.id}`, phase: 'Sections', schema: REPORT }))

let reviews = []
if (review) {
  phase('Review')
  reviews = await batches(A.sections, s => agent(`${COMMON}
READ-ONLY REVIEW of src/sections/${s.comp}.mdx (${A.sourceShort} section ${s.id}:
${s.title}). Do not edit any file. Read the file and the source PDF ${A.pdf},
pages ${s.pages}, from the rendered pages. Check: (1) coverage of the assigned
pages against the agreed scope, listing every omission or promotion of optional
material; (2) mathematical fidelity of the statements, equations and examples
you can compare, symbol by symbol, with signs, indices, dimensions and
assumptions; (3) labels and cross-references match the source's numbering
where it is preserved and no number is hand-typed; (4) prose is the writer's
own explanation, not the source's sentences, especially frame sentences such
as equation lead-ins; (5) every widget's quantities are introduced in the text
and its regimes are stated correctly. Also run the read-only checks. Report
id "${s.id}", completed=true only if the section is acceptable as is, and each
finding as an issue with file, location, and the correction.`,
  { label: `review:${s.id}`, phase: 'Review', schema: REPORT }))
} else {
  log('per-section review skipped by args.review=false; the integrator carries all review')
}

// One bounded prerequisite wave: planned concepts plus proposals the writers
// and reviewers reported, deduplicated and capped. No recursion afterwards.
const plannedIds = new Set(planned.map(c => c.id))
const proposals = new Map()
for (const { report } of [...sections, ...reviews])
  for (const p of report.prerequisites ?? [])
    if (p && typeof p.id === 'string' && CONCEPT_ID.test(p.id) && !plannedIds.has(p.id) && !proposals.has(p.id))
      proposals.set(p.id, { id: p.id, name: p.name, context: `${p.context} (needed at ${p.where})` })
const proposed = [...proposals.values()]
const accepted = proposed.slice(0, maxProposed)
const overflow = proposed.slice(maxProposed).map(c => c.id)
if (overflow.length) log(`proposed concepts beyond the cap of ${maxProposed}, left unwritten: ${overflow.join(', ')}`)
const conceptsToWrite = [...planned, ...accepted]

phase('Concepts')
const conceptResults = await batches(conceptsToWrite, c => agent(`${COMMON}
Own only src/concepts/${c.id}.mdx and a uniquely prefixed companion widget/check
if needed. Explain ${c.name} for this use: ${c.context}. Reuse an existing module
if present. Supply the immediate definition and a useful example where needed;
it must be intelligible without opening another pop-up. This is the only
concept wave: do not add links to concepts that have no module, and do not
create placeholder modules; report further needs as issues. Report id "${c.id}".`,
{ label: `concept:${c.id}`, phase: 'Concepts', schema: REPORT }))

phase('Integrate')
const deliverable = offline
  ? 'The deliverable is the offline single-file HTML: finish with npm run build:singlefile and verify that exact dist/index.html opened directly with networking disabled (npm run verify:browser does this when a browser is available).'
  : 'The deliverable is the hosted multi-file build: finish with npm run build (a single-file build would overwrite it).'
const integration = await agent(`Integrate the planned work in ${A.root}.
Read CONVENTIONS.md and these reports: ${JSON.stringify({ sections, reviews, reviewSkipped: !review, concepts: conceptResults, unwrittenProposals: overflow })}.
All writers and reviewers have stopped. Fix the confirmed review findings and
any failed or missing section reports (re-run that section's work yourself if
needed); check the mathematics and boundary cases of anything you change.
Check coverage, links, duplicated explanations, and hidden prerequisites.
Resolve missing concept links by reuse, reviewed necessary content, or removing
an unneeded link; report unresolved scope instead of filling it with stubs.
Run shared generation and checks serially, in this order: npm run build,
npm run verify:numbers, node scripts/gen-numbers.mjs --check. Fix errors
attributable to this work. Both build modes write dist/, so the last build you
run is the deliverable. ${deliverable}
The browser check needs at least one registered section (src/sections/S*.mdx);
the bare starter has none. If no browser is available, report the unverified
rendering and offline behavior as a gap and completed=false.
Trim repetition introduced by fixes. Write REPORT.md with the checks actually
run, source errata, remaining issues, unwritten proposed concepts, and scope.
Report id "integrate". Return completed=true only if planned content and checks
are complete, all worker and reviewer findings are resolved, and no blocking
issues remain.`,
{ label: 'integrate', phase: 'Integrate', schema: REPORT })
if (!validReport(integration) || integration.id !== 'integrate')
  throw new Error('Missing or invalid integration report')
log(`Integration reported ${integration.completed ? 'complete' : 'incomplete'}; inspect REPORT.md for evidence`)
return {
  sections,
  reviews,
  reviewSkipped: !review,
  concepts: { planned, proposed: accepted, overflow, written: conceptResults },
  integration,
}
