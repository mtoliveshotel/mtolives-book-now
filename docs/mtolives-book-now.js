/*! mtolives-book-now v0.4.2 | (c) 2025 Mount of Olives Hotel Ltd. | MIT */
(() => {
  const WIDGET_VERSION = '0.4.2';
  console.info(`mtolives-book-now ${WIDGET_VERSION} loaded`);

  // ---------- tiny loader helpers ----------
  const once = (key, fn) => (once[key] ? undefined : (once[key] = fn()));
  const loadJs = (src) => new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.defer = true;
    s.onload = res; s.onerror = () => rej(new Error(`Script load failed: ${src}`));
    document.head.appendChild(s);
  });
  const loadCss = (href) => new Promise((res, rej) => {
    const l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = href;
    l.onload = res; l.onerror = () => rej(new Error(`CSS load failed: ${href}`));
    document.head.appendChild(l);
  });
  const tryLoad = async (primary, fallback) => { try { await primary(); } catch { if (fallback) await fallback(); } };

  // Compute base directory of THIS script robustly (works with ?v=...)
  const thisScript = document.currentScript || [...document.scripts].find(s => /mtolives-book-now\.js/.test(s.src));
  const SCRIPT_BASE = thisScript ? new URL('.', thisScript.src).href : './';
  const FP_LOCAL_BASE = new URL('./vendor/flatpickr/', SCRIPT_BASE).href; // .../vendor/flatpickr/
  const FP_CDN_ROOT   = 'https://cdn.jsdelivr.net/npm/flatpickr@4.6.13';
  const FP_CDN_DIST   = `${FP_CDN_ROOT}/dist`;

  // Ensure Flatpickr (local → CDN)
  async function ensureFlatpickr() {
    if (window.flatpickr && window.rangePlugin) return;

    await once('fp-css', () =>
      tryLoad(
        () => loadCss(`${FP_LOCAL_BASE}flatpickr.min.css`),
        () => loadCss(`${FP_CDN_DIST}/flatpickr.min.css`)
      )
    );
    if (!window.flatpickr) {
      await tryLoad(
        () => loadJs(`${FP_LOCAL_BASE}flatpickr.min.js`),
        () => loadJs(`${FP_CDN_DIST}/flatpickr.min.js`)
      );
    }
    if (!window.rangePlugin) {
      await tryLoad(
        () => loadJs(`${FP_LOCAL_BASE}plugins/rangePlugin.js`),
        () => loadJs(`${FP_CDN_DIST}/plugins/rangePlugin.js`)
      );
    }
    if (!window.flatpickr || !window.rangePlugin) throw new Error('Flatpickr not available after load');
  }

  // ---------- Web Component ----------
  class MtOlivesBookNow extends HTMLElement {
    static get observedAttributes() {
      return ['book-url','display-format','show-months','locale','allow-same-day','min-nights','max-nights','popup'];
    }

    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this.shadowRoot.innerHTML = `
        <style>
          :host{
            --olive: #7a8000;
            --hover: #4a90e2;
            --text:  #1e1f23;
            --muted: rgba(0,0,0,.56);
            --bg:    #fff;
            --ring:  rgba(0,0,0,.12);
            --radius: 12px;
            --gap: 12px;
            --fieldW: 260px;
            --fieldH: 48px;
            --buttonOffset: 0px;
            font: 14px/1.4 system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
            color: var(--text);
          }
          *,*::before,*::after{ box-sizing: border-box; }
          .wrap{ background: var(--bg); border-radius: 16px; box-shadow: 0 8px 28px rgba(0,0,0,.10); padding: 16px 18px; width:max-content; }
          .bar{ display:flex; align-items:center; gap:var(--gap); flex-wrap:nowrap; position:relative; }
          .field{ width:var(--fieldW); height:var(--fieldH); border:1px solid var(--ring); border-radius:var(--radius); padding:10px 12px; display:flex; align-items:center; background:#fff; }
          .field input{ border:none; outline:none; width:100%; font:inherit; color:var(--text); background:transparent; }
          .hint{ position:absolute; left:0; bottom:-18px; font-size:12px; color:#5b6b7a; user-select:none; display:none; }
          .btn{ transform:translateY(var(--buttonOffset)); height:var(--fieldH); padding:0 22px; border-radius:999px; background:var(--olive); color:#000; border:none; font-weight:600; letter-spacing:.2px; cursor:pointer; white-space:nowrap; }
          .btn:hover{ background: var(--hover); color:#fff; }
          input.is-active{ outline:2px solid #2bb6c1; outline-offset:2px; }
        </style>
        <div class="wrap">
          <div class="bar">
            <div class="field"><input id="in"  type="text" placeholder="Check-in"  inputmode="none" /></div>
            <div class="field"><input id="out" type="text" placeholder="Check-out" inputmode="none" /></div>
            <button class="btn" id="go">BOOK NOW</button>
            <div class="hint" id="hint"></div>
          </div>
        </div>
      `;
    }

    connectedCallback() {
      this.api = this.readApi();
      this.$in   = this.shadowRoot.getElementById('in');
      this.$out  = this.shadowRoot.getElementById('out');
      this.$go   = this.shadowRoot.getElementById('go');
      this.$hint = this.shadowRoot.getElementById('hint');

      ensureFlatpickr()
        .then(() => this.initCalendar())
        .catch(err => console.error(err));

      this.$go.addEventListener('click', () => this.book());
    }

    attributeChangedCallback() { this.api = this.readApi(); }

    readApi() {
      const A = (n, d=null) => this.getAttribute(n) ?? d;
      const N = (n, d=null) => { const v = this.getAttribute(n); const x = v==null?d:Number(v); return Number.isFinite(x)?x:d; };
      return {
        bookUrl:       A('book-url', 'https://www.mtoliveshotel.com/book-now'),
        displayFormat: A('display-format','d M Y'),
        showMonths:    N('show-months', 2),
        locale:        A('locale', null) || undefined,
        allowSameDay:  (A('allow-same-day','false') === 'true'),
        minNights:     N('min-nights', 0),
        maxNights:     N('max-nights', 0),
        popup:         A('popup','below')  // 'below' | 'above' | 'auto'
      };
    }

    // ============= Improved calendar behavior =============
    initCalendar() {
      const { flatpickr, rangePlugin } = window;
      const { displayFormat, showMonths, locale, popup, allowSameDay, minNights, maxNights } = this.api;

      const inEl  = this.$in;
      const outEl = this.$out;
      const hint  = this.$hint;

      // Track which input opened the popup
      let openedBy = null;

      const setActiveField = (which) => {
        inEl.classList.toggle('is-active',  which === 'in');
        outEl.classList.toggle('is-active', which === 'out');
        hint.style.display = 'block';
        hint.textContent = which === 'out' ? 'Choose a new check-out date' : 'Choose a new check-in date';
      };
      const clearActive = () => {
        inEl.classList.remove('is-active');
        outEl.classList.remove('is-active');
        hint.style.display = 'none';
      };

      const markOpenSource = (which) => () => { openedBy = which; };
      ['pointerdown','mousedown','keydown','focus'].forEach(ev => {
        inEl .addEventListener(ev, markOpenSource('in'));
        outEl.addEventListener(ev, markOpenSource('out'));
      });

      const fp = flatpickr(inEl, {
        plugins: [ new rangePlugin({ input: outEl }) ],
        mode: 'range',
        dateFormat: displayFormat || 'd M Y',
        altInput: false,
        clickOpens: true,
        closeOnSelect: false,                   // keep open until both dates chosen
        minDate: 'today',
        showMonths: +showMonths || 2,
        position: popup || 'below',
        static: true,                           // stable positioning
        locale: locale || undefined,

        onOpen: function(selected, _str, inst) {
          // Visual cue: which input is active?
          setActiveField(openedBy || 'in');

          // Anchor months to the current check-in (or today) so October doesn't "disappear"
          const anchor = parseDisplayDate(inEl.value, inst) || new Date();
          inst.jumpToDate(anchor);

          // If opened from CHECK-IN: start a fresh selection (clear range)
          if ((openedBy || 'in') === 'in') {
            inst.clear(false); // silent clear
            // also ensure minDate is baseline (today) in case it was altered
            inst.set('minDate', 'today');
          } else {
            // From CHECK-OUT: keep range; make sure you can't pick < check-in
            const start = inst.selectedDates && inst.selectedDates[0];
            if (start) inst.set('minDate', start);
          }
        },

        onChange: function(selectedDates, _str, inst) {
          const day = 86400000;
          // One date: enforce that the next pick can't be before the first
          if (selectedDates.length === 1) {
            inst.set('minDate', selectedDates[0]);
            return;
          }
          // Two dates: normalize and enforce rules, then close
          if (selectedDates.length === 2) {
            let [a, b] = selectedDates;
            let start = a <= b ? a : b;
            let end   = a <= b ? b : a;
            let nights = Math.round((end - start) / day);

            if (!allowSameDay && nights === 0) { end = new Date(start.getTime()+day); nights = 1; }
            if (minNights && nights < minNights) { end = new Date(start.getTime()+minNights*day); nights = minNights; }
            if (maxNights && nights > maxNights) { end = new Date(start.getTime()+maxNights*day); nights = maxNights; }

            inst.setDate([start, end], true);
            requestAnimationFrame(() => inst.close());
          }
        },

        onClose: function(_sel, _str, inst) {
          // restore global minDate after closing
          inst.set('minDate', 'today');
          clearActive();
          openedBy = null;
        }
      });

      // Open when focusing either field (desktop nicety)
      inEl .addEventListener('focus', () => fp.open());
      outEl.addEventListener('focus', () => fp.open());

      // helper to parse the visible text back into a Date using the current format
      function parseDisplayDate(val, inst) {
        if (!val) return null;
        try { return inst.parseDate(val, inst.config.dateFormat); } catch { return null; }
      }

      this.fp = fp;
    }
    // ============= /Improved calendar behavior =============

    book() {
      const { bookUrl, allowSameDay, minNights, maxNights } = this.api;
      if (!this.fp) return;

      const sel = this.fp.selectedDates || [];
      if (sel.length < 2) { this.fp.open(); return; }

      const day = 86400000;
      let [start, end] = sel[0] <= sel[1] ? sel : [sel[1], sel[0]];
      let nights = Math.round((end - start) / day);

      if (!allowSameDay && nights === 0) { this.fp.open(); return; }
      if (minNights && nights < minNights) { this.fp.open(); return; }
      if (maxNights && nights > maxNights) { this.fp.open(); return; }

      const toYMD = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const params = new URLSearchParams({ checkin: toYMD(start), checkout: toYMD(end) });
      window.location.href = `${bookUrl}?${params}`;
    }
  }

  customElements.define('mtolives-book-now', MtOlivesBookNow);

  // Global calendar polish (outside shadow)
  once('fp-global-css', () => {
    const s = document.createElement('style');
    s.textContent = `
      .flatpickr-calendar{border:1px solid rgba(0,0,0,.08)!important; box-shadow:0 10px 30px rgba(0,0,0,.22)!important}
      .flatpickr-day.selected,.flatpickr-day.startRange,.flatpickr-day.endRange{background:var(--fp-accent,#4a90e2);border-color:var(--fp-accent,#4a90e2);color:#fff}
      .flatpickr-day.inRange{background:rgba(74,144,226,.16)}
      .flatpickr-day.flatpickr-disabled{color:rgba(0,0,0,.38)!important}
    `;
    document.head.appendChild(s);
  });
})();
