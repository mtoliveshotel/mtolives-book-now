/*! mtolives-book-now v0.4.4 | (c) 2025 Mount of Olives Hotel Ltd. | MIT */
(() => {
  const WIDGET_VERSION = '0.4.4';
  console.info(`mtolives-book-now ${WIDGET_VERSION} loaded`);

  // ---------- helpers ----------
  const once = (key, fn) => (once[key] ? undefined : (once[key] = fn()));
  const loadScript = (src) => new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.defer = true; s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
  const loadCss = (href) => {
    const l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = href;
    document.head.appendChild(l);
  };
  const fmtYMD = (d) => {
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;
  };

  // Global calendar polish (calendar renders in <body>, not shadow)
  once('global-flatpickr-css', () => {
    const css = `
      .flatpickr-calendar{border:1px solid rgba(0,0,0,.08)!important;box-shadow:0 10px 30px rgba(0,0,0,.18)!important}
      .flatpickr-day.selected,.flatpickr-day.startRange,.flatpickr-day.endRange{background:#4a90e2;border-color:#4a90e2;color:#fff}
      .flatpickr-day.inRange{background:rgba(74,144,226,.16)}
      .flatpickr-day.flatpickr-disabled{opacity:.55}
      .fp-intent-pill{font:600 12px/1 system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#2b2b2b;
        background:#f4f6f8;border:1px solid #e5e7eb;border-radius:999px;padding:6px 10px;margin:8px 10px}
    `;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  });

  class MtOlivesBookNow extends HTMLElement {
    static get observedAttributes() {
      return ['book-url','show-months','popup','display-format',
              'locale','min-nights','max-nights','align','labels'];
    }

    constructor(){
      super();
      this.attachShadow({mode:'open'});

      const accent  = this.getAttribute('accent') || '#808000';
      const rounded = this.getAttribute('rounded')|| '10px';
      const labels  = (this.getAttribute('labels') || 'none').toLowerCase(); // 'none' | 'show'

      this.shadowRoot.innerHTML = `
        <style>
          :host{
            --accent:${accent};
            --fieldW:250px; --rounded:${rounded};
            --shadow:0 10px 28px rgba(0,0,0,.18);
            font:14px/1.4 system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;
          }
          *,*::before,*::after{box-sizing:border-box}
          .bar{display:flex;gap:12px;align-items:center}
          :host([align="center"]) .bar{justify-content:center}

          .group{display:flex;flex-direction:column;gap:6px}
          label{font-weight:600;color:#2b2b2b}
          .hideLabel label{display:none}

          input{
            width:var(--fieldW);padding:12px;border:1px solid #d9dde2;border-radius:var(--rounded);
            outline:none;background:#fff;box-shadow:0 1px 0 rgba(0,0,0,.04) inset;height:42px;
          }
          input:focus{border-color:#67b1ff;box-shadow:0 0 0 3px rgba(103,177,255,.22)}

          button{
            padding:10px 18px;border-radius:999px;border:0;background:var(--accent);color:#000;
            font-weight:700;letter-spacing:.02em;cursor:pointer;box-shadow:var(--shadow);height:42px;
          }
          button:disabled{opacity:.5;cursor:not-allowed}
        </style>
        <div class="bar ${labels === 'none' ? 'hideLabel' : ''}">
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

    async ensureFlatpickr(){
      if (window.flatpickr) return;
      const LOCAL = './vendor/flatpickr';
      const CDN   = 'https://cdn.jsdelivr.net/npm/flatpickr@4.6.13';

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

      const showMonths = Number(this.getAttribute('show-months') || '2');
      const displayFmt = this.getAttribute('display-format') || 'd M Y';
      const align      = this.getAttribute('align') || 'center';
      const minNights  = Math.max(1, Number(this.getAttribute('min-nights') || '1'));

      // Track which field opened (for re-anchoring logic + "intent pill")
      let openedBy = 'in';
      inputIn .addEventListener('mousedown', () => { openedBy = 'in';  }, {capture:true});
      inputOut.addEventListener('mousedown', () => { openedBy = 'out'; }, {capture:true});

      const fp = flatpickr(inputIn, {
        plugins: [ new rangePlugin({ input: inputOut }) ],
        showMonths,
        disableMobile:true,
        static:false,
        minDate:'today',
        dateFormat:displayFmt,
        allowInput:false,
        closeOnSelect:false,  // keep open until we explicitly close on valid range

        onOpen: (_sel,_str,inst) => {
          if (inst.selectedDates[0]) inst.jumpToDate(inst.selectedDates[0], true);
          this.intentPill(inst, openedBy === 'out' ? 'end' : 'start');
        },

        onChange: (dates,_s,inst) => {
          // We implement "smart re-anchor":
          //  - If user started from Check-in and picked a date beyond the old end,
          //    flatten's default collapses start=end and closes. We intercept and
          //    re-anchor to a single start, keep open, and move focus to Check-out.
          //  - If user started from Check-out and picked a date before the old start,
          //    we re-anchor to a single end, keep open, and move focus to Check-in.

          const setInputsFromDates = () => {
            if (inst.selectedDates.length === 0) { inputIn.value=''; inputOut.value=''; return; }
            if (inst.selectedDates.length === 1) {
              inputIn.value = inst.formatDate(inst.selectedDates[0], displayFmt);
              inputOut.value = '';
              return;
            }
            const [s,e] = inst.selectedDates;
            inputIn.value  = inst.formatDate(s, displayFmt);
            inputOut.value = inst.formatDate(e, displayFmt);
          };

          if (dates.length === 1) {
            // Single anchor selected — mirror to inputs and keep open
            setInputsFromDates();
            return;
          }

          if (dates.length === 2) {
            let [s,e] = dates;

            // Case A: user opened from Check-in and clicked far in the future
            if (openedBy === 'in' && e.getTime() === s.getTime()) {
              // Re-anchor to start only
              inst.setDate([s], true); // updates selectedDates to [s] and inputIn
              inputOut.value = '';
              setTimeout(() => { openedBy = 'out'; inputOut.focus(); inst.jumpToDate(s, true); }, 0);
              return;
            }

            // Case B: user opened from Check-out and clicked before the start
            if (openedBy === 'out' && e.getTime() <= s.getTime()) {
              // Re-anchor to end only (treat clicked day as new end)
              const end = e; // the clicked date
              inst.clear(false);
              inst.setDate([end], true); // flatpickr treats single date as "start"; we mirror to checkout
              inputIn.value  = '';                       // clear start in UI
              inputOut.value = inst.formatDate(end, displayFmt);
              setTimeout(() => { openedBy = 'in'; inputIn.focus(); inst.jumpToDate(end, true); }, 0);
              return;
            }

            // Normal range completion
            const nights = Math.round((e - s) / 86400000);
            if (nights < minNights) {
              // Too short: keep open, re-anchor to the first date
              inst.setDate([s], true);
              inputOut.value = '';
              setTimeout(() => { openedBy = 'out'; inputOut.focus(); }, 0);
              return;
            }

            setInputsFromDates();
            // Close after a valid range
            setTimeout(() => inst.close(), 0);
          }
        }
      });

      // BOOK NOW -> hand off with ?checkin=YYYY-MM-DD&checkout=YYYY-MM-DD
      btn.addEventListener('click', () => {
        const url = this.getAttribute('book-url') || '';
        const [s,e] = fp.selectedDates;
        if (!url || !s || !e) return;
        const q = new URLSearchParams({ checkin: fmtYMD(s), checkout: fmtYMD(e) });
        location.href = `${url}?${q.toString()}`;
      });

      this.setAttribute('align', align);
    }

    intentPill(instance, intent){
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
