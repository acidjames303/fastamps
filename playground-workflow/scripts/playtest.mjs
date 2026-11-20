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
      /make it smarter|analysing|run another analysis/i.test(b.textContent || ""),
    );
    const templates = [...document.querySelectorAll("button, a, [role='button']")]
      .map((el) => text(el))
      .filter((t) =>
        /sales follow-up|enquiry handling|onboarding|internal approvals|blank canvas/i.test(t),
      );
    const canvas = document.querySelector('[aria-label*="Workflow canvas"], [role="application"]');
    const stepNodes = canvas
      ? [...canvas.querySelectorAll('[aria-label*="step"]')].map((n) => n.getAttribute("aria-label"))
      : [];
    const slashTips = [...document.querySelectorAll("li, p, span")]
      .map((el) => text(el))
      .filter((t) => t.startsWith("//"));
    const body = document.body?.innerText || "";
    const metaDesc =
      document.querySelector('meta[name="description"]')?.getAttribute("content") || "";
    const cta = [...document.querySelectorAll("button")].find((b) =>
      /^Make it smarter$/i.test(text(b)),
    );
    const ctaRect = cta?.getBoundingClientRect();
    return {
      title: document.title || "",
      metaDesc,
      h1: text(h1),
      templates: [...new Set(templates)].slice(0, 8),
      hasCanvas: !!canvas,
      stepNodeCount: stepNodes.length,
      stepNodes: stepNodes.slice(0, 8),
      slashTips: slashTips.slice(0, 5),
      makeSmarter: makeSmarter ? text(makeSmarter) : null,
      makeSmarterDisabled: makeSmarter ? makeSmarter.disabled : null,
      boilerplateMeta: /premium digital agency platform/i.test(metaDesc),
      freeUsedGate: /Your free analysis has been used/i.test(body),
      emailGate: /Business email|Add your name and email/i.test(body),
      beforeAfter: /Before and after/i.test(body),
      turnIntoProject: /Turn this into a project/i.test(body),
      ctaY: ctaRect ? Math.round(ctaRect.top) : null,
      ctaInFirstViewport: ctaRect
        ? ctaRect.top < window.innerHeight && ctaRect.bottom > 0
        : false,
      stickyCta: !!document.querySelector("[data-playground-sticky-cta], .playground-sticky-cta"),
    };
  });
}

async function runViewport(browser, tag, viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const log = [];
  const push = async (msg, extra = {}) => {
    const signals = await pageSignals(page);
    log.push({ msg, viewport, ...signals, ...extra });
  };

  await page.goto(URL, { waitUntil: "networkidle", timeout: 60000 });
  await sleep(800);
  await push(`${tag}:landed`);
  await shot(page, `${tag}-01-hero`);

  const sales = page.getByRole("button", { name: /Sales follow-up/i });
  if (await sales.count()) {
    await sales.first().click();
    await sleep(500);
    await push(`${tag}:template-sales`);
    await shot(page, `${tag}-02-template`);
  } else {
    await push(`${tag}:template-missing`);
  }

  const cta = page.getByRole("button", { name: /^Make it smarter$/i });
  if (await cta.count()) {
    await cta.first().scrollIntoViewIfNeeded();
    await cta.first().click();
    // Analysis may complete, or free-quota gate may appear
    for (let i = 0; i < 12; i++) {
      await sleep(1500);
      const s = await pageSignals(page);
      if (s.beforeAfter || s.turnIntoProject || s.freeUsedGate || s.emailGate) {
        await push(`${tag}:after-cta`, { poll: i + 1 });
        break;
      }
      if (i === 11) await push(`${tag}:after-cta-timeout`);
    }
    await shot(page, `${tag}-03-cta`);
  }

  await context.close();
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

  const dLand = desktop.find((e) => e.msg.endsWith(":landed"));
  const mLand = mobile.find((e) => e.msg.endsWith(":landed"));
  const dAfter = desktop.find((e) => e.msg.includes("after-cta"));
  const mAfter = mobile.find((e) => e.msg.includes("after-cta"));

  const report = {
    url: URL,
    at: new Date().toISOString(),
    desktop,
    mobile,
    summary: {
      desktopH1: dLand?.h1 || null,
      mobileH1: mLand?.h1 || null,
      boilerplateMeta: !!(dLand?.boilerplateMeta || mLand?.boilerplateMeta),
      slashTipsPresent: !!(dLand?.slashTips?.length || mLand?.slashTips?.length),
      desktopAnalysisOrGate: !!(dAfter?.beforeAfter || dAfter?.freeUsedGate || dAfter?.emailGate),
      mobileAnalysisOrGate: !!(mAfter?.beforeAfter || mAfter?.freeUsedGate || mAfter?.emailGate),
      mobileCtaInFirstViewport: !!mLand?.ctaInFirstViewport,
      mobileCtaY: mLand?.ctaY ?? null,
      canvasNodesWhenTemplated: desktop.find((e) => e.msg.endsWith(":template-sales"))?.stepNodeCount ?? null,
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
