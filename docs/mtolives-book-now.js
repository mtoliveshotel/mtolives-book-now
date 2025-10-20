/*! mtolives-book-now v0.4.0 | (c) 2025 Mount of Olives Hotel Ltd. | MIT */
(() => {
  const WIDGET_VERSION = '0.4.0';
  console.info(`mtolives-book-now ${WIDGET_VERSION} loaded`);

  // ---------- tiny loader helpers ----------
  const once = (k, fn) => (once[k] ? undefined : (once[k] = fn()));
  const loadCss = (href) =>
    new Promise((res, rej) => {
      const l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = href;
      l.onload = res;
      l.onerror = rej;
      document.head.appendChild(l);
    });
  const loadJs = (src) =>
    new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src;
      s.defer = true;
      s.onload = res;
      s.onerror = rej;
      document.head.appendChild(s);
    });

  // Compute base directory of THIS script robustly (handles ?v=...).
  const thisScript =
    document.currentScript ||
    [...document.scripts].find((s) => /mtolives-book-now\.js/.test(s.src));
  const SCRIPT_BASE = thisScript ? new URL('.', thisScript.src).href : './';

  // Local vendor dir (next to this script) + CDN fallbacks
  const FP_LOCAL_BASE = new URL('./vendor/flatpickr/', SCRIPT_BASE).href; // ends with /
  const FP_CDN_ROOT   = 'https://cdn.jsdelivr.net/npm/flatpickr@4.6.13';  // no trailing /
  const FP_CDN_DIST   = `${FP_CDN_ROOT}/dist`;

  // Ensure Flatpickr is available; prefer local, fall back to CDN.
  async function ensureFlatpickr() {
    // If the page already loaded Flatpickr (your Option A tags), do nothing.
    if (window.flatpickr) return;

    try {
      once('fp-css', () => loadCss(`${FP_LOCAL_BASE}flatpickr.min.css`));
      await loadJs(`${FP_LOCAL_BASE}flatpickr.min.js`);
      await loadJs(`${FP_LOCAL_BASE}plugins/rangePlugin.js`);
    } catch {
      // Fallback to CDN
      once('fp-css-cdn', () => loadCss(`${FP_CDN_DIST}/flatpickr.min.css`));
      await loadJs(`${FP_CDN_DIST}/flatpickr.min.js`);
      await loadJs(`${FP_CDN_ROOT}/dist/plugins/rangePlugin.js`);
    }

    if (!window.flatpickr) {
      console.error('flatpickr not available after load');
    }
  }

  // ---------- widget ----------
  class MtOlivesBookNow extends HTMLElement {
    static get observedAttributes() {
      return ['book-url', 'show-months', 'popup', 'display-format', 'min-nights', 'locale'];
    }

    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this.shadowRoot.innerHTML = `
        <style>
          :host{
            --olive:#808000;
            --fieldW: 260px;
            --radius: 6px;
            --label: #6b7280;
            --border:#d1d5db;
            --inner: #26b6c1; /* subtle turquoise inner line */
            --focus:#4a90e2;
            font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji","Segoe UI Emoji";
          }
          .wrap{display:flex; gap:12px; align-items:center; flex-wrap:wrap}
          .group{display:flex; flex-direction:column; gap:6px}
          label{font-size:12px; color:var(--label)}
          input{
            width:var(--fieldW); height:40px; padding:8px 10px;
            border:1px solid var(--border); border-radius: var(--radius);
            outline: 2px solid transparent; outline-offset: -4px;
            background:#fff; font-size:14px;
          }
          input:focus{ border-color: var(--focus); outline-color: var(--inner); }
          button{
            height:40px; padding:0 20px; border-radius:20px; border:none;
            background:var(--olive); color:#111; font-weight:600; cursor:pointer;
          }
          button:disabled{opacity:.6; cursor:not-allowed}
          /* Flatpickr popup visual polish (global, lives outside shadow) */
        </style>
        <div class="wrap">
          <div class="group">
            <label>Check-in</label>
            <input id="in" type="text" inputmode="none" placeholder="Check-in">
          </div>
          <div class="group">
            <label>Check-out</label>
            <input id="out" type="text" inputmode="none" placeholder="Check-out">
          </div>
          <button id="go" type="button">BOOK NOW</button>
        </div>
      `;

      this.$in  = this.shadowRoot.getElementById('in');
      this.$out = this.shadowRoot.getElementById('out');
      this.$go  = this.shadowRoot.getElementById('go');

      // defaults
      this.cfg = {
        bookUrl:   'https://www.mtoliveshotel.com/book-now',
        showMonths: 2,
        popup:     'auto',          // 'auto' | 'above' | 'below'
        displayFmt:'d M Y',
        minNights: 1,
        locale:    null
      };
    }

    attributeChangedCallback(name, _old, val) {
      if (name === 'book-url') this.cfg.bookUrl = val || this.cfg.bookUrl;
      if (name === 'show-months') this.cfg.showMonths = +val || this.cfg.showMonths;
      if (name === 'popup') this.cfg.popup = val || this.cfg.popup;
      if (name === 'display-format') this.cfg.displayFmt = val || this.cfg.displayFmt;
      if (name === 'min-nights') this.cfg.minNights = Math.max(1, +val || 1);
      if (name === 'locale') this.cfg.locale = val || null;
    }

    async connectedCallback() {
      // Put a little global popup styling (outside shadow)
      once('fp-global-css', () => {
        const s = document.createElement('style');
        s.textContent = `
          .flatpickr-calendar{border:1px solid rgba(0,0,0,.08)!important; box-shadow:0 10px 30px rgba(0,0,0,.22)!important}
          .flatpickr-day.selected,.flatpickr-day.startRange,.flatpickr-day.endRange{background:#4a90e2;border-color:#4a90e2;color:#fff}
          .flatpickr-day.inRange{background:rgba(74,144,226,.16)}
        `;
        document.head.appendChild(s);
      });

      await ensureFlatpickr(); // will no-op if already loaded by the page
      this.initCalendar();
      this.$go.addEventListener('click', () => this.handleGo());
    }

    initCalendar() {
      const pos = this.cfg.popup === 'above' ? 'above'
                : this.cfg.popup === 'below' ? 'below'
                : 'auto';

      // Use rangePlugin to pair two inputs (check-in -> check-out)
      const options = {
        altInput: true,
        altFormat: this.cfg.displayFmt,
        dateFormat: 'Y-m-d',
        minDate: 'today',
        position: pos,
        showMonths: this.cfg.showMonths,
        plugins: [ new window.rangePlugin({ input: this.$out }) ],
        locale: this.cfg.locale || undefined,
        onChange: (dates) => this.enforceMinNights(dates),
        onReady:  (selDates, dateStr, inst) => {
          // keep check-out constrained to >= check-in
          this.$out.addEventListener('change', () => {
            const inDate = this.$in._flatpickr && this.$in._flatpickr.selectedDates[0];
            const outDate = this.$out._flatpickr && this.$out._flatpickr.selectedDates[0];
            if (inDate && outDate && outDate < inDate) {
              this.$out._flatpickr.setDate(inDate, true);
            }
          });
        }
      };

      // attach FP instances
      window.flatpickr(this.$in, options);
      window.flatpickr(this.$out, {
        altInput: true,
        altFormat: this.cfg.displayFmt,
        dateFormat: 'Y-m-d',
        minDate: 'today',
        position: pos,
        locale: this.cfg.locale || undefined
      });
    }

    enforceMinNights(dates) {
      if (!dates || dates.length === 0) return;
      const [inDate] = dates;
      if (!inDate) return;

      // Ensure checkout reflects min nights as a soft guide (does not block user)
      const minMs  = (this.cfg.minNights || 1) * 86400000;
      const target = new Date(inDate.getTime() + minMs);

      const outFP = this.$out._flatpickr;
      const currentOut = outFP && outFP.selectedDates[0];
      if (outFP && (!currentOut || currentOut < target)) {
        outFP.setDate(target, false); // do not trigger change loop
      }

      // Also constrain check-out minDate dynamically
      if (outFP) outFP.set('minDate', inDate);
    }

    handleGo() {
      const inFP  = this.$in._flatpickr;
      const outFP = this.$out._flatpickr;
      const inISO  = inFP  && inFP.selectedDates[0]  ? inFP.formatDate(inFP.selectedDates[0], 'Y-m-d') : '';
      const outISO = outFP && outFP.selectedDates[0] ? outFP.formatDate(outFP.selectedDates[0], 'Y-m-d') : '';

      if (!inISO || !outISO) {
        alert('Please select a check-in and check-out date.');
        return;
      }

      // Build URL (supports absolute or relative book-url)
      let url;
      try { url = new URL(this.cfg.bookUrl, window.location.href); }
      catch { url = new URL(String(this.cfg.bookUrl), window.location.origin); }

      url.searchParams.set('checkin',  inISO);
      url.searchParams.set('checkout', outISO);
      window.location.href = url.toString();
    }
  }

  customElements.define('mtolives-book-now', MtOlivesBookNow);
})();
