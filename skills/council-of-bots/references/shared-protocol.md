# Shared Review Protocol

Use this protocol on every host.

## Context File

Write `/tmp/${ID}-context.md` with these sections:

1. `## Conversation summary`
   Keep it factual and short.

2. `## Review material`
   Include one or more of:
   - raw `git diff` or `git diff --cached`
   - named file contents
   - code snippets
   - exact user question
   - absolute file paths for large reviews

3. `## Focus areas`
   Include numbered questions when possible.

## Neutrality Requirement

Collect outside perspectives. Do not preload reviewers with your own diagnosis.

Do:

- present raw code, diffs, outputs, and file paths
- state what was done factually
- ask open review questions

Do not:

- state your conclusion first
- ask reviewers to confirm your theory
- omit contradictory evidence

## Prompt Contract

Wrap the context file with the prompt in [prompt-template.md](prompt-template.md).

The goals are:

- review only the provided content
- find bugs, regressions, correctness issues, security issues, and missing tests
- avoid preamble and clarifying questions
- produce a concise findings-first review

## Output Contract

Use these paths:

- `/tmp/${ID}-codex.txt`
- `/tmp/${ID}-gemini.txt`
- `/tmp/${ID}-claude.txt`

If Claude runs via Agent in Claude Code, its review may arrive directly instead of via file.
The synthesis step should normalize that result under the same logical `claude` source.

## Synthesis Contract

Report:

- points of agreement
- points of disagreement
- unique insights
- actionable suggestions

Source every substantive item by bot name.
