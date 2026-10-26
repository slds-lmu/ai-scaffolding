#!/usr/bin/env node
/**
 * Rendered check of a built app: math, console, layout, concept windows,
 * deep dives, and (for a file target) genuine offline behavior.
 *
 *   node scripts/browser-check.mjs [dist/index.html | http://127.0.0.1:4173/]
 *        [--section 4.6] [--out DIR] [--executable /path/to/chrome]
 *
 * A file target is opened via file:// with every request other than that one
 * document aborted, so a build that still reaches for the network or for
 * sibling files (a hosted build's assets/) fails here. A URL target checks a
 * served hosted build instead (no offline claim); the served document must
 * reference the same content-hashed assets as the local dist/index.html (a
 * single-file build served by URL must be identical to it), which is what
 * catches a stale server from another revision.
 *
 * Exit 0: all checks passed. Exit 1: a check failed. Exit 2: no browser
 * runtime (Playwright + Chromium) is available; that is a stated gap, not a
 * pass. Playwright is not a dependency of the starter: it is resolved from the
 * app, from PLAYWRIGHT_MODULE_PATH, or from the global npm root. Point
 * --executable (or PLAYWRIGHT_CHROMIUM_EXECUTABLE) at a Chromium binary when
 * Playwright's own download is not installed.
 *
 * What is checked, and why (the tooltip items map onto the failure modes
 * documented at the top of src/lib/tooltip/TooltipEngine.tsx):
 *  - identity: the page contains the expected registered section
 *    (`--section`, else the first `export const id` under src/sections/S*.mdx);
 *    the bare starter registers no section, so a check without one proves
 *    nothing; for a URL target, the served asset references match dist/index.html
 *  - math: MathJax finished (startup promise when exposed, else a stable
 *    mjx-container count), at least one formula when the section's source
 *    contains math outside code (a text-only section is legitimate; a
 *    --section with no matching file expects math), zero `mjx-merror` /
 *    `[data-mml-node="merror"]`; undefined macros render as literal text with
 *    no error node, so scripts/verify/scan-macros.mjs remains a separate check
 *  - no console errors (a missing favicon.ico is not one: the browser requests
 *    it from an http target by itself), no failed requests, and for a file
 *    target no request other than the document
 *  - layout at 390 px and 1300 px: nothing wider than the viewport (MathJax
 *    internals excluded), no horizontal scroll, and no plot SVG (an svg with a
 *    viewBox at least 100 units wide, outside mjx-container, and actually
 *    rendered: plots inside a collapsed deep dive are not counted) rendered
 *    narrower than 40 px, which is what a viewBox-only SVG collapses to in a
 *    flex column
 *  - concept windows: hover opens one preview after the 120 ms dwell; moving
 *    into it keeps it open; a link inside it opens a second (depth recorded);
 *    a pointer that comes to rest in the corridor between link and window, on
 *    the segment joining their centres, closes the preview (regression 2:
 *    nothing pruned a resting pointer); a hover shorter
 *    than the dwell followed by leaving opens nothing (regression 1: flash and
 *    vanish); click pins; a pinned window survives wheel scroll and click-away,
 *    moves when dragged by its title bar, and Escape closes it
 *  - deep dive: the body is hidden before its button is clicked and shown after
 *  - fragment links (src/lib/useFragmentNavigation.ts): a #sec- link lands
 *    with the heading at the top, not mid-section (block "center" on a tall
 *    <section>); scrolling right after the jump is not undone by the settle
 *    loop; a link to an id inside a collapsed deep dive opens it
 */
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import { readdirSync, readFileSync, mkdtempSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { tmpdir } from "node:os";

const require = createRequire(import.meta.url);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// ---- arguments ------------------------------------------------------------
const argv = process.argv.slice(2);
const opt = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
const target = argv.find((a) => !a.startsWith("--") && argv[argv.indexOf(a) - 1]?.startsWith("--") !== true) ?? "dist/index.html";
const section = registeredSection(opt("--section"));
const expectedSection = section.id;
// a text-only section is legitimate: expect typeset math only when its source
// has a `$` outside code spans and escaped dollars (`df$x` in an R block is not math)
const expectMath = section.source === null ? true
  : /\$/.test(section.source.replace(/```[\s\S]*?```|`[^`\n]*`|\\\$/g, ""));
const outDir = opt("--out") ?? mkdtempSync(join(tmpdir(), "browser-check-"));
const executablePath = opt("--executable") ?? process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
mkdirSync(outDir, { recursive: true });

// The registered section to look for: `wanted` (from --section) or the first
// `export const id` under src/sections/S*.mdx. Its source decides whether
// typeset math is expected; a --section with no matching file expects math.
function registeredSection(wanted) {
  const dir = join(ROOT, "src", "sections");
  let files = [];
  try { files = readdirSync(dir).filter((f) => /^S.*\.mdx$/.test(f)).sort(); } catch { /* no sections dir */ }
  for (const f of files) {
    const source = readFileSync(join(dir, f), "utf8");
    const m = source.match(/export\s+const\s+id\s*=\s*["']([^"']+)["']/);
    if (m && (wanted === undefined || m[1] === wanted)) return { id: m[1], source };
  }
  return { id: wanted ?? null, source: null };
}

// ---- browser runtime ------------------------------------------------------
function loadPlaywright() {
  const paths = [ROOT, process.cwd()];
  if (process.env.PLAYWRIGHT_MODULE_PATH) paths.push(process.env.PLAYWRIGHT_MODULE_PATH);
  try {
    const g = execSync("npm root -g", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
    if (g) paths.push(g, dirname(g));
  } catch { /* npm not on PATH */ }
  for (const name of ["playwright", "playwright-core"]) {
    try { return require(require.resolve(name, { paths })); } catch { /* try next */ }
  }
  return null;
}

const results = [];
const check = (name, passed, detail = "") => { results.push({ name, passed, detail }); console.log(`${passed ? "ok  " : "FAIL"} ${name}${detail ? `: ${detail}` : ""}`); };
const note = (name, detail) => { results.push({ name, passed: true, detail: `skipped: ${detail}` }); console.log(`skip ${name}: ${detail}`); };

if (!expectedSection) {
  console.error("browser-check: no registered section (src/sections/S*.mdx with `export const id`) and no --section given; the bare starter renders no content, so there is nothing to verify");
  process.exit(1);
}
const pw = loadPlaywright();
if (!pw) {
  console.error("browser-check: Playwright not found (install `playwright` in the app, or set PLAYWRIGHT_MODULE_PATH); rendering is UNVERIFIED");
  process.exit(2);
}

const isUrl = /^https?:\/\//.test(target);
const url = isUrl ? target : pathToFileURL(resolve(ROOT, target)).href;
let browser;
try {
  browser = await pw.chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
} catch (err) {
  console.error(`browser-check: could not launch Chromium (${err.message.split("\n")[0]}); pass --executable or run \`npx playwright install chromium\`; rendering is UNVERIFIED`);
  process.exit(2);
}

// ---- helpers --------------------------------------------------------------
async function open(width) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  const offlineHits = [];
  if (!isUrl) {
    // only the document itself may load: a hosted build's ./assets/ would
    // otherwise resolve from disk and pass as "offline"
    await ctx.route("**/*", (route) => {
      const u = route.request().url();
      if (u === url || /^(data|blob):/.test(u)) return route.continue();
      offlineHits.push(u);
      return route.abort();
    });
  }
  const page = await ctx.newPage();
  const consoleErrors = [], failedRequests = [];
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    // the browser asks an http server for /favicon.ico on its own; the starter ships none
    if (/\/favicon\.ico$/.test(m.location()?.url ?? "")) return;
    consoleErrors.push(m.text());
  });
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));
  page.on("requestfailed", (r) => failedRequests.push(`${r.url()} ${r.failure()?.errorText ?? ""}`));
  await page.goto(url, { waitUntil: "load" });
  await waitForMath(page);
  return { ctx, page, consoleErrors, failedRequests, offlineHits };
}

async function waitForMath(page) {
  if (expectMath) await page.waitForFunction(() => document.querySelectorAll("mjx-container").length > 0, null, { timeout: 30000 }).catch(() => {});
  const exposed = await page.evaluate(() => !!(globalThis.MathJax && globalThis.MathJax.startup && globalThis.MathJax.startup.promise));
  if (exposed) {
    await page.evaluate(() => globalThis.MathJax.startup.promise);
    return;
  }
  // bundled MathJax without a global: wait until the container count stops changing
  let last = -1;
  for (let i = 0; i < 20; i++) {
    const n = await page.evaluate(() => document.querySelectorAll("mjx-container").length);
    if (n === last) return;
    last = n;
    await page.waitForTimeout(500);
  }
}

const count = (page, sel) => page.locator(sel).count();
const box = async (loc) => loc.boundingBox();

// ---- served-build identity (URL target) -----------------------------------
if (isUrl) {
  const probe = await browser.newContext();
  let served;
  try {
    served = await (await probe.request.get(url)).text();
  } catch (err) {
    console.error(`browser-check: cannot fetch ${url} (${err.message.split("\n")[0]}); is the server running?`);
    await browser.close();
    process.exit(1);
  }
  await probe.close();
  const refs = (html) => [...html.matchAll(/(?:src|href)="([^"]*assets\/[^"]+)"/g)].map((m) => m[1]).sort();
  let localHtml = null;
  try { localHtml = readFileSync(join(ROOT, "dist", "index.html"), "utf8"); } catch { /* no local build */ }
  if (localHtml === null) note("served build matches dist/index.html", "no local dist/index.html to compare with");
  else {
    // hosted build: the content-hashed asset names identify the revision;
    // single-file build (no asset refs): the whole document must be identical
    const a = refs(served), b = refs(localHtml);
    const same = b.length ? a.length === b.length && a.every((r, i) => r === b[i]) : served === localHtml;
    check("served build matches dist/index.html", same, same
      ? (b.length ? `${b.length} asset ref${b.length === 1 ? "" : "s"}` : "single-file document identical")
      : b.length
        ? `served [${a.join(", ")}] vs local [${b.join(", ")}]: stale server`
        : "served document differs from the local single-file dist/index.html: stale server");
  }
}

// ---- checks per width -----------------------------------------------------
for (const width of [1300, 390]) {
  const { ctx, page, consoleErrors, failedRequests, offlineHits } = await open(width);
  const label = width >= 1000 ? "desktop" : "phone";
  const state = await page.evaluate((sectionId) => {
    const vw = document.documentElement.clientWidth;
    const wide = [...document.querySelectorAll("body *")]
      .filter((e) => !e.tagName.startsWith("MJX") && e.getBoundingClientRect().width > vw + 1)
      .slice(0, 5)
      .map((e) => `${e.tagName.toLowerCase()}${e.id ? "#" + e.id : ""} ${Math.round(e.getBoundingClientRect().width)}px`);
    const plots = [...document.querySelectorAll("svg[viewBox]")].filter((s) => {
      if (s.closest("mjx-container")) return false;
      if (s.getClientRects().length === 0) return false; // not rendered (collapsed deep dive)
      const vb = (s.getAttribute("viewBox") || "").trim().split(/[\s,]+/).map(Number);
      return vb.length === 4 && vb[2] >= 100;
    });
    const narrow = plots.filter((s) => s.getBoundingClientRect().width < 40).length;
    return {
      title: document.title,
      hasSection: !!document.getElementById(`sec-${sectionId}`),
      mjx: document.querySelectorAll("mjx-container").length,
      merror: document.querySelectorAll('mjx-merror, [data-mml-node="merror"]').length,
      wide,
      plots: plots.length,
      narrow,
      hScroll: document.documentElement.scrollWidth > vw + 1,
    };
  }, expectedSection);
  await page.screenshot({ path: join(outDir, `${label}-initial.png`) });

  check(`${label}: expected section #sec-${expectedSection} is on the page`, state.hasSection, state.hasSection ? "" : `title "${state.title}"`);
  if (expectMath) check(`${label}: math typeset`, state.mjx > 0, `${state.mjx} mjx-container`);
  else note(`${label}: math typeset`, "the section source contains no math");
  check(`${label}: no MathJax errors`, state.merror === 0, state.merror ? `${state.merror} merror` : "");
  check(`${label}: nothing wider than the viewport`, state.wide.length === 0 && !state.hScroll, state.wide.join("; ") || (state.hScroll ? "horizontal scroll" : ""));
  check(`${label}: no collapsed plot SVG`, state.narrow === 0, `${state.plots} plot svg${state.plots === 1 ? "" : "s"}${state.narrow ? `, ${state.narrow} narrower than 40 px` : ""}`);

  if (width >= 1000) {
    // a pin-able concept link: an <a data-concept-link> is a reference with a
    // preview, whose click navigates instead of pinning (checked below)
    const link = page.locator("span[data-concept-link]").first();
    if (await link.count() === 0) note("concept windows", "no span[data-concept-link] on the page");
    else {
      await link.scrollIntoViewIfNeeded();
      const linkBox = await box(link);
      // preview opens after the hover dwell and survives the pointer entering it
      await link.hover();
      await page.waitForTimeout(400);
      check("hover opens one preview", await count(page, "[data-tt-key]") === 1);
      const win = page.locator("[data-tt-key]").first();
      const winBox = await box(win);
      if (winBox) {
        await page.mouse.move(winBox.x + winBox.width / 2, winBox.y + Math.min(60, winBox.height / 2));
        await page.waitForTimeout(700);
        check("preview survives the pointer entering it", await count(page, "[data-tt-key]") === 1);
        const inner = win.locator("[data-concept-link]").first();
        if (await inner.count()) {
          await inner.hover();
          await page.waitForTimeout(400);
          check("a link inside the preview opens a second window", await count(page, "[data-tt-key]") === 2);
        } else note("nested preview", "the first window contains no concept link");
        await page.screenshot({ path: join(outDir, "desktop-preview.png") });
        // regression 2: a pointer resting in the gap between link and window must not keep it alive
        const windows = (await Promise.all((await page.locator("[data-tt-key]").all()).map(box))).filter(Boolean);
        const gap = gapPoint(linkBox, winBox, windows);
        if (gap) {
          await page.mouse.move(gap.x, gap.y);
          await page.waitForTimeout(1500);
          check("a pointer resting in the link/window gap closes the preview", await count(page, "[data-tt-key]") === 0);
        } else note("gap regression", "no free point on the corridor between link and window");
      }
      await page.mouse.move(5, 5);
      await page.waitForTimeout(600);
      // regression 1: a hover shorter than the dwell, then leaving, opens nothing
      await page.mouse.move(linkBox.x + linkBox.width / 2, linkBox.y + linkBox.height / 2);
      await page.waitForTimeout(80);
      await page.mouse.move(5, 5);
      await page.waitForTimeout(900);
      check("a hover shorter than the dwell opens nothing", await count(page, "[data-tt-key]") === 0);
      // pin, scroll, drag, click-away, escape
      await link.click();
      await page.waitForTimeout(400);
      check("click pins the window", await count(page, '[data-tt-pinned="true"]') === 1);
      await page.mouse.wheel(0, 700);
      await page.waitForTimeout(400);
      check("pinned window survives scrolling", await count(page, '[data-tt-pinned="true"]') === 1);
      const pinned = page.locator('[data-tt-pinned="true"]').first();
      const before = await box(pinned);
      if (before) {
        const hx = before.x + Math.min(80, before.width / 2), hy = before.y + 12;
        await page.mouse.move(hx, hy);
        await page.mouse.down();
        await page.mouse.move(hx + 80, hy + 45, { steps: 6 });
        await page.mouse.move(hx + 160, hy + 90, { steps: 6 });
        await page.mouse.up();
        await page.waitForTimeout(200);
        const after = await box(pinned);
        const moved = after && Math.abs(after.x - before.x) > 100 && Math.abs(after.y - before.y) > 50;
        check("pinned window moves when dragged by its title bar", !!moved, after ? `dx=${Math.round(after.x - before.x)} dy=${Math.round(after.y - before.y)}` : "window gone");
      }
      await page.screenshot({ path: join(outDir, "desktop-pinned.png") });
      await page.mouse.click(5, 5);
      await page.waitForTimeout(400);
      check("pinned window survives click-away", await count(page, '[data-tt-pinned="true"]') === 1);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(400);
      check("Escape closes the pinned window", await count(page, "[data-tt-key]") === 0);
    }
    // definition previews (scripts/gen-definitions.mjs): a reference to a
    // definition/theorem previews on hover and navigates on click
    const refLink = page.locator("a[data-concept-link]").first();
    if (await refLink.count() === 0) note("reference preview", "no @definition:/@theorem: reference on the page");
    else {
      await refLink.scrollIntoViewIfNeeded();
      await refLink.hover();
      await page.waitForTimeout(400);
      const refWin = page.locator("[data-tt-key]").first();
      const footer = (await refWin.count()) ? await refWin.innerText() : "";
      check("reference preview opens one window with its source link", await count(page, "[data-tt-key]") === 1 && footer.includes("→"), footer.split("\n").at(-1));
      const href = await refLink.getAttribute("href");
      await refLink.click();
      await page.waitForTimeout(600);
      const hash = await page.evaluate(() => location.hash);
      check("clicking the reference follows its link without pinning", hash === href && await count(page, '[data-tt-pinned="true"]') === 0, `hash ${hash}, href ${href}`);
      await page.keyboard.press("Escape");
      await page.mouse.move(5, 5);
      await page.waitForTimeout(600);
    }
    const deep = page.locator("[data-deep]").first();
    if (await deep.count() === 0) note("deep dive", "no [data-deep] block on the page");
    else {
      const hiddenBefore = await deep.locator(":scope > div[hidden]").count();
      check("deep-dive body is hidden before its button is clicked", hiddenBefore === 1);
      await deep.locator("button").first().scrollIntoViewIfNeeded();
      await deep.locator("button").first().click();
      await page.waitForTimeout(300);
      check("deep-dive body is shown after the click", await deep.locator(":scope > div[hidden]").count() === 0);
      await page.screenshot({ path: join(outDir, "desktop-deepdive.png") });
    }

    // fragment navigation (src/lib/useFragmentNavigation.ts): click an injected
    // in-page link, as a reader clicks a cross-reference
    const clickFragment = async (hash) => {
      await page.evaluate((h) => {
        document.getElementById("__fragment-probe")?.remove();
        const a = Object.assign(document.createElement("a"), { id: "__fragment-probe", href: h, textContent: "probe" });
        document.querySelector("main").append(a);
      }, hash);
      const probe = page.locator("#__fragment-probe");
      await probe.scrollIntoViewIfNeeded();
      await probe.click();
    };
    if (!state.hasSection) note("fragment navigation", "expected section missing; see the identity check");
    else {
    const headTop = () => page.evaluate((id) => document.getElementById(`sec-${id}`).querySelector("h2")?.getBoundingClientRect().top ?? NaN, expectedSection);
    const tall = await page.evaluate((id) => document.getElementById(`sec-${id}`).getBoundingClientRect().height > window.innerHeight * 0.6, expectedSection);
    await clickFragment(`#sec-${expectedSection}`);
    await page.waitForTimeout(1200);
    const landed = await headTop();
    if (tall) check("a section link puts the section heading at the top (not mid-section)", landed >= -2 && landed <= 150, `heading top ${Math.round(landed)} px`);
    else note("section-link alignment", "the section is shorter than 60 % of the viewport");
    // regression: the settle loop must not pull the reader back after they scroll
    await clickFragment(`#sec-${expectedSection}`);
    await page.waitForTimeout(1200); // index.css scrolls smoothly; let the jump finish
    const aligned = await headTop();
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(4500);
    const later = await headTop();
    check("scrolling right after a fragment jump is not undone", later < aligned - 200, `heading top ${Math.round(aligned)} -> ${Math.round(later)} px`);
    // a link to an id inside a collapsed deep dive opens it
    const deepTarget = await page.evaluate(() => {
      for (const d of document.querySelectorAll("[data-deep]")) {
        const t = d.querySelector(":scope > div [id]");
        if (t) {
          if (!d.querySelector(":scope > div[hidden]")) d.querySelector("button").click(); // re-collapse
          return t.id;
        }
      }
      return null;
    });
    if (!deepTarget) note("fragment into a deep dive", "no element with an id inside a [data-deep] block");
    else {
      await page.waitForTimeout(300);
      await clickFragment(`#${deepTarget}`);
      await page.waitForTimeout(800);
      const shown = await page.evaluate((id) => {
        const t = document.getElementById(id);
        const r = t.getBoundingClientRect();
        return !t.closest("[data-deep]").querySelector(":scope > div[hidden]") && r.bottom > 0 && r.top < window.innerHeight;
      }, deepTarget);
      check("a link into a collapsed deep dive opens it and scrolls to the target", shown, `#${deepTarget}`);
    }
    await page.evaluate(() => document.getElementById("__fragment-probe")?.remove());
    }
  }

  check(`${label}: no console errors`, consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));
  check(`${label}: no failed requests`, failedRequests.length === 0, failedRequests.slice(0, 3).join(" | "));
  if (!isUrl) check(`${label}: no request beyond the document while offline`, offlineHits.length === 0, offlineHits.slice(0, 3).join(" | "));
  await ctx.close();
}

function gapPoint(a, b, avoid = []) {
  // midpoint of the free corridor between link `a` and window `b` along the
  // segment joining their centres: outside both and outside every open window
  const ca = { x: a.x + a.width / 2, y: a.y + a.height / 2 };
  const cb = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  const inside = (p, r) => p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height;
  const free = [];
  const n = Math.max(100, Math.ceil(Math.hypot(cb.x - ca.x, cb.y - ca.y))); // about one sample per pixel
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = { x: ca.x + t * (cb.x - ca.x), y: ca.y + t * (cb.y - ca.y) };
    if (!inside(p, a) && ![b, ...avoid].some((r) => inside(p, r))) free.push(p);
  }
  return free.length ? free[Math.floor(free.length / 2)] : null;
}

await browser.close();
const failed = results.filter((r) => !r.passed);
console.log(`\n${results.length - failed.length}/${results.length} checks passed; screenshots in ${outDir}`);
if (failed.length) { console.error(`browser-check: ${failed.length} failed`); process.exit(1); }
