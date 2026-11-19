/*!
 * <rosary-builder> - interactive "design your own rosary" web component.
 * No dependencies. Works standalone, in an iframe, or as a Wix Velo Custom Element.
 *
 * Attributes : catalog-url, cta-label, hide-cta
 * Properties : catalog (object), design (read only)
 * Methods    : getDesign(), exportPreview(width), reset(), randomize()
 * Events     : design-change  {design, price}
 *              add-to-cart    {designId, price, currency, summary, design, preview}
 *              (when inside an iframe, add-to-cart is also posted to window.parent)
 */
(() => {
  'use strict';
  if (customElements.get('rosary-builder')) return;

  const SVG_W = 400;
  const SVG_H = 680;
  const STAGE = '#ece4d4';
  const MAX_ZOOM = 5;
  // Each rosary type has its own parts ("roles"), the catalog group each role reads from, its labels and its layout.
  // A role is a tab in the builder; for the rosary the role and the catalog group have the same name.
  const TYPES = {
    rosary: {
      id: 'rosary', label: 'Rosary', short: 'Rosary', sectionKey: 'decades', sectionCount: 5, sectionLabel: 'Decade', tailLabel: 'Tail',
      roles: ['beads', 'heads', 'center', 'cross', 'cord'],
      group: { beads: 'beads', heads: 'heads', center: 'center', cross: 'cross', cord: 'cord' },
      names: { beads: 'Beads', heads: 'Our Father beads', center: 'Centerpiece', cross: 'Crucifix', cord: 'Cord' }
    },
    rope: {
      id: 'rope', label: 'Orthodox Prayer Rope', short: 'Prayer Rope', sectionKey: 'sections', sectionCount: 3, sectionLabel: 'Section', tailLabel: 'Bottom bead',
      roles: ['beads', 'spacers', 'cross', 'tassel', 'cord'],
      group: { beads: 'rope-beads', spacers: 'rope-spacers', cross: 'rope-cross', tassel: 'rope-tassel', cord: 'rope-cord' },
      names: { beads: 'Jesus beads', spacers: 'Spacers', cross: 'Cross', tassel: 'Tassel', cord: 'Cord' }
    }
  };
  // Small line icons for the tabs and the type switch (24x24, drawn with the text colour).
  const ICONS = {
    rosary: '<ellipse cx="12" cy="8.5" rx="6.2" ry="6" stroke-width="2.6" stroke-dasharray="0.01 3.1"/><path d="M12 14.6V17M9.8 20h4.4M12 17v5"/>',
    rope: '<circle cx="12" cy="8" r="6" stroke-width="2.6" stroke-dasharray="0.01 3.1"/><path d="M12 14v2M12 16.5l-3 3.5h6z" stroke-width="1.5"/><path d="M12 19.5v2.5" />',
    beads: '<circle cx="12" cy="12" r="7.5"/><path d="M8.6 9.4a4.4 4.4 0 0 1 3-2.1" stroke-linecap="round"/>',
    heads: '<circle cx="12" cy="12" r="7.5"/><path d="M12 8.2v7.6M8.2 11h7.6"/>',
    center: '<path d="M12 5.2c3.4 0 5.4 2.9 5.4 6.6S15.4 19 12 19s-5.4-3.5-5.4-7.2S8.6 5.2 12 5.2z"/><circle cx="12" cy="3.2" r="1.4"/><path d="M12 9v6M9.6 11.2h4.8"/>',
    cross: '<path d="M12 3v18M7 8.5h10"/>',
    spacers: '<path d="M10 3.5h4v5h5v4h-5v8h-4v-8H5v-4h5z" stroke-linejoin="round"/>',
    tassel: '<path d="M12 2.8v2.6M9.4 5.4h5.2l.8 3.2H8.6zM8.6 8.6L5.8 21h12.4l-2.8-12.4"/><path d="M10.6 12v7M13.4 12v7"/>',
    cord: '<path d="M3 14.5c3-8.5 6-8.5 9 0s6 8.5 9 0"/>'
  };
  const icon = (name) => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>`;
  const ROLE_OF_KIND = { bead: 'beads', head: 'heads', spacer: 'spacers', center: 'center' };
  const DRAFT_KEY = 'rosary-builder-draft-v2';

  /* ------------------------------------------------------------------ catalog */
  // Placeholder catalog. Replace with the client's real items (add `image` to use photos).
  // `extra` is a surcharge charged once per distinct item used in the design.
  const DEFAULT_CATALOG = {
    product: 'wired-rosary',
    version: 1,
    currency: '$',
    basePrice: 19.99,
    groups: {
      beads: {
        label: 'Beads',
        items: [
          { id: 'onyx', name: 'Onyx Black', color: '#1d1d22', finish: 'glass', extra: 0 },
          { id: 'ruby', name: 'Ruby Red', color: '#a3162b', finish: 'glass', extra: 0 },
          { id: 'sapphire', name: 'Sapphire Blue', color: '#1f4aa8', finish: 'glass', extra: 0 },
          { id: 'emerald', name: 'Emerald Green', color: '#14803c', finish: 'glass', extra: 0 },
          { id: 'amethyst', name: 'Amethyst', color: '#6e3aa6', finish: 'glass', extra: 0 },
          { id: 'rose', name: 'Rose Pink', color: '#e58aa6', finish: 'glass', extra: 0 },
          { id: 'amber', name: 'Amber', color: '#d98a1c', finish: 'glass', extra: 0 },
          { id: 'pearl', name: 'Pearl White', color: '#f1ede6', finish: 'pearl', extra: 0 },
          { id: 'olive-wood', name: 'Olive Wood', color: '#b98a4e', finish: 'wood', extra: 0 },
          { id: 'walnut', name: 'Walnut Wood', color: '#5a3a24', finish: 'wood', extra: 0 },
          { id: 'crystal', name: 'Clear Crystal', color: '#d7ecf5', finish: 'glass', extra: 2 },
          { id: 'rose-quartz', name: 'Rose Quartz', color: '#f0b6c4', finish: 'pearl', extra: 4 },
          { id: 'lapis', name: 'Lapis Lazuli', color: '#26408b', finish: 'pearl', extra: 5 }
        ]
      },
      heads: {
        label: 'Our Father Beads',
        items: [
          { id: 'silver', name: 'Silver', color: '#c8cdd6', finish: 'metal', extra: 0 },
          { id: 'gold', name: 'Gold', color: '#d4af37', finish: 'metal', extra: 0 },
          { id: 'black', name: 'Black', color: '#25252a', finish: 'glass', extra: 0 },
          { id: 'red', name: 'Red', color: '#b0182e', finish: 'glass', extra: 0 },
          { id: 'white', name: 'White', color: '#f3efe8', finish: 'pearl', extra: 0 },
          { id: 'wood', name: 'Dark Wood', color: '#4c311d', finish: 'wood', extra: 0 }
        ]
      },
      center: {
        label: 'Centerpiece',
        items: [
          { id: 'round-silver', name: 'Round Medal, Silver', color: '#c8cdd6', finish: 'metal', shape: 'round', extra: 0 },
          { id: 'round-gold', name: 'Round Medal, Gold', color: '#d4af37', finish: 'metal', shape: 'round', extra: 2 },
          { id: 'oval-silver', name: 'Oval Medal, Silver', color: '#c8cdd6', finish: 'metal', shape: 'oval', extra: 0 },
          { id: 'heart-gold', name: 'Heart, Gold', color: '#d4af37', finish: 'metal', shape: 'heart', extra: 2 },
          { id: 'heart-antique', name: 'Heart, Antique', color: '#9a6b3a', finish: 'metal', shape: 'heart', extra: 0 }
        ]
      },
      cross: {
        label: 'Crucifix',
        items: [
          { id: 'crucifix-silver', name: 'Crucifix, Silver', color: '#c8cdd6', finish: 'metal', shape: 'crucifix', extra: 0 },
          { id: 'crucifix-gold', name: 'Crucifix, Gold', color: '#d4af37', finish: 'metal', shape: 'crucifix', extra: 2 },
          { id: 'plain-silver', name: 'Plain Cross, Silver', color: '#c8cdd6', finish: 'metal', shape: 'plain', extra: 0 },
          { id: 'budded-bronze', name: 'Budded Cross, Bronze', color: '#9a6b3a', finish: 'metal', shape: 'budded', extra: 0 },
          { id: 'plain-black', name: 'Plain Cross, Black', color: '#2a2a2e', finish: 'metal', shape: 'plain', extra: 0 }
        ]
      },
      cord: {
        label: 'Cord',
        items: [
          { id: 'white', name: 'White Cord', color: '#f4f1ea', extra: 0 },
          { id: 'black', name: 'Black Cord', color: '#1f1f23', extra: 0 }
        ]
      }
    }
  };

  /* ------------------------------------------------------------------ helpers */
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clamp = (n) => Math.min(255, Math.max(0, n));
  const hexToRgb = (h) => {
    h = String(h).replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const n = parseInt(h, 16) || 0;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const rgbToHex = (r, g, b) => '#' + [r, g, b].map((v) => Math.round(clamp(v)).toString(16).padStart(2, '0')).join('');
  const mix = (h, t, amt) => {
    const a = hexToRgb(h);
    const b = hexToRgb(t);
    return rgbToHex(...a.map((v, i) => v + (b[i] - v) * amt));
  };
  const lighten = (h, a) => mix(h, '#ffffff', a);
  const darken = (h, a) => mix(h, '#000000', a);
  const gid = (g, it) => `g-${g}-${String(it.id).replace(/[^\w-]/g, '_')}`;
  const newId = () => {
    const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    const bytes = new Uint8Array(6);
    (window.crypto || window.msCrypto).getRandomValues(bytes);
    return 'RC-' + Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
  };

  function gradientDef(id, item) {
    const c = item.color || '#888888';
    const f = item.finish || 'glass';
    if (f === 'metal') {
      return `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">` +
        `<stop offset="0" stop-color="${lighten(c, 0.65)}"/><stop offset=".35" stop-color="${c}"/>` +
        `<stop offset=".6" stop-color="${darken(c, 0.5)}"/><stop offset=".8" stop-color="${lighten(c, 0.2)}"/>` +
        `<stop offset="1" stop-color="${darken(c, 0.4)}"/></linearGradient>`;
    }
    const hi = f === 'pearl' ? 0.75 : f === 'wood' ? 0.22 : 0.55;
    const lo = f === 'wood' ? 0.4 : 0.5;
    return `<radialGradient id="${id}" cx=".36" cy=".32" r=".8">` +
      `<stop offset="0" stop-color="${lighten(c, hi)}"/><stop offset=".4" stop-color="${c}"/>` +
      `<stop offset="1" stop-color="${darken(c, lo)}"/></radialGradient>`;
  }

  /* ----------------------------------------------------------------- geometry */
  // Loop: 5 decades of 10 beads with 4 Our Fathers between them. Tail: Our Father, 3 beads, Our Father, crucifix.
  // The loop hangs like a real rosary: a teardrop that is widest near the top and narrows
  // to the centerpiece. Slots are spaced evenly by arc length along that curve.
  const CX = 200, CY = 205, RX = 128, RY = 180;
  const LOOP_BOTTOM = CY + RY;

  function loopPoint(phi) {
    const narrow = 1 - 0.4 * Math.pow(Math.max(0, Math.cos(phi)), 1.6);
    return [CX - RX * Math.sin(phi) * narrow, CY + RY * Math.cos(phi)];
  }

  // Dense polyline of the loop starting at the bottom, running clockwise on screen.
  function sampleLoop(steps) {
    const pts = [];
    const cum = [0];
    for (let k = 0; k <= steps; k++) {
      pts.push(loopPoint((k / steps) * 2 * Math.PI));
      if (k > 0) cum.push(cum[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
    }
    return { pts, cum };
  }

  const LOOP_COUNT = 55; // centerpiece + 5 decades of 10 beads + 4 Our Fathers

  function buildLayout() {
    // The centerpiece closes the loop, so 1 + 50 + 4 = 55 positions on the curve.
    const { pts, cum } = sampleLoop(1200);
    const total = cum[cum.length - 1];
    const at = (s) => {
      let k = 1;
      while (k < cum.length - 1 && cum[k] < s) k++;
      const f = (s - cum[k - 1]) / ((cum[k] - cum[k - 1]) || 1);
      return [pts[k - 1][0] + (pts[k][0] - pts[k - 1][0]) * f, pts[k - 1][1] + (pts[k][1] - pts[k - 1][1]) * f];
    };
    const out = [{ id: 'Center', kind: 'center', x: CX, y: LOOP_BOTTOM, r: 17, decade: null }];
    // Leave a gap either side of the centerpiece so the first/last beads never touch it.
    const unit = total / (LOOP_COUNT + 3.4);
    for (let i = 1; i < LOOP_COUNT; i++) {
      const [x, y] = at((i + 1.7) * unit);
      const k = (i - 1) % 11;
      if (k === 10) out.push({ id: `Bead-${i}`, kind: 'head', x, y, r: 9, decade: null });
      else out.push({ id: `Bead-${i}`, kind: 'bead', x, y, r: 6.6, decade: Math.floor((i - 1) / 11) });
    }
    // Tail: Our Father, 3 beads, Our Father. Their positions follow the centerpiece's bottom hole (see _computeGeo).
    [['head', 9], ['bead', 6.6], ['bead', 6.6], ['bead', 6.6], ['head', 9]].forEach(([kind, r], n) => {
      out.push({ id: `Bead-${LOOP_COUNT + n}`, kind, x: CX, y: LOOP_BOTTOM + 60 + n * 18, r, decade: kind === 'bead' ? 'tail' : null });
    });
    return { slots: out, pts, cum, total, unit };
  }
  const BUILT = buildLayout();
  const LAYOUT = BUILT.slots;
  const TAIL = LAYOUT.slice(LOOP_COUNT);
  const ORDER = {};
  LAYOUT.forEach((s, i) => { ORDER[s.id] = i; });
  ORDER.Cross = LAYOUT.length;

  // Orthodox prayer rope: a circle of 3 sections x 11 "Jesus beads", a cross "spacer" before each section (one at the
  // bottom), then one more bead, the cross and the tassel hanging below the bottom spacer.
  const ROPE_CX = 200, ROPE_CY = 178, ROPE_RX = 138, ROPE_RY = 166, ROPE_N = 36;
  const ROPE_BOTTOM = ROPE_CY + ROPE_RY;
  const ROPE_CROSS_BOX = [50, 92], ROPE_TASSEL_BOX = [58, 120];
  // The loop hangs under its own weight: widest near the top, narrowing towards the bottom (like the rosary).
  function ropePoint(phi) {
    const narrow = 1 - 0.34 * Math.pow(Math.max(0, Math.cos(phi)), 1.6);
    return [ROPE_CX - ROPE_RX * Math.sin(phi) * narrow, ROPE_CY + ROPE_RY * Math.cos(phi)];
  }
  function buildRope() {
    const steps = 1800, pts = [], cum = [0];
    for (let k = 0; k <= steps; k++) {
      pts.push(ropePoint((k / steps) * 2 * Math.PI));
      if (k > 0) cum.push(cum[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
    }
    const total = cum[steps];
    const at = (d) => {
      let k = 1;
      while (k < steps && cum[k] < d) k++;
      const f = (d - cum[k - 1]) / ((cum[k] - cum[k - 1]) || 1);
      return [pts[k - 1][0] + (pts[k][0] - pts[k - 1][0]) * f, pts[k - 1][1] + (pts[k][1] - pts[k - 1][1]) * f];
    };
    const slots = [];
    for (let i = 0; i < ROPE_N; i++) {
      const [x, y] = at((i / ROPE_N) * total);   // equal spacing along the loop; i = 0 is the bottom, running clockwise
      if (i % 12 === 0) slots.push({ id: `Bead-${i}`, kind: 'spacer', x, y, r: 12.5, decade: null });
      else slots.push({ id: `Bead-${i}`, kind: 'bead', x, y, r: 10, decade: Math.floor((i - 1) / 12) });
    }
    slots.push({ id: `Bead-${ROPE_N}`, kind: 'bead', x: ROPE_CX, y: ROPE_BOTTOM + 27, r: 10, decade: 'tail' });
    const order = {};
    slots.forEach((sl, i) => { order[sl.id] = i; });
    order.Tassel = slots.length;
    order.Cross = slots.length + 1;
    const path = 'M' + pts.filter((_, k) => k % 6 === 0).map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('L') + 'Z';
    return { slots, tail: slots.slice(ROPE_N), order, glide: [], path };
  }
  const LAYOUTS = {
    rosary: { slots: LAYOUT, tail: TAIL, order: ORDER, glide: TAIL.map((sl) => sl.id).concat('Cross') },
    rope: buildRope()
  };

  // Where the loop's cord ends tie on: the ear holes of the centerpiece photo sit on this line.
  const EAR_Y = LOOP_BOTTOM - 6;
  const CENTER_BOX = [54, 72];
  const CROSS_BOX = [62, 108];
  const CUT = BUILT.unit * 2.0; // the loop cord stops this far (arc length) from the bottom, then runs to the ears

  function loopCord(earL, earR) {
    const { pts, cum, total } = BUILT;
    const mid = pts.filter((p, k) => cum[k] >= CUT && cum[k] <= total - CUT);
    const f = (p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
    return `M${f(earL)}L${mid.map(f).join('L')}L${f(earR)}`;
  }

  // Place a centerpiece photo by its holes: ears on EAR_Y, mid-point on the centre line.
  function placeCenter(item) {
    const a = item.anchors;
    if (item.image && a && a.left && a.right && a.bottom) {
      const [w, h] = fit(item, CENTER_BOX[0], CENTER_BOX[1]);
      const x = CX - ((a.left[0] + a.right[0]) / 2) * w;
      const y = EAR_Y - ((a.left[1] + a.right[1]) / 2) * h;
      return {
        rect: { x, y, w, h }, cx: x + w / 2, cy: y + h / 2,
        earL: [x + a.left[0] * w, y + a.left[1] * h], earR: [x + a.right[0] * w, y + a.right[1] * h],
        bottom: [x + a.bottom[0] * w, y + a.bottom[1] * h]
      };
    }
    return { rect: null, cx: CX, cy: LOOP_BOTTOM + 8, earL: [CX - 14, LOOP_BOTTOM - 2], earR: [CX + 14, LOOP_BOTTOM - 2], bottom: [CX, LOOP_BOTTOM + 26] };
  }

  // Hang a crucifix photo by its top hole.
  function placeCross(item, hx, hy, box) {
    const a = item.anchors;
    if (item.image && a && a.top) {
      const [w, h] = fit(item, (box || CROSS_BOX)[0], (box || CROSS_BOX)[1]);
      return { rect: { x: hx - a.top[0] * w, y: hy - a.top[1] * h, w, h }, x: hx, y: hy };
    }
    return { rect: null, x: hx, y: hy + 41 }; // drawn cross: its ring is 38 above its centre
  }

  /* ---------------------------------------------------------------- shape art */
  // Fit a photo's aspect ratio inside a box (item.w / item.h come from tools/process_assets.py).
  function fit(item, bw, bh) {
    const ar = item.w && item.h ? item.w / item.h : 1;
    return ar > bw / bh ? [bw, bw / ar] : [bh * ar, bh];
  }
  const PHOTO_SHADOW = 'filter:drop-shadow(.8px 1.4px 1px rgba(0,0,0,.38))';

  function beadSvg(x, y, r, item, id, attrs, src) {
    if (item.image) {
      return `<g ${attrs}><circle cx="${x + 0.8}" cy="${y + 1.3}" r="${r * 0.96}" fill="rgba(0,0,0,.3)"/>` +
        `<image href="${esc(src(item.image))}" x="${x - r}" y="${y - r}" width="${r * 2}" height="${r * 2}"/></g>`;
    }
    const f = item.finish || 'glass';
    const dark = darken(item.color || '#888888', f === 'metal' || f === 'pearl' ? 0.62 : 0.55);
    let s = `<g ${attrs}><circle cx="${x + 0.8}" cy="${y + 1.3}" r="${r}" fill="rgba(0,0,0,.34)"/>` +
      `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#${id})" stroke="${dark}" stroke-width=".7"/>`;
    if (f !== 'wood') {
      const hx = x - r * 0.32, hy = y - r * 0.4;
      s += `<ellipse cx="${hx}" cy="${hy}" rx="${r * 0.28}" ry="${r * 0.17}" fill="#fff" opacity="${f === 'pearl' ? 0.55 : 0.6}" transform="rotate(-30 ${hx} ${hy})"/>`;
    }
    return s + '</g>';
  }

  // A cross-shaped spacer photo, fitted into a square of side 2r
  function spacerSvg(x, y, r, item, attrs, src) {
    const [w, h] = fit(item, r * 2, r * 2);
    return `<g ${attrs}><image href="${esc(src(item.image))}" x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" style="${PHOTO_SHADOW}"/></g>`;
  }

  function tasselSvg(item, attrs, src, rect, swatch) {
    const [w, h] = rect ? [rect.w, rect.h] : fit(item, swatch[0], swatch[1]);
    return `<g ${attrs}><image href="${esc(src(item.image))}" x="${rect ? rect.x : -w / 2}" y="${rect ? rect.y : -h / 2}" width="${w}" height="${h}" style="${PHOTO_SHADOW}"/></g>`;
  }

  function centerSvg(item, id, x, y, scale, attrs, src, rect) {
    if (item.image) {
      const [w, h] = rect ? [rect.w, rect.h] : fit(item, 35 * scale, 46 * scale);
      return `<g ${attrs}><image href="${esc(src(item.image))}" x="${rect ? rect.x : x - w / 2}" y="${rect ? rect.y : y - h / 2}" width="${w}" height="${h}" style="${PHOTO_SHADOW}"/></g>`;
    }
    const c = item.color || '#aaaaaa';
    const dark = darken(c, 0.5);
    const fill = `fill="url(#${id})" stroke="${dark}" stroke-width=".8"`;
    const inner = `fill="none" stroke="${lighten(c, 0.55)}" stroke-width=".9"`;
    const crossMark = `<path d="M0 -6V6M-4 -2H4" stroke="${dark}" stroke-width="1.6" stroke-linecap="round" fill="none"/>`;
    let body;
    if (item.shape === 'oval') body = `<ellipse rx="11" ry="15" ${fill}/><ellipse rx="8" ry="12" ${inner}/>${crossMark}`;
    else if (item.shape === 'heart') body = `<path d="M0 13C-19 -1 -13 -15 0 -6C13 -15 19 -1 0 13Z" ${fill}/><path d="M0 8C-11 -1 -8 -8 0 -3C8 -8 11 -1 0 8Z" ${inner}/>${crossMark}`;
    else body = `<circle r="14" ${fill}/><circle r="10.5" ${inner}/>${crossMark}`;
    return `<g ${attrs}><g transform="translate(${x} ${y}) scale(${scale})">${body}</g></g>`;
  }

  function crossSvg(item, id, x, y, scale, attrs, src, rect) {
    if (item.image) {
      // Swatches fit the photo in a box; the stage passes `rect` so the photo hangs by its top hole.
      const [w, h] = rect ? [rect.w, rect.h] : fit(item, 56 * scale, 88 * scale);
      return `<g ${attrs}><image href="${esc(src(item.image))}" x="${rect ? rect.x : x - w / 2}" y="${rect ? rect.y : y - 44 * scale}" width="${w}" height="${h}" style="${PHOTO_SHADOW}"/></g>`;
    }
    const c = item.color || '#aaaaaa';
    const dark = darken(c, 0.5);
    const paint = `fill="url(#${id})" stroke="${dark}" stroke-width=".7"`;
    let s = `<g ${attrs}><g transform="translate(${x} ${y}) scale(${scale})">`;
    s += `<circle cx="0" cy="-38" r="3.2" fill="none" stroke="${dark}" stroke-width="1.4"/>`;
    s += `<rect x="-4" y="-34" width="8" height="68" rx="1.5" ${paint}/>`;
    s += `<rect x="-20" y="-18" width="40" height="8" rx="1.5" ${paint}/>`;
    if (item.shape === 'budded') {
      [[0, -34], [0, 34], [-20, -14], [20, -14]].forEach(([bx, by]) => {
        s += `<circle cx="${bx}" cy="${by}" r="5.5" ${paint}/>`;
      });
    }
    if (item.shape === 'crucifix') {
      const light = lighten(c, 0.55);
      s += `<path d="M-16 -14L16 -14M0 -14L0 17" stroke="${light}" stroke-width="2.4" stroke-linecap="round" fill="none"/>`;
      s += `<circle cx="0" cy="-20" r="3.2" fill="${light}" stroke="${dark}" stroke-width=".5"/>`;
    }
    return s + '</g></g>';
  }

  /* ------------------------------------------------------------------- styles */
  const CSS = `
:host{display:block;container-type:inline-size;container-name:rb;max-width:1200px;margin-inline:auto;color:var(--rb-text,#f3ece0);font-family:var(--rb-font,Georgia,'Times New Roman',serif);
 --rb-accent:#c9a24a;--rb-card:#181614;--rb-border:#3a342b;--rb-muted:#a99f8e;--rb-stage:${STAGE}}
*{box-sizing:border-box}
button{font:inherit;color:inherit;cursor:pointer}
.rb{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.05fr);gap:28px;align-items:start}
.stage{position:sticky;top:12px;z-index:2;background:radial-gradient(circle at 50% 35%,#fbf8f2,var(--rb-stage) 70%);
 border-radius:18px;padding:10px;box-shadow:0 10px 30px rgba(0,0,0,.35)}
.stage svg{display:block;width:100%;height:auto;max-height:calc(100vh - var(--rb-top,0px) - 40px);max-height:calc(100dvh - var(--rb-top,0px) - 40px);overflow:visible}
.stage .ring{pointer-events:none}
.stage{touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none}
.stage.zoomed{cursor:grab}
.stage.zoomed svg{overflow:hidden}
.stage.dragging{cursor:grabbing}
.zoombar{position:absolute;top:10px;right:10px;display:flex;flex-direction:column;align-items:flex-end;gap:6px;z-index:3}
.zoombar button{width:36px;height:36px;padding:0;border-radius:50%;border:1px solid rgba(58,52,43,.25);background:rgba(255,255,255,.9);
 color:#3a342b;font-size:21px;line-height:1;display:grid;place-items:center;box-shadow:0 2px 6px rgba(0,0,0,.2);cursor:pointer}
.zoombar button:disabled{opacity:.35;cursor:default}
.zoombar .zreset{width:auto;border-radius:18px;padding:0 13px;height:34px;font-size:13px;font-family:inherit;opacity:0;pointer-events:none;transform:translateY(-4px);transition:opacity .2s,transform .2s}
.zoombar .zreset.show{opacity:1;pointer-events:auto;transform:none}
.stage [data-group]{cursor:pointer;transition:filter .25s}
.stage svg .dim{filter:saturate(.72) brightness(.9)}
.panel{min-width:0;background:var(--rb-card);border:1px solid var(--rb-border);border-radius:18px;padding:16px}
.types{display:flex;gap:4px;margin-bottom:12px;padding:4px;background:#211e1a;border:1px solid var(--rb-border);border-radius:999px}
.type{flex:1 1 0;border:0;background:transparent;border-radius:999px;padding:9px 10px;font-size:14px;line-height:1.1;white-space:nowrap;display:inline-flex;align-items:center;justify-content:center;gap:8px;transition:background .2s,color .2s}
.type:not(.on):hover{background:rgba(201,162,74,.12)}
.type .ic{width:22px;height:22px}
.type .short{display:none}
.ic{width:18px;height:18px;flex:0 0 auto}
.tab{display:inline-flex;align-items:center;gap:7px}
.type.on{background:var(--rb-accent);color:#1a1408;font-weight:700}
.tabs{display:flex;gap:8px;overflow-x:auto;padding-bottom:6px;scrollbar-width:thin}
.tab{flex:0 0 auto;border:1px solid var(--rb-border);background:transparent;border-radius:999px;padding:8px 14px;font-size:14px;white-space:nowrap}
.tab.on{background:var(--rb-accent);border-color:var(--rb-accent);color:#1a1408;font-weight:700}
.targets{display:none;align-items:center;gap:8px;flex-wrap:wrap;margin:12px 0 2px;font-size:13px;color:var(--rb-muted)}
.targets.show{display:flex}
.chip{border:1px solid var(--rb-border);background:transparent;border-radius:999px;padding:5px 11px;font-size:13px;display:inline-flex;align-items:center;gap:6px}
.chip.on{border-color:var(--rb-accent);color:var(--rb-accent)}
.chip i{width:10px;height:10px;border-radius:50%;display:inline-block;border:1px solid rgba(255,255,255,.25)}
.opts{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:10px;margin-top:14px}
.opt{position:relative;border:1px solid var(--rb-border);background:#211e1a;border-radius:14px;padding:8px 6px 9px;display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center;transition:transform .15s,border-color .15s}
.opt.sold,.opt.sold:hover{opacity:.55;cursor:not-allowed;transform:none;border-color:var(--rb-border)}
.opt.sold .sw{filter:grayscale(.75)}
.opt.sold .nm{text-decoration:line-through;text-decoration-color:#8a8070}
.tag-sold{position:absolute;top:5px;left:5px;z-index:1;background:#8c2f2f;color:#fff;font-size:10px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;padding:3px 7px;border-radius:999px;line-height:1.1;pointer-events:none}
.opt:hover{transform:translateY(-2px);border-color:#6a5d43}
.opt.on{border-color:var(--rb-accent);box-shadow:0 0 0 1px var(--rb-accent) inset}
.opt:active{transform:scale(.95)}
.opts.enter .opt{animation:rise .38s cubic-bezier(.2,.8,.2,1) both;animation-delay:calc(var(--i,0) * 28ms)}
@keyframes rise{from{opacity:0;transform:translateY(10px) scale(.94)}to{opacity:1;transform:none}}
.sw{width:54px;height:54px;display:block}
.sw svg{width:100%;height:100%;display:block}
.nm{font-size:12.5px;line-height:1.2}
.ex{font-size:11.5px;color:var(--rb-accent)}
.sum{margin:16px 0 4px;border-top:1px solid var(--rb-border);padding-top:12px;font-size:13.5px;color:var(--rb-muted);display:grid;gap:3px}
.sum b{color:var(--rb-text);font-weight:600}
.row{display:flex;align-items:center;gap:10px;margin-top:12px}
.cta{flex:1;border:0;border-radius:12px;background:var(--rb-accent);color:#1a1408;font-weight:700;font-size:16px;padding:14px 18px}
.cta:disabled{opacity:.6;cursor:progress}
.msg{margin-top:10px;font-size:14px;line-height:1.35;color:var(--rb-accent);text-align:center}
.msg:empty{display:none}
.ghost{border:1px solid var(--rb-border);background:transparent;border-radius:12px;padding:13px 14px;font-size:14px}
:host([hide-cta]) .cta{display:none}
@container rb (min-width:701px){
 /* Wide layout: a fixed-height workspace. The rosary fills the left side and never slides under a site header;
    only the swatch grid scrolls, so tabs, summary and the buy button are always in view. */
 .rb{height:clamp(480px,calc(100vh - var(--rb-top,0px) - 150px),760px);height:clamp(480px,calc(100dvh - var(--rb-top,0px) - 150px),760px);align-items:stretch}
 .stage{position:relative;top:auto;height:100%;min-height:0}
 .stage svg{height:100%;max-height:none}
 .panel{height:100%;min-height:0;display:flex;flex-direction:column}
 .types,.tabs,.targets,.sum,.row,.msg{flex:none}
 .opts{flex:1 1 auto;min-height:0;overflow-y:auto;align-content:start;padding-right:4px;overscroll-behavior:contain}
}
@container rb (max-width:700px){
 .type .full{display:none}.type .short{display:inline}.type{padding:9px 6px}
 /* Narrow layout (decided by the builder's own width, not the window): rosary pinned on top, swipeable option rows below, sticky buy bar. */
 .rb{grid-template-columns:minmax(0,1fr);gap:10px}
 .stage{top:0;padding:4px;border-radius:0 0 18px 18px;height:min(44vh,400px);height:min(44dvh,400px)}
 .stage svg{height:100%;max-height:none}
 .zoombar{top:8px;right:8px}
 .zoombar button{width:40px;height:40px}
 .zoombar .zreset{height:36px}
 .panel{border:0;border-radius:18px 18px 0 0;padding:12px 12px 0}
 .tabs{scrollbar-width:none;margin:0 -12px;padding:0 12px 4px}
 .tabs::-webkit-scrollbar,.opts::-webkit-scrollbar,.targets::-webkit-scrollbar{display:none}
 .tab{padding:10px 16px;font-size:14.5px;min-height:44px}
 .targets{flex-wrap:nowrap;overflow-x:auto;margin:8px -12px 0;padding:0 12px;scrollbar-width:none}
 .targets span,.chip{flex:0 0 auto;white-space:nowrap}
 .chip{padding:8px 13px;font-size:13.5px;min-height:40px}
 .opts{display:grid;grid-auto-flow:column;grid-template-columns:none;grid-template-rows:repeat(2,min-content);
  grid-auto-columns:92px;gap:8px;overflow-x:auto;scroll-snap-type:x proximity;margin:10px -12px 0;padding:2px 12px 8px;scrollbar-width:none}
 .opt{scroll-snap-align:start}
 .sw{width:50px;height:50px}
 .sum{font-size:12.5px;margin-top:6px}
 .row{position:sticky;bottom:0;z-index:3;margin:10px -12px 0;padding:10px 12px max(12px,env(safe-area-inset-bottom));
  background:linear-gradient(to bottom,rgba(24,22,20,0),var(--rb-card) 28%)}
 .ghost{padding:13px 0;width:48px;font-size:18px;text-align:center}
 .ghost .lbl{display:none}
 .cta{white-space:nowrap;font-size:15.5px;padding:14px 10px}
}
@media(max-height:700px){@container rb (max-width:700px){
 /* Short narrow screens: shorter rosary, one row of swatches, so the options show on the first screen. */
 .stage{height:min(36vh,300px);height:min(36dvh,300px)}
 .opts{grid-template-rows:min-content}
 .sum{display:none}
}}
@media(orientation:landscape) and (max-height:560px) and (pointer:coarse){@container rb (min-width:521px){
 /* Landscape phones (touch only): rosary on the left (full height), options on the right, sticky buy bar. */
 .rb{gap:12px;grid-template-columns:minmax(0,.85fr) minmax(0,1.15fr);height:calc(100vh - 12px);height:calc(100dvh - 12px)}
 .stage{top:6px;padding:4px}
 .stage svg{max-height:calc(100vh - 20px);max-height:calc(100dvh - 20px)}
 .panel{padding:10px}
 .tab{padding:9px 14px;min-height:44px}
 .chip{min-height:40px}
 .opts{grid-template-columns:repeat(auto-fill,minmax(84px,1fr));gap:8px;margin-top:10px}
 .sw{width:44px;height:44px}
 .sum{display:none}
 .cta{white-space:nowrap;font-size:15px;padding:13px 10px}
 .row{position:sticky;bottom:0;z-index:3;margin:8px -10px 0;padding:8px 10px;background:linear-gradient(to bottom,rgba(24,22,20,0),var(--rb-card) 28%)}
}}
@media(hover:hover) and (pointer:fine){
 .tabs,.opts,.targets{scrollbar-width:thin;scrollbar-color:#6a5d43 transparent}
 .tabs::-webkit-scrollbar,.opts::-webkit-scrollbar,.targets::-webkit-scrollbar{display:block;height:8px}
 .tabs::-webkit-scrollbar-thumb,.opts::-webkit-scrollbar-thumb,.targets::-webkit-scrollbar-thumb{background:#6a5d43;border-radius:8px}
 .tabs::-webkit-scrollbar-track,.opts::-webkit-scrollbar-track,.targets::-webkit-scrollbar-track{background:transparent}
 .tabs.grabbing,.opts.grabbing,.targets.grabbing{cursor:grabbing;scroll-snap-type:none}
}
@media(pointer:coarse){.zoombar button{width:44px;height:44px}.zoombar .zreset{height:38px}}
@media(prefers-reduced-motion:reduce){.opts.enter .opt{animation:none}}`;

  /* ---------------------------------------------------------------- component */
  class RosaryBuilder extends HTMLElement {
    static get observedAttributes() { return ['catalog-url', 'cta-label', 'busy', 'message']; }

    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this._tab = 'beads';
      this._target = 'all';
      this._imgCache = {};
      this._built = false;
    }

    connectedCallback() {
      if (!this._started) { this._started = true; this._load(); }
      this._onResize = this._onResize || (() => this._fit());
      window.addEventListener('resize', this._onResize);
    }

    disconnectedCallback() { if (this._onResize) window.removeEventListener('resize', this._onResize); }

    // A site header that stays fixed or sticky at the top covers the builder. Measure how tall it is so the
    // builder can fit in the space below it (and scroll to sit right under it).
    _fit() {
      let top = 0;
      try {
        const x = Math.round(window.innerWidth / 2);
        for (const el of document.elementsFromPoint(x, 4)) {
          if (el === this || this.contains(el) || el === document.documentElement || el === document.body) continue;
          const pos = getComputedStyle(el).position;
          if (pos === 'fixed' || pos === 'sticky') top = Math.max(top, el.getBoundingClientRect().bottom);
        }
      } catch (e) { /* cross-origin or unsupported */ }
      top = Math.max(0, Math.min(Math.round(top), Math.round(window.innerHeight * 0.5)));
      this.style.setProperty('--rb-top', `${top}px`);
      this.style.scrollMarginTop = `${top + 8}px`;
      return top;
    }

    // First time only: bring the builder fully into view below the header.
    _revealOnce() {
      if (this._revealed) return;
      this._revealed = true;
      setTimeout(() => {
        const top = this._fit();
        const r = this.getBoundingClientRect();
        if (top > 0 && (r.top < top || r.top > window.innerHeight * 0.4)) this.scrollIntoView({ block: 'start', behavior: 'smooth' });
      }, 400);
    }

    attributeChangedCallback(name) {
      if (!this._built) return;
      if (name === 'cta-label' || name === 'busy') this._renderCta();
      if (name === 'message') this._renderMessage();
      if (name === 'catalog-url') this._load();
    }

    set catalog(v) { this._userCatalog = v; if (this.isConnected) this._load(); }
    get catalog() { return this._catalog; }
    get design() { return this.getDesign(); }

    async _load() {
      let cat = this._userCatalog;
      const url = this.getAttribute('catalog-url');
      if (!cat && url) {
        try {
          const abs = new URL(url, document.baseURI).href;
          cat = await (await fetch(abs)).json();
          // Image paths in a fetched catalog are relative to the catalog file.
          Object.values(cat.groups).forEach((grp) => grp.items.forEach((it) => {
            if (it.image && !/^(https?:|data:|\/)/.test(it.image)) it.image = new URL(it.image, abs).href;
          }));
        } catch (e) { console.warn('[rosary-builder] catalog-url failed, using defaults', e); cat = null; }
      }
      await this._setCatalog(cat || DEFAULT_CATALOG);
    }

    // Resolves when the images are loaded (or after `ms`, so a slow image never blocks the builder).
    _preload(urls, ms) {
      this._kept = this._kept || [];
      const jobs = [...new Set(urls)].map((u) => new Promise((res) => {
        const img = new Image();
        img.onload = img.onerror = () => res();
        img.src = u;
        this._kept.push(img); // keep the decoded bitmap warm so swapping parts never pops in
      }));
      return Promise.race([Promise.all(jobs), new Promise((r) => setTimeout(r, ms))]);
    }

    async _setCatalog(cat) {
      this._catalog = cat;
      this._byGroup = {};
      let defs = '';
      Object.keys(cat.groups).forEach((g) => {
        this._byGroup[g] = {};
        (cat.groups[g].items || []).forEach((it) => {
          this._byGroup[g][it.id] = it;
          if (!it.image) defs += gradientDef(gid(g, it), it);
        });
      });
      this._defs = defs;
      // Only offer the rosary types whose parts all exist in the catalog (an old catalog has just the rosary).
      this._typeIds = Object.keys(TYPES).filter((t) => TYPES[t].roles.every((r) => cat.groups[TYPES[t].group[r]]));
      this._prevSlots = null;
      this._prevPos = null;
      this._enter = true;
      const draft = this._loadDraft();
      this._states = draft ? draft.states : {};
      this._type = draft ? draft.type : 'rosary';
      this._bindType();
      const everything = Object.values(this._byGroup).flatMap((m) => Object.values(m).map((it) => it.image)).filter(Boolean);
      this._preload(everything, 20000);
      // Wait for the selected photos so the opening animation never shows empty slots.
      await this._preload(this._wantedImages(), 4000);
      this._build();
      this._fit();
      this._render();
      this._revealOnce();
    }

    _wantedImages() {
      const s = this._state;
      const T = this._T;
      const beads = [...new Set([s.beads, s.tail, ...s[T.sectionKey]])].filter(Boolean).map((id) => this._items.beads[id]);
      return beads.concat(T.roles.filter((r) => r !== 'beads' && r !== 'cord').map((r) => this._items[r][s[r]])).map((it) => it && it.image).filter(Boolean);
    }

    // Points the builder at the current rosary type: its parts, its layout and its own design state.
    _bindType() {
      const T = TYPES[this._type];
      this._T = T;
      this._L = LAYOUTS[T.id];
      this._items = {};
      T.roles.forEach((r) => { this._items[r] = this._byGroup[T.group[r]]; });
      if (!this._states[T.id]) this._states[T.id] = this._defaults(T.id);
      this._state = this._states[T.id];
    }

    _gid(role, it) { return gid(this._T.group[role], it); }

    _defaults(typeId) {
      const T = TYPES[typeId];
      const s = { [T.sectionKey]: new Array(T.sectionCount).fill(null), tail: null };
      const wanted = typeId === 'rosary' ? this._catalog.defaults : ((this._catalog.typeDefaults || {})[typeId]);
      T.roles.forEach((r) => {
        const map = this._byGroup[T.group[r]];
        const items = this._catalog.groups[T.group[r]].items;
        const ok = (it) => it && !it.soldOut;
        const first = items.find(ok);
        const w = wanted && wanted[r];
        s[r] = (w && ok(map[w]) ? w : null) || (first && first.id) || (items[0] && items[0].id);
      });
      return s;
    }

    // Items marked soldOut in catalog.json are shown with a tag and cannot be chosen
    _soldOut(role, id) { const it = id && this._items[role] && this._items[role][id]; return !!(it && it.soldOut); }

    // A saved state is only used when every part still exists and is in stock.
    _validState(typeId, s) {
      const T = TYPES[typeId];
      if (!s || typeof s !== 'object') return null;
      const bad = (role, id) => { const it = this._byGroup[T.group[role]][id]; return !it || it.soldOut; };
      for (const r of T.roles) if (bad(r, s[r])) return null;
      const secs = s[T.sectionKey];
      if (!Array.isArray(secs) || secs.length !== T.sectionCount) return null;
      if (secs.some((d) => d && bad('beads', d))) return null;
      s.tail = s.tail && !bad('beads', s.tail) ? s.tail : null;
      return s;
    }

    _loadDraft() {
      try {
        const raw = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
        if (!raw || raw.product !== this._catalog.product) return null;
        const saved = raw.states || (raw.state ? { rosary: raw.state } : {});   // older drafts hold just the rosary
        const states = {};
        Object.keys(saved).forEach((t) => { if (this._typeIds.includes(t)) { const v = this._validState(t, saved[t]); if (v) states[t] = v; } });
        return { type: this._typeIds.includes(raw.type) ? raw.type : 'rosary', states };
      } catch (e) { return null; }
    }

    _saveDraft() {
      try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ product: this._catalog.product, type: this._type, states: this._states })); } catch (e) { /* storage unavailable */ }
    }

    // Switch between rosary types. Each type keeps its own design while you look at the other.
    setType(id) {
      if (!this._built || id === this._type || !this._typeIds.includes(id)) return;
      this._type = id;
      this._bindType();
      this._tab = 'beads';
      this._target = 'all';
      this._enter = true;
      this._prevSlots = null;
      this._prevPos = null;
      this._origin = null;
      this._tweenId++;
      this._view = { k: 1, x: 0, y: 0 };
      this._applyView();
      this._preload(this._wantedImages(), 3000).then(() => this._changed());
    }

    /* ------------------------------------------------------------------ DOM */
    _build() {
      const root = this.shadowRoot;
      root.innerHTML = `<style>${CSS}</style>
<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${this._defs}</defs></svg>
<div class="rb">
  <div class="stage"><svg viewBox="0 0 ${SVG_W} ${SVG_H}" role="img" aria-label="Your rosary design"><g class="view"></g></svg>
    <div class="zoombar"><button data-act="zoomin" type="button" aria-label="Zoom in" title="Zoom in">+</button><button data-act="zoomout" type="button" aria-label="Zoom out" title="Zoom out" disabled>−</button><button class="zreset" data-act="zoomreset" type="button" aria-label="Reset view">Reset view</button></div>
  </div>
  <div class="panel">
    <div class="types" role="tablist" aria-label="Rosary type"></div>
    <div class="tabs" role="tablist"></div>
    <div class="targets"></div>
    <div class="opts"></div>
    <div class="sum"></div>
    <div class="row"><button class="ghost" data-act="random" type="button" aria-label="Surprise me"><span class="ic">✦</span><span class="lbl"> Surprise me</span></button><button class="ghost" data-act="reset" type="button" aria-label="Reset design"><span class="ic">↺</span><span class="lbl"> Reset</span></button><button class="cta" data-act="add" type="button"></button></div>
    <div class="msg" role="status" aria-live="polite"></div>
  </div>
</div>`;
      this._$ = {
        stage: root.querySelector('.stage svg'),
        stageEl: root.querySelector('.stage'),
        view: root.querySelector('.stage .view'),
        zoomIn: root.querySelector('[data-act=zoomin]'),
        zoomOut: root.querySelector('[data-act=zoomout]'),
        zoomReset: root.querySelector('[data-act=zoomreset]'),
        types: root.querySelector('.types'),
        tabs: root.querySelector('.tabs'),
        targets: root.querySelector('.targets'),
        opts: root.querySelector('.opts'),
        sum: root.querySelector('.sum'),
        cta: root.querySelector('.cta'),
        msg: root.querySelector('.msg')
      };
      root.addEventListener('click', (e) => this._onClick(e));
      this._initView();
      this._initCarousels();
      this._built = true;
    }

    _onClick(e) {
      const act = e.target.closest('[data-act]');
      if (act) {
        const a = act.dataset.act;
        const rect = act.getBoundingClientRect();
        this._origin = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        if (a === 'type') this.setType(act.dataset.type);
        else if (a === 'tab') { this._tab = act.dataset.tab; this._target = 'all'; this._enter = true; this._render(); }
        else if (a === 'target') { this._target = act.dataset.target; this._render(); }
        else if (a === 'pick') this._pick(act.dataset.id);
        else if (a === 'reset') this.reset();
        else if (a === 'random') this.randomize();
        else if (a === 'add') this._add();
        else if (a === 'zoomin') this._zoomBy(1.5);
        else if (a === 'zoomout') this._zoomBy(1 / 1.5);
        else if (a === 'zoomreset') this._resetView();
        return;
      }
      const hit = e.target.closest('[data-group]');
      if (hit) {
        if (this._suppressClick) return; // that was the end of a pan, not a tap
        this._tab = hit.dataset.group;
        const mixed = this._state[this._T.sectionKey].some(Boolean) || !!this._state.tail;
        this._target = this._tab === 'beads' && mixed && hit.dataset.decade !== undefined ? hit.dataset.decade : 'all';
        this._render();
      }
    }

    _pick(id) {
      if (this._soldOut(this._tab, id)) return;
      try { if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) navigator.vibrate(8); } catch (e) { /* not supported */ }
      const g = this._tab;
      const s = this._state;
      const sk = this._T.sectionKey;
      if (g === 'beads' && this._target === 'tail') s.tail = id;
      else if (g === 'beads' && this._target !== 'all') s[sk][Number(this._target)] = id;
      else {
        s[g] = id;
        if (g === 'beads') { s[sk] = new Array(this._T.sectionCount).fill(null); s.tail = null; }
      }
      this._changed();
    }

    _changed() {
      this._saveDraft();
      this._render();
      this.dispatchEvent(new CustomEvent('design-change', { detail: { design: this.getDesign(), price: this._price() }, bubbles: true, composed: true }));
    }

    /* --------------------------------------------------------------- render */
    _src(url) { return this._imgCache[url] || url; }

    _beadItem(decade) {
      const s = this._state;
      const own = decade === 'tail' ? s.tail : decade != null ? s[this._T.sectionKey][decade] : null;
      const id = own || s.beads;
      return this._items.beads[id];
    }

    _itemFor(slot) {
      const s = this._state;
      if (slot.kind === 'bead') return this._beadItem(slot.decade);
      const role = ROLE_OF_KIND[slot.kind];
      return this._items[role][s[role]];
    }

    // Positions of every moving part, from the chosen centerpiece's holes down to the crucifix's top hole.
    _computeGeo() {
      if (this._T.id === 'rope') return this._computeGeoRope();
      const s = this._state;
      const c = placeCenter(this._items.center[s.center]);
      const pos = {};
      this._L.slots.forEach((sl) => { pos[sl.id] = [sl.x, sl.y]; });
      pos.Center = [c.cx, c.cy];
      let y = c.bottom[1] + 18;
      let prevR = 9;
      this._L.tail.forEach((sl, i) => {
        if (i > 0) y += prevR + sl.r + 2.4;
        pos[sl.id] = [c.bottom[0], y];
        prevR = sl.r;
      });
      const tailEnd = y + prevR + 11;
      const cross = placeCross(this._items.cross[s.cross], c.bottom[0], tailEnd);
      pos.Cross = [c.bottom[0], tailEnd];
      this._geo = { c, pos, tailEnd, cross };
    }

    _computeGeoRope() {
      const s = this._state;
      const pos = {};
      this._L.slots.forEach((sl) => { pos[sl.id] = [sl.x, sl.y]; });
      const last = this._L.tail[0];
      const hy = last.y + last.r + 3;
      const cross = placeCross(this._items.cross[s.cross], ROPE_CX, hy, ROPE_CROSS_BOX);
      const bottom = cross.rect ? cross.rect.y + cross.rect.h : hy + 60;
      const ti = this._items.tassel[s.tassel];
      const [tw, th] = fit(ti, ROPE_TASSEL_BOX[0], ROPE_TASSEL_BOX[1]);
      const ax = (ti.anchors && ti.anchors.top) ? ti.anchors.top[0] : 0.5;   // where the tassel's top cap is
      const tassel = { x: ROPE_CX - ax * tw, y: bottom - 7, w: tw, h: th };
      pos.Cross = [ROPE_CX, hy];
      pos.Tassel = [ROPE_CX, tassel.y + th / 2];
      this._geo = { pos, cross, tassel, hy };
    }

    // data-group elements of the other tabs are dimmed (class "dim") while a tab is open
    _dim(role) { return this._tab === 'cord' || role === this._tab ? '' : ' class="dim"'; }

    _ropeScene() {
      const { cross, tassel, hy } = this._geo;
      const s = this._state;
      const src = (u) => this._src(u);
      const wc = this._items.cord[s.cord].color;
      const bottom = ROPE_BOTTOM;
      let m = `<g data-group="cord"${this._dim('cord')}>` +
        `<path d="${this._L.path}" fill="none" stroke="${darken(wc, 0.4)}" stroke-width="3.2" stroke-linejoin="round"/>` +
        `<path d="${this._L.path}" fill="none" stroke="${lighten(wc, 0.25)}" stroke-width="1.6" stroke-linejoin="round"/>` +
        `<path d="M${ROPE_CX} ${bottom}V${hy.toFixed(1)}" stroke="${darken(wc, 0.4)}" stroke-width="3.2"/>` +
        `<path d="M${ROPE_CX} ${bottom}V${hy.toFixed(1)}" stroke="${lighten(wc, 0.25)}" stroke-width="1.6"/></g>`;
      this._L.slots.forEach((sl) => {
        const it = this._itemFor(sl);
        const role = ROLE_OF_KIND[sl.kind];
        const dec = sl.decade != null ? ` data-decade="${sl.decade}"` : '';
        const attrs = `data-group="${role}"${dec} data-slot="${sl.id}"${this._dim(role)}`;
        m += sl.kind === 'spacer' ? spacerSvg(sl.x, sl.y, sl.r, it, attrs, src) : beadSvg(sl.x, sl.y, sl.r, it, this._gid('beads', it), attrs, src);
      });
      m += tasselSvg(this._items.tassel[s.tassel], `data-group="tassel" data-slot="Tassel"${this._dim('tassel')}`, src, tassel);
      const xi = this._items.cross[s.cross];
      m += crossSvg(xi, this._gid('cross', xi), cross.x, cross.y, 1, `data-group="cross" data-slot="Cross"${this._dim('cross')}`, src, cross.rect);
      return m;
    }

    _sceneMarkup() {
      this._computeGeo();
      if (this._T.id === 'rope') return this._ropeScene();
      const { c, pos, tailEnd, cross } = this._geo;
      const wc = this._items.cord[this._state.cord].color;
      const loop = loopCord(c.earL, c.earR);
      const tail = `M${c.bottom[0].toFixed(1)} ${c.bottom[1].toFixed(1)}V${tailEnd.toFixed(1)}`;
      let m = `<g data-group="cord"${this._dim('cord')}><path d="${loop}" fill="none" stroke="${darken(wc, 0.4)}" stroke-width="3.2" stroke-linejoin="round" stroke-linecap="round"/>` +
        `<path d="${loop}" fill="none" stroke="${lighten(wc, 0.25)}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>` +
        `<path d="${tail}" stroke="${darken(wc, 0.4)}" stroke-width="3.2"/>` +
        `<path d="${tail}" stroke="${lighten(wc, 0.25)}" stroke-width="1.6"/></g>`;
      const src = (u) => this._src(u);
      this._L.slots.forEach((sl) => {
        if (sl.kind === 'center') return;
        const g = sl.kind === 'head' ? 'heads' : 'beads';
        const it = this._itemFor(sl);
        const dec = sl.decade != null ? ` data-decade="${sl.decade}"` : '';
        m += beadSvg(pos[sl.id][0], pos[sl.id][1], sl.r, it, gid(g, it), `data-group="${g}"${dec} data-slot="${sl.id}"${this._dim(g)}`, src);
      });
      const ci = this._items.center[this._state.center];
      m += centerSvg(ci, gid('center', ci), CX, LOOP_BOTTOM + 8, 1.3, `data-group="center" data-slot="Center"${this._dim('center')}`, src, c.rect);
      const xi = this._items.cross[this._state.cross];
      m += crossSvg(xi, gid('cross', xi), cross.x, cross.y, 1, `data-group="cross" data-slot="Cross"${this._dim('cross')}`, src, cross.rect);
      return m;
    }

    _slotMap() {
      const m = {};
      this._L.slots.forEach((sl) => { m[sl.id] = this._itemFor(sl).id; });
      m.Cross = this._state.cross;
      if (this._T.id === 'rope') m.Tassel = this._state.tassel;
      return m;
    }

    /* ------------------------------------------------------------ carousels */
    // On narrow screens the tabs, decade chips and swatches scroll sideways. Touch swipes natively; for a
    // mouse the wheel scrolls the row sideways and click-drag works like a swipe.
    _initCarousels() {
      [this._$.tabs, this._$.targets, this._$.opts].forEach((el) => {
        const room = () => el.scrollWidth - el.clientWidth;
        el.addEventListener('wheel', (e) => {
          if (e.ctrlKey || room() <= 2) return;
          const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
          if ((d < 0 && el.scrollLeft <= 0) || (d > 0 && el.scrollLeft >= room() - 1)) return; // at an end: let the page scroll
          e.preventDefault();
          el.scrollLeft += d;
        }, { passive: false });
        el.addEventListener('pointerdown', (e) => {
          if (e.pointerType !== 'mouse' || e.button !== 0 || room() <= 2) return;
          const startX = e.clientX;
          const startLeft = el.scrollLeft;
          let moved = false;
          const move = (ev) => {
            if (!moved && Math.abs(ev.clientX - startX) > 5) { moved = true; el.classList.add('grabbing'); }
            if (moved) el.scrollLeft = startLeft - (ev.clientX - startX);
          };
          const up = () => {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up);
            el.classList.remove('grabbing');
            if (moved) { el._dragged = true; setTimeout(() => { el._dragged = false; }, 60); }
          };
          window.addEventListener('pointermove', move);
          window.addEventListener('pointerup', up);
        });
        // A drag must not count as a click on whatever option it ended over.
        el.addEventListener('click', (e) => { if (el._dragged) { e.stopPropagation(); e.preventDefault(); } }, true);
      });
    }

    /* ------------------------------------------------------------ zoom & pan */
    // Mouse: wheel zooms at the cursor, drag pans, double-click toggles. Touch: pinch zooms, drag pans,
    // double-tap toggles. Buttons: + / - / Reset view. The scene lives in <g class="view"> so the
    // exported preview image (built separately) always shows the whole rosary.
    _initView() {
      this._view = { k: 1, x: 0, y: 0 };
      this._ptrs = new Map();
      this._pinch = null;
      this._tweenId = 0;
      const st = this._$.stageEl;
      this._mv = (e) => this._onMove(e);
      this._up = (e) => this._onUp(e);
      st.addEventListener('pointerdown', (e) => this._onDown(e));
      st.addEventListener('wheel', (e) => this._onWheel(e), { passive: false });
      st.addEventListener('dblclick', (e) => {
        if (e.target.closest('.zoombar') || Date.now() - (this._tapZoomAt || 0) < 500) return;
        this._toggleZoom(e.clientX, e.clientY);
      });
    }

    _rootPoint(cx, cy) {
      const m = this._$.stage.getScreenCTM();
      if (!m) return [SVG_W / 2, SVG_H / 2];
      const p = new DOMPoint(cx, cy).matrixTransform(m.inverse());
      return [p.x, p.y];
    }

    _unitsPerPx() {
      const m = this._$.stage.getScreenCTM();
      return m && m.a ? 1 / m.a : 1;
    }

    // Keep the picture covering the frame so you can never pan it away.
    _clampView() {
      const v = this._view;
      v.k = Math.min(MAX_ZOOM, Math.max(1, v.k));
      v.x = Math.min(0, Math.max(SVG_W - SVG_W * v.k, v.x));
      v.y = Math.min(0, Math.max(SVG_H - SVG_H * v.k, v.y));
      if (v.k === 1) { v.x = 0; v.y = 0; }
    }

    _applyView() {
      const v = this._view;
      const $ = this._$;
      if (v.k === 1) $.view.removeAttribute('transform');
      else $.view.setAttribute('transform', `translate(${v.x.toFixed(2)} ${v.y.toFixed(2)}) scale(${v.k.toFixed(4)})`);
      $.stageEl.classList.toggle('zoomed', v.k > 1.001);
      $.zoomReset.classList.toggle('show', v.k > 1.001);
      $.zoomOut.disabled = v.k <= 1.001;
      $.zoomIn.disabled = v.k >= MAX_ZOOM - 0.001;
    }

    // Zoom by `factor`, keeping the point (px, py) (stage SVG units) fixed on screen.
    _zoomAt(factor, px, py) {
      const v = this._view;
      const k = Math.min(MAX_ZOOM, Math.max(1, v.k * factor));
      const f = k / v.k;
      v.x = px - (px - v.x) * f;
      v.y = py - (py - v.y) * f;
      v.k = k;
      this._clampView();
      this._applyView();
    }

    _tweenView(to, ms) {
      const from = { ...this._view };
      const id = ++this._tweenId;
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        Object.assign(this._view, to);
        this._clampView();
        this._applyView();
        return;
      }
      const t0 = performance.now();
      const step = (now) => {
        if (id !== this._tweenId) return;
        const t = Math.min(1, (now - t0) / (ms || 280));
        const e = 1 - Math.pow(1 - t, 3);
        this._view.k = from.k + (to.k - from.k) * e;
        this._view.x = from.x + (to.x - from.x) * e;
        this._view.y = from.y + (to.y - from.y) * e;
        this._clampView();
        this._applyView();
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }

    _zoomTarget(factor, px, py) {
      const v = this._view;
      const k = Math.min(MAX_ZOOM, Math.max(1, v.k * factor));
      const f = k / v.k;
      return { k, x: px - (px - v.x) * f, y: py - (py - v.y) * f };
    }

    _zoomBy(factor) { this._tweenView(this._zoomTarget(factor, SVG_W / 2, SVG_H / 2)); }

    _resetView() { this._tweenView({ k: 1, x: 0, y: 0 }); }

    _toggleZoom(cx, cy) {
      if (this._view.k > 1.05) { this._resetView(); return; }
      const [px, py] = this._rootPoint(cx, cy);
      this._tweenView(this._zoomTarget(2.4, px, py));
    }

    _onWheel(e) {
      if (e.target.closest('.zoombar')) return;
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      // Scrolling down at full view just scrolls the page; everything else zooms.
      if (this._view.k <= 1.001 && dy > 0 && !e.ctrlKey) return;
      e.preventDefault();
      this._tweenId++;
      const [px, py] = this._rootPoint(e.clientX, e.clientY);
      this._zoomAt(Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.002)), px, py);
    }

    _onDown(e) {
      if (e.target.closest('.zoombar')) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      this._tweenId++;
      this._ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY });
      if (this._ptrs.size === 1) {
        this._moved = false;
        window.addEventListener('pointermove', this._mv);
        window.addEventListener('pointerup', this._up);
        window.addEventListener('pointercancel', this._up);
      } else {
        this._moved = true; // a second finger makes this a pinch, never a tap
        this._pinch = this._pinchState();
      }
    }

    _pinchState() {
      const [a, b] = [...this._ptrs.values()];
      return { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
    }

    _onMove(e) {
      const p = this._ptrs.get(e.pointerId);
      if (!p) return;
      const v = this._view;
      const u = this._unitsPerPx();
      if (this._ptrs.size === 1) {
        const dx = e.clientX - p.x;
        const dy = e.clientY - p.y;
        p.x = e.clientX;
        p.y = e.clientY;
        if (!this._moved && Math.hypot(e.clientX - p.sx, e.clientY - p.sy) > 5) this._moved = true;
        if (this._moved && v.k > 1) {
          v.x += dx * u;
          v.y += dy * u;
          this._clampView();
          this._applyView();
          this._$.stageEl.classList.add('dragging');
        }
      } else if (this._ptrs.size === 2 && this._pinch) {
        p.x = e.clientX;
        p.y = e.clientY;
        const now = this._pinchState();
        const prev = this._pinch;
        v.x += (now.cx - prev.cx) * u;
        v.y += (now.cy - prev.cy) * u;
        const [px, py] = this._rootPoint(now.cx, now.cy);
        this._zoomAt(now.d / prev.d, px, py);
        this._pinch = now;
      }
    }

    _onUp(e) {
      const p = this._ptrs.get(e.pointerId);
      if (!p) return;
      this._ptrs.delete(e.pointerId);
      if (this._ptrs.size < 2) this._pinch = null;
      if (this._ptrs.size === 1) {
        const rest = [...this._ptrs.values()][0];
        rest.sx = rest.x;
        rest.sy = rest.y;
      }
      if (this._ptrs.size > 0) return;
      window.removeEventListener('pointermove', this._mv);
      window.removeEventListener('pointerup', this._up);
      window.removeEventListener('pointercancel', this._up);
      this._$.stageEl.classList.remove('dragging');
      if (this._moved) {
        this._suppressClick = true;
        setTimeout(() => { this._suppressClick = false; }, 60);
      } else if (e.pointerType === 'touch' && e.type === 'pointerup') {
        const now = Date.now();
        const last = this._lastTap;
        if (last && now - last.t < 320 && Math.hypot(e.clientX - last.x, e.clientY - last.y) < 30) {
          this._lastTap = null;
          this._tapZoomAt = now;
          this._toggleZoom(e.clientX, e.clientY);
        } else {
          this._lastTap = { t: now, x: e.clientX, y: e.clientY };
        }
      }
    }

    // Convert a client (screen) point to the stage SVG's coordinates.
    _svgPoint(p) {
      const m = p && this._$.view.getScreenCTM();
      if (!m) return null;
      const r = new DOMPoint(p.x, p.y).matrixTransform(m.inverse());
      return { x: r.x, y: r.y };
    }

    // Beads fly from the swatch you tapped into their slots; the centerpiece spins in and the
    // crucifix drops in and swings. On first load the rosary strings itself bead by bead.
    _animate(ids, intro) {
      if (!ids.length) return;
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const svg = this._$.view;
      const from = intro ? null : this._svgPoint(this._origin);
      this._origin = null;
      const order = ids.slice().sort((a, b) => this._L.order[a] - this._L.order[b]);
      const step = Math.min(16, 560 / order.length);
      order.forEach((id, n) => {
        const el = svg.querySelector(`[data-slot="${id}"]`);
        if (!el || !el.animate) return;
        const slot = { x: this._geo.pos[id][0], y: this._geo.pos[id][1] };
        const o = from || { x: slot.x, y: slot.y - 26 };
        const dx = o.x - slot.x;
        const dy = o.y - slot.y;
        const arc = Math.min(70, Math.hypot(dx, dy) * 0.22);
        const delay = n * step + (intro ? 150 : 0);
        const mid = `translate(${dx * 0.5}px,${dy * 0.5 - arc}px)`;
        el.style.transformBox = 'fill-box';
        el.style.transformOrigin = id === 'Cross' || id === 'Tassel' ? '50% 0%' : '50% 50%';
        let frames;
        let duration;
        if (id === 'Cross') {
          duration = 1100;
          frames = [
            { transform: `translate(${dx}px,${dy}px) scale(.3) rotate(30deg)`, opacity: 0 },
            { transform: `${mid} scale(.9) rotate(-14deg)`, opacity: 1, offset: 0.4 },
            { transform: 'translate(0,0) scale(1.06) rotate(8deg)', offset: 0.62 },
            { transform: 'rotate(-5deg)', offset: 0.76 },
            { transform: 'rotate(2.5deg)', offset: 0.88 },
            { transform: 'none' }
          ];
        } else if (id === 'Center') {
          duration = 850;
          frames = [
            { transform: `translate(${dx}px,${dy}px) scale(.25) rotate(-50deg)`, opacity: 0 },
            { transform: `${mid} scale(.9) rotate(25deg)`, opacity: 1, offset: 0.5 },
            { transform: 'translate(0,0) scale(1.28) rotate(-10deg)', offset: 0.78 },
            { transform: 'scale(.95) rotate(3deg)', offset: 0.9 },
            { transform: 'none' }
          ];
        } else {
          duration = 650;
          frames = [
            { transform: `translate(${dx}px,${dy}px) scale(.35)`, opacity: 0 },
            { transform: `${mid} scale(.85)`, opacity: 1, offset: 0.5 },
            { transform: 'translate(0,0) scale(1.2)', offset: 0.82 },
            { transform: 'none' }
          ];
        }
        el.animate(frames, { duration, delay, easing: 'cubic-bezier(.25,.8,.3,1)', fill: 'backwards' });
        if (!intro && (id === 'Cross' || id === 'Center')) this._ring(slot.x, slot.y, delay + duration * 0.7);
      });
    }

    // A different centerpiece moves the tail and crucifix: slide them to their new spots.
    _glide(skip, prevPos) {
      if (!prevPos) return;
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const skipped = new Set(skip);
      this._L.glide.forEach((id) => {
        const o = prevPos[id];
        const n = this._geo.pos[id];
        if (skipped.has(id) || !o || !n) return;
        const dx = o[0] - n[0];
        const dy = o[1] - n[1];
        if (Math.hypot(dx, dy) < 0.6) return;
        const el = this._$.stage.querySelector(`[data-slot="${id}"]`);
        if (el && el.animate) el.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'none' }], { duration: 480, easing: 'cubic-bezier(.25,.8,.3,1)' });
      });
    }

    // Soft expanding ring where the centerpiece / crucifix lands.
    _ring(x, y, after) {
      setTimeout(() => {
        const svg = this._$ && this._$.view;
        if (!svg || !svg.isConnected) return;
        svg.insertAdjacentHTML('beforeend', `<circle class="ring" cx="${x}" cy="${y}" r="16" fill="none" stroke="#c9a24a" stroke-width="2.5" style="transform-box:fill-box;transform-origin:center"/>`);
        const c = svg.lastElementChild;
        const a = c.animate([{ transform: 'scale(.6)', opacity: 0.85 }, { transform: 'scale(2.6)', opacity: 0 }], { duration: 560, easing: 'ease-out' });
        a.onfinish = () => c.remove();
      }, after);
    }

    _render() {
      if (!this._built) return;
      const $ = this._$;
      const cat = this._catalog;
      const T = this._T;
      $.stage.setAttribute('data-active', this._tab);
      $.view.innerHTML = this._sceneMarkup();
      const slotMap = this._slotMap();
      const prev = this._prevSlots;
      this._prevSlots = slotMap;
      const changed = Object.keys(slotMap).filter((id) => !prev || prev[id] !== slotMap[id]);
      const prevPos = this._prevPos;
      this._prevPos = this._geo.pos;
      this._animate(changed, !prev);
      this._glide(changed, prevPos);

      $.types.style.display = this._typeIds.length > 1 ? '' : 'none';
      $.types.innerHTML = this._typeIds.map((t) =>
        `<button class="type${t === this._type ? ' on' : ''}" role="tab" aria-selected="${t === this._type}" data-act="type" data-type="${t}" type="button">${icon(t)}<span class="full">${esc((cat.types && cat.types[t] && cat.types[t].label) || TYPES[t].label)}</span><span class="short">${esc(TYPES[t].short)}</span></button>`).join('');
      $.tabs.innerHTML = T.roles.map((g) =>
        `<button class="tab${g === this._tab ? ' on' : ''}" role="tab" aria-selected="${g === this._tab}" data-act="tab" data-tab="${g}" type="button">${icon(g)}<span>${esc(cat.groups[T.group[g]].label)}</span></button>`).join('');

      const s = this._state;
      const showTargets = this._tab === 'beads';
      $.targets.classList.toggle('show', showTargets);
      if (showTargets) {
        const dot = (d) => `<i style="background:${this._beadItem(d).color || '#888'}"></i>`;
        $.targets.innerHTML = '<span>Apply to</span>' +
          `<button class="chip${this._target === 'all' ? ' on' : ''}" data-act="target" data-target="all" type="button">All beads</button>` +
          Array.from({ length: T.sectionCount }, (_, d) => d).map((d) => `<button class="chip${String(d) === this._target ? ' on' : ''}" data-act="target" data-target="${d}" type="button">${dot(d)}${T.sectionLabel} ${d + 1}</button>`).join('') +
          `<button class="chip${this._target === 'tail' ? ' on' : ''}" data-act="target" data-target="tail" type="button">${dot('tail')}${T.tailLabel}</button>`;
      }

      const g = this._tab;
      const selected = g === 'beads' && this._target !== 'all' ? this._beadItem(this._target === 'tail' ? 'tail' : Number(this._target)).id : s[g];
      const src = (u) => this._src(u);
      const swatch = (it) => {
        const id = this._gid(g, it);
        if (g === 'beads' || g === 'heads') return `<svg viewBox="-13 -13 26 26">${beadSvg(0, 0, 10, it, id, '', src)}</svg>`;
        if (g === 'spacers') return `<svg viewBox="-13 -13 26 26">${spacerSvg(0, 0, 11, it, '', src)}</svg>`;
        if (g === 'tassel') return `<svg viewBox="-22 -30 44 60">${tasselSvg(it, '', src, null, [40, 56])}</svg>`;
        if (g === 'center') return `<svg viewBox="${it.image ? '-20 -26 40 52' : '-19 -19 38 38'}">${centerSvg(it, id, 0, 0, 1, '', src)}</svg>`;
        if (g === 'cross') return `<svg viewBox="${it.image ? '-30 -48 60 96' : '-26 -46 52 92'}">${crossSvg(it, id, 0, 0, 1, '', src)}</svg>`;
        return `<svg viewBox="-14 -14 28 28"><path d="M-11 6Q0 -12 11 6" fill="none" stroke="${darken(it.color, 0.3)}" stroke-width="4.5" stroke-linecap="round"/><path d="M-11 6Q0 -12 11 6" fill="none" stroke="${it.color}" stroke-width="3" stroke-linecap="round"/></svg>`;
      };
      $.opts.classList.toggle('enter', !!this._enter);
      this._enter = false;
      $.opts.innerHTML = cat.groups[T.group[g]].items.map((it, i) =>
        `<button class="opt${it.id === selected ? ' on' : ''}${it.soldOut ? ' sold' : ''}" style="--i:${i}" data-act="pick" data-id="${esc(it.id)}" aria-pressed="${it.id === selected}"${it.soldOut ? ' disabled aria-disabled="true"' : ''} type="button">` +
        `${it.soldOut ? '<span class="tag-sold">Sold out</span>' : ''}<span class="sw">${swatch(it)}</span><span class="nm">${esc(it.name)}</span>` +
        `${it.extra ? `<span class="ex">+${this._fmt(it.extra)}</span>` : ''}</button>`).join('');

      const lines = this._summaryLines();
      $.sum.innerHTML = lines.map(([k, v]) => `<div><b>${esc(k)}:</b> ${esc(v)}</div>`).join('');
      this._renderCta();
    }

    _renderCta() {
      if (!this._built) return;
      const busy = this.getAttribute('busy') === 'true';
      const label = this.getAttribute('cta-label') || 'Add to cart';
      this._$.cta.disabled = busy || this._holding === true;
      this._$.cta.textContent = busy ? 'Preparing checkout…' : `${label} · ${this._fmt(this._price())}`;
      this._renderMessage();
    }

    // Host pages (Wix page code) can show a line of text under the button with the `message` attribute.
    _renderMessage() {
      if (this._built) this._$.msg.textContent = this.getAttribute('message') || '';
    }

    /* ------------------------------------------------------------- data out */
    _fmt(n) { return `${this._catalog.currency || '$'}${Number(n).toFixed(2)}`; }

    _price() {
      const s = this._state;
      const T = this._T;
      const used = (r, ids) => [...new Set(ids.filter(Boolean))].reduce((t, id) => t + (this._items[r][id].extra || 0), 0);
      let sum = this._catalog.basePrice;
      T.roles.forEach((r) => { sum += used(r, r === 'beads' ? [s.beads, s.tail, ...s[T.sectionKey]] : [s[r]]); });
      return Math.round(sum * 100) / 100;
    }

    _summaryLines() {
      const s = this._state;
      const T = this._T;
      const name = (r, id) => this._items[r][id].name;
      const secs = s[T.sectionKey];
      const mixed = secs.some(Boolean) || !!s.tail;
      const beads = mixed ? secs.map((d, i) => `${T.sectionLabel[0]}${i + 1} ${name('beads', d || s.beads)}`).concat(`${T.tailLabel} ${name('beads', s.tail || s.beads)}`).join(', ') : name('beads', s.beads);
      return [['Rosary type', T.label]].concat(T.roles.map((r) => [T.names[r], r === 'beads' ? beads : name(r, s[r])]));
    }

    getDesign() {
      if (!this._state) return null;
      const s = this._state;
      const T = this._T;
      const slots = this._L.slots.map((sl) => ({ id: sl.id, kind: sl.kind, skin: this._itemFor(sl).id }));
      slots.push({ id: 'Cross', kind: 'cross', skin: s.cross });
      if (T.id === 'rope') slots.push({ id: 'Tassel', kind: 'tassel', skin: s.tassel });
      const selection = { type: T.id, beads: s.beads, [T.sectionKey]: [...s[T.sectionKey]], tail: s.tail || null };
      T.roles.forEach((r) => { if (r !== 'beads') selection[r] = s[r]; });
      return {
        v: 1,
        product: this._catalog.product,
        catalogVersion: this._catalog.version,
        type: T.id,
        selection,
        slots,
        summary: this._summaryLines().map(([k, v]) => `${k}: ${v}`).join(' | '),
        price: this._price()
      };
    }

    /* --------------------------------------------------------------- export */
    async _inlineImages() {
      const urls = new Set();
      Object.values(this._byGroup).forEach((m) => Object.values(m).forEach((it) => { if (it.image && !this._imgCache[it.image]) urls.add(it.image); }));
      await Promise.all([...urls].map(async (u) => {
        try {
          const blob = await (await fetch(u, { mode: 'cors' })).blob();
          this._imgCache[u] = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); });
        } catch (e) { console.warn('[rosary-builder] could not inline image (needs CORS):', u); }
      }));
    }

    async exportPreview(width = 600) {
      await this._inlineImages();
      const w = width;
      const h = Math.round((width * SVG_H) / SVG_W);
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SVG_W} ${SVG_H}" width="${w}" height="${h}">` +
        `<defs>${this._defs}</defs><rect width="${SVG_W}" height="${SVG_H}" fill="${STAGE}"/>${this._sceneMarkup()}</svg>`;
      const img = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); });
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      return canvas.toDataURL('image/jpeg', 0.9);
    }

    async _add() {
      const btn = this._$.cta;
      btn.disabled = true;
      btn.textContent = 'Preparing…';
      let preview = null;
      try { preview = await this.exportPreview(); } catch (e) { console.warn('[rosary-builder] preview failed', e); }
      const design = this.getDesign();
      design.designId = newId();
      const detail = { designId: design.designId, price: design.price, currency: this._catalog.currency || '$', summary: design.summary, design, preview };
      this.dispatchEvent(new CustomEvent('add-to-cart', { detail, bubbles: true, composed: true }));
      if (window.parent && window.parent !== window) {
        try { window.parent.postMessage({ source: 'rosary-builder', type: 'add-to-cart', detail }, '*'); } catch (e) { /* cross-origin parent */ }
      }
      // Brief lock so a double tap cannot send the same design twice; a host that sets busy="true" keeps it locked.
      this._holding = true;
      this._renderCta();
      setTimeout(() => { this._holding = false; this._renderCta(); }, 1200);
    }

    /* -------------------------------------------------------------- actions */
    reset() {
      this._states[this._type] = this._defaults(this._type);
      this._state = this._states[this._type];
      this._tab = 'beads';
      this._target = 'all';
      this._changed();
    }

    randomize() {
      const T = this._T;
      const pick = (r) => { const all = this._catalog.groups[T.group[r]].items; const l = all.filter((it) => !it.soldOut); const src = l.length ? l : all; return src[Math.floor(Math.random() * src.length)].id; };
      const s = this._state;
      T.roles.forEach((r) => { s[r] = pick(r); });
      s[T.sectionKey] = Array.from({ length: T.sectionCount }, () => (Math.random() < 0.4 ? pick('beads') : null));
      s.tail = Math.random() < 0.4 ? pick('beads') : null;
      this._changed();
    }
  }

  customElements.define('rosary-builder', RosaryBuilder);
})();
