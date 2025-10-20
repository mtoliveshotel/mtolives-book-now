/*! mtolives-book-now v0.4.1 | (c) 2025 Mount of Olives Hotel Ltd. | MIT */
(() => {
  const WIDGET_VERSION = '0.4.1';
  console.info(`mtolives-book-now ${WIDGET_VERSION} loaded`);

  // ---------- small utilities ----------
  const once = (key, fn) => (once[key] ? undefined : (once[key] = fn()));
  const loadScript = (src) =>
    new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src; s.defer = true; s.onload = res; s.onerror = () => rej(new Error(`Script load failed: ${src}`));
      document.head.appendChild(s);
    });
  const loadCss = (href) =>
    new Promise((res, rej) => {
      const l = document.createElement('link');
      l.rel = 'stylesheet'; l.href = href;
      l.onload = res; l.onerror = () => rej(new Error(`CSS load failed: ${href}`));
      document.head.appendChild(l);
    });
  const tryLoad = async (loadFnPrimary, loadFnFallback) => {
    try { await loadFnPrimary(); } catch { if (loadFnFallback) await loadFnFallback(); }
  };
  const toYMD = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

  // Detect the base directory of THIS script so we can find /vendor/ alongside it.
  const currentScriptBase = () => {
    const s = document.currentScript || Array.from(document.scripts).slice(-1)[0];
    const src = (s && s.src) || '';
    return src ? src.replace(/[^/?#]*$/, '') : './';
  };
  const LOCAL_BASE = currentScriptBase();                           // .../mtolives-book-now/
  const FP_LOCAL_BASE = `${LOCAL_BASE}vendor/flatpickr`;            // .../vendor/flatpickr
  const FP_CDN_BASE   = 'https://cdn.jsdelivr.net/npm/flatpickr@4.6.13';

  // Ensure Flatpickr is available; prefer local, fall back to CDN.
  async function ensureFlatpickr() {
    if (window.flatpickr && window.rangePlugin) return;

    await once('flatpickr-css', () =>
      tryLoad(
        () => loadCss(`${FP_LOCAL_BASE}/flatpickr.min.css`),
        () => loadCss(`${FP_CDN_BASE}/dist/flatpickr.min.css`)
      )
    );

    if (!window.flatpickr) {
      await tryLoad(
        () => loadScript(`${FP_LOCAL_BASE}/flatpickr.min.js`),
        () => loadScript(`${FP_CDN_BASE}/dist/flatpickr.min.js`)
      );
    }
    if (!window.rangePlugin) {
      await tryLoad(
        () => loadScript(`${FP_LOCAL_BASE}/plugins/rangePlugin.js`),
        () => loadScript(`${FP_CDN_BASE}/dist/plugins/rangePlugin.js`)
      );
    }

    if (!window.flatpickr || !window.rangePlugin) {
      throw new Error('Flatpickr not available after load');
    }
  }

  // ---------- Web Component ----------
  class MtOlivesBookNow extends HTMLElement {
    static get observedAttributes() {
      return ['book-url','display-format','show-months','locale','allow-same-day','min-nights','max-nights'];
    }

    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this.shadowRoot.innerHTML = `
        <style>
          :host{
            --olive: #7a8000;
            --text:  #1e1f23;
            --muted: rgba(0,0,0,.56);
            --bg:    #fff;
            --ring:  rgba(0,0,0,.08);
            --radius: 12px;
            --gap: 12px;
            --fieldW: 260px;
            --fieldH: 48px;
            --buttonOffset: 0px;
            font: 14px/1.4 system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
            color: var(--text);
          }
          *,*::before,*::after{ box-sizing: border-box; }
          .wrap{
            background: var(--bg);
            border-radius: 16px;
            box-shadow: 0 8px 28px rgba(0,0,0,.10);
            padding: 16px 18px;
            width: max-content;
          }
          .bar{
            display:flex; align-items:center; gap: var(--gap); flex-wrap: nowrap;
          }
          .field{
            width: var(--fieldW);
            height: var(--fieldH);
            border: 1px solid var(--ring);
            border-radius: var(--radius);
            padding: 10px 12px;
            display:flex; align-items:center;
            background:#fff;
          }
          .field input{
            border: none; outline: none; width: 100%;
            font: inherit; color: var(--text); background: transparent;
          }
          .placeholder{ position:absolute; clip:rect(0 0 0 0); } /* labels inside inputs only */
          .btn{
            transform: translateY(var(--buttonOffset));
            height: var(--fieldH);
            padding: 0 22px;
            border-radius: 999px;
            background: var(--olive); color:#000; /* black text per your spec */
            border: none; font-weight: 600; letter-spacing:.2px;
            cursor: pointer; white-space: nowrap;
          }
          .btn:disabled{ opacity:.6; cursor:not-allowed; }
        </style>
        <div class="wrap">
          <div class="bar">
            <label class="placeholder" for="in">Check-in</label>
            <div class="field"><input id="in"  type="text" placeholder="Check-in"  inputmode="none" /></div>
            <label class="placeholder" for="out">Check-out</label>
            <div class="field"><input id="out" type="text" placeholder="Check-out" inputmode="none" /></div>
            <button class="btn" id="go">BOOK NOW</button>
          </div>
        </div>
      `;
    }

    connectedCallback() {
      this.api = this.readApi();
      this.$in  = this.shadowRoot.getElementById('in');
      this.$out = this.shadowRoot.getElementById('out');
      this.$go  = this.shadowRoot.getElementById('go');

      // Initialize calendar after flatpickr is guaranteed available
      ensureFlatpickr().then(() => this.initCalendar()).catch(err => console.error(err));
      this.$go.addEventListener('click', () => this.book());
    }

    attributeChangedCallback() { this.api = this.readApi(); }

    readApi() {
      const A = (n, d=null) => this.getAttribute(n) ?? d;
      const N = (n) => { const v = A(n); const x = v==null?null:Number(v); return Number.isFinite(x)?x:null; };
      return {
        bookUrl:       A('book-url', 'https://www.mtoliveshotel.com/book-now'),
        displayFormat: A('display-format','d M Y'),
        showMonths:    N('show-months') ?? 2,
        locale:        A('locale', null) || undefined,
        allowSameDay:  (A('allow-same-day','false') === 'true'),
        minNights:     N('min-nights') ?? 0,
        maxNights:     N('max-nights') ?? 0,
      };
    }

    initCalendar() {
      const { displayFormat, showMonths, locale, allowSameDay, minNights, maxNights } = this.api;
      const { flatpickr, rangePlugin } = window;
      const inEl  = this.$in;
      const outEl = this.$out;

      // Create the paired range picker on the "check-in" input
      this.fp = flatpickr(inEl, {
        plugins: [ new rangePlugin({ input: outEl }) ],
        dateFormat: displayFormat || 'd M Y',
        altInput: false,
        clickOpens: true,
        closeOnSelect: false,           // keep open until both selected
        minDate: 'today',
        showMonths: +showMonths || 2,
        static: false,
        locale: locale || undefined,

        onChange: (selectedDates, _str, instance) => {
          if (selectedDates.length === 2) {
            const start = selectedDates[0];
            const end   = selectedDates[1];
            const day = 86400000;
            let nights = Math.round((end - start) / day);

            // same-day handling
            if (!allowSameDay && nights === 0) {
              instance.setDate([start, new Date(start.getTime()+day)], true);
              return;
            }
            if (minNights && nights < minNights) {
              instance.setDate([start, new Date(start.getTime()+minNights*day)], true);
              return;
            }
            if (maxNights && nights > maxNights) {
              instance.setDate([start, new Date(start.getTime()+maxNights*day)], true);
              return;
            }
            // Valid range: close now
            instance.close();
          }
        },

        onOpen: (_sel, _str, instance) => {
          // If user focuses Check-in while a full range exists, start fresh
          if (document.activeElement === inEl &&
              instance.selectedDates && instance.selectedDates.length === 2) {
            instance.clear();
          }
        }
      });

      // Open on focus (nice on desktop)
      inEl .addEventListener('focus', () => this.fp.open());
      outEl.addEventListener('focus', () => this.fp.open());
    }

    book() {
      const { bookUrl, allowSameDay, minNights, maxNights } = this.api;
      if (!this.fp) return;

      const sel = this.fp.selectedDates || [];
      if (sel.length < 2) {
        this.fp.open(); return;
      }
      const start = sel[0], end = sel[1];
      const day = 86400000;
      const nights = Math.round((end - start) / day);

      if (!allowSameDay && nights === 0) { this.fp.open(); return; }
      if (minNights && nights < minNights) { this.fp.open(); return; }
      if (maxNights && nights > maxNights) { this.fp.open(); return; }

      const params = new URLSearchParams({
        checkin:  toYMD(start),
        checkout: toYMD(end)
      });
      // Navigate
      window.location.href = `${bookUrl}?${params}`;
    }
  }

  customElements.define('mtolives-book-now', MtOlivesBookNow);
})();
