/*
 * Citation field — DocTalk's signature visual, shared by the three 2026-09-21
 * prototypes. A real document page, set as text, sits in low light. A lamp
 * scans down the page, stops on the cited sentence, and a highlighter draws
 * across it. That is the product in one moment: every answer cites the exact
 * page.
 *
 * Every word is verbatim from page 1 of backend/seed_data/alphabet-earnings.pdf.
 *
 * Rendering: all text is drawn once to an offscreen "ink" layer. Each frame
 * draws that layer dim, then again masked by the lamp's radial gradient
 * (destination-in), so light falls only where there is ink — no per-glyph work.
 */
(function () {
  // `?still` renders the finished frame with no animation — the same path as
  // prefers-reduced-motion. Used for poster frames and for headless screenshots,
  // where requestAnimationFrame does not run under a virtual-time budget.
  const still = /[?&]still\b/.test(location.search);
  const reduce = still || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(pointer: fine)').matches;

  const PARAGRAPHS = [
    'Alphabet Announces Fourth Quarter and Fiscal Year 2025 Results',
    'MOUNTAIN VIEW, Calif. – February 4, 2026 – Alphabet Inc. (NASDAQ: GOOG, GOOGL) today announced financial results for the quarter ended December 31, 2025.',
    '• Consolidated Alphabet revenues increased 18%, or 17% in constant currency, to $113.8 billion, reflecting strong momentum across the business and acceleration in growth in both Google Services and Google Cloud.',
    '• Google Services revenues increased 14% to $95.9 billion, led by 17% growth in Google Search & other, 17% in Google subscriptions, platforms, and devices, and 9% in YouTube ads.',
    '• YouTube revenue across ads and subscriptions exceeded $60 billion for the full year 2025.',
    '• Google Cloud saw a continued increase in customer demand as revenues increased 48% to $17.7 billion, led by an increase in Google Cloud Platform (GCP) across enterprise AI Infrastructure and enterprise AI Solutions, as well as core GCP products.',
    '• Consolidated Alphabet operating income increased 16% and operating margin was 31.6%. Operating income included a $2.1 billion employee compensation charge for Waymo.',
    '• Net income increased 30% and EPS increased 31% to $2.82.',
    'Sundar Pichai, CEO of Alphabet and Google, said: “It was a tremendous quarter for Alphabet and annual revenues exceeded $400 billion for the first time. The launch of Gemini 3 was a major milestone and we have great momentum. Our first party models, like Gemini, now process over 10 billion tokens per minute via direct API use by our customers, and the Gemini App has grown to over 750 million monthly active users. Search saw more usage than ever before, with AI continuing to drive an expansionary moment.',
    'We continue to drive strong growth across the business. YouTube’s annual revenues surpassed $60 billion across ads and subscriptions; we now have over 325 million paid subscriptions across consumer services, led by strong adoption for Google One and YouTube Premium. And Google Cloud ended 2025 at an annual run rate of over $70 billion, representing a wide breadth of customers, driven by demand for AI products.',
    'We’re seeing our AI investments and infrastructure drive revenue and growth across the board. To meet customer demand and capitalize on the growing opportunities we have ahead of us, our 2026 CapEx investments are anticipated to be in the range of $175 to $185 billion.”',
    'Q4 2025 Financial Highlights',
    'The following table summarizes our consolidated financial results for the quarter and fiscal year ended December 31, 2024 and 2025 (in millions, except for per share information and percentages).',
  ];
  const CITED =
    'To meet customer demand and capitalize on the growing opportunities we have ahead of us, our 2026 CapEx investments are anticipated to be in the range of $175 to $185 billion.';

  const ease = (t) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

  function mount(canvas, cfg) {
    const c = Object.assign(
      {
        font: '15px "IBM Plex Sans", system-ui, sans-serif',
        titleFont: null, // first paragraph; null = same as font
        lineHeight: 26,
        paraGap: 12,
        pad: 40,
        repeat: 1, // tile the page to fill tall full-bleed areas
        occurrence: 0, // which repeat carries the lit citation
        focusY: null, // 0..1: slide the text so the citation sits here
        ink: '#20211e',
        dimAlpha: 0.13,
        litAlpha: 0.95,
        lampRadius: 360,
        bloom: null, // { color: 'rgba(r,g,b,', alpha, radius, mode }
        // Shadow on the paper outside the lamp: the page is dim because it is
        // unlit, not because its ink is faded. { color: 'rgba(r,g,b,', alpha, radius, inner }
        shade: null,
        repeatSkip: 0, // repeats after the first omit this many leading paragraphs (title, dateline)
        highlight: 'rgba(255, 196, 0, 0.32)',
        citedInk: '#20211e',
        badge: { bg: '#fff0c2', fg: '#6b4400', border: '#e6c56a', label: '1', font: '600 12px "IBM Plex Sans", sans-serif' },
        cursorLamp: true,
        cursorRadius: 170,
        cursorAlpha: 0.55,
        start: 250, // ms before the scan begins
        scanDur: 1500,
        markDur: 900,
      },
      cfg || {},
    );

    // A canvas in the DOM picks up the page's CSS letter-spacing; the offscreen
    // layers do not. Words laid out on one and redrawn on the other would then
    // drift apart glyph by glyph, so pin the visible canvas to zero.
    canvas.style.letterSpacing = '0px';
    const ctx = canvas.getContext('2d');
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    const ink = document.createElement('canvas');
    const tmp = document.createElement('canvas');
    const ictx = ink.getContext('2d');
    const tctx = tmp.getContext('2d');
    let W = 0, H = 0, dpr = 1, words = [], spans = [], cited = null, offsetY = 0, totalH = 0;
    let t0 = null, raf = 0, visible = true;
    const cursor = { x: 0, y: 0, tx: 0, ty: 0, a: 0, ta: 0 };

    function buildLayout() {
      const paras = [];
      for (let r = 0; r < c.repeat; r++) {
        PARAGRAPHS.forEach((p, i) => { if (!(r > 0 && i < c.repeatSkip)) paras.push({ text: p, title: i === 0, rep: r }); });
      }
      const maxX = W - c.pad;
      words = [];
      let y = c.pad + c.lineHeight * 0.8;
      paras.forEach((p) => {
        const font = p.title && c.titleFont ? c.titleFont : c.font;
        ictx.font = font;
        const space = ictx.measureText(' ').width;
        const citedStart = p.rep === c.occurrence ? p.text.indexOf(CITED) : -1;
        const citedEnd = citedStart < 0 ? -1 : citedStart + CITED.length;
        let x = c.pad, idx = 0;
        p.text.split(' ').forEach((w) => {
          const ww = ictx.measureText(w).width;
          if (x + ww > maxX && x > c.pad) { x = c.pad; y += c.lineHeight; }
          const s = idx, e = idx + w.length;
          words.push({ text: w, x, y, w: ww, font, cited: citedStart >= 0 && s < citedEnd && e > citedStart });
          x += ww + space;
          idx = e + 1;
        });
        y += c.lineHeight + c.paraGap;
      });
      totalH = y;

      // group cited words into per-line spans, in reading order
      spans = [];
      words.filter((w) => w.cited).forEach((w) => {
        const last = spans[spans.length - 1];
        if (last && last.y === w.y) last.x2 = w.x + w.w;
        else spans.push({ y: w.y, x1: w.x, x2: w.x + w.w });
      });
      const lens = spans.map((s) => s.x2 - s.x1);
      const total = lens.reduce((a, b) => a + b, 0) || 1;
      let acc = 0;
      spans.forEach((s, i) => { s.from = acc / total; acc += lens[i]; s.to = acc / total; });
      cited = spans.length
        ? { cx: (Math.min(...spans.map((s) => s.x1)) + Math.max(...spans.map((s) => s.x2))) / 2,
            cy: (spans[0].y + spans[spans.length - 1].y) / 2 - c.lineHeight * 0.3,
            first: spans[0] }
        : null;
      offsetY = c.focusY != null && cited ? Math.round(c.focusY * H - cited.cy) : 0;
    }

    function paintInk() {
      ink.width = tmp.width = Math.round(W * dpr);
      ink.height = tmp.height = Math.round(H * dpr);
      ictx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ictx.clearRect(0, 0, W, H);
      ictx.fillStyle = c.ink;
      ictx.textBaseline = 'alphabetic';
      words.forEach((w) => {
        const y = w.y + offsetY;
        if (y < -c.lineHeight || y > H + c.lineHeight) return;
        ictx.font = w.font;
        ictx.fillText(w.text, w.x, y);
      });
    }

    function resize() {
      // Layout size, not getBoundingClientRect(): that includes transforms, so
      // a rotated sheet or a window mid-entrance would be laid out at its
      // bounding-box size and then squeezed back into the real one.
      W = Math.max(1, canvas.clientWidth); H = Math.max(1, canvas.clientHeight);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildLayout();
      paintInk();
      if (reduce) draw(1e9);
      canvas.dispatchEvent(new CustomEvent('layout'));
    }

    function lampPass(x, y, radius, alpha) {
      tctx.setTransform(1, 0, 0, 1, 0, 0);
      tctx.globalCompositeOperation = 'source-over';
      tctx.clearRect(0, 0, tmp.width, tmp.height);
      tctx.drawImage(ink, 0, 0);
      tctx.globalCompositeOperation = 'destination-in';
      const g = tctx.createRadialGradient(x * dpr, y * dpr, 0, x * dpr, y * dpr, radius * dpr);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(0.55, 'rgba(0,0,0,0.55)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      tctx.fillStyle = g;
      tctx.fillRect(0, 0, tmp.width, tmp.height);
      tctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = alpha;
      ctx.drawImage(tmp, 0, 0, W, H);
      ctx.globalAlpha = 1;
    }

    function draw(t) {
      ctx.clearRect(0, 0, W, H);
      if (!cited) { ctx.globalAlpha = c.dimAlpha; ctx.drawImage(ink, 0, 0, W, H); ctx.globalAlpha = 1; return; }
      const fade = reduce ? 1 : ease(t / 600);
      const scan = reduce ? 1 : ease((t - c.start) / c.scanDur);
      const mark = reduce ? 1 : ease((t - c.start - c.scanDur * 0.85) / c.markDur);
      const cy = cited.cy + offsetY;
      const lampY = (c.pad + offsetY + 20) + (cy - (c.pad + offsetY + 20)) * scan;
      const lampX = cited.cx;
      const breathe = reduce ? 1 : 1 + 0.035 * Math.sin(t / 900);
      const radius = c.lampRadius * (1.25 - 0.25 * scan) * breathe;

      if (c.bloom) {
        ctx.globalCompositeOperation = c.bloom.mode || 'source-over';
        const g = ctx.createRadialGradient(lampX, lampY, 0, lampX, lampY, c.bloom.radius);
        g.addColorStop(0, c.bloom.color + (c.bloom.alpha * fade) + ')');
        g.addColorStop(1, c.bloom.color + '0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
        ctx.globalCompositeOperation = 'source-over';
      }

      ctx.globalAlpha = c.dimAlpha * fade;
      ctx.drawImage(ink, 0, 0, W, H);
      ctx.globalAlpha = 1;
      lampPass(lampX, lampY, radius, c.litAlpha * fade);

      if (c.cursorLamp && fine && !reduce) {
        cursor.x += (cursor.tx - cursor.x) * 0.14;
        cursor.y += (cursor.ty - cursor.y) * 0.14;
        cursor.a += (cursor.ta - cursor.a) * 0.08;
        if (cursor.a > 0.01) lampPass(cursor.x, cursor.y, c.cursorRadius, c.cursorAlpha * cursor.a);
      }

      if (c.shade) {
        const s = c.shade, R = s.radius * (1.25 - 0.25 * scan) * breathe;
        const g = ctx.createRadialGradient(lampX, lampY, 0, lampX, lampY, R);
        g.addColorStop(0, s.color + '0)');
        g.addColorStop(s.inner != null ? s.inner : 0.3, s.color + '0)');
        g.addColorStop(1, s.color + (s.alpha * fade) + ')');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      }

      // highlighter, then the cited words in full ink on top of it
      spans.forEach((s) => {
        const local = Math.min(1, Math.max(0, (mark - s.from) / Math.max(1e-6, s.to - s.from)));
        if (local <= 0) return;
        const y = s.y + offsetY;
        ctx.fillStyle = c.highlight;
        ctx.beginPath();
        const h = c.lineHeight * 0.92;
        ctx.roundRect(s.x1 - 3, y - c.lineHeight * 0.72, (s.x2 - s.x1 + 6) * local, h, 3);
        ctx.fill();
      });
      ctx.save();
      ctx.globalAlpha = mark;
      ctx.fillStyle = c.citedInk;
      words.forEach((w) => { if (w.cited) { ctx.font = w.font; ctx.fillText(w.text, w.x, w.y + offsetY); } });
      ctx.restore();
      announce(mark);

      const pop = reduce ? 1 : ease((mark - 0.7) / 0.3);
      if (c.badge && pop > 0.01) {
        const b = c.badge, f = cited.first;
        ctx.font = b.font;
        const label = b.label, tw = ctx.measureText(label).width;
        const bw = Math.max(20, tw + 10), bh = 20;
        // In the page margin, level with the first cited line — a margin note.
        // Placing it just left of the first cited word collided with the words
        // before it whenever the citation began mid-line.
        const bx = b.inline ? f.x1 - bw - 9 : Math.max(4, c.pad - bw - 12);
        const by = f.y + offsetY - c.lineHeight * 0.72 + (c.lineHeight * 0.92 - bh) / 2;
        ctx.save();
        ctx.translate(bx + bw / 2, by + bh / 2);
        ctx.scale(0.6 + 0.4 * pop, 0.6 + 0.4 * pop);
        ctx.globalAlpha = pop;
        ctx.fillStyle = b.bg; ctx.strokeStyle = b.border; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(-bw / 2, -bh / 2, bw, bh, 5); ctx.fill(); ctx.stroke();
        ctx.fillStyle = b.fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(label, 0, 1);
        ctx.restore();
      }
    }

    // 'cited' fires once, when the highlighter has finished and the badge is
    // up: the moment the page's answer should appear.
    let announced = false;
    function announce(mark) {
      if (announced || mark < 1) return;
      announced = true;
      canvas.dispatchEvent(new CustomEvent('cited'));
    }

    function loop(now) {
      // The clock starts the first time the field is on screen, so a field
      // below the fold plays its scan when it is scrolled to, not unseen.
      if (visible) {
        if (t0 == null) t0 = now;
        draw(now - t0);
      }
      raf = requestAnimationFrame(loop);
    }

    canvas.addEventListener('pointermove', (e) => {
      cursor.tx = e.offsetX; cursor.ty = e.offsetY; // local, transform-aware
      if (cursor.a < 0.01) { cursor.x = cursor.tx; cursor.y = cursor.ty; }
      cursor.ta = 1;
    });
    canvas.addEventListener('pointerleave', () => { cursor.ta = 0; });

    // Read-only hook for tuning a composition: where the citation actually lands.
    canvas.__citationField = {
      get citedY() { return cited ? cited.cy + offsetY : null; },
      // centre of the margin badge, in canvas coordinates (untransformed)
      get anchor() {
        if (!cited) return null;
        const f = cited.first, bw = 20;
        const x = c.badge && c.badge.inline ? f.x1 - bw / 2 - 9 : Math.max(4, c.pad - bw - 12) + bw / 2;
        return { x, y: f.y + offsetY - c.lineHeight * 0.72 + (c.lineHeight * 0.92) / 2 };
      },
      get citedLines() { return spans.length; },
      get height() { return H; },
      get textHeight() { return totalH; },
    };

    new ResizeObserver(resize).observe(canvas);
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(canvas);
    // Load the canvas fonts explicitly: a face used only inside a canvas is not
    // "in use" by the DOM, so document.fonts.ready alone may resolve before it
    // arrives and the page would be laid out in a fallback face.
    //
    // But never wait on the network indefinitely: a slow or blocked font would
    // otherwise leave a blank sheet. Start after at most 1.2s in whatever face is
    // available, and re-lay-out once the real one arrives.
    const faces = [c.font, c.titleFont, c.badge && c.badge.font].filter(Boolean);
    const fontsLoaded = Promise.all(faces.map((f) => document.fonts.load(f).catch(() => null)))
      .then(() => document.fonts.ready);
    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      resize();
      if (!reduce) raf = requestAnimationFrame(loop);
    };
    Promise.race([fontsLoaded, new Promise((r) => setTimeout(r, 1200))]).then(start);
    fontsLoaded.then(() => { if (started) resize(); else start(); });
  }

  window.CitationField = { mount, CITED };
})();
