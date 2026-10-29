// Walks through every slide and step of the deck in real time, with animations on.
// Takes a screenshot after each step has settled, collects JS errors, and reports
// elements of the current slide that end up outside the 1600x900 slide area.
const puppeteer = require("puppeteer-core");
const path = require("path");
const fs = require("fs");

const out = path.join(__dirname, "..", "out", "live");
fs.mkdirSync(out, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: "new",
    userDataDir: path.join(__dirname, "..", "out", "chrome-profile"),
    args: ["--window-size=1600,900", "--hide-scrollbars"],
    defaultViewport: { width: 1600, height: 900 },
  });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("response", (r) => { if (r.status() >= 400) errors.push(`http ${r.status()}: ${r.url()}`); });
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warn") errors.push(m.type() + ": " + m.text());
  });
  await page.setCacheEnabled(false); // always test the files on disk
  await page.goto("http://127.0.0.1:8765/index.html", { waitUntil: "networkidle0" });
  await sleep(1500);

  const total = await page.evaluate(() => Reveal.getTotalSlides());
  const report = [];
  let shot = 0;
  for (let guard = 0; guard < 400; guard++) {
    await sleep(1800);
    const st = await page.evaluate(() => {
      const s = Reveal.getCurrentSlide();
      const box = document.querySelector(".reveal .slides").getBoundingClientRect();
      const scale = Reveal.getScale();
      const bad = [];
      s.querySelectorAll("*").forEach((el) => {
        if (el.closest("aside.notes") || el.matches("canvas.mapbg, style, script, .fragment.step")) return;
        const cs = getComputedStyle(el);
        if (cs.display === "none" || cs.visibility === "hidden" || +cs.opacity === 0) return;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return;
        const x0 = (r.left - box.left) / scale, x1 = (r.right - box.left) / scale;
        const y0 = (r.top - box.top) / scale, y1 = (r.bottom - box.top) / scale;
        if (x0 < -2 || y0 < -2 || x1 > 1602 || y1 > 902) bad.push(`${el.tagName.toLowerCase()}.${el.className && el.className.baseVal === undefined ? el.className : ""} [${Math.round(x0)},${Math.round(y0)} to ${Math.round(x1)},${Math.round(y1)}]`);
        // text cut by a code block
        if (el.tagName === "CODE" && el.scrollWidth > el.clientWidth + 2) bad.push(`code wider than its box by ${el.scrollWidth - el.clientWidth}px`);
      });
      const idx = Reveal.getIndices();
      return { h: idx.h, f: idx.f === undefined ? -1 : idx.f, bad: [...new Set(bad)].slice(0, 6), isLast: Reveal.isLastSlide() && !Reveal.availableFragments().next };
    });
    const name = `${String(st.h).padStart(2, "0")}-${String(st.f + 1).padStart(2, "0")}.png`;
    await page.screenshot({ path: path.join(out, name) });
    shot++;
    if (st.bad.length) report.push(`slide ${st.h} step ${st.f + 1}: ${st.bad.join(" | ")}`);
    if (st.isLast) break;
    await page.keyboard.press("ArrowRight");
    await sleep(150);
  }
  console.log(`slides: ${total}, screenshots: ${shot}`);
  console.log("errors:", errors.length ? "\n  " + errors.join("\n  ") : "none");
  console.log("out of bounds:", report.length ? "\n  " + report.join("\n  ") : "none");
  await browser.close();
})();
