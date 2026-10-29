// Animated background for title and section slides: a hash map that fills up and forgets.
// Each cell is a slot; groups of 8 slots are drawn together. Random slots get "put" (bright orange)
// and fade as they age. A cleanup sweep runs across the map and clears slots older than the watermark.
(function () {
  const CELL = 14, GAP = 3, GROUP_GAP = 9;
  const maps = [];
  // RGB triplets from theme.css, read once the stylesheet is loaded.
  let rgb;

  function setup(canvas) {
    const W = 1600, H = 900;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    const cols = [];
    let x = 30;
    while (x + CELL < W) {
      for (let i = 0; i < 8 && x + CELL < W; i++) {
        cols.push(x);
        x += CELL + GAP;
      }
      x += GROUP_GAP;
    }
    const rows = [];
    for (let y = 30; y + CELL < H; y += CELL + GAP + 5) rows.push(y);
    const n = cols.length * rows.length;
    const age = new Float32Array(n).fill(-1);
    // start with a half full map
    for (let i = 0; i < n; i++) if (Math.random() < 0.35) age[i] = Math.random() * 18;
    const flashA = new Float32Array(n);
    return { canvas, ctx, cols, rows, age, flashA, W, H, sweep: -200, t: 0, intensity: +canvas.dataset.intensity || 1 };
  }

  function frame(m, dt) {
    const { ctx, cols, rows, age, flashA, W, H } = m;
    m.t += dt;
    const minutes = dt * 1.4; // simulated minutes per second
    // puts
    const puts = Math.floor(60 * dt) + (Math.random() < 0.5 ? 1 : 0);
    for (let p = 0; p < puts; p++) {
      const i = (Math.random() * age.length) | 0;
      age[i] = 0;
      flashA[i] = 1;
    }
    for (let i = 0; i < age.length; i++) {
      if (age[i] >= 0) age[i] += minutes;
      if (flashA[i] > 0) flashA[i] = Math.max(0, flashA[i] - dt * 1.6);
    }
    // cleanup sweep
    m.sweep += dt * 420;
    if (m.sweep > W + 400) m.sweep = -300;
    ctx.clearRect(0, 0, W, H);
    const nc = cols.length;
    for (let r = 0; r < rows.length; r++) {
      for (let c = 0; c < nc; c++) {
        const i = r * nc + c;
        const x = cols[c], y = rows[r];
        const a = age[i];
        if (a >= 0 && a > 20 && Math.abs(x - m.sweep) < 10) {
          age[i] = -1;
          flashA[i] = -1; // marks a removal flash
        }
        let fill;
        if (flashA[i] < 0) {
          fill = `rgba(${rgb.red},0.5)`;
          flashA[i] = Math.min(0, flashA[i] + dt * 2.5);
          if (flashA[i] === 0) flashA[i] = 0;
        } else if (age[i] < 0) {
          fill = "rgba(16,24,40,0.035)";
        } else {
          const fresh = Math.max(0, 1 - age[i] / 20);
          const f = flashA[i];
          const alpha = (0.1 + 0.32 * fresh + 0.45 * f) * m.intensity;
          fill = f > 0.05 ? `rgba(${rgb.yellow},${alpha})` : `rgba(${rgb.orange},${alpha})`;
        }
        ctx.fillStyle = fill;
        ctx.fillRect(x, y, CELL, CELL);
      }
    }
    // the sweep line
    const g = ctx.createLinearGradient(m.sweep - 120, 0, m.sweep + 4, 0);
    g.addColorStop(0, `rgba(${rgb.yellow},0)`);
    g.addColorStop(1, `rgba(${rgb.yellow},${0.18 * m.intensity})`);
    ctx.fillStyle = g;
    ctx.fillRect(m.sweep - 120, 0, 124, H);
  }

  let last = 0;
  function loop(t) {
    const dt = Math.min(0.05, (t - last) / 1000 || 0);
    last = t;
    for (const m of maps) {
      const sec = m.canvas.closest("section");
      if (sec && sec.classList.contains("present")) frame(m, dt);
    }
    requestAnimationFrame(loop);
  }

  window.DeckBg = function () {
    const cs = getComputedStyle(document.documentElement);
    rgb = { orange: cs.getPropertyValue("--orange-rgb").trim(), yellow: cs.getPropertyValue("--yellow-rgb").trim(), red: cs.getPropertyValue("--red-rgb").trim() };
    document.querySelectorAll("canvas.mapbg").forEach((c) => maps.push(setup(c)));
    requestAnimationFrame(loop);
  };
})();
