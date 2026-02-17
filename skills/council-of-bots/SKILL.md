---
name: council-of-bots
description: >
  Triggers on `/council-of-bots` or when the user wants multiple AI agents to review
  code, diffs, or answer questions. Fans out to Codex, Gemini, and a separate Claude
  instance in parallel, collects their responses, and synthesizes a unified summary.
---

# Council of Bots

Fan out a review or question to Codex, Gemini, and a separate Claude instance in
parallel, then synthesize their responses.

## Invocation

`/council-of-bots [--no-codex] [--no-gemini] [--no-claude] [focus area or question]`

## Step 1: Prepare context

Generate a unique invocation ID: `ID=council-$(date +%s)-$$`

Determine what the user wants reviewed. Build a context file at
`/tmp/${ID}-context.md` containing:

- **Conversation summary**: A concise factual summary of the current task so far.
- **Review material**: The specific content to review:
  - Uncommitted changes: include `git diff` / `git diff --cached` output.
  - Named files: include their contents.
  - Code snippet or question: include it verbatim.
  - If ambiguous, ask the user.
- **Focus areas**: Any specific concerns the user mentioned.

Keep the context file concise. If content exceeds ~8000 lines, summarize or truncate.

### Neutrality requirement

The context file must collect **outside perspectives**, not confirm your own thinking.
Council reviewers anchor on whatever framing they receive — if you transmit your
conclusions, the review degrades into rubber-stamping.

**Do:**
- Present raw data, code, and outputs without interpretation
- State what was done factually ("Study 1 ran 10 pilot reps. Results table below.")
- Let reviewers discover issues themselves
- Ask open-ended review questions ("What concerns do you see?", "Are there issues
  with this DGP design?")

**Do NOT:**
- Include your own diagnosis or conclusions ("Coverage looks good except for X")
- Frame results with expectations ("As expected, cluster outperforms default")
- Lead reviewers toward specific findings ("We suspect the intercept issue is caused by…")
- Use language that signals what answer you want ("Please confirm that…",
  "Verify that this is correct")
- Cherry-pick which results to show based on what supports your narrative

**Litmus test:** Could a reviewer reading this context form a conclusion that
*contradicts* yours? If the framing makes disagreement feel awkward, rewrite it.

## Step 2: Launch all bots

Run the launcher script as a **single background Bash command**:

```bash
bash ~/.claude/skills/council-of-bots/scripts/council-fanout.sh \
  /tmp/${ID}-context.md [--no-codex] [--no-gemini] [--no-claude]
```

The script launches all enabled bots in parallel, waits for completion, and reports
output file paths. Output files are named `/tmp/${ID}-{codex,gemini,claude}.txt`.

This replaces the previous manual per-bot launching — one permission prompt instead
of three.

**Timeout**: Codex can take 3-5 minutes for large reviews. The script waits for all
bots to finish. If it seems stuck, check with `ps aux | grep -E 'codex|gemini|claude'`.

## Step 3: Collect and synthesize

Read all output files for the bots that succeeded. Present a **single unified
synthesis** to the user:

```
## Council of Bots - Review Summary

### Points of Agreement
- Items where 2+ bots raised the same concern [Codex, Gemini]

### Points of Disagreement
- Items where bots gave conflicting advice; note each position

### Unique Insights
- Notable points raised by only one bot

### Actionable Suggestions
- Prioritized concrete next steps, with source bot noted
- Separate into **required** (blockers) vs **recommended** (can defer)

### Raw Responses (collapsed)
Offer to show individual bot responses on request.
```

## Tips from Experience

- **Codex is unreliable**: Frequently returns 0-byte output. The launcher script
  checks for this. May need a manual retry. Gemini is most reliable.
- **Numbered questions get better results**: Include explicit numbered questions in
  the context file (e.g., "Q1: Is the RNG handling correct?"). Makes synthesis much
  easier — compare answers question-by-question.
- **Keep context under ~4K tokens**: Shorter context → better, more focused responses.
  For small reviews, include code inline. For large targets (>8K lines, e.g., full
  manuscripts or large codebases), include file paths in the context and instruct bots
  to read the files themselves — don't try to inline all content.
- **Always run from main conversation**: Never delegate /council-of-bots to a Task
  subagent. Subagents lack Bash permissions for the fanout script and will fail
  silently. Always invoke the skill directly in the main conversation.
