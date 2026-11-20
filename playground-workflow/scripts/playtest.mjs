/**
 * Playground workflow playtest — public /playground flow.
 * Requires: playwright-core + Chrome. Outputs JSON to stdout and optional --out dir.
 *
 *   node scripts/playtest.mjs [--out artifacts/run-001]
 */
import { chromium } from "playwright-core";
import fs from "fs";
import path from "path";

const URL = process.env.PLAYGROUND_URL || "https://smartfunction.io/playground";
const OUT = process.argv.includes("--out")
  ? process.argv[process.argv.indexOf("--out") + 1]
  : null;
if (OUT) fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const chrome =
  process.env.CHROME_PATH ||
  ["/usr/bin/google-chrome-stable", "/usr/bin/google-chrome", "/usr/bin/chromium"].find((p) =>
    fs.existsSync(p),
  );

async function shot(page, name) {
  if (!OUT) return null;
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  return file;
}

async function pageSignals(page) {
  return page.evaluate(() => {
    const text = (el) => (el?.textContent || "").replace(/\s+/g, " ").trim();
    const h1 = document.querySelector("h1");
    const makeSmarter = [...document.querySelectorAll("button")].find((b) =>
      /make it smarter|analysing/i.test(b.textContent || ""),
    );
    const templates = [...document.querySelectorAll("button, a, [role='button']")]
      .map((el) => text(el))
      .filter((t) =>
        /sales follow-up|enquiry handling|onboarding|internal approvals|blank canvas/i.test(t),
      );
    const canvas = document.querySelector('[aria-label*="Workflow canvas"], [role="application"]');
    const stepHints = [...document.querySelectorAll("span, p, li")]
      .map((el) => text(el))
      .filter((t) => /^[1-4] · /.test(t) || /drag to arrange|circle to connect/i.test(t));
    const metaDesc =
      document.querySelector('meta[name="description"]')?.getAttribute("content") || "";
    const title = document.title || "";
    return {
      title,
      metaDesc,
      h1: text(h1),
      templates: [...new Set(templates)].slice(0, 8),
      hasCanvas: !!canvas,
      canvasLabel: canvas?.getAttribute("aria-label") || null,
      makeSmarter: makeSmarter ? text(makeSmarter) : null,
      makeSmarterDisabled: makeSmarter ? makeSmarter.disabled : null,
      stepHints: [...new Set(stepHints)].slice(0, 12),
      boilerplateMeta: /premium digital agency platform/i.test(metaDesc),
    };
  });
}

async function runViewport(browser, tag, viewport) {
  const page = await browser.newPage({ viewport });
  const log = [];
  const push = async (msg, extra = {}) => {
    const signals = await pageSignals(page);
    log.push({ msg, viewport, ...signals, ...extra });
  };

  await page.goto(URL, { waitUntil: "networkidle", timeout: 60000 });
  await sleep(800);
  await push(`${tag}:landed`);
  await shot(page, `${tag}-01-hero`);

  // Prefer Sales follow-up template if present
  const sales = page.getByRole("button", { name: /Sales follow-up/i });
  if (await sales.count()) {
    await sales.first().click();
    await sleep(500);
    await push(`${tag}:template-sales`);
    await shot(page, `${tag}-02-template`);
  } else {
    await push(`${tag}:template-missing`);
  }

  // Click Make it smarter to surface validation or gate (do not fill spam forms)
  const cta = page.getByRole("button", { name: /Make it smarter/i });
  if (await cta.count()) {
    await cta.first().click();
    await sleep(900);
    await push(`${tag}:after-cta`);
    await shot(page, `${tag}-03-cta`);
  }

  // Capture any validation / gate copy
  const gateText = await page.evaluate(() => {
    const body = document.body?.innerText || "";
    const lines = body
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    return lines
      .filter((l) =>
        /before we can analyse|add your first|connect your steps|free analysis|privacy|business email|make it smarter|one click/i.test(
          l,
        ),
      )
      .slice(0, 30);
  });
  await push(`${tag}:gate-copy`, { gateText });

  await page.close();
  return log;
}

async function main() {
  if (!chrome) {
    console.error("No Chrome/Chromium found. Set CHROME_PATH.");
    process.exit(2);
  }

  const browser = await chromium.launch({
    executablePath: chrome,
    headless: true,
  });

  const desktop = await runViewport(browser, "desktop", { width: 1280, height: 800 });
  const mobile = await runViewport(browser, "mobile", { width: 390, height: 844 });
  await browser.close();

  const report = {
    url: URL,
    at: new Date().toISOString(),
    desktop,
    mobile,
    summary: {
      desktopH1: desktop.find((e) => e.msg.endsWith(":landed"))?.h1 || null,
      mobileH1: mobile.find((e) => e.msg.endsWith(":landed"))?.h1 || null,
      boilerplateMeta:
        desktop.some((e) => e.boilerplateMeta) || mobile.some((e) => e.boilerplateMeta),
      hasMakeSmarter: desktop.some((e) => e.makeSmarter),
    },
  };

  if (OUT) {
    fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
  }
  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
