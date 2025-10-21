/*! mtolives-book-now v0.4.1 | (c) 2025 Mount of Olives Hotel Ltd. | MIT */
(() => {
  const WIDGET_VERSION = '0.4.1';
  console.info(`mtolives-book-now ${WIDGET_VERSION} loaded`);

  // ---------------- helpers ----------------
  const once = (key, fn) => (once[key] ? undefined : (once[key] = fn()));
  const loadScript = (src) =>
    new Promise((res, rej) => {
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
  const loadWithFallback = async (tryFirst, fallback, kind) => {
    try {
      if (kind === 'css') loadCss(tryFirst);
      else await loadScript(tryFirst);
    } catch {
      if (kind === 'css') loadCss(fallback);
      else await loadScript(fallback);
    }
  };
  const fmt = (d) => {
    // ISO date yyyy-mm-dd for URL handoff
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  // Inject a tiny bit of global calendar polish (outside shadow)
  once('global-calendar-css', () => {
    const css = `
      .flatpickr-calendar{border:1px solid rgba(0,0,0,.08)!important;box-shadow:0 10px 30px rgba(0,0,0,.18)!important}
      .flatpickr-day.selected,.flatpickr-day.startRange,.flatpickr-day.endRange{background:#4a90e2;border-color:#4a90e2;color:#fff}
      .flatpickr-day.inRange{background:rgba(74,144,226,.16)}
      .fp-intent-pill{font:600 12px/1 system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;
        color:#2b2b2b;background:#f4f6f8;border:1px solid #e5e7eb;border-radius:999px;padding:6px 10px;margin:8px 10px}
    `;
    const style = document.createElement('style');
    style.textContent = css; document.head.appendChild(style);
  });

  // ---------------- component ----------------
  class MtOlivesBookNow extends HTMLElement {
    static get observedAttributes() {
      return ['book-url','show-months','popup','display-format','locale','min-nights','max-nights','align'];
    }

    constructor() {
      super();
      this.attachShadow({ mode: 'open' });

      const accent = '#808000';
      const hover = '#4a90e2';
      const rounded = this.getAttribute('rounded') || '10px';

      this.shadowRoot.innerHTML = `
        <style>
          :host{
            --accent: ${accent};
            --hover: ${hover};
            --fieldW: 250px;
            --rounded: ${rounded};
            --density: 12px;
            --shadow: 0 10px 28px rgba(0,0,0,.18);
            font: 14px/1.4 system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;
          }
          *,*::before,*::after{box-sizing:border-box}
          .bar{display:flex;gap:12px;align-items:center;flex-wrap:nowrap}
          :host([align="center"]) .bar{justify-content:center}
          .group{display:flex;flex-direction:column;gap:6px}
          label{font-weight:600;color:#2b2b2b}
          input{
            width:var(--fieldW);padding:var(--density) 12px;border:1px solid #d9dde2;border-radius:var(--rounded);
            outline:none;box-shadow:0 1px 0 rgba(0,0,0,.04) inset;background:#fff;
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

    connectedCallback() {
      this.init();
    }

    attributeChangedCallback() {}

    async ensureFlatpickr() {
      if (window.flatpickr) return;

      // Choose local vs CDN; paths relative to the page (GitHub Pages /docs)
      const LOCAL_BASE = './vendor/flatpickr';
      const CDN_BASE = 'https://cdn.jsdelivr.net/npm/flatpickr@4.6.13';

      // CSS first (with fallback), then JS and plugin
      once('flatpickr-css', () =>
        loadWithFallback(`${LOCAL_BASE}/flatpickr.min.css`, `${CDN_BASE}/dist/flatpickr.min.css`, 'css')
      );
      try {
        await loadScript(`${LOCAL_BASE}/flatpickr.min.js`);
      } catch {
        await loadScript(`${CDN_BASE}/dist/flatpickr.min.js`);
      }
      try {
        await loadScript(`${LOCAL_BASE}/plugins/rangePlugin.js`);
      } catch {
        await loadScript(`${CDN_BASE}/dist/plugins/rangePlugin.js`);
      }
    }

    async init() {
      await this.ensureFlatpickr();

      const root = this.shadowRoot;
      const btn = root.getElementById('book');
      const inputFrom = root.getElementById('checkin');
      const inputTo = root.getElementById('checkout');

      // attrs
      const showMonths = Number(this.getAttribute('show-months') || '2');
      const displayFormat = this.getAttribute('display-format') || 'd M Y';
      const popup = this.getAttribute('popup') || 'below'; // 'below'|'above'
      const locale = (this.getAttribute('locale') || 'default');
      const minNights = Number(this.getAttribute('min-nights') || '1');
      const align = this.getAttribute('align') || 'center';

      // For clarity & fixes:
      // - We keep one flatpickr instance on the "from" input + rangePlugin(to)
      // - We track which side the user is editing (intent = 'start'|'end')
      // - Clicking "Check-in" clears the old end date; clicking "Check-out" keeps start.
      let intent = 'start'; // current selection intent


      
      
// Build instance (deleted code)
// --- Calendar setup (replaces previous flatpickr(...) block) -----------------
const inInput  = this.shadowRoot.querySelector('input[name="checkin"]')  || this.shadowRoot.querySelector('#checkin');
const outInput = this.shadowRoot.querySelector('input[name="checkout"]') || this.shadowRoot.querySelector('#checkout');

// Track which field opened the calendar: 'in' or 'out'
let activeField = null;
['mousedown','focus','click'].forEach(ev => {
  inInput .addEventListener(ev, () => { activeField = 'in';  });
  outInput.addEventListener(ev, () => { activeField = 'out'; });
});

const displayFmt = this.getAttribute('display-format') || 'd M Y';

const fp = flatpickr(inInput, {
  // pair check-in with check-out
  plugins: [ new rangePlugin({ input: outInput }) ],

  // presentation
  showMonths: 2,
  static: true,
  clickOpens: true,
  disableMobile: true,

  // dates & formatting
  minDate: 'today',
  dateFormat: displayFmt,
  altInput: false,
  allowInput: false,

  // behavior: clean re-select when opening from Check-in
  onOpen: (_sel, _str, instance) => {
    if (activeField === 'in') {
      // start fresh when user clicks "Check-in"
      instance.clear();
      inInput.value = '';
      outInput.value = '';
    }
    // keep months stable if we already had a start date
    if (instance.selectedDates[0]) {
      instance.jumpToDate(instance.selectedDates[0], true);
    }
  },

  // build the range and close only after two dates are chosen
  onChange: (selectedDates, _str, instance) => {
    if (selectedDates.length === 1) {
      inInput.value = instance.formatDate(selectedDates[0], displayFmt);
      return; // keep calendar open for end date
    }
    if (selectedDates.length === 2) {
      const [start, end] = selectedDates;
      inInput .value = instance.formatDate(start, displayFmt);
      outInput.value = instance.formatDate(end,   displayFmt);
      // close after a valid range is set
      setTimeout(() => instance.close(), 0);
    }
  }
});






      
      // Clicking inputs sets intent + resets as required
      const clearEnd = () => {
        // Keep only a start date if present; clear checkout field
        const [s] = fp.selectedDates;
        if (s) {
          fp.setDate([s], true); // true = trigger change -> keeps UI consistent
        } else {
          fp.clear();
        }
        inputTo.value = '';
      };

      inputFrom.addEventListener('focus', () => {
        intent = 'start';
        // Reset the end date so a *new* range can be chosen
        if (fp.selectedDates.length === 2) clearEnd();
        fp.open(); // shows intent banner via onOpen
      });
      inputFrom.addEventListener('click', () => {
        intent = 'start';
        if (fp.selectedDates.length === 2) clearEnd();
        fp.open();
      });

      inputTo.addEventListener('focus', () => {
        intent = 'end';
        if (fp.selectedDates.length === 0) {
          // No start yet? force user to pick start first
          intent = 'start';
          fp.open();
        } else {
          fp.open();
        }
      });
      inputTo.addEventListener('click', () => {
        intent = 'end';
        if (fp.selectedDates.length === 0) {
          intent = 'start';
          fp.open();
        } else {
          fp.open();
        }
      });

      // BOOK NOW: build URL ?checkin=YYYY-MM-DD&checkout=YYYY-MM-DD
      btn.addEventListener('click', () => {
        const url = this.getAttribute('book-url') || '';
        const [s, e] = fp.selectedDates;
        if (!url || !s || !e) return;

        const params = new URLSearchParams();
        params.set('checkin', fmt(s));
        params.set('checkout', fmt(e));

        // Navigate same tab
        location.href = `${url}?${params.toString()}`;
      });

      // Make host alignment reflect attribute (for demo styling)
      this.setAttribute('align', align);
    }

    updateIntentPill(instance, intent) {
      const c = instance.calendarContainer;
      let pill = c.querySelector('.fp-intent-pill');
      const text = intent === 'end' ? 'Choose check-out' : 'Choose check-in';
      if (!pill) {
        pill = document.createElement('div');
        pill.className = 'fp-intent-pill';
        c.insertBefore(pill, c.firstChild);
      }
      pill.textContent = text;
    }
  }

  customElements.define('mtolives-book-now', MtOlivesBookNow);
})();
