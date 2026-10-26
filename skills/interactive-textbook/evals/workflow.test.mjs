// Runtime-contract tests: no model calls or external side effects.
// Run: node skills/interactive-textbook/evals/workflow.test.mjs
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../references/workflow-template.js', import.meta.url), 'utf8');
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const execute = new AsyncFunction('args', 'agent', 'parallel', 'phase', 'log',
  source.replace('export const meta =', 'const meta ='));
const inputs = {
  root: '/tmp/course', pdf: '/tmp/notes.pdf', sourceShort: 'Notes',
  sections: [1, 2, 3].map(i => ({ id: `1.${i}`, comp: `S1${i}`, title: `Topic ${i}`, pages: `${i}` })),
  concepts: [{ id: 'least-squares', name: 'Least squares', context: 'Regression objective' }],
  concurrency: 2,
};

const idOf = label => label.slice(label.indexOf(':') + 1);
const ok = (id, extra = {}) => ({ id, completed: true, issues: [], ...extra });

// `respond(label, prompt)` returns the mocked agent report; `parallelResult`
// replaces the runtime's parallel(); both default to well-behaved versions.
function harness({ respond, parallelResult } = {}) {
  let live = 0, peak = 0;
  const labels = [], phases = [], prompts = {};
  const agent = async (prompt, options) => {
    live++;
    peak = Math.max(peak, live);
    labels.push(options.label);
    prompts[options.label] = prompt;
    await new Promise(resolve => setTimeout(resolve, 1));
    live--;
    return respond ? respond(options.label, prompt) : ok(options.label === 'integrate' ? 'integrate' : idOf(options.label));
  };
  return {
    run: args => execute(args, agent,
      parallelResult ?? (calls => Promise.all(calls.map(call => call()))),
      phase => phases.push(phase), () => {}),
    labels, phases, prompts, peak: () => peak,
  };
}

test('sections, read-only review, one concept wave, then integration; concurrency bounded', async () => {
  const h = harness();
  const result = await h.run(inputs);
  assert.equal(h.peak(), 2);
  assert.deepEqual(h.phases, ['Sections', 'Review', 'Concepts', 'Integrate']);
  assert.deepEqual(h.labels, [
    'write:1.1', 'write:1.2', 'write:1.3',
    'review:1.1', 'review:1.2', 'review:1.3',
    'concept:least-squares', 'integrate',
  ]);
  assert.match(h.prompts['review:1.1'], /READ-ONLY REVIEW/);
  assert.match(h.prompts['review:1.1'], /Do not edit any file/);
  assert.doesNotMatch(h.prompts['review:1.1'], /at least 8|≥ ?8 equations/);
  assert.match(h.prompts['write:1.1'], /gen-numbers\.mjs --check/);
  assert.match(h.prompts['write:1.1'], /AUTHORING\.md/);
  assert.equal(result.sections.length, 3);
  assert.equal(result.reviews.length, 3);
  assert.equal(result.reviewSkipped, false);
  assert.equal(result.concepts.written.length, 1);
  assert.equal(result.integration.completed, true);
});

test('review can be opted out and the opt-out is visible in the result and to the integrator', async () => {
  const h = harness();
  const result = await h.run({ ...inputs, review: false });
  assert.deepEqual(h.phases, ['Sections', 'Concepts', 'Integrate']);
  assert.ok(!h.labels.some(label => label.startsWith('review:')));
  assert.equal(result.reviewSkipped, true);
  assert.match(h.prompts.integrate, /"reviewSkipped":true/);
});

test('JSON-stringified args and an empty concept plan work', async () => {
  const h = harness();
  const result = await h.run(JSON.stringify({ ...inputs, concepts: [] }));
  assert.equal(result.concepts.written.length, 0);
  assert.equal(h.labels.filter(label => label.startsWith('concept:')).length, 0);
});

test('invalid plans fail before any agent launches', async () => {
  for (const args of [
    { ...inputs, concurrency: 0 }, { ...inputs, concurrency: 5 },
    { ...inputs, sections: [] },
    { ...inputs, sections: [inputs.sections[0], inputs.sections[0]] },
    { ...inputs, sections: [{ ...inputs.sections[0], comp: '../escape' }] },
    { ...inputs, concepts: [...inputs.concepts, ...inputs.concepts] },
    { ...inputs, sections: [{ ...inputs.sections[0], id: 4.6 }] },
    { ...inputs, concepts: [{ id: 123, name: 'numeric id', context: 'c' }] },
    { ...inputs, review: 'yes' },
    { ...inputs, maxProposedConcepts: -1 },
    { ...inputs, offline: 'true' },
  ]) {
    const h = harness();
    await assert.rejects(h.run(args));
    assert.deepEqual(h.labels, []);
  }
});

test('missing or truncated worker replies become failed reports; finished work and integration are preserved', async () => {
  // drop the last reply of every batch
  const h = harness({ parallelResult: async calls => (await Promise.all(calls.map(call => call()))).slice(0, -1) });
  const result = await h.run({ ...inputs, review: false });
  const byId = Object.fromEntries(result.sections.map(({ item, report }) => [item.id, report]));
  assert.equal(byId['1.1'].completed, true);
  assert.equal(byId['1.2'].completed, false);
  assert.match(byId['1.2'].issues[0], /No valid report/);
  assert.equal(byId['1.3'].completed, false);
  assert.ok(h.labels.includes('integrate'));
  assert.match(h.prompts.integrate, /No valid report/);
});

test('replies stay paired with their item whatever order the runtime returns them in', async () => {
  const h = harness({ parallelResult: async calls => (await Promise.all(calls.map(call => call()))).reverse() });
  const result = await h.run({ ...inputs, review: false });
  for (const { item, report } of result.sections) assert.equal(report.id, item.id);
  for (const { item, report } of result.concepts.written) assert.equal(report.id, item.id);
});

test('a reply with a wrong or missing id cannot be credited to another item', async () => {
  const h = harness({ respond: (label) => label.startsWith('write:1.2') ? ok('9.9') : ok(label === 'integrate' ? 'integrate' : idOf(label)) });
  const result = await h.run({ ...inputs, review: false });
  const byId = Object.fromEntries(result.sections.map(({ item, report }) => [item.id, report]));
  assert.equal(byId['1.2'].completed, false);
  assert.equal(byId['1.1'].completed, true);
});

test('a null entry from parallel (an errored agent) fails only that item', async () => {
  const h = harness({ parallelResult: async calls => { const r = await Promise.all(calls.map(call => call())); r[0] = null; return r; } });
  const result = await h.run({ ...inputs, review: false });
  const byId = Object.fromEntries(result.sections.map(({ item, report }) => [item.id, report]));
  assert.equal(byId['1.1'].completed, false);
  assert.match(byId['1.1'].issues[0], /No valid report/);
  assert.equal(byId['1.2'].completed, true);
});

test('a rejected batch marks its items failed and the run continues', async () => {
  let n = 0;
  const h = harness({ parallelResult: async calls => { if (n++ === 0) throw new Error('runtime hiccup'); return Promise.all(calls.map(call => call())); } });
  const result = await h.run({ ...inputs, review: false });
  const byId = Object.fromEntries(result.sections.map(({ item, report }) => [item.id, report]));
  assert.equal(byId['1.1'].completed, false);
  assert.equal(byId['1.3'].completed, true);
  assert.ok(h.labels.includes('integrate'));
});

test('proposed prerequisites are deduplicated, capped, exclude planned ids, and never trigger a second wave', async () => {
  const proposals = {
    'write:1.1': [
      { id: 'least-squares', name: 'planned already', context: 'c', where: 'S11.mdx' },
      { id: 'rank', name: 'Rank', context: 'needs rank', where: 'S11.mdx #4.1.1' },
      { id: 'inner-product', name: 'Inner product', context: 'projection', where: 'S11.mdx' },
    ],
    'write:1.2': [
      { id: 'rank', name: 'Rank again', context: 'dup', where: 'S12.mdx' },
      { id: 'projection', name: 'Projection', context: 'p', where: 'S12.mdx' },
      { id: 'Bad Id', name: 'invalid', context: 'x', where: 'S12.mdx' },
    ],
    'concept:rank': [{ id: 'field', name: 'Field', context: 'recursive', where: 'rank.mdx' }],
  };
  const h = harness({ respond: (label) => label === 'integrate'
    ? ok('integrate')
    : ok(idOf(label), proposals[label] ? { prerequisites: proposals[label] } : {}) });
  const result = await h.run({ ...inputs, review: false, maxProposedConcepts: 2 });
  assert.deepEqual(h.labels.filter(label => label.startsWith('concept:')), ['concept:least-squares', 'concept:rank', 'concept:inner-product']);
  assert.deepEqual(result.concepts.proposed.map(c => c.id), ['rank', 'inner-product']);
  assert.deepEqual(result.concepts.overflow, ['projection']);
  assert.match(result.concepts.proposed[0].context, /needed at S11\.mdx #4\.1\.1/);
  assert.ok(!h.labels.includes('concept:field'));
  assert.match(h.prompts.integrate, /"unwrittenProposals":\["projection"\]/);
});

test('reported worker failure is preserved for integration and incomplete outcome is returned', async () => {
  const h = harness({ respond: (label) => label === 'integrate'
    ? { id: 'integrate', completed: false, issues: ['Missing source page'] }
    : { id: idOf(label), completed: false, issues: ['Missing source page'] } });
  const result = await h.run(inputs);
  assert.equal(result.sections[0].report.completed, false);
  assert.equal(result.integration.completed, false);
  assert.deepEqual(result.integration.issues, ['Missing source page']);
});

test('the deliverable mode is stated to the integrator', async () => {
  const hosted = harness();
  await hosted.run({ ...inputs, review: false });
  assert.match(hosted.prompts.integrate, /hosted multi-file build/);
  const off = harness();
  await off.run({ ...inputs, review: false, offline: true });
  assert.match(off.prompts.integrate, /build:singlefile/);
  assert.match(off.prompts.integrate, /at least one registered section/);
});

test('malformed or misattributed integration reports are rejected', async () => {
  for (const bad of [{ completed: 'yes', issues: [] }, { id: '1.1', completed: true, issues: [] }]) {
    const h = harness({ respond: (label) => label === 'integrate' ? bad : ok(idOf(label)) });
    await assert.rejects(h.run(inputs), /integration report/);
  }
});

test('a worker that throws or returns null fails only its own item; its batch siblings are preserved', async () => {
  const h = harness({ respond: (label) => {
    if (label === 'write:1.1') throw new Error('rate limited');
    if (label === 'write:1.3') return null;
    return ok(label === 'integrate' ? 'integrate' : idOf(label));
  } });
  const result = await h.run({ ...inputs, review: false });
  const byId = Object.fromEntries(result.sections.map(({ item, report }) => [item.id, report]));
  assert.equal(byId['1.1'].completed, false);
  assert.match(byId['1.1'].issues[0], /Worker failed: rate limited/);
  assert.equal(byId['1.2'].completed, true); // same batch as 1.1 (concurrency 2)
  assert.equal(byId['1.3'].completed, false);
  assert.match(byId['1.3'].issues[0], /No valid report/);
  assert.ok(h.labels.includes('integrate'));
});

test("two workers that echo each other's ids are both rejected, not swapped", async () => {
  const swap = { 'write:1.1': '1.2', 'write:1.2': '1.1' };
  const h = harness({ respond: (label) => ok(label === 'integrate' ? 'integrate' : (swap[label] ?? idOf(label))) });
  const result = await h.run({ ...inputs, review: false });
  const byId = Object.fromEntries(result.sections.map(({ item, report }) => [item.id, report]));
  assert.equal(byId['1.1'].completed, false);
  assert.match(byId['1.1'].issues[0], /misattributed/);
  assert.equal(byId['1.2'].completed, false);
  assert.equal(byId['1.3'].completed, true);
});

test('section extra text reaches only that writer; a non-string extra is rejected', async () => {
  const h = harness();
  const sections = inputs.sections.map((s, i) => i === 0 ? { ...s, extra: 'Chapter intro on pages 1-2 belongs here.' } : s);
  await h.run({ ...inputs, sections, review: false });
  assert.match(h.prompts['write:1.1'], /Chapter intro on pages 1-2 belongs here\./);
  assert.doesNotMatch(h.prompts['write:1.2'], /Chapter intro/);
  const bad = harness();
  await assert.rejects(bad.run({ ...inputs, sections: [{ ...inputs.sections[0], extra: 42 }] }));
  assert.deepEqual(bad.labels, []);
});
