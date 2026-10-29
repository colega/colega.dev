// Checks that the notes plugin is loaded, every slide has speaker notes, and the note times go up.
const puppeteer = require("puppeteer-core");
const path = require("path");
(async () => {
  const b = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", userDataDir: path.join(__dirname, "..", "out", "chrome-profile") });
  const p = await b.newPage();
  await p.setCacheEnabled(false);
  await p.goto("http://127.0.0.1:8765/index.html", { waitUntil: "networkidle0" });
  const r = await p.evaluate(() => {
    const slides = [...document.querySelectorAll(".reveal .slides > section")];
    const times = slides.map((s) => { const m = (s.querySelector("aside.notes") || {}).textContent?.match(/\[(\d+):(\d+)\]/); return m ? +m[1] * 60 + +m[2] : null; });
    return { notesPlugin: !!Reveal.getPlugin("notes"), slides: slides.length, withNotes: slides.filter((s) => s.querySelector("aside.notes")).length, times };
  });
  const ts = r.times.filter((t) => t !== null);
  console.log(JSON.stringify({ notesPlugin: r.notesPlugin, slides: r.slides, withNotes: r.withNotes, timed: ts.length, increasing: ts.every((t, i) => i === 0 || t >= ts[i - 1]), last: ts[ts.length - 1] }));
  await b.close();
})();
