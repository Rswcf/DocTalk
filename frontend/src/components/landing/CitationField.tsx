"use client";

import { useEffect, useRef } from 'react';
import { CITED, PARAGRAPHS } from './citationFieldContent';

/**
 * The landing hero's citation field: a real document page, set as text, in
 * low light. A lamp scans down the page, stops on the cited sentence, a
 * highlighter draws across it and a margin badge pops. That is the product in
 * one moment: every answer cites the exact page.
 *
 * Ported from design-explorations/2026-09-21-citation-field/citation-field.js
 * (plan .collab/plans/2026-09-21-landing-night.md §4). Differences from the
 * prototype, all deliberate:
 *  - No colour or font literal. Colours come from the `--ed-*` tokens and the
 *    font from the canvas's own computed `font-family` (`var(--dt-body)`, so
 *    next/font's generated family name). A test forbids hex literals here.
 *  - The loop stops. It runs until the citation is marked, draws one final
 *    frame and cancels; only a fine pointer over the field restarts it, and it
 *    stops again when the cursor lamp has faded. The prototype's ambient
 *    "breathing" is gone: it redrew the whole field sixty times a second
 *    forever.
 *  - The clock starts the first time the field is on screen.
 *  - `prefers-reduced-motion` and `?still` (screenshots, verification) draw
 *    the finished frame only.
 *
 * Rendering: all text is drawn once to an offscreen "ink" layer. Each frame
 * draws that layer dim, then again masked by the lamp's radial gradient
 * (destination-in), so light falls only where there is ink.
 *
 * The canvas is decoration: its wrapper is aria-hidden, and HeroSection
 * carries the real text (the claim, the answer card, an sr-only description).
 */

export interface CitationSpan {
  x1: number;
  x2: number;
  top: number;
  bottom: number;
}

export interface CitationFieldLayout {
  width: number;
  height: number;
  /** Vertical centre of the cited lines, in canvas CSS px. */
  citedY: number;
  /** One box per highlighted line, in canvas CSS px. */
  spans: CitationSpan[];
  /** Left edge of the text column (the highlight's left edge), canvas CSS px. */
  textLeft: number;
}

export interface CitationFieldSettings {
  fontSize: number;
  titleFontSize: number;
  lineHeight: number;
  paraGap: number;
  /** Text inset from the canvas edges; the margin badge sits inside it. */
  pad: number;
  /** Tile the page to fill a tall field. */
  repeat: number;
  /** Repeats after the first omit this many leading paragraphs (title, dateline). */
  repeatSkip: number;
  /** Which repeat carries the lit citation. */
  occurrence: number;
  /** 0..1: slide the text so the citation sits at this fraction of the height. */
  focusY: number;
  /**
   * If set, overrides focusY: the top of the first highlighted line sits this
   * many px from the canvas top. HeroSection derives it from the claim's
   * measured bottom, so the passage follows the claim at every viewport.
   */
  anchorTop?: number;
  dimAlpha: number;
  litAlpha: number;
  lampRadius: number;
  /** Additive warm light around the lamp, in the evidence colour. */
  bloomAlpha: number;
  bloomRadius: number;
  cursorRadius: number;
  cursorAlpha: number;
  /** ms before the scan begins, then the scan and the highlighter durations. */
  start: number;
  scanDur: number;
  markDur: number;
}

interface Props {
  settings: CitationFieldSettings;
  onLayout?: (layout: CitationFieldLayout) => void;
  /** Fires once, when the highlighter has finished and the badge is up. */
  onCited?: () => void;
}

type Rgb = [number, number, number];

interface Word {
  text: string;
  x: number;
  y: number;
  w: number;
  font: string;
  cited: boolean;
}

interface Span {
  y: number;
  x1: number;
  x2: number;
  from: number;
  to: number;
}

const ease = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
const rgba = ([r, g, b]: Rgb, a: number) => `rgba(${r}, ${g}, ${b}, ${a})`;

/** Begin a rounded-rect path; square corners where roundRect is missing (Safari < 16). */
function roundedRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  if (typeof c.roundRect === 'function') c.roundRect(x, y, w, h, r);
  else c.rect(x, y, w, h);
}

/** A token's colour as rgb. Tokens are hex today; rgb()/rgba() also parse. */
function readColour(style: CSSStyleDeclaration, name: string): Rgb {
  const value = style.getPropertyValue(name).trim();
  if (value.startsWith('#')) {
    let hex = value.slice(1);
    if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
    const n = parseInt(hex.slice(0, 6), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const parts = value.match(/\d+(\.\d+)?/g);
  if (parts && parts.length >= 3) return [Number(parts[0]), Number(parts[1]), Number(parts[2])];
  return [128, 128, 128];
}

export default function CitationField({ settings, onLayout, onCited }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // The engine lives in one effect for the component's lifetime; it reads the
  // latest props through refs, so a settings change re-lays out the field
  // without tearing down the animation.
  const settingsRef = useRef(settings);
  const onLayoutRef = useRef(onLayout);
  const onCitedRef = useRef(onCited);
  const relayoutRef = useRef<(() => void) | null>(null);
  onLayoutRef.current = onLayout;
  onCitedRef.current = onCited;

  useEffect(() => {
    settingsRef.current = settings;
    relayoutRef.current?.();
  }, [settings]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const ink = document.createElement('canvas');
    const tmp = document.createElement('canvas');
    const ictx = ink.getContext('2d');
    const tctx = tmp.getContext('2d');
    if (!ctx || !ictx || !tctx) return;

    const still =
      /[?&]still\b/.test(window.location.search) ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer = window.matchMedia('(pointer: fine)').matches;

    let alive = true;
    let started = false;
    let finished = false;
    let visible = true;
    let raf = 0;
    let t0: number | null = null;
    let W = 0;
    let H = 0;
    let dpr = 1;
    let offsetY = 0;
    let words: Word[] = [];
    let spans: Span[] = [];
    let cited: { cx: number; cy: number; first: Span } | null = null;
    let fonts = { body: '', title: '', badge: '' };
    let colours = { ink: [128, 128, 128] as Rgb, evidence: [128, 128, 128] as Rgb, soft: [128, 128, 128] as Rgb };
    const cursor = { x: 0, y: 0, tx: 0, ty: 0, a: 0, ta: 0 };

    function readTheme() {
      const style = getComputedStyle(canvas!);
      const s = settingsRef.current;
      const family = style.fontFamily;
      fonts = {
        body: `${s.fontSize}px ${family}`,
        title: `600 ${s.titleFontSize}px ${family}`,
        badge: `600 12px ${family}`,
      };
      colours = {
        ink: readColour(style, '--ed-ink'),
        evidence: readColour(style, '--ed-evidence'),
        soft: readColour(style, '--ed-evidence-soft'),
      };
    }

    function buildLayout() {
      const s = settingsRef.current;
      const paras: { text: string; title: boolean; rep: number }[] = [];
      for (let r = 0; r < s.repeat; r += 1) {
        PARAGRAPHS.forEach((text, i) => {
          if (r > 0 && i < s.repeatSkip) return;
          paras.push({ text, title: i === 0, rep: r });
        });
      }
      const maxX = W - s.pad;
      words = [];
      let y = s.pad + s.lineHeight * 0.8;
      for (const p of paras) {
        const font = p.title ? fonts.title : fonts.body;
        ictx!.font = font;
        const space = ictx!.measureText(' ').width;
        const citedStart = p.rep === s.occurrence ? p.text.indexOf(CITED) : -1;
        const citedEnd = citedStart < 0 ? -1 : citedStart + CITED.length;
        let x = s.pad;
        let idx = 0;
        for (const w of p.text.split(' ')) {
          const ww = ictx!.measureText(w).width;
          if (x + ww > maxX && x > s.pad) {
            x = s.pad;
            y += s.lineHeight;
          }
          const start = idx;
          const end = idx + w.length;
          words.push({ text: w, x, y, w: ww, font, cited: citedStart >= 0 && start < citedEnd && end > citedStart });
          x += ww + space;
          idx = end + 1;
        }
        y += s.lineHeight + s.paraGap;
      }

      // Cited words grouped into one span per line, in reading order; each
      // span knows which fraction of the highlighter's stroke it takes.
      spans = [];
      for (const w of words) {
        if (!w.cited) continue;
        const last = spans[spans.length - 1];
        if (last && last.y === w.y) last.x2 = w.x + w.w;
        else spans.push({ y: w.y, x1: w.x, x2: w.x + w.w, from: 0, to: 0 });
      }
      const total = spans.reduce((sum, sp) => sum + (sp.x2 - sp.x1), 0) || 1;
      let acc = 0;
      for (const sp of spans) {
        sp.from = acc / total;
        acc += sp.x2 - sp.x1;
        sp.to = acc / total;
      }
      cited = spans.length
        ? {
            cx: (Math.min(...spans.map((sp) => sp.x1)) + Math.max(...spans.map((sp) => sp.x2))) / 2,
            cy: (spans[0].y + spans[spans.length - 1].y) / 2 - s.lineHeight * 0.3,
            first: spans[0],
          }
        : null;
      if (!cited) offsetY = 0;
      else if (s.anchorTop != null) offsetY = Math.round(s.anchorTop - (cited.first.y - s.lineHeight * 0.72));
      else offsetY = Math.round(s.focusY * H - cited.cy);
    }

    function paintInk() {
      ink.width = tmp.width = Math.round(W * dpr);
      ink.height = tmp.height = Math.round(H * dpr);
      ictx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      ictx!.clearRect(0, 0, W, H);
      ictx!.fillStyle = rgba(colours.ink, 1);
      ictx!.textBaseline = 'alphabetic';
      const lh = settingsRef.current.lineHeight;
      for (const w of words) {
        const y = w.y + offsetY;
        if (y < -lh || y > H + lh) continue;
        ictx!.font = w.font;
        ictx!.fillText(w.text, w.x, y);
      }
    }

    function lampPass(x: number, y: number, radius: number, alpha: number) {
      tctx!.setTransform(1, 0, 0, 1, 0, 0);
      tctx!.globalCompositeOperation = 'source-over';
      tctx!.clearRect(0, 0, tmp.width, tmp.height);
      tctx!.drawImage(ink, 0, 0);
      tctx!.globalCompositeOperation = 'destination-in';
      // destination-in keeps only the alpha of these stops; their colour is
      // discarded, so the black here is not a colour to tokenise.
      const g = tctx!.createRadialGradient(x * dpr, y * dpr, 0, x * dpr, y * dpr, radius * dpr);
      g.addColorStop(0, 'rgba(0, 0, 0, 1)');
      g.addColorStop(0.55, 'rgba(0, 0, 0, 0.55)');
      g.addColorStop(1, 'rgba(0, 0, 0, 0)');
      tctx!.fillStyle = g;
      tctx!.fillRect(0, 0, tmp.width, tmp.height);
      tctx!.globalCompositeOperation = 'source-over';
      ctx!.globalAlpha = alpha;
      ctx!.drawImage(tmp, 0, 0, W, H);
      ctx!.globalAlpha = 1;
    }

    function draw(t: number) {
      const s = settingsRef.current;
      ctx!.clearRect(0, 0, W, H);
      if (!cited) {
        ctx!.globalAlpha = s.dimAlpha;
        ctx!.drawImage(ink, 0, 0, W, H);
        ctx!.globalAlpha = 1;
        return;
      }
      const fade = still ? 1 : ease(t / 600);
      const scan = still ? 1 : ease((t - s.start) / s.scanDur);
      const mark = still ? 1 : ease((t - s.start - s.scanDur * 0.85) / s.markDur);
      const cy = cited.cy + offsetY;
      const top = s.pad + offsetY + 20;
      const lampY = top + (cy - top) * scan;
      const lampX = cited.cx;
      const radius = s.lampRadius * (1.25 - 0.25 * scan);

      if (s.bloomAlpha > 0) {
        ctx!.globalCompositeOperation = 'lighter';
        const g = ctx!.createRadialGradient(lampX, lampY, 0, lampX, lampY, s.bloomRadius);
        g.addColorStop(0, rgba(colours.evidence, s.bloomAlpha * fade));
        g.addColorStop(1, rgba(colours.evidence, 0));
        ctx!.fillStyle = g;
        ctx!.fillRect(0, 0, W, H);
        ctx!.globalCompositeOperation = 'source-over';
      }

      ctx!.globalAlpha = s.dimAlpha * fade;
      ctx!.drawImage(ink, 0, 0, W, H);
      ctx!.globalAlpha = 1;
      lampPass(lampX, lampY, radius, s.litAlpha * fade);

      if (cursor.a > 0.01) lampPass(cursor.x, cursor.y, s.cursorRadius, s.cursorAlpha * cursor.a);

      // The highlighter, then the cited words in full ink on top of it.
      const h = s.lineHeight * 0.92;
      for (const sp of spans) {
        const local = Math.min(1, Math.max(0, (mark - sp.from) / Math.max(1e-6, sp.to - sp.from)));
        if (local <= 0) continue;
        const y = sp.y + offsetY - s.lineHeight * 0.72;
        // The soft evidence fill, warmed with the evidence colour itself: on
        // its own the dark-theme fill barely separates from the stage.
        roundedRect(ctx!, sp.x1 - 3, y, (sp.x2 - sp.x1 + 6) * local, h, 3);
        ctx!.fillStyle = rgba(colours.soft, 1);
        ctx!.fill();
        ctx!.fillStyle = rgba(colours.evidence, 0.16);
        ctx!.fill();
        // A hairline of the evidence colour under the stroke, so the mark
        // reads as a highlight and not as a text selection on a dark ground.
        ctx!.fillStyle = rgba(colours.evidence, 0.9);
        ctx!.fillRect(sp.x1 - 3, y + h - 1, (sp.x2 - sp.x1 + 6) * local, 1);
      }
      ctx!.save();
      ctx!.globalAlpha = mark;
      ctx!.fillStyle = rgba(colours.ink, 1);
      for (const w of words) {
        if (!w.cited) continue;
        ctx!.font = w.font;
        ctx!.fillText(w.text, w.x, w.y + offsetY);
      }
      ctx!.restore();

      // The margin badge pops as the highlighter finishes: a margin note,
      // level with the first cited line.
      const pop = still ? 1 : ease((mark - 0.7) / 0.3);
      if (pop > 0.01) {
        const f = cited.first;
        ctx!.font = fonts.badge;
        const bw = Math.max(20, ctx!.measureText('1').width + 10);
        const bh = 20;
        const bx = Math.max(4, s.pad - bw - 12);
        const by = f.y + offsetY - s.lineHeight * 0.72 + (h - bh) / 2;
        ctx!.save();
        ctx!.translate(bx + bw / 2, by + bh / 2);
        ctx!.scale(0.6 + 0.4 * pop, 0.6 + 0.4 * pop);
        ctx!.globalAlpha = pop;
        ctx!.fillStyle = rgba(colours.soft, 1);
        ctx!.strokeStyle = rgba(colours.evidence, 1);
        ctx!.lineWidth = 1;
        roundedRect(ctx!, -bw / 2, -bh / 2, bw, bh, 5);
        ctx!.fill();
        ctx!.stroke();
        ctx!.fillStyle = rgba(colours.evidence, 1);
        ctx!.textAlign = 'center';
        ctx!.textBaseline = 'middle';
        ctx!.fillText('1', 0, 1);
        ctx!.restore();
      }

      if (mark >= 1 && !finished) {
        finished = true;
        onCitedRef.current?.();
      }
    }

    function reportLayout() {
      const s = settingsRef.current;
      if (!cited || !onLayoutRef.current) return;
      onLayoutRef.current({
        width: W,
        height: H,
        citedY: cited.cy + offsetY,
        spans: spans.map((sp) => {
          const top = sp.y + offsetY - s.lineHeight * 0.72;
          return { x1: sp.x1 - 3, x2: sp.x2 + 3, top, bottom: top + s.lineHeight * 0.92 };
        }),
        textLeft: s.pad - 3,
      });
    }

    function frame(now: number) {
      raf = 0;
      if (!alive || !visible) return;
      if (t0 === null) t0 = now;
      cursor.x += (cursor.tx - cursor.x) * 0.14;
      cursor.y += (cursor.ty - cursor.y) * 0.14;
      cursor.a += (cursor.ta - cursor.a) * 0.08;
      const cursorLive = cursor.ta > 0 || cursor.a > 0.01;
      if (!cursorLive) cursor.a = 0;
      draw(still ? 1e9 : now - t0);
      if (!finished || cursorLive) raf = requestAnimationFrame(frame);
    }

    function kick() {
      if (alive && started && visible && !raf) raf = requestAnimationFrame(frame);
    }

    function layout() {
      W = canvas!.clientWidth;
      H = canvas!.clientHeight;
      if (W < 1 || H < 1) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas!.width = Math.round(W * dpr);
      canvas!.height = Math.round(H * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      readTheme();
      buildLayout();
      paintInk();
      reportLayout();
      if (!cited) {
        // The sentence is not in the laid-out text (a content edit, or an
        // occurrence beyond the repeats): show the page, release the card,
        // and never start a loop with nothing to animate.
        draw(1e9);
        if (!finished) {
          finished = true;
          onCitedRef.current?.();
        }
        return;
      }
      if (still || finished) draw(1e9);
      else kick();
    }
    relayoutRef.current = () => {
      if (started) layout();
    };

    function start() {
      if (!alive || started) return;
      started = true;
      layout();
    }

    // The cursor lamp is lit only while the pointer moves. A pointer parked
    // over the field would otherwise hold the loop at full frame rate
    // forever (review 2026-09-21, MAJOR-2): after a short rest the lamp
    // fades out and the loop stops with it.
    let idle = 0;
    const onMove = (e: PointerEvent) => {
      cursor.tx = e.offsetX;
      cursor.ty = e.offsetY;
      if (cursor.a < 0.01) {
        cursor.x = cursor.tx;
        cursor.y = cursor.ty;
      }
      cursor.ta = 1;
      window.clearTimeout(idle);
      idle = window.setTimeout(() => {
        cursor.ta = 0;
        kick();
      }, 1200);
      kick();
    };
    const onLeave = () => {
      window.clearTimeout(idle);
      cursor.ta = 0;
    };
    if (finePointer && !still) {
      canvas.addEventListener('pointermove', onMove);
      canvas.addEventListener('pointerleave', onLeave);
    }

    const resizeObserver = new ResizeObserver(() => {
      if (started) layout();
    });
    resizeObserver.observe(canvas);
    const visibilityObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) kick();
    });
    visibilityObserver.observe(canvas);

    // A face used only inside a canvas is not "in use" by the DOM, so load it
    // explicitly. Never wait on the network indefinitely: start after at most
    // 1.2s in whatever face is available, and lay out again when the real one
    // arrives.
    readTheme();
    const fontsLoaded = Promise.all(
      [fonts.body, fonts.title, fonts.badge].map((f) => document.fonts.load(f).catch(() => null)),
    ).then(() => document.fonts.ready);
    const timer = window.setTimeout(start, 1200);
    fontsLoaded.then(() => {
      if (!alive) return;
      window.clearTimeout(timer);
      if (started) layout();
      else start();
    });

    return () => {
      alive = false;
      relayoutRef.current = null;
      window.clearTimeout(timer);
      window.clearTimeout(idle);
      if (raf) cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  // letter-spacing 0: a canvas in the DOM picks up the page's CSS
  // letter-spacing and the offscreen layers do not, so words laid out on one
  // and redrawn on the other would drift apart glyph by glyph.
  return <canvas ref={canvasRef} className="ed-night-canvas" style={{ letterSpacing: 0 }} />;
}
