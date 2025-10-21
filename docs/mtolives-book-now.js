/*! mtolives-book-now v0.4.2 | (c) 2025 Mount of Olives Hotel Ltd. | MIT */
(() => {
  const WIDGET_VERSION = '0.4.2';
  console.info(`mtolives-book-now ${WIDGET_VERSION} loaded`);

  // ---------- tiny helpers ----------
  const once = (key, fn) => (once[key] ? undefined : (once[key] = fn()));
  const loadScript = (src) => new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.defer = true;
    s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
  const loadCss = (href) => {
    const l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = href;
    document.head.appendChild(l);
  };
  const fmt = (d) => {
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;
  };

  // Global calendar polish (calendar lives outside shadow)
  once('global-flatpickr-css', () => {
    const css = `
      .flatpickr-calendar{border:1px solid rgba(0,0,0,.08)!important;box-shadow:0 10px 30px rgba(0,0,0,.18)!important}
      .flatpickr-day.selected,.flatpickr-day.startRange,.flatpickr-day.endRange{background:#4a90e2;border-color:#4a90e2;color:#fff}
      .flatpickr-day.inRange{background:rgba(74,144,226,.16)}
      .fp-intent-pill{font:600 12px/1 system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#2b2b2b;
        background:#f4f6f8;border:1px solid #e5e7eb;border-radius:999px;padding:6px 10px;margin:8px 10px}
    `;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  });

  class MtOlivesBookNow extends HTMLElement {
    static get observedAttributes() {
      return ['book-url','show-months','popup','display-format','locale','min-nights','max-nights','align'];
    }

    constructor() {
      super();
      this.attachShadow({mode:'open'});

      const accent  = this.getAttribute('accent') || '#808000';
      const hover   = this.getAttribute('hover')  || '#4a90e2';
      const rounded = this.getAttribute('rounded')|| '10px';

      this.shadowRoot.innerHTML = `
        <style>
          :host{
            --accent:${accent}; --hover:${hover};
            --fieldW:250px; --rounded:${rounded};
            --density:12px; --shadow:0 10px 28px rgba(0,0,0,.18);
            font:14px/1.4 system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;
          }
          *,*::before,*::after{box-sizing:border-box}
          .bar{display:flex;gap:12px;align-items:center}
          :host([align="center"]) .bar{justify-content:center}
          .group{display:flex;flex-direction:column;gap:6px}
          label{font-weight:600;color:#2b2b2b}
          input{
            width:var(--fieldW);padding:var(--density) 12px;border:1px solid #d9dde2;border-radius:var(--rounded);
            outline:none;background:#fff;box-shadow:0 1px 0 rgba(0,0,0,.04) inset;
          }
          input:focus{border-color:#67b1ff;box-shadow:0 0 0 3px rgba(103,177,255,.22)}
          button{
            padding:10px 18px;border-radius:999px;border:0;background:var(--accent);color:#000;
            font-weight:700;letter-spacing:.02em;cursor:pointer;box-shadow:var(--shadow)
          }
          button:disabled{opacity:.5;cursor:not-allowed}
        </style>
        <div class="bar">
          <div class="group">
            <label>Check-in</label>
            <input id="checkin" type="text" placeholder="Check-in" inputmode="none" />
          </div>
          <div class="group">
            <label>Check-out</label>
            <input id="checkout" type="text" placeholder="Check-out" inputmode="none" />
          </div>
          <button id="book">BOOK NOW</button>
        </div>
      `;
    }

    connectedCallback(){ this.init(); }
    attributeChangedCallback() {}

    async ensureFlatpickr(){
      if (window.flatpickr) return;

      const LOCAL = './vendor/flatpickr';
      const CDN   = 'https://cdn.jsdelivr.net/npm/flatpickr@4.6.13';

      // CSS first (fallback via onerror path), then JS & plugin with try/catch
      once('flatpickr-css', () => loadCss(`${LOCAL}/flatpickr.min.css`));
      try { await loadScript(`${LOCAL}/flatpickr.min.js`); }
      catch { await loadScript(`${CDN}/dist/flatpickr.min.js`); }
      try { await loadScript(`${LOCAL}/plugins/rangePlugin.js`); }
      catch { await loadScript(`${CDN}/dist/plugins/rangePlugin.js`); }
    }

    async init(){
      await this.ensureFlatpickr();

      const root      = this.shadowRoot;
      const inputIn   = root.getElementById('checkin');
      const inputOut  = root.getElementById('checkout');
      const btn       = root.getElementById('book');

      const showMonths   = Number(this.getAttribute('show-months') || '2');
      const displayFmt   = this.getAttribute('display-format') || 'd M Y';
      const popup        = (this.getAttribute('popup') || 'below'); // 'below'|'above'
      const minNights    = Number(this.getAttribute('min-nights') || '1');
      const align        = this.getAttribute('align') || 'center';

      // Track which field opened the calendar
      let activeField = null;
      ['mousedown','focus','click'].forEach(ev => {
        inputIn .addEventListener(ev, () => { activeField = 'in';  });
        inputOut.addEventListener(ev, () => { activeField = 'out'; });
      });

      // Build a single Flatpickr instance on the "in" input and pair it
      const fp = flatpickr(inputIn, {
        plugins: [ new rangePlugin({ input: inputOut }) ],
        showMonths,
        disableMobile:true,
        // let the picker float; avoids odd layout in some contexts
        static:false,

        minDate:'today',
        dateFormat:displayFmt,
        altInput:false,
        allowInput:false,

        onOpen: (_sel,_str,inst) => {
          // If user clicked "Check-in", start fresh
          if (activeField === 'in') {
            inst.clear();
            inputIn.value = ''; inputOut.value = '';
          }
          // Keep months steady if we already have a start
          if (inst.selectedDates[0]) inst.jumpToDate(inst.selectedDates[0], true);
          this.updateIntentPill(inst, activeField === 'out' ? 'end' : 'start');
        },

        onChange: (dates,_s,inst) => {
          if (dates.length === 1) {
            inputIn.value = inst.formatDate(dates[0], displayFmt);
            return; // wait for end date
          }
          if (dates.length === 2) {
            const [s,e] = dates;
            // min nights check (if configured)
            if (minNights > 1) {
              const nights = Math.round((e - s) / 86400000);
              if (nights < minNights) return; // ignore too-short range
            }
            inputIn.value  = inst.formatDate(s, displayFmt);
            inputOut.value = inst.formatDate(e, displayFmt);
            setTimeout(() => inst.close(), 0);
          }
        }
      });

      // BOOK NOW handoff
      btn.addEventListener('click', () => {
        const url = this.getAttribute('book-url') || '';
        const [s,e] = fp.selectedDates;
        if (!url || !s || !e) return;
        const q = new URLSearchParams({ checkin: fmt(s), checkout: fmt(e) });
        location.href = `${url}?${q.toString()}`;
      });

      // reflect alignment for demo
      this.setAttribute('align', align);
    }

    updateIntentPill(instance, intent){
      const c = instance.calendarContainer;
      let pill = c.querySelector('.fp-intent-pill');
      const text = intent === 'end' ? 'Choose check-out' : 'Choose check-in';
      if (!pill){
        pill = document.createElement('div');
        pill.className = 'fp-intent-pill';
        c.insertBefore(pill, c.firstChild);
      }
      pill.textContent = text;
    }
  }

  customElements.define('mtolives-book-now', MtOlivesBookNow);
})();
