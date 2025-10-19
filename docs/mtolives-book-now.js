/*! mtolives-book-now v1.0.0 | (c) 2025 Mount of Olives Hotel Ltd. | MIT */
(() => {
  const WIDGET_VERSION = '1.0.0';
  console.info(`mtolives-book-now ${WIDGET_VERSION} loaded`);

  // ---------- helpers ----------
  const once = (k, fn) => (once[k] ? undefined : (once[k] = fn()));
  const toAbs = (u) => new URL(u, location.href).href;

  const loadScript = (src) =>
    new Promise((res, rej) => {
      const abs = toAbs(src);
      if ([...document.scripts].some(s => toAbs(s.src) === abs)) return res();
      const s = document.createElement('script');
      s.src = abs;
      s.onload = res;
      s.onerror = () => rej(new Error(`Failed to load script: ${abs}`));
      document.head.appendChild(s);
    });

  const loadCss = (href) =>
    new Promise((res, rej) => {
      const abs = toAbs(href);
      if ([...document.querySelectorAll('link[rel="stylesheet"]')].some(l => toAbs(l.href) === abs)) return res();
      const l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = abs;
      l.onload = res;
      l.onerror = () => rej(new Error(`Failed to load CSS: ${abs}`));
      document.head.appendChild(l);
    });

  const loadScriptWithFallback = async (localUrl, cdnUrl) => {
    try { await loadScript(localUrl); }
    catch { await loadScript(cdnUrl); }
  };
  const loadCssWithFallback = async (localUrl, cdnUrl) => {
    try { await loadCss(localUrl); }
    catch { await loadCss(cdnUrl); }
  };

  // ---------- third-party assets (local first, CDN fallback) ----------
  const FP_LOCAL_BASE = '/widgets/mtolives-book-now/vendor/flatpickr';
  const FP_CDN_BASE   = 'https://cdn.jsdelivr.net/npm/flatpickr@4.6.13';


  // put near the top where you define Flatpickr paths
const FP_BASE = 'https://cdn.jsdelivr.net/npm/flatpickr';

once('flatpickr-css', () => loadCss(`${FP_BASE}/dist/flatpickr.min.css`));
await loadScript(`${FP_BASE}/dist/flatpickr.min.js`);
await loadScript(`${FP_BASE}/dist/plugins/rangePlugin.js`);

  
  
  
  // Load calendar CSS globally (popup renders in <body>, not shadow)
  once('flatpickr-css', () =>
    loadCssWithFallback(
      `${FP_LOCAL_BASE}/flatpickr.min.css`,
      `${FP_CDN_BASE}/dist/flatpickr.min.css`
    )
  );

  // Tiny visual polish + arrow sizing + z-index
  once('mtolives-global-calendar-css', () => {
    const style = document.createElement('style');
    style.textContent = `
      .flatpickr-calendar {
        border: 1px solid rgba(0,0,0,.08)!important;
        box-shadow: 0 10px 30px rgba(0,0,0,.18)!important;
        z-index: 999999;
      }
      .flatpickr-day.selected,
      .flatpickr-day.startRange,
      .flatpickr-day.endRange { background:#4a90e2; border-color:#4a90e2; color:#fff }
      .flatpickr-day.inRange { background: rgba(74,144,226,.16) }
      .flatpickr-prev-month svg, .flatpickr-next-month svg { width:14px; height:14px; display:inline-block }
    `;
    document.head.appendChild(style);
  });

  async function ensureFlatpickrLoaded(locale) {
    // core + plugin
    await loadScriptWithFallback(
      `${FP_LOCAL_BASE}/flatpickr.min.js`,
      `${FP_CDN_BASE}/dist/flatpickr.min.js`
    );
    await loadScriptWithFallback(
      `${FP_LOCAL_BASE}/plugins/rangePlugin.js`,
      `${FP_CDN_BASE}/dist/plugins/rangePlugin.js`
    );
    // optional locale
    if (locale && locale.toLowerCase() !== 'en') {
      const l = locale.toLowerCase();
      // try local first, then CDN; ignore if missing
      try {
        await loadScript(`${FP_LOCAL_BASE}/l10n/${l}.js`);
      } catch {
        try { await loadScript(`${FP_CDN_BASE}/dist/l10n/${l}.js`); } catch {}
      }
    }
  }

  // ---------- web component ----------
  class MtOlivesBookNow extends HTMLElement {
    static get observedAttributes() { return ['book-url','show-months','popup','display-format','locale']; }

    constructor() {
      super();
      this.attachShadow({ mode:'open' });
      this.shadowRoot.innerHTML = `
        <style>
          :host{
            --olive:#808000; --hover-blue:#4a90e2; --teal:#26bac5;
            --fieldW:260px; --fieldH:46px; --radius:0px; --gap:12px;
            --font:system-ui,-apple-system,Segoe UI,Roboto,"Helvetica Neue",Arial,"Noto Sans","Liberation Sans",sans-serif;
          }
          *,*::before,*::after{box-sizing:border-box;font-family:var(--font)}
          .bar{display:inline-flex;align-items:center;gap:var(--gap);flex-wrap:wrap;position:relative}
          .field{display:flex;flex-direction:column;gap:6px}
          .field label{font-size:12px;color:#6b7280;line-height:1}
          .field input{
            width:var(--fieldW);max-width:100%;height:var(--fieldH);padding:10px 12px;
            border:1px solid rgba(0,0,0,.22);border-radius:var(--radius);background:#fff;outline:none;
            box-shadow:inset 0 0 0 1px rgba(38,186,197,.75);
            transition:border-color .15s ease, box-shadow .15s ease;
          }
          .field input:hover{border-color:rgba(0,0,0,.28)}
          .field input:focus{border-color:rgba(0,0,0,.35);box-shadow:inset 0 0 0 2px rgba(38,186,197,.85)}
          .book-btn{
            height:var(--fieldH);padding:0 26px;border:0;border-radius:24px;
            background:var(--olive);color:#000;cursor:pointer;
            transition:background .18s ease,color .18s ease,transform .08s ease
          }
          .book-btn:hover{background:var(--hover-blue);color:#fff}
          .book-btn:active{transform:translateY(1px)}
        </style>
        <div class="bar" part="bar">
          <div class="field">
            <label for="checkin">Check-in</label>
            <input id="checkin" type="text" aria-label="Check-in" placeholder="" readonly>
          </div>
          <div class="field">
            <label for="checkout">Check-out</label>
            <input id="checkout" type="text" aria-label="Check-out" placeholder="" readonly>
          </div>
          <button type="button" class="book-btn">BOOK NOW</button>
        </div>
      `;
    }

    connectedCallback(){ this.init(); }
    attributeChangedCallback(){ if (this.isConnected) this.init(true); }

    async init() {
      const locale = (this.getAttribute('locale') || 'en').toLowerCase();
      await ensureFlatpickrLoaded(locale);

      const checkin  = this.shadowRoot.querySelector('#checkin');
      const checkout = this.shadowRoot.querySelector('#checkout');
      const btn      = this.shadowRoot.querySelector('.book-btn');

      const displayFormat = this.getAttribute('display-format') || 'd M Y';
      const showMonths    = Number(this.getAttribute('show-months') || 2);
      const posAttr       = (this.getAttribute('popup') || 'above').toLowerCase();
      const position      = ['above','below','auto','auto left','auto center','auto right'].includes(posAttr) ? posAttr : 'above';

      if (this.fpRange && this.fpRange.destroy) this.fpRange.destroy();

      // Apply UI labels for RTL locales (simple toggle)
      if (locale === 'ar' || locale === 'he') this.shadowRoot.host.setAttribute('dir','rtl');
      else this.shadowRoot.host.removeAttribute('dir');

      this.fpRange = flatpickr(checkin, {
        locale,
        dateFormat: displayFormat,     // visible format
        allowInput: false,
        clickOpens: true,
        showMonths,
        position,
        plugins: [ new rangePlugin({ input: checkout }) ],
        onChange: (dates) => {
          const ci = dates[0], co = dates[1];
          checkin.value  = ci ? this.formatDisplay(ci, displayFormat) : '';
          checkout.value = co ? this.formatDisplay(co, displayFormat) : '';
        },
      });

      if (!this._wired){
        btn.addEventListener('click', (e) => { e.preventDefault(); this.bookNow(); });
        this._wired = true;
      }
    }

    bookNow(){
      const dates = (this.fpRange && this.fpRange.selectedDates) ? this.fpRange.selectedDates : [];
      const ciEl  = this.shadowRoot.querySelector('#checkin');
      const coEl  = this.shadowRoot.querySelector('#checkout');

      let checkIn  = dates[0] || (ciEl.value ? new Date(ciEl.value) : null);
      let checkOut = dates[1] || (coEl.value ? new Date(coEl.value) : null);

      if (checkIn && !checkOut) checkOut = new Date(checkIn.getFullYear(), checkIn.getMonth(), checkIn.getDate() + 1);

      if (!checkIn || !checkOut || checkOut <= checkIn){
        this.nudge();
        if (this.fpRange && this.fpRange.open) this.fpRange.open();
        return;
      }

      const urlBase = this.getAttribute('book-url') || '/book-now';
      const url = urlBase.startsWith('http') ? new URL(urlBase) : new URL(urlBase, location.origin);

      url.searchParams.set('checkin',  this.toYMD(checkIn));
      url.searchParams.set('checkout', this.toYMD(checkOut));

      if (this.fpRange && this.fpRange.close) this.fpRange.close();
      location.href = url.toString();
    }

    toYMD(d){ const p=n=>String(n).padStart(2,'0'); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`; }
    formatDisplay(d, fmt){
      if (window.flatpickr && flatpickr.formatDate) return flatpickr.formatDate(d, fmt);
      const m=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return `${String(d.getDate()).padStart(2,'0')} ${m[d.getMonth()]} ${d.getFullYear()}`;
    }
    nudge(){
      const el = this.shadowRoot.querySelector('.bar');
      if (el && el.animate){
        el.animate(
          [{transform:'translateX(0)'},{transform:'translateX(-4px)'},{transform:'translateX(4px)'},{transform:'translateX(0)'}],
          {duration:280,easing:'ease-in-out'}
        );
      }
    }
  }

  customElements.define('mtolives-book-now', MtOlivesBookNow);
})();
