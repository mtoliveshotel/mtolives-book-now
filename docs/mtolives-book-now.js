/*! mtolives-book-now v0.4.0 | (c) 2025 Mount of Olives Hotel Ltd. | MIT */
(() => {
  const WIDGET_VERSION = '0.4.0';
  console.info(`mtolives-book-now ${WIDGET_VERSION} loaded`);

  // ----------------- tiny utilities -----------------
  const once = (k, fn) => (once[k] ? once[k] : (once[k] = fn()));
  const loadScript = (src) =>
    new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = res;
      s.onerror = () => rej(new Error(`Failed to load ${src}`));
      document.head.appendChild(s);
    });

  const loadCss = (href) =>
    new Promise((res, rej) => {
      const l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = href;
      l.onload = res;
      l.onerror = () => rej(new Error(`Failed to load ${href}`));
      document.head.appendChild(l);
    });

  const loadWithFallback = async (primary, fallback, loader) => {
    try { await loader(primary); }
    catch { await loader(fallback); }
  };

  const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const diffNights = (a, b) => Math.round((b - a) / 86400000);
  const fmtISO = (d) => d.toISOString().slice(0,10); // YYYY-MM-DD

  // ----------------- resolve base paths -----------------
  function getSelfBase() {
    // Find the <script> tag that loaded this file and derive its directory.
    const rx = /\/mtolives-book-now(\.min)?\.js/i;
    const tag = Array.from(document.scripts).find(s => rx.test(s.src));
    if (tag) return tag.src.replace(rx, '');

    // Sensible defaults if we can't detect the loader tag:
    if (location.pathname.startsWith('/mtolives-book-now/')) return '/mtolives-book-now'; // GitHub Pages repo root
    if (location.pathname.startsWith('/widgets/mtolives-book-now/')) return '/widgets/mtolives-book-now'; // cPanel
    return '.'; // current directory
  }

  const SELF_BASE     = getSelfBase();                        // e.g. /mtolives-book-now
  const FP_LOCAL_DIR  = `${SELF_BASE}/vendor/flatpickr`;      // vendored copy (if present)
  const FP_CDN_DIST   = 'https://cdn.jsdelivr.net/npm/flatpickr@4.6.13/dist';
  const FP_CDN_ROOT   = 'https://cdn.jsdelivr.net/npm/flatpickr@4.6.13';

  // Ensure Flatpickr (CSS + core + rangePlugin) exactly once, with local→CDN fallbacks
  let ENSURE_FP;
  function ensureFlatpickr() {
    if (ENSURE_FP) return ENSURE_FP;
    ENSURE_FP = (async () => {
      // CSS (global; popup renders in <body>)
      await loadWithFallback(
        `${FP_LOCAL_DIR}/flatpickr.min.css`,
        `${FP_CDN_DIST}/flatpickr.min.css`,
        loadCss
      );
      // Core JS
      await loadWithFallback(
        `${FP_LOCAL_DIR}/flatpickr.min.js`,
        `${FP_CDN_ROOT}/flatpickr.min.js`,
        loadScript
      );
      // rangePlugin JS
      await loadWithFallback(
        `${FP_LOCAL_DIR}/plugins/rangePlugin.js`,
        `${FP_CDN_DIST}/plugins/rangePlugin.js`,
        loadScript
      );
      if (!window.flatpickr) throw new Error('flatpickr not available after load');
      return window.flatpickr;
    })();
    return ENSURE_FP;
  }

  // A little global polish for the popup calendar
  once('global-calendar-css', () => {
    const css = `
      .flatpickr-calendar{border:1px solid rgba(0,0,0,.08)!important;box-shadow:0 12px 32px rgba(0,0,0,.22)!important}
      .flatpickr-day.selected,
      .flatpickr-day.startRange,
      .flatpickr-day.endRange{background:var(--fp-accent,#4a90e2);border-color:var(--fp-accent,#4a90e2);color:#fff}
      .flatpickr-day.inRange{background:rgba(74,144,226,.15)}
    `;
    const s = document.createElement('style');
    s.textContent = css;
    document.head.appendChild(s);
  });

  // ----------------- Web Component -----------------
  class MtOlivesBookNow extends HTMLElement {
    static get observedAttributes() {
      return [
        // behavior / data
        'book-url','target','show-months','popup','display-format','locale',
        'min-nights','max-nights','allow-same-day',
        // design tokens
        'accent','hover','teal','field-width','rounded','density','shadow','align'
      ];
    }

    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this.shadowRoot.innerHTML = `
        <style>
          :host{
            --accent: #808000;          /* olive */
            --hover:  #4a90e2;          /* blue */
            --teal:   #2bb6c1;          /* inner frame hint */
            --fieldW: 260px;
            --rounded: 6px;
            --density: 12px;            /* vertical padding inside fields */
            --shadow: 0 10px 28px rgba(0,0,0,.18);
            --align: left;               /* left|center */
          }
          *,*::before,*::after{ box-sizing:border-box }
          .wrap{ display:flex; justify-content: var(--align) ; }
          .bar{ display:flex; gap:12px; align-items:center; flex-wrap:nowrap; }
          .group{ display:flex; flex-direction:column; gap:6px; }
          label{ font: 500 12px/1.2 system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; color:#444 }
          .field{
            width:var(--fieldW);
            padding:var(--density) 14px;
            border:1px solid rgba(0,0,0,.18);
            border-radius:var(--rounded);
            outline:none;
            font: 500 14px/1.3 system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
            background:#fff;
            box-shadow: inset 0 0 0 1px transparent;
            transition: box-shadow .15s ease, border-color .15s ease;
          }
          .field:focus{
            border-color: rgba(0,0,0,.35);
            box-shadow: inset 0 0 0 1px rgba(0,0,0,.15);
          }
          :host([teal]) .field{ box-shadow: inset 0 0 0 1px var(--teal); }

          .btn{
            border:none; cursor:pointer; user-select:none;
            padding: calc(var(--density) + 2px) 20px;
            border-radius: 999px;
            background: var(--accent);
            color: #111;
            font: 700 14px/1 system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
            box-shadow: var(--shadow);
            transition: transform .04s ease, background .15s ease, color .15s ease;
            white-space:nowrap;
          }
          .btn:hover{ background: var(--hover); color:#fff; }
          .btn:active{ transform: translateY(1px); }

          /* alignment helper */
          :host([align="center"]) .wrap{ justify-content:center; }
          :host([align="left"]) .wrap{ justify-content:flex-start; }
          :host([align="right"]) .wrap{ justify-content:flex-end; }

          /* allow tokens via attributes */
          :host([accent]){ --accent: attr(accent color, color); }
          :host([hover]) { --hover:  attr(hover color, color); }
          :host([field-width]){ --fieldW: attr(field-width px); }
          :host([rounded]){ --rounded: attr(rounded px); }
          :host([density]){ --density: attr(density px); }
          :host([shadow]){ --shadow: attr(shadow); }
        </style>

        <div class="wrap">
          <div class="bar">
            <div class="group">
              <label id="ci-lab">Check-in</label>
              <input class="field" id="ci" aria-labelledby="ci-lab" autocomplete="off" />
            </div>
            <div class="group">
              <label id="co-lab">Check-out</label>
              <input class="field" id="co" aria-labelledby="co-lab" autocomplete="off" />
            </div>
            <button class="btn" id="go">BOOK NOW</button>
          </div>
        </div>
      `;
    }

    // -------- lifecycle --------
    connectedCallback() {
      // defaults
      this.bookUrl       = this.getAttribute('book-url') || 'https://www.mtoliveshotel.com/book-now';
      this.target        = this.getAttribute('target') || 'same';        // same|new
      this.showMonths    = clamp(parseInt(this.getAttribute('show-months')||'2',10) || 2, 1, 3);
      this.popup         = (this.getAttribute('popup') || 'below');      // below|above|auto
      this.displayFormat = this.getAttribute('display-format') || 'd M Y';
      this.locale        = this.getAttribute('locale') || 'en';
      this.minNights     = parseInt(this.getAttribute('min-nights')||'1',10) || 1;
      this.maxNights     = parseInt(this.getAttribute('max-nights')||'0',10) || 0; // 0 = unlimited
      this.allowSameDay  = this.hasAttribute('allow-same-day');

      // expose accent to calendar via CSS var
      document.documentElement.style.setProperty('--fp-accent', getComputedStyle(this).getPropertyValue('--hover') || '#4a90e2');

      // wires
      this.$ci = this.shadowRoot.getElementById('ci');
      this.$co = this.shadowRoot.getElementById('co');
      this.$go = this.shadowRoot.getElementById('go');
      this.$go.addEventListener('click', () => this.handleGo());

      // init calendar
      ensureFlatpickr().then(() => this.initPicker()).catch(console.error);
    }

    attributeChangedCallback(name, _o, _n) {
      // If attributes change after mount, re-init simple ones
      if (!this.$ci) return;
      if (['show-months','popup','display-format','min-nights','max-nights','allow-same-day','locale'].includes(name)) {
        try { this.fp && this.fp.destroy(); } catch {}
        ensureFlatpickr().then(() => this.initPicker()).catch(console.error);
      }
    }

    // -------- calendar init + validation --------
    initPicker() {
      const fpOpts = {
        dateFormat: this.displayFormat,       // what shows in the inputs
        allowInput: false,
        clickOpens: true,
        position: this.popup,                 // "above" | "below" | "auto"
        showMonths: this.showMonths,
        // Locale: pass-through; if unsupported, Flatpickr will default to English
        locale: this.locale,
        // Link the second input with rangePlugin
        plugins: [ new rangePlugin({ input: this.$co }) ],
        onChange: (sel) => this.onChange(sel),
      };

      // Flatpickr attaches to the FIRST input; second is wired by rangePlugin
      this.fp = window.flatpickr(this.$ci, fpOpts);
      // If same-day not allowed, bump co minDate dynamically when ci changes
      this.$ci.addEventListener('change', () => {
        if (!this.fp || !this.fp.selectedDates?.length) return;
        const ci = this.fp.selectedDates[0];
        const minCo = this.allowSameDay ? ci : addDays(ci, 1);
        this.fp.set('minDate', null); // avoid conflict on core picker
        // rangePlugin handles min constraint implicitly; we enforce in onChange
      });
    }

    onChange(sel) {
      if (!sel || sel.length === 0) return;
      const ci = sel[0];
      let co  = sel[1] || null;

      // if only ci selected, ensure co respects same-day policy when it arrives
      if (!co) return;

      // enforce same-day if disallowed
      if (!this.allowSameDay && diffNights(ci, co) === 0) {
        co = addDays(ci, 1);
      }

      // enforce min/max nights
      const minN = Math.max(0, this.minNights);
      const maxN = Math.max(0, this.maxNights); // 0 => unlimited

      let nights = diffNights(ci, co);
      if (minN > 0 && nights < minN) {
        co = addDays(ci, minN);
        nights = minN;
      }
      if (maxN > 0 && nights > maxN) {
        co = addDays(ci, maxN);
        nights = maxN;
      }

      // write back if we modified end date
      if (sel[1] !== co) {
        // setDate accepts array [start,end] and will update both inputs
        this.fp.setDate([ci, co], true);
      }
    }

    // -------- submit --------
    handleGo() {
      if (!this.fp || this.fp.selectedDates.length < 2) {
        // open calendar if not complete
        try { this.fp.open(); } catch {}
        return;
      }
      const [ci, co] = this.fp.selectedDates;
      if (!ci || !co) return;

      const url = new URL(this.bookUrl, location.origin);
      const params = url.searchParams;
      params.set('checkin',  fmtISO(ci));
      params.set('checkout', fmtISO(co));
      url.search = params.toString();

      if ((this.getAttribute('target') || 'same') === 'new') {
        window.open(url.toString(), '_blank', 'noopener,noreferrer');
      } else {
        location.href = url.toString();
      }
    }
  }

  customElements.define('mtolives-book-now', MtOlivesBookNow);
})();
