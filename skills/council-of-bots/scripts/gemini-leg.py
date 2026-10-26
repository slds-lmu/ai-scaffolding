#!/usr/bin/env python3
"""Helpers for the Gemini (agy) leg of council-fanout.sh.

  gemini-leg.py prompt  --base FILE --context FILE --out FILE [--auto 0|1]
                        [--inline PATH]... [--budget-kb N]
      Build the Gemini prompt: the shared prompt (--base) plus, inside
      <content-to-review>, the text files named by --inline and (with --auto 1)
      every existing text file whose absolute path appears in the context file,
      verbatim and line-numbered, up to --budget-kb in total. Writes one NDJSON
      stdin message for `agy --input-format stream-json` to --out and prints a
      one-line summary of what was inlined.

  gemini-leg.py extract --ndjson FILE --stderr FILE --out FILE --exit N
                        --timeout S --model M
      Turn agy's `--output-format stream-json` transcript into the review file.
      A complete answer is written as-is. Anything else (agy print timeout, which
      agy reports as status SUCCESS with exit 0; outer kill; stream errors) gets a
      first-line marker "[GEMINI PARTIAL OUTPUT: ...]" plus whatever text was
      streamed, or "[GEMINI PRODUCED NO OUTPUT: ...]" plus diagnostics.

Why (verified 2026-10-16, agy 1.4.0, Gemini 4 Argon): agy reads files through
its agent loop, one model turn (5-60 s at High effort) per read, so repo-backed
reviews ran out of a 900 s budget; inlining the material removes those turns.
The prompt goes through stdin because a single argv string is capped at 128 KiB
(MAX_ARG_STRLEN), which `agy -p "$PROMPT"` hits on large contexts.
"""

import argparse
import json
import os
import re
import sys

PATH_RE = re.compile(r"(?:~|/)[^\s`'\"<>()\[\]{},;|*]+")
# Never ship credentials to an external model, even if a context names them.
DENY_RE = re.compile(
    r"(/\.ssh/|/\.gnupg/|oauth|token|credential|secret|password|\.pem$|\.key$|"
    r"/\.env$|/\.netrc$|google_accounts\.json$)",
    re.IGNORECASE,
)

INLINE_NOTE = (
    "\n- Files in <file path=...> blocks inside <content-to-review> were read from disk for\n"
    "  you and are included verbatim, each line prefixed with its line number: do NOT\n"
    "  re-read them with tools, and cite those line numbers. Use tools only for referenced\n"
    "  material that is not included (other files, git branches, images, directories).\n"
)


def is_text_file(path):
    try:
        with open(path, "rb") as fh:
            head = fh.read(8192)
    except OSError:
        return False
    return b"\0" not in head


def candidate_paths(context_text):
    seen = []
    for m in PATH_RE.finditer(context_text):
        p = m.group(0).rstrip(".:!?")
        p = os.path.expanduser(p)
        if p not in seen:
            seen.append(p)
    return seen


def numbered(text):
    lines = text.splitlines()
    return "".join(f"{i:6d}\t{line}\n" for i, line in enumerate(lines, 1))


def cmd_prompt(a):
    base = open(a.base, encoding="utf-8", errors="replace").read()
    context_abs = os.path.realpath(a.context)
    context_text = open(a.context, encoding="utf-8", errors="replace").read()
    budget = a.budget_kb * 1024

    wanted = list(a.inline)
    if a.auto:
        wanted += candidate_paths(context_text)

    blocks, inlined, skipped, used, done = [], [], [], 0, set()
    for p in wanted:
        rp = os.path.realpath(os.path.expanduser(p))
        if rp in done or rp == context_abs:
            continue
        done.add(rp)
        explicit = p in a.inline
        if not os.path.isfile(rp):
            if explicit:
                skipped.append(f"{p} (not a file)")
            continue
        if DENY_RE.search(rp):
            skipped.append(f"{p} (looks like a credential file)")
            continue
        if not is_text_file(rp):
            if explicit:
                skipped.append(f"{p} (binary)")
            continue
        size = os.path.getsize(rp)
        if used + size > budget:
            skipped.append(f"{p} ({size // 1024} KB, over the {a.budget_kb} KB budget)")
            continue
        text = open(rp, encoding="utf-8", errors="replace").read()
        blocks.append(f'<file path="{p}">\n{numbered(text)}</file>\n')
        inlined.append(p)
        used += size

    prompt = base
    if blocks:
        marker = "</content-to-review>"
        idx = prompt.rfind(marker)
        files = "\n" + "".join(blocks)
        prompt = prompt[:idx] + files + prompt[idx:]
        anchor = "Never modify them."
        if anchor in prompt:
            prompt = prompt.replace(anchor, anchor + INLINE_NOTE.rstrip("\n"), 1)
        else:
            prompt = INLINE_NOTE.strip() + "\n\n" + prompt

    msg = {"event": "user", "message": {"role": "user", "content": prompt}}
    with open(a.out, "w", encoding="utf-8") as fh:
        fh.write(json.dumps(msg) + "\n")

    summary = f"inlined {len(inlined)} file(s), {used // 1024} KB; prompt {len(prompt.encode()) // 1024} KB"
    if skipped:
        summary += "; not inlined: " + "; ".join(skipped)
    print(summary)


def cmd_extract(a):
    result, err_events = None, []
    steps = {}  # step_index -> {"type", "state", "text"}
    ntools, last_tool = 0, ""
    try:
        with open(a.ndjson, encoding="utf-8", errors="replace") as fh:
            for line in fh:
                try:
                    ev = json.loads(line)
                except ValueError:
                    continue
                kind = ev.get("event")
                if kind == "step_update":
                    s = ev.get("step_update", {})
                    st = steps.setdefault(
                        s.get("step_index", -1), {"type": s.get("step_type"), "state": "", "text": ""}
                    )
                    st["state"] = s.get("state", st["state"])
                    st["text"] += s.get("text_delta", "")
                    if s.get("step_type") == "tool" and s.get("state") == "DONE":
                        ntools += 1
                        info = s.get("tool_info", {})
                        params = json.dumps(info.get("parameters", ""))[:160]
                        last_tool = f"{s.get('tool_name', '?')} {params}"
                elif kind == "result":
                    result = ev.get("result", {})
                elif kind == "error":
                    err_events.append(json.dumps(ev)[:300])
    except OSError:
        pass

    try:
        stderr = open(a.stderr, encoding="utf-8", errors="replace").read()
    except OSError:
        stderr = ""

    # The review is the text of the agent_response steps, minus attempts that an
    # error step aborted. Do not use result.response: after a mid-answer "stream
    # was interrupted" agy retries in a new step, and result.response glues the
    # aborted attempt and the retry together (seen 2026-10-16). result.status also
    # stays "ERROR" after a retry that succeeded, and says "SUCCESS" after a print
    # timeout, so judge completeness from the step states instead.
    text_steps = [i for i in sorted(steps) if steps[i]["type"] == "agent_response" and steps[i]["text"].strip()]
    aborted = {i for i in text_steps if steps.get(i + 1, {}).get("type") == "error_message"}
    kept = [i for i in text_steps if i not in aborted] or text_steps[-1:]
    final = kept[-1] if kept else None
    response = "".join(steps[i]["text"] for i in kept) if kept else ((result or {}).get("response") or "")
    err_after = [i for i in steps if steps[i]["type"] == "error_message" and (final is None or i > final)]

    reasons = []
    if "print timeout" in stderr:
        reasons.append(f"agy hit --print-timeout {a.timeout}s")
    if a.exit == 124:
        reasons.append(f"killed by the outer timeout ({a.timeout}s + grace)")
    elif a.exit != 0:
        reasons.append(f"agy exited with code {a.exit}")
    if result is None:
        reasons.append("no final result event")
    if final is not None and steps[final]["state"] != "DONE":
        reasons.append("final answer was still streaming")
    if err_after or (final is None and result and result.get("status") != "SUCCESS"):
        reasons.append(f"agy error: {(result or {}).get('error') or 'error step after the answer'}")
    if re.search(r"sign in|please sign|unauthenticated|not signed", stderr, re.I) and not response:
        reasons.append("agy is not signed in: run `agy` once interactively, then re-run")

    complete = bool(response.strip()) and not reasons
    with open(a.out, "w", encoding="utf-8") as out:
        if complete:
            out.write(response)
            return 0
        why = "; ".join(reasons) or "empty response"
        stats = f"model={a.model}, {ntools} tool call(s)"
        if last_tool:
            stats += f", last: {last_tool}"
        if response.strip():
            out.write(f"[GEMINI PARTIAL OUTPUT: {why}; review is truncated; {stats}]\n\n")
            out.write(response)
        else:
            out.write(f"[GEMINI PRODUCED NO OUTPUT: {why}; {stats}]\n")
            tail = [l for l in stderr.splitlines() if l.strip()][-20:]
            if tail or err_events:
                out.write("--- agy stderr / error events (tail) ---\n")
                out.write("\n".join(err_events + tail) + "\n")
    return 1


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("prompt")
    p.add_argument("--base", required=True)
    p.add_argument("--context", required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--auto", type=int, default=1)
    p.add_argument("--inline", action="append", default=[])
    p.add_argument("--budget-kb", type=int, default=400)
    e = sub.add_parser("extract")
    e.add_argument("--ndjson", required=True)
    e.add_argument("--stderr", required=True)
    e.add_argument("--out", required=True)
    e.add_argument("--exit", type=int, required=True)
    e.add_argument("--timeout", required=True)
    e.add_argument("--model", required=True)
    a = ap.parse_args()
    if a.cmd == "prompt":
        cmd_prompt(a)
        return 0
    return cmd_extract(a)


if __name__ == "__main__":
    sys.exit(main())
