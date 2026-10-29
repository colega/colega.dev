// Step-driven animations for the deck.
// An element with data-anim="name" data-steps="N" gets N invisible reveal fragments in its slide.
// Each time a fragment is shown or hidden, render(el, step) is called with the number of visible steps.
(function () {
  const NS = "http://www.w3.org/2000/svg";
  const A = {};
  window.DeckAnims = A;

  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === "class") el.className = v;
      else if (k === "style") el.style.cssText = v;
      else if (k === "html") el.innerHTML = v;
      else el.setAttribute(k, v);
    }
    for (const c of children.flat()) {
      if (c == null) continue;
      el.append(c instanceof Node ? c : document.createTextNode(c));
    }
    return el;
  }

  function s(tag, attrs, ...children) {
    const el = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === "text") el.textContent = v;
      else el.setAttribute(k, v);
    }
    for (const c of children.flat()) if (c) el.append(c);
    return el;
  }

  function cell(text, cls, w) {
    const c = h("div", { class: "cell " + (cls || "") }, text == null ? "" : String(text));
    if (w) c.style.setProperty("--w", w + "px");
    return c;
  }

  function setCell(c, text, cls) {
    c.textContent = text == null ? "" : String(text);
    c.className = "cell " + (cls || "");
  }

  // Restart a CSS animation class on an element.
  function flash(el, cls, delay) {
    el.classList.remove(cls);
    void el.offsetWidth;
    if (delay) {
      el.style.animationDelay = delay + "s";
    } else {
      el.style.animationDelay = "";
    }
    el.classList.add(cls);
  }

  const hex = (n) => n.toString(16).padStart(2, "0");

  // ------------------------------------------------------------------ architecture
  A.arch = {
    init(el) {
      const svg = s("svg", { viewBox: "0 0 1420 600", width: "100%" });
      const box = (x, y, w, hh, title, sub, color, id) => {
        const g = s("g", { id: id || "" });
        g.append(
          s("rect", { x, y, width: w, height: hh, rx: 18, fill: "#181b1f", stroke: color, "stroke-width": 2 }),
          s("text", { x: x + w / 2, y: y + hh / 2 - (sub ? 6 : -10), "text-anchor": "middle", fill: "#fff", "font-size": 30, "font-weight": 700, text: title })
        );
        if (sub) g.append(s("text", { x: x + w / 2, y: y + hh / 2 + 30, "text-anchor": "middle", fill: "#8e8e9e", "font-size": 20, class: "mono", text: sub }));
        return g;
      };
      const defs = s("defs");
      defs.append(
        s("marker", { id: "arr", viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto-start-reverse" },
          s("path", { d: "M0,0 L10,5 L0,10 z", fill: "#5a5f6b" }))
      );
      svg.append(defs);
      const paths = {
        p1: "M250,150 L420,150",
        p2: "M680,150 L850,150",
        p3: "M1110,150 L1200,150",
        down: "M520,215 L520,385",
        up: "M580,385 L580,215",
        back: "M420,105 C330,60 330,60 250,105",
      };
      for (const [id, d] of Object.entries(paths)) {
        svg.append(s("path", { id: "arch-" + id, d, stroke: "#3b3f47", "stroke-width": 3, fill: "none", "marker-end": "url(#arr)", class: "arch-path arch-" + id }));
      }
      svg.append(
        box(20, 85, 230, 130, "Writers", "Prometheus, Alloy", "#5a5f6b"),
        box(420, 85, 260, 130, "Distributor", "push path", "#6e9fff"),
        box(850, 85, 260, 130, "Kafka", "ingest storage", "#5a5f6b"),
        box(1200, 85, 200, 130, "Ingesters", "block-builders", "#5a5f6b")
      );
      const ut = box(370, 385, 360, 140, "usage-tracker", "new series? over limit?", "#ff8833", "arch-ut");
      ut.setAttribute("class", "arch-ut");
      svg.append(ut);
      svg.append(
        s("text", { x: 470, y: 305, fill: "#fbca0a", "font-size": 20, class: "mono arch-lbl", "text-anchor": "end", text: "series hashes" }),
        s("text", { x: 630, y: 305, fill: "#f2495c", "font-size": 20, class: "mono arch-lbl", text: "rejected hashes" }),
        s("text", { x: 335, y: 52, fill: "#f2495c", "font-size": 22, class: "mono arch-lbl", "text-anchor": "middle", text: "429 Too Many Requests" })
      );
      const warn = s("g", { class: "arch-warn" });
      warn.append(
        s("text", { x: 1395, y: 268, fill: "#f2495c", "font-size": 22, "text-anchor": "end", class: "mono", text: "over the limit?" }),
        s("text", { x: 1395, y: 298, fill: "#f2495c", "font-size": 22, "text-anchor": "end", class: "mono", text: "we find out here," }),
        s("text", { x: 1395, y: 328, fill: "#f2495c", "font-size": 22, "text-anchor": "end", class: "mono", text: "after paying for Kafka" })
      );
      svg.append(warn);
      // flowing dots
      const dots = s("g", { class: "arch-dots" });
      const mk = (pathId, n, dur, cls, offset) => {
        for (let i = 0; i < n; i++) {
          const c = s("circle", { r: 7, class: "flow-dot " + (cls || "") });
          const am = s("animateMotion", { dur: dur + "s", repeatCount: "indefinite", begin: (-(offset + (i * dur) / n)).toFixed(2) + "s" });
          am.append(s("mpath", { href: "#arch-" + pathId }));
          c.append(am);
          dots.append(c);
        }
      };
      mk("p1", 3, 1.6, "good", 0);
      mk("p2", 3, 1.6, "good pass", 0.4);
      mk("p3", 2, 1.2, "good pass", 0.8);
      mk("p1", 1, 1.6, "bad", 0.8);
      mk("p2", 1, 1.6, "bad leak", 1.2);
      mk("p3", 1, 1.2, "bad leak", 1.7);
      mk("down", 3, 1.4, "ut", 0);
      mk("up", 2, 1.4, "ut rej", 0.7);
      mk("back", 2, 1.5, "ut rej", 0.3);
      svg.append(dots);
      el.append(svg);
      const style = h("style", {}, `
        .arch .flow-dot.bad { fill: #f2495c; filter: drop-shadow(0 0 6px rgba(242,73,92,.9)); }
        .arch .flow-dot.ut { fill: #ff8833; }
        .arch .flow-dot.rej { fill: #f2495c; }
        .arch .arch-ut, .arch .arch-lbl, .arch .arch-down, .arch .arch-up, .arch .arch-back, .arch .flow-dot.ut, .arch .arch-warn, .arch .flow-dot.bad { opacity: 0; transition: opacity .6s; }
        .arch.s1 .arch-warn, .arch.s1 .flow-dot.bad { opacity: 1; }
        .arch.s2 .arch-warn, .arch.s2 .flow-dot.leak { opacity: 0; }
        .arch.s2 .arch-ut, .arch.s2 .arch-lbl, .arch.s2 .arch-down, .arch.s2 .arch-up, .arch.s2 .arch-back, .arch.s2 .flow-dot.ut { opacity: 1; }
        .arch.s2 .flow-dot.bad:not(.leak) { opacity: 1; }
      `);
      el.append(style);
      el.classList.add("arch");
    },
    render(el, step) {
      el.classList.toggle("s1", step >= 1);
      el.classList.toggle("s2", step >= 2);
    },
  };

  // ------------------------------------------------------------------ clock face
  A.clock = {
    init(el) {
      const R = 250, C = 300;
      const svg = s("svg", { viewBox: "0 0 600 600", width: "600", height: "600", class: "clock" });
      const ang = (m) => (m / 120) * 2 * Math.PI - Math.PI / 2;
      const pt = (m, r) => [C + r * Math.cos(ang(m)), C + r * Math.sin(ang(m))];
      svg.append(s("circle", { cx: C, cy: C, r: R + 30, fill: "#14161a", stroke: "#2c3235", "stroke-width": 2 }));
      // valid window arc (filled sector), rotated by a group transform
      const arcG = s("g", { class: "clk-arc", style: `transform-origin: ${C}px ${C}px` });
      const sector = (from, to, r) => {
        const [x1, y1] = pt(from, r), [x2, y2] = pt(to, r);
        const large = to - from > 60 ? 1 : 0;
        return `M${C},${C} L${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} Z`;
      };
      arcG.append(s("path", { d: sector(-60, 0, R + 28), fill: "rgba(255,136,51,0.13)", stroke: "rgba(255,136,51,0.5)", "stroke-width": 1.5 }));
      arcG.append(s("path", { d: sector(-20, 0, R + 28), fill: "rgba(251,202,10,0.10)" }));
      svg.append(arcG);
      for (let m = 0; m < 120; m++) {
        const big = m % 10 === 0;
        const [x1, y1] = pt(m, R + 28), [x2, y2] = pt(m, R + (big ? 10 : 20));
        svg.append(s("line", { x1, y1, x2, y2, stroke: big ? "#8e8e9e" : "#3b3f47", "stroke-width": big ? 3 : 1.5 }));
        if (big) {
          const [tx, ty] = pt(m, R - 14);
          svg.append(s("text", { x: tx, y: ty + 8, "text-anchor": "middle", fill: m === 0 ? "#fbca0a" : "#8e8e9e", "font-size": 22, class: "mono", text: String(m) }));
        }
      }
      // series dots
      const dotsG = s("g");
      svg.append(dotsG);
      const rnd = mulberry(7);
      const dots = [];
      const addDots = (n, from, to, cls) => {
        for (let i = 0; i < n; i++) {
          const m = from + rnd() * (to - from);
          const r = 120 + rnd() * 90;
          const [x, y] = pt(m, r);
          const d = s("circle", { cx: x, cy: y, r: 7, class: "clk-dot " + cls, style: `transform-origin:${x}px ${y}px; transition-delay:${(rnd() * 0.5).toFixed(2)}s` });
          dotsG.append(d);
          dots.push({ el: d, m, cls });
        }
      };
      addDots(46, 75, 95, "a");
      addDots(14, 50, 75, "a");
      addDots(30, 111, 130, "b");
      // hands
      const hand = (cls, color, len, w) => {
        const g = s("g", { class: cls, style: `transform-origin:${C}px ${C}px` });
        g.append(s("line", { x1: C, y1: C, x2: C, y2: C - len, stroke: color, "stroke-width": w, "stroke-linecap": "round" }));
        g.append(s("circle", { cx: C, cy: C - len, r: w + 3, fill: color }));
        return g;
      };
      const wm = hand("clk-wm", "#f2495c", R - 40, 4);
      const now = hand("clk-now", "#fbca0a", R + 10, 6);
      svg.append(wm, now, s("circle", { cx: C, cy: C, r: 12, fill: "#fbca0a" }));
      const big = s("text", { x: C, y: C + 70, "text-anchor": "middle", fill: "#fff", "font-size": 40, "font-weight": 800, class: "mono clk-now-label", text: "" });
      svg.append(big);
      el.append(svg);
      el._clk = { arcG, now, wm, dots, big };
      el.append(h("style", {}, `
        .clock .clk-arc, .clock .clk-now, .clock .clk-wm { transition: transform 1.6s cubic-bezier(.45,0,.2,1), opacity .5s; }
        .clock .clk-dot { fill: #6e9fff; opacity: 0; transform: scale(0); transition: transform .5s cubic-bezier(.3,1.6,.5,1), opacity .5s, fill .5s; }
        .clock .clk-dot.on { opacity: .9; transform: scale(1); }
        .clock .clk-dot.exp { fill: #f2495c; }
        .clock .clk-dot.gone { opacity: 0; transform: scale(2.5); }
      `));
    },
    render(el, step) {
      const k = el._clk;
      const nowM = step >= 4 ? 130 : 95;
      const wmM = nowM - 20;
      k.now.style.transform = `rotate(${(nowM / 120) * 360}deg)`;
      k.wm.style.transform = `rotate(${(wmM / 120) * 360}deg)`;
      k.arcG.style.transform = `rotate(${(nowM / 120) * 360}deg)`;
      k.arcG.style.opacity = step >= 1 ? 1 : 0;
      k.wm.style.opacity = step >= 2 ? 1 : 0;
      k.big.textContent = String(nowM % 120);
      for (const d of k.dots) {
        const visible = (d.cls === "a" && step >= 2) || (d.cls === "b" && step >= 4);
        const expired = step >= 2 && d.m <= wmM;
        const gone = (step >= 3 && d.cls === "a" && d.m <= 75) || (step >= 4 && d.m <= wmM);
        d.el.classList.toggle("on", visible);
        d.el.classList.toggle("exp", expired);
        d.el.classList.toggle("gone", gone);
      }
      const caps = el.closest("section").querySelectorAll("[data-clk]");
      caps.forEach((c) => c.classList.toggle("on", +c.dataset.clk <= step));
    },
  };

  // ------------------------------------------------------------------ group layout
  A.group = {
    init(el) {
      const U = 18; // pixels per byte
      const mkRow = (label, cls) => {
        const r = h("div", { class: "cells grp-row " + cls, style: "gap:2px; align-items:center" });
        r.append(h("div", { class: "rowlabel" }, label));
        return r;
      };
      const idx = mkRow("index", "r-idx");
      const dat = mkRow("data", "r-dat");
      const key = mkRow("keys", "r-key");
      const pref = [0x2b, 0x47, 0x15, 0x6c, 0x00, 0x51, 0x00, 0x00];
      const mins = [37, 52, 18, 44, null, 29, null, null];
      for (let i = 0; i < 8; i++) {
        const c1 = cell("", pref[i] ? "occo" : "", U);
        c1.style.height = "46px";
        idx.append(c1);
        const c2 = cell("", mins[i] != null ? "yel" : "", U);
        c2.style.height = "46px";
        dat.append(c2);
        const c3 = cell(pref[i] ? "k" + i : "", pref[i] ? "occ" : "", U);
        c3.style.height = "46px";
        c3.classList.add("keycell");
        key.append(c3);
      }
      el.append(idx, dat, key);
      el._g = { idx, dat, key, U };
      el.append(h("style", {}, `
        .grp-row { margin: 10px 0; opacity: 0; transform: translateX(-20px); transition: all .6s cubic-bezier(.2,.8,.2,1); }
        .grp-row.on { opacity: 1; transform: none; }
        .grp-row .cell { font-size: 16px; }
        .grp-comp { display:flex; height: 46px; margin: 34px 0 0 150px; border-radius: 10px; overflow:hidden; width: 1280px; opacity:0; transition: opacity .6s; }
        .grp-comp.on { opacity: 1; }
        .grp-comp > div { display:flex; align-items:center; justify-content:center; font-family: var(--mono); font-size: 18px; color:#111; font-weight:700; }
      `));
      const comp = h("div", { class: "grp-comp" },
        h("div", { style: "width:10%; background:#ff8833" }, "8"),
        h("div", { style: "width:10%; background:#fbca0a" }, "8"),
        h("div", { style: "width:80%; background:#6e9fff" }, "64 bytes of keys: one whole cache line")
      );
      el.append(comp);
      el._g.comp = comp;
    },
    render(el, step) {
      const g = el._g;
      g.idx.classList.toggle("on", step >= 0);
      g.dat.classList.toggle("on", step >= 1);
      g.key.classList.toggle("on", step >= 2);
      const w = step >= 2 ? g.U * 8 + 7 * 2 : g.U;
      g.key.querySelectorAll(".keycell").forEach((c) => c.style.setProperty("--w", w + "px"));
      g.comp.classList.toggle("on", step >= 3);
      el.closest("section").querySelectorAll("[data-grp]").forEach((c) => c.classList.toggle("on", +c.dataset.grp <= step));
    },
  };

  // ------------------------------------------------------------------ SWAR match
  A.match = {
    init(el) {
      const rows = [
        ["index word", [0x2b, 0x47, 0x15, 0x47, 0x6c, 0x00, 0x00, 0x00], "occo"],
        ["loBits * 0x47", Array(8).fill(0x47), "yel"],
        ["xor", [0x6c, 0x00, 0x52, 0x00, 0x2b, 0x47, 0x47, 0x47], ""],
        ["findZeroBytes", [0x00, 0x80, 0x00, 0x80, 0x00, 0x00, 0x00, 0x00], ""],
      ];
      el._rows = [];
      rows.forEach(([label, bytes, cls], ri) => {
        const r = h("div", { class: "cells m-row", style: "align-items:center; margin: 12px 0" });
        r.append(h("div", { class: "rowlabel", style: "width: 250px" }, label));
        bytes.forEach((b, i) => {
          let c = cls;
          if (ri === 0 && b === 0) c = "";
          if (ri === 2) c = b === 0 ? "hit" : "";
          if (ri === 3) c = b ? "hit" : "dim";
          r.append(cell(hex(b), c, 84));
        });
        el.append(r);
        el._rows.push(r);
      });
      const slots = h("div", { class: "cells", style: "margin: 4px 0 0 0" });
      slots.append(h("div", { class: "rowlabel", style: "width:250px" }, "slot"));
      for (let i = 0; i < 8; i++) slots.append(h("div", { class: "mono", style: "width:84px; text-align:center; color:#8e8e9e; font-size:18px" }, String(i)));
      el.prepend(slots);
      el.append(h("style", {}, `.m-row { opacity:0; transform: translateY(14px); transition: all .5s cubic-bezier(.2,.8,.2,1); } .m-row.on { opacity:1; transform:none; }`));
    },
    render(el, step) {
      el._rows.forEach((r, i) => r.classList.toggle("on", i <= step));
      el.closest("section").querySelectorAll("[data-m]").forEach((c) => c.classList.toggle("on", +c.dataset.m <= step));
    },
  };

  // ------------------------------------------------------------------ bit packing
  A.bits = {
    init(el) {
      const rnd = mulberry(3);
      const bits = Array.from({ length: 64 }, () => (rnd() > 0.5 ? 1 : 0));
      // low 7 bits: shard 0b1011010 = 90
      const shard = [1, 0, 1, 1, 0, 1, 0];
      // ^value for value 37 = 0b0100101 -> ^ on 7 bits = 0b1011010
      const val = [1, 0, 1, 1, 0, 1, 0].map((b, i) => [0, 1, 0, 0, 1, 0, 1][i] ^ 1);
      const row = h("div", { class: "cells", style: "gap:3px" });
      const cells = [];
      for (let i = 0; i < 64; i++) {
        const c = cell(String(bits[i]), "", 17);
        c.style.height = "44px";
        c.style.fontSize = "13px";
        c.style.borderRadius = "4px";
        if (i % 8 === 0 && i) c.style.marginLeft = "7px";
        cells.push(c);
        row.append(c);
      }
      const idxs = h("div", { class: "mono", style: "display:flex; justify-content:space-between; width: 1290px; color:#8e8e9e; font-size:18px; margin-top: 8px" }, h("span", {}, "bit 63"), h("span", {}, "bit 0"));
      el.append(row, idxs);
      el._b = { cells, bits, shard, val };
    },
    render(el, step) {
      const { cells, bits, shard, val } = el._b;
      cells.forEach((c, i) => {
        let cls = "occ";
        let t = bits[i];
        if (step >= 1 && i < 7) cls = "occo";
        if (step >= 2 && i >= 57) {
          cls = "exp";
          t = shard[i - 57];
        }
        if (step >= 3 && i >= 57) {
          cls = "yel";
          t = val[i - 57];
        }
        if (step === 2 && i >= 7 && i < 57) cls = "occ dim";
        c.textContent = t;
        c.className = "cell " + cls;
        c.style.setProperty("--w", "17px");
      });
      el.closest("section").querySelectorAll("[data-bits]").forEach((c) => c.classList.toggle("on", +c.dataset.bits <= step));
    },
  };

  // ------------------------------------------------------------------ probe chain
  A.probe = {
    init(el) {
      el._groups = [];
      const wrap = h("div", { style: "display:flex; gap: 36px" });
      for (let g = 0; g < 3; g++) {
        const col = h("div", {});
        col.append(h("div", { class: "mono", style: "color:#8e8e9e; font-size:20px; margin: 0 0 10px 2px" }, "group " + g + (g === 0 ? "  (probe start of X)" : "")));
        const r = h("div", { class: "cells", style: "gap:5px" });
        const cs = [];
        for (let i = 0; i < 8; i++) {
          const c = cell("", "", 50);
          cs.push(c);
          r.append(c);
        }
        col.append(r);
        wrap.append(col);
        el._groups.push(cs);
      }
      el.append(wrap);
      const arrow = h("div", { class: "probe-res" });
      el.append(arrow);
      el._res = arrow;
      el.append(h("style", {}, `.probe-res { margin-top: 30px; font-size: 30px; min-height: 44px; font-family: var(--sans); }`));
    },
    render(el, step) {
      const G = el._groups;
      const g0 = ["A", "B", "C", "D", "E", "F", "G", "H"];
      G[0].forEach((c, i) => setCell(c, g0[i], "occ"));
      G[1].forEach((c, i) => setCell(c, i === 0 ? "X" : i === 1 ? "I" : "", i === 0 ? "occo" : i === 1 ? "occ" : ""));
      G[2].forEach((c, i) => setCell(c, i === 0 ? "J" : "", i === 0 ? "occ" : ""));
      el._res.innerHTML = "";
      const scan = (cells, upto) => cells.slice(0, upto).forEach((c, i) => flash(c, "scan", i * 0.07));
      if (step === 0) {
        el._res.innerHTML = '<span class="muted">X belongs in group 0, but group 0 was full when X arrived, so X <b class="o">spilled</b> into group 1.</span>';
      }
      if (step === 1) {
        scan(G[0], 8);
        setTimeout(() => setCell(G[1][0], "X", "hit"), 650);
        el._res.innerHTML = 'lookup(X): group 0 has no X and <b>no empty slot</b>, keep walking... <span class="g">found in group 1</span>';
      }
      if (step >= 2) {
        setCell(G[0][2], "", step === 2 ? "exp" : "");
        if (step === 2) {
          G[0][2].textContent = "C";
          setTimeout(() => setCell(G[0][2], "", ""), 700);
          el._res.innerHTML = 'Cleanup: C was idle for 20 minutes. <b class="r">Clear the slot.</b>';
        }
      }
      if (step === 3) {
        scan(G[0], 3);
        setTimeout(() => setCell(G[0][2], "", "miss"), 300);
        el._res.innerHTML = 'lookup(X): group 0 has an empty slot, so <b class="r">X is not here</b>. X is counted as new. Again.';
      }
      if (step >= 4) {
        setCell(G[0][2], "T", "tomb");
        scan(G[0], 8);
        setTimeout(() => setCell(G[1][0], "X", "hit"), 650);
        el._res.innerHTML = 'Tombstone: <b class="p">"deleted, but keep walking"</b>. X is found again.';
      }
    },
  };

  // ------------------------------------------------------------------ deletion generations
  A.gens = {
    init(el) {
      const mk = (label, w) => {
        const r = h("div", { class: "cells", style: "gap:5px; align-items:center; margin: 9px 0" });
        r.append(h("div", { class: "rowlabel" }, label));
        const cs = [];
        for (let i = 0; i < 8; i++) {
          const c = cell("", "", w);
          cs.push(c);
          r.append(c);
        }
        el.append(r);
        return cs;
      };
      el._idx = mk("index", 56);
      el._dat = mk("data", 56);
      el._key = mk("keys", 118);
      el._stats = h("div", { style: "display:flex; gap:14px; margin: 26px 0 0 150px; flex-wrap:wrap; min-height: 40px" });
      el.append(el._stats);
    },
    render(el, step) {
      const I = el._idx, D = el._dat, K = el._key;
      const pre = ["2b", "47", "15", "6c", "33", "58", "1e", "7a"];
      const dat = ["da", "cb", "ed", "d3", "e2", "c8", "f0", "c4"];
      const full = () => {
        for (let i = 0; i < 8; i++) {
          setCell(I[i], pre[i], "occo");
          setCell(D[i], dat[i], "yel");
          setCell(K[i], "k" + i, "occ");
        }
      };
      const pills = (arr) => {
        el._stats.innerHTML = "";
        arr.forEach(([t, c]) => el._stats.append(h("span", { class: "pill " + c }, t)));
      };
      const tag = el.closest("section").querySelector(".gens-title");
      el.closest("section").querySelectorAll("[data-gens]").forEach((c) => c.classList.toggle("on", c.dataset.gens.split(",").includes(String(step))));
      full();
      if (step === 0) {
        pills([["a full group: A..H", ""], ["7 of them expire", "r"]]);
        for (let i = 1; i < 8; i++) {
          D[i].classList.add("exp");
        }
        if (tag) tag.innerHTML = 'Before cleanup';
      }
      if (step === 1) {
        for (let i = 1; i < 8; i++) {
          setCell(I[i], "01", "tomb");
          setCell(D[i], "00", "tomb");
          setCell(K[i], "0", "tomb");
          flash(I[i], "write", i * 0.05);
          flash(D[i], "write", i * 0.05);
          flash(K[i], "write", i * 0.05);
        }
        pills([["21 writes", "r"], ["keys cache line dirty", "r"], ["0 free slots until rehash", "r"], ["resident unchanged", "r"]]);
        if (tag) tag.innerHTML = '<span class="p">v1: tombstones everywhere</span> <span class="muted small">(2024 to Apr 2026)</span>';
      }
      if (step === 2) {
        // different scenario: group with free slots, expire B
        const p2 = ["2b", "47", "15", "6c", "00", "00", "00", "00"];
        const d2 = ["da", "cb", "ed", "d3", "00", "00", "00", "00"];
        for (let i = 0; i < 8; i++) {
          setCell(I[i], p2[i], i < 4 ? "occo" : "");
          setCell(D[i], d2[i], i < 4 ? "yel" : "");
          setCell(K[i], i < 4 ? "k" + i : "", i < 4 ? "occ" : "");
        }
        setTimeout(() => {
          setCell(I[1], "6c", "occo");
          setCell(D[1], "d3", "yel");
          setCell(K[1], "k3", "occ");
          setCell(I[3], "00", "");
          setCell(D[3], "00", "");
          setCell(K[3], "", "");
          [I[1], D[1], K[1], I[3], D[3], K[3]].forEach((c) => flash(c, "write"));
        }, 500);
        pills([["has a free slot: move D into B's hole", "o"], ["no tombstone", "g"], ["still writes 2 keys", "r"]]);
        if (tag) tag.innerHTML = '<span class="o">#14932: move instead of tombstone</span> <span class="muted small">(Apr 2026)</span>';
      }
      if (step >= 3) {
        for (let i = 1; i < 8; i++) {
          setCell(I[i], i === 7 ? "01" : "00", i === 7 ? "spill" : "");
          setCell(D[i], i === 7 ? "01" : "00", i === 7 ? "spill" : "");
          setCell(K[i], "k" + i, "occ dim clean");
        }
        flash(I[7], "write");
        flash(D[7], "write");
        pills([["2 uint64 writes", "g"], ["keys untouched", "g"], ["6 free slots + the mark", "g"], ["resident -7", "g"]]);
        if (tag) tag.innerHTML = '<span class="g">v2: one spillmark per group</span> <span class="muted small">(#16532, Sep 2026)</span>';
      }
    },
  };

  // ------------------------------------------------------------------ SWAR cleanup
  A.cleanup = {
    init(el) {
      const rnd = mulberry(11);
      const mkBlock = (expiring) => {
        const vals = [];
        for (let g = 0; g < 8; g++) {
          for (let i = 0; i < 8; i++) {
            const occupied = rnd() < 0.55;
            let v = null;
            if (occupied) v = expiring && rnd() < 0.18 ? Math.floor(rnd() * 30) : 31 + Math.floor(rnd() * 28);
            vals.push(v);
          }
        }
        if (expiring) vals[7] = 12; // make sure a last slot expires to show the spillmark
        return vals;
      };
      const b1 = mkBlock(true), b2 = mkBlock(false);
      const line = (vals, label) => {
        const wrap = h("div", { class: "cl-line", style: "margin: 12px 0" });
        wrap.append(h("div", { class: "mono", style: "font-size:19px; color:#8e8e9e; margin-bottom:8px" }, label));
        const r = h("div", { class: "cells group-gap", style: "gap:2px" });
        const cs = vals.map((v) => {
          const c = cell("", v == null ? "" : "occ", 17);
          c.style.height = "40px";
          r.append(c);
          return c;
        });
        wrap.append(r);
        el.append(wrap);
        return { wrap, cs };
      };
      el._l1 = line(b1, "block 0: data of groups 0..7 = 64 bytes = one cache line");
      el._l2 = line(b2, "block 1: groups 8..15");
      el._b1 = b1;
      el._b2 = b2;
      // zoom of group 0
      const z = h("div", { class: "cl-zoom", style: "margin-top: 26px" });
      const zr = (label) => {
        const r = h("div", { class: "cells", style: "gap:5px; align-items:center; margin: 7px 0" });
        r.append(h("div", { class: "rowlabel", style: "width: 250px" }, label));
        const cs = [];
        for (let i = 0; i < 8; i++) {
          const c = cell("", "", 64);
          c.style.height = "46px";
          cs.push(c);
          r.append(c);
        }
        z.append(r);
        return cs;
      };
      el._zv = zr("group 0, minutes");
      el._zw = zr("watermark x8");
      el._zr = zr("expiredSlots");
      el.append(z);
      el._z = z;
      el.append(h("style", {}, `.cl-zoom { opacity:0; transition: opacity .5s; } .cl-zoom.on { opacity:1; } .cl-line { transition: opacity .5s; } .cl-line.skip { opacity: .35; }`));
    },
    render(el, step) {
      const W = 30;
      const { _l1: l1, _l2: l2, _b1: b1, _b2: b2 } = el;
      l1.cs.forEach((c, i) => {
        const v = b1[i];
        let cls = v == null ? "" : "occ";
        if (step >= 2 && v != null && v <= W) cls = "exp";
        if (step >= 3 && v != null && v <= W) cls = i % 8 === 7 ? "spill" : "";
        c.className = "cell " + cls;
        c.style.setProperty("--w", "17px");
      });
      l2.cs.forEach((c, i) => {
        c.className = "cell " + (b2[i] == null ? "" : "occ");
        c.style.setProperty("--w", "17px");
      });
      l2.wrap.classList.toggle("skip", step >= 2);
      el._z.classList.toggle("on", step >= 1);
      for (let i = 0; i < 8; i++) {
        const v = b1[i];
        setCell(el._zv[i], v == null ? "--" : v, v == null ? "" : "yel");
        setCell(el._zw[i], W, "occo");
        const e = v != null && v <= W;
        setCell(el._zr[i], e ? "80" : "00", e ? "exp" : "dim");
        if (step >= 3 && e) setCell(el._zv[i], i === 7 ? "S" : "--", i === 7 ? "spill" : "");
      }
      el.closest("section").querySelectorAll("[data-cl]").forEach((c) => c.classList.toggle("on", +c.dataset.cl <= step));
    },
  };

  // ------------------------------------------------------------------ lock holds
  A.locks = {
    init(el) {
      const svg = s("svg", { viewBox: "0 0 1420 470", width: "100%" });
      const X0 = 210, X1 = 1380, T = 300; // ms on the axis
      const x = (ms) => X0 + ((X1 - X0) * ms) / T;
      const lane = (y, label, sub) => {
        svg.append(s("text", { x: 0, y: y + 8, fill: "#fff", "font-size": 26, "font-weight": 700, text: label }));
        svg.append(s("text", { x: 0, y: y + 40, fill: "#8e8e9e", "font-size": 18, class: "mono", text: sub }));
        svg.append(s("line", { x1: X0, y1: y + 55, x2: X1, y2: y + 55, stroke: "#2c3235", "stroke-width": 2 }));
      };
      lane(40, "before", "Items(): clone");
      lane(260, "after", "Iterate(): chunks");
      for (let ms = 0; ms <= T; ms += 50) {
        svg.append(s("text", { x: x(ms), y: 460, fill: "#6c6f80", "font-size": 17, "text-anchor": "middle", class: "mono", text: ms + " ms" }));
      }
      const before = s("g", { class: "lk-before" });
      before.append(s("rect", { x: x(0), y: 20, width: x(230) - x(0), height: 50, rx: 8, fill: "rgba(242,73,92,.85)", class: "lk-hold" }));
      before.append(s("text", { x: x(115), y: 53, fill: "#fff", "font-size": 22, "text-anchor": "middle", "font-weight": 700, text: "shard lock: one hold, up to 230 ms", class: "lk-holdtxt" }));
      for (let i = 0; i < 14; i++) {
        const t = 8 + i * 16;
        const y = 82 + (i % 4) * 14;
        before.append(s("line", { x1: x(t), y1: y, x2: x(230), y2: y, stroke: "#ff8833", "stroke-width": 5, "stroke-linecap": "round", class: "lk-wait", style: `transition-delay:${(0.6 + i * 0.05).toFixed(2)}s` }));
      }
      before.append(s("text", { x: x(232), y: 140, fill: "#ff8833", "font-size": 20, class: "mono lk-wait", text: "trackSeries calls wait" }));
      const after = s("g", { class: "lk-after" });
      for (let i = 0; i < 60; i++) {
        const t = i * 5;
        after.append(s("rect", { x: x(t), y: 240, width: 3, height: 50, fill: "rgba(115,191,105,.9)", class: "lk-chunk", style: `transition-delay:${(i * 0.02).toFixed(2)}s` }));
      }
      for (let i = 0; i < 14; i++) {
        const t = 8 + i * 16;
        const y = 302 + (i % 4) * 14;
        after.append(s("circle", { cx: x(t), cy: y, r: 5, fill: "#6e9fff", class: "lk-req", style: `transition-delay:${(0.8 + i * 0.05).toFixed(2)}s` }));
      }
      after.append(s("text", { x: x(150), y: 400, fill: "#73bf69", "font-size": 22, "text-anchor": "middle", class: "mono lk-req", text: "~460 holds per shard: 24 µs average, 110 µs max" }));
      svg.append(before, after);
      el.append(svg);
      el.append(h("style", {}, `
        .lk-before, .lk-after { opacity: 0; transition: opacity .5s; }
        .locks.s0 .lk-before { opacity: 1; }
        .locks.s1 .lk-after { opacity: 1; }
        .lk-hold { transform-origin: ${X0}px 0; transform: scaleX(0); transition: transform 1.2s cubic-bezier(.4,0,.2,1); }
        .locks.s0 .lk-hold { transform: none; }
        .lk-holdtxt, .lk-wait { opacity: 0; transition: opacity .5s 1s; }
        .locks.s0 .lk-holdtxt, .locks.s0 .lk-wait { opacity: 1; }
        .lk-chunk, .lk-req { opacity: 0; transition: opacity .3s; }
        .locks.s1 .lk-chunk, .locks.s1 .lk-req { opacity: 1; }
      `));
      el.classList.add("locks");
    },
    render(el, step) {
      el.classList.toggle("s0", step >= 0);
      el.classList.toggle("s1", step >= 1);
    },
  };

  // ------------------------------------------------------------------ PR timeline
  A.timeline = {
    init(el) {
      const ev = JSON.parse(el.dataset.events);
      const svg = s("svg", { viewBox: "0 0 1440 640", width: "100%" });
      const X0 = 160, X1 = 1290, Y = 330;
      // Events are spaced evenly, not by date: the last months are too dense for a linear time axis.
      const step = (X1 - X0) / (ev.length - 1);
      const xi = (i) => X0 + i * step;
      svg.append(s("line", { x1: 20, y1: Y, x2: 1420, y2: Y, stroke: "url(#tlg)", "stroke-width": 5, "stroke-linecap": "round", class: "tl-axis", "stroke-dasharray": 1400, "stroke-dashoffset": 1400 }));
      const defs = s("defs");
      const lg = s("linearGradient", { id: "tlg", x1: 0, x2: 1, y1: 0, y2: 0 });
      lg.append(s("stop", { offset: "0", "stop-color": "#f05a28" }), s("stop", { offset: "1", "stop-color": "#fbca0a" }));
      defs.append(lg);
      svg.append(defs);
      ev.forEach((e, i) => {
        if (i > 0 && e.d.slice(0, 4) !== ev[i - 1].d.slice(0, 4)) {
          const yx = xi(i) - step / 2;
                    svg.append(s("rect", { x: yx - 34, y: Y - 15, width: 68, height: 30, rx: 8, fill: "#0b0c0e", stroke: "#5a5f6b" }));
          svg.append(s("text", { x: yx, y: Y + 7, fill: "#ccccdc", "font-size": 19, "text-anchor": "middle", class: "mono", text: e.d.slice(0, 4) }));
        }
      });
      const lanes = [-1, 1, -2, 2];
      ev.forEach((e, i) => {
        const l = lanes[i % 4];
        const up = l < 0;
        const lane = Math.abs(l);
        const ly = up ? Y - 70 - (lane - 1) * 110 : Y + 80 + (lane - 1) * 110;
        const x = xi(i);
        const g = s("g", { class: "tl-ev", style: `animation-delay:${(0.4 + i * 0.12).toFixed(2)}s` });
        const color = e.c || "#ff8833";
        g.append(s("line", { x1: x, y1: Y, x2: x, y2: up ? ly + 36 : ly - 26, stroke: color, "stroke-width": 1.5, opacity: 0.6 }));
        g.append(s("circle", { cx: x, cy: Y, r: 9, fill: color }));
        g.append(s("text", { x, y: up ? ly - 22 : ly, fill: "#fff", "font-size": 21, "font-weight": 650, "text-anchor": "middle", text: e.t }));
        g.append(s("text", { x, y: up ? ly + 4 : ly + 26, fill: color, "font-size": 17, "text-anchor": "middle", class: "mono", text: e.s }));
        g.append(s("text", { x, y: up ? ly + 26 : ly + 48, fill: "#6c6f80", "font-size": 15, "text-anchor": "middle", class: "mono", text: e.d.slice(0, 7) }));
        svg.append(g);
      });
      el.append(svg);
      el.append(h("style", {}, `
        section.present .tl-axis { animation: tl-draw 1.4s cubic-bezier(.4,0,.2,1) forwards; }
        @keyframes tl-draw { to { stroke-dashoffset: 0; } }
        .tl-ev { opacity: 0; }
        section.present .tl-ev { animation: tl-pop .5s cubic-bezier(.3,1.5,.5,1) both; }
        @keyframes tl-pop { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
      `));
    },
    render() {},
  };

  // ------------------------------------------------------------------ helpers
  function mulberry(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function bars(el) {
    if (el._built) return;
    el._built = true;
    const data = JSON.parse(el.dataset.bars);
    const log = el.dataset.log === "1";
    const max = Math.max(...data.map((d) => d.v));
    const min = Math.min(...data.map((d) => d.v));
    for (const d of data) {
      let pct = (d.v / max) * 100;
      if (log) {
        const lo = Math.log10(min) - 0.6;
        pct = ((Math.log10(d.v) - lo) / (Math.log10(max) - lo)) * 100;
      }
      const fill = h("div", { class: "bar-fill " + (d.c || ""), "data-pct": pct.toFixed(2) }, h("span", { class: "bar-val" }, d.l));
      el.append(h("div", { class: "bar-row" }, h("div", { class: "bar-label" }, d.n), h("div", { class: "bar-track" }, fill)));
    }
  }

  function countUp(el) {
    const target = +el.dataset.count;
    const dur = 1400;
    const start = performance.now();
    const fmt = (n) => (el.dataset.fmt === "plain" ? String(n) : n.toLocaleString("en-US"));
    if (document.documentElement.classList.contains("shot")) {
      el.textContent = (el.dataset.prefix || "") + fmt(target) + (el.dataset.suffix || "");
      return;
    }
    function tick(t) {
      const p = Math.min(1, (t - start) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      el.textContent = (el.dataset.prefix || "") + fmt(Math.round(target * e)) + (el.dataset.suffix || "");
      if (p < 1 && el._run === start) requestAnimationFrame(tick);
    }
    el._run = start;
    requestAnimationFrame(tick);
  }

  // ------------------------------------------------------------------ wiring
  function prepare() {
    document.querySelectorAll("[data-anim]").forEach((el) => {
      // Steps get explicit indexes: reveal puts fragments without an index after the indexed ones,
      // so other fragments of the slide must have an index too, data-fragment-index >= steps.
      const n = +el.dataset.steps || 0;
      const sec = el.closest("section");
      for (let i = 0; i < n; i++) sec.append(h("span", { class: "fragment step", "data-fragment-index": String(i) }));
    });
    document.querySelectorAll(".bars").forEach(bars);
  }

  function update(sec) {
    if (!sec) return;
    const step = sec.querySelectorAll(".fragment.step.visible").length;
    sec.querySelectorAll("[data-anim]").forEach((el) => {
      const a = A[el.dataset.anim];
      if (!a) return;
      if (!el._inited) {
        a.init(el);
        el._inited = true;
      }
      if (el._last !== step) {
        el._last = step;
        a.render(el, step);
      }
    });
  }

  function enter(sec) {
    sec.querySelectorAll(".bars").forEach((b) => {
      b.classList.remove("go");
      b.querySelectorAll(".bar-fill").forEach((f) => (f.style.width = "0"));
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          b.classList.add("go");
          b.querySelectorAll(".bar-fill").forEach((f) => (f.style.width = f.dataset.pct + "%"));
        })
      );
    });
    sec.querySelectorAll("[data-count]").forEach(countUp);
    sec.querySelectorAll("[data-anim]").forEach((el) => (el._last = undefined));
    update(sec);
  }

  // prepare must run before Reveal.initialize, so that reveal counts the step fragments.
  // hook runs after it.
  window.DeckWire = {
    prepare,
    hook(Reveal) {
      Reveal.on("slidechanged", (e) => enter(e.currentSlide));
      Reveal.on("fragmentshown", () => update(Reveal.getCurrentSlide()));
      Reveal.on("fragmenthidden", () => update(Reveal.getCurrentSlide()));
      enter(Reveal.getCurrentSlide());
    },
  };
})();
