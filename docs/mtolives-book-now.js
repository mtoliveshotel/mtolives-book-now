/*! mtolives-book-now v0.4.6-pre | (c) 2025 Mount of Olives Hotel Ltd. | MIT */
(() => {
  const WIDGET_VERSION = '0.4.6-pre';
  console.info(`mtolives-book-now ${WIDGET_VERSION} loaded`);

  // ---------- helpers ----------
  const once = (k, fn) => (once[k] ? undefined : (once[k] = fn()));
  const loadScript = (src) => new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.defer = true; s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
  const loadCss = (href) => {
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = href;
    document.head.appendChild(l);
    return l;
  };
  const pad = n => String(n).padStart(2, '0');
  const fmtYMD = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  // Optional global polish if any popup ever renders in <body>
  once('global-flatpickr-css', () => {
    const style = document.createElement('style');
    style.textContent = `
      .flatpickr-calendar{border:1px solid rgba(0,0,0,.08)!important;box-shadow:0 10px 30px rgba(0,0,0,.18)!important}
      /* belt-and-suspenders: kill native pointer chevrons globally */
      .flatpickr-calendar:before,.flatpickr-calendar:after,
      .flatpickr-calendar.arrowTop:before,.flatpickr-calendar.arrowTop:after,
      .flatpickr-calendar.arrowBottom:before,.flatpickr-calendar.arrowBottom:after{display:none!important;border:0!important;content:''!important}
      .fp-intent-pill{font:600 12px/1 system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#2b2b2b;background:#f4f6f8;border:1px solid #e5e7eb;border-radius:999px;padding:6px 10px;margin:8px 10px}
    `;
    document.head.appendChild(style);
  });

  class MtOlivesBookNow extends HTMLElement {
    // private instance slots
    #fp;         // flatpickr instance
    #inputIn;    // <input id="checkin">
    #inputOut;   // <input id="checkout">

    static get observedAttributes () {
      return [
        'book-url',
        'show-months',
        'popup',
        'display-format',
        'min-nights',
        'max-nights',
        'align',
        'labels',
        'accent',
        'rounded',
        'label-checkin',
        'label-checkout',
        'label-choose-start',
        'label-choose-end'
      ];
    }

    // Centralized i18n that always reads current attributes
    get i18n() {
      return {
        checkin     : this.getAttribute('label-checkin')      || 'Check-in',
        checkout    : this.getAttribute('label-checkout')     || 'Check-out',
        chooseStart : this.getAttribute('label-choose-start') || 'Choose check-in',
        chooseEnd   : this.getAttribute('label-choose-end')   || 'Choose check-out',
        displayFmt  : this.getAttribute('display-format')     || 'd M Y',
      };
    }

    constructor(){
      super();
      this.attachShadow({ mode: 'open' });

      const accent  = this.getAttribute('accent')  || '#808000';
      const rounded = this.getAttribute('rounded') || '12px';
      const labels  = (this.getAttribute('labels') || 'none').toLowerCase(); // 'none' | 'show'

      this.shadowRoot.innerHTML = `
        <!-- Flatpickr CSS inside the shadow root -->
        <link id="fp-css" rel="stylesheet" href="./vendor/flatpickr/flatpickr.min.css">

        <style>
          :host{
            --accent: ${accent};
            --hover: rgba(128,128,0,.24);
            --fieldW: 250px;
            --rounded: ${rounded};
            --shadow: 0 10px 28px rgba(0,0,0,.18);
            font: 14px/1.4 system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;
          }
          *,*::before,*::after{ box-sizing: border-box; }

          .bar{ display:flex; gap:12px; align-items:center; }
          :host([align="center"]) .bar{ justify-content:center; }
          :host([align="right"])  .bar{ justify-content:flex-end; }

          .group{ display:flex; flex-direction:column; gap:6px; }
          label{ font-weight:600; color:#2b2b2b; }
          .hideLabel label{ display:none; }

          input{
            width:var(--fieldW); height:42px; padding:12px;
            border:1px solid #d9dde2; border-radius:var(--rounded);
            outline:none; background:#fff; box-shadow:0 1px 0 rgba(0,0,0,.04) inset;
          }
          input:focus{ border-color:#67b1ff; box-shadow:0 0 0 3px rgba(103,177,255,.22); }

          button{
            height:42px; padding:10px 18px; border-radius:999px; border:0;
            background:var(--accent); color:#000; font-weight:700; letter-spacing:.02em;
            cursor:pointer; box-shadow:var(--shadow);
          }
          button:disabled{ opacity:.5; cursor:not-allowed; }

          /* --- Flatpickr theming inside shadow --- */

          /* hide pointer chevrons when rendered in shadow */
          .flatpickr-calendar:before,
          .flatpickr-calendar:after,
          .flatpickr-calendar.arrowTop:before,
          .flatpickr-calendar.arrowTop:after,
          .flatpickr-calendar.arrowBottom:before,
          .flatpickr-calendar.arrowBottom:after{ display:none!important; border:0!important; content:''!important; }

          .flatpickr-day.selected,
          .flatpickr-day.startRange,
          .flatpickr-day.endRange{ background:var(--accent); border-color:var(--accent); color:#fff; }
          .flatpickr-day.selected:hover,
          .flatpickr-day.startRange:hover,
          .flatpickr-day.endRange:hover{ background:var(--accent); border-color:var(--accent); color:#fff; }

          /* In-range tint in brand olive (no theme blues) */
          .flatpickr-day.inRange,
          .flatpickr-day.inRange:hover{
            background: var(--hover) !important;
            border-color: transparent !important;
            color: #111 !important;
          }

          /* Disabled + out-of-month numerals slightly darker than default; no pill */
          .flatpickr-calendar .flatpickr-day[aria-disabled="true"],
          .flatpickr-calendar .flatpickr-day.flatpickr-disabled,
          .flatpickr-calendar .flatpickr-day.prevMonthDay,
          .flatpickr-calendar .flatpickr-day.nextMonthDay{
            color:#c0c0c0!important; background:transparent!important;
            border-color:transparent!important; box-shadow:none!important; opacity:1!important;
          }
          .flatpickr-calendar .flatpickr-day[aria-disabled="true"]:hover,
          .flatpickr-calendar .flatpickr-day.flatpickr-disabled:hover,
          .flatpickr-calendar .flatpickr-day.prevMonthDay:hover,
          .flatpickr-calendar .flatpickr-day.nextMonthDay:hover{
            color:#c0c0c0!important; background:transparent!important; box-shadow:none!important;
          }

          /* tiny pointer that tracks focused field */
          .mto-pin{
            position:absolute; top:-8px; left:0; transform:translateX(-50%);
            width:0; height:0; border-left:8px solid transparent; border-right:8px solid transparent;
            border-bottom:8px solid #e5e7eb; pointer-events:none; z-index:3; filter:drop-shadow(0 1px 0 rgba(0,0,0,.05));
          }
        </style>

        <div class="bar ${labels === 'none' ? 'hideLabel' : ''}">
          <div class="group"><label>Check-in</label><input id="checkin" type="text" placeholder="Check-in" inputmode="none"></div>
          <div class="group"><label>Check-out</label><input id="checkout" type="text" placeholder="Check-out" inputmode="none"></div>
          <button id="book">BOOK NOW</button>
        </div>
      `;
    }

    // --- public: reflect label attributes into UI + placeholders
    applyLabels(){
      const r = this.shadowRoot;
      const [labIn, labOut] = r.querySelectorAll('.group > label');
      const inputIn  = r.getElementById('checkin');
      const inputOut = r.getElementById('checkout');

      // visible label text
      if (labIn)  labIn.textContent  = this.i18n.checkin;
      if (labOut) labOut.textContent = this.i18n.checkout;

      // show/hide the visual labels
      const hide = (this.getAttribute('labels') || '').toLowerCase();
      const wrap = r.querySelector('.bar');
      const shouldHide = hide === 'hidden' || hide === 'none' || hide === 'false';
      if (wrap) wrap.classList.toggle('hideLabel', shouldHide);

      // placeholders
      if (inputIn && inputOut) {
        // keep placeholders aligned with label text
        inputIn.placeholder  = this.i18n.checkin;
        inputOut.placeholder = this.i18n.checkout;
      }
    }

    // keep inputs in sync with the current picker + format
    #mirrorInputs(inst = this.#fp){
      if (!inst || !this.#inputIn || !this.#inputOut) return;
      const df = inst.config?.dateFormat || this.i18n.displayFmt;
      const d = inst.selectedDates;
      if (d.length === 0){ this.#inputIn.value = this.#inputOut.value = ''; return; }
      if (d.length === 1){ this.#inputIn.value = inst.formatDate(d[0], df); this.#inputOut.value = ''; return; }
      this.#inputIn.value  = inst.formatDate(d[0], df);
      this.#inputOut.value = inst.formatDate(d[1], df);
    }

    connectedCallback(){ this.applyLabels(); this.init(); }

    attributeChangedCallback (name, oldVal, newVal) {
      if (oldVal === newVal) return;

      switch (name) {
        case 'labels':
        case 'label-checkin':
        case 'label-checkout':
        case 'label-choose-start':
        case 'label-choose-end':
          this.applyLabels?.();
          if (this.#fp && this.#fp.calendarContainer) {
            const pillEl = this.#fp.calendarContainer.querySelector('.fp-intent-pill');
            if (pillEl) {
              const activeIsOut =
                (this.shadowRoot?.activeElement === this.#inputOut) ||
                (document.activeElement === this.#inputOut);
              pillEl.textContent = activeIsOut ? this.i18n.chooseEnd : this.i18n.chooseStart;
            }
          }
          break;

        case 'display-format':
          if (this.#fp) {
            this.#fp.set('dateFormat', this.i18n.displayFmt);
            this.#mirrorInputs(); // keep inputs in sync with new format
          }
          break;

        default:
          break;
      }
    }

    async ensureFlatpickr(){
      if (window.flatpickr) return;
      const LOCAL = './vendor/flatpickr';
      const CDN   = 'https://cdn.jsdelivr.net/npm/flatpickr@4.6.13';
      once('flatpickr-css', () => loadCss(`${LOCAL}/flatpickr.min.css`)); // global safety
      try { await loadScript(`${LOCAL}/flatpickr.min.js`); }   catch { await loadScript(`${CDN}/dist/flatpickr.min.js`); }
      try { await loadScript(`${LOCAL}/plugins/rangePlugin.js`);} catch { await loadScript(`${CDN}/dist/plugins/rangePlugin.js`); }
    }

    async init(){
      await this.ensureFlatpickr();

      // Wait for the Shadow-DOM flatpickr CSS to parse before creating the picker
      {
        const link = this.shadowRoot.getElementById('fp-css');
        if (link && !link.sheet) {
          await new Promise(resolve => link.addEventListener('load', resolve, { once:true }));
        }
      }

      const r        = this.shadowRoot;
      this.#inputIn  = r.getElementById('checkin');
      this.#inputOut = r.getElementById('checkout');
      const btn      = r.getElementById('book');

      const showMonths = Number(this.getAttribute('show-months') || '2');
      const displayFmt = this.i18n.displayFmt;
      const align      = this.getAttribute('align') || 'center';
      const minNights  = Math.max(1, Number(this.getAttribute('min-nights') || '1'));

      // remember which input opened the calendar
      let openedBy = 'in';
      this.#inputIn .addEventListener('mousedown', () => { openedBy = 'in';  }, { capture:true });
      this.#inputOut.addEventListener('mousedown', () => { openedBy = 'out'; }, { capture:true });

      // prevent onChange recursion
      let mutating = false;
      const setDateSilently = (inst, arr) => { mutating = true; try { inst.setDate(Array.isArray(arr)?arr:[arr], false); } finally { mutating = false; } };

      // top “intent” pill inside the calendar
      const pill = (inst, side) => {
        const c = inst.calendarContainer;
        let x = c.querySelector('.fp-intent-pill');
        if (!x) { x = document.createElement('div'); x.className = 'fp-intent-pill'; c.insertBefore(x, c.firstChild); }
        x.textContent = side === 'end' ? this.i18n.chooseEnd : this.i18n.chooseStart;
      };

      // little pointer that follows the focused field
      const ensurePin = (inst) => {
        const c = inst.calendarContainer;
        if (!c.querySelector('.mto-pin')) {
          const pin = document.createElement('div');
          pin.className = 'mto-pin';
          c.appendChild(pin);
        }
      };
      const positionPin = (inst, side) => {
        const c = inst.calendarContainer;
        const pin = c.querySelector('.mto-pin'); if (!pin) return;
        const target = (side === 'end' || openedBy === 'out' || document.activeElement === this.#inputOut)
          ? this.#inputOut : this.#inputIn;
        const cr = c.getBoundingClientRect();
        const tr = target.getBoundingClientRect();
        pin.style.left = `${tr.left + tr.width / 2 - cr.left}px`;
      };

      this.#fp = flatpickr(this.#inputIn, {
        plugins: [ new rangePlugin({ input: this.#inputOut }) ],
        showMonths,
        appendTo: this.shadowRoot.querySelector('.bar'),
        static: true,
        disableMobile: true,
        minDate: 'today',
        dateFormat: displayFmt,
        allowInput: false,
        closeOnSelect: false,

        onOpen: (_d,_s,inst) => {
          if (inst.selectedDates[0]) inst.jumpToDate(inst.selectedDates[0], true);
          pill(inst, openedBy === 'out' ? 'end' : 'start');
          ensurePin(inst);
          positionPin(inst, openedBy === 'out' ? 'end' : 'start');
        },

        // Avoid chevron flash & misaligned header on hard reloads
        onReady: (_dates, _str, inst) => {
          const cal  = inst.calendarContainer;
          const link = this.shadowRoot.getElementById('fp-css');
          cal.style.visibility = 'hidden';
          const showAndRedraw = () => {
            try { inst.redraw && inst.redraw(); } catch {}
            requestAnimationFrame(() => { try { inst.redraw(); } catch {} cal.style.visibility = 'visible'; });
            setTimeout(() => { try { inst.redraw(); } catch {} cal.style.visibility = 'visible'; }, 120);
          };
          if (link && !link.sheet) link.addEventListener('load', showAndRedraw, { once:true });
          else showAndRedraw();
        },

        onChange: (dates,_str,inst) => {
          if (mutating) return;

          // helper must be defined BEFORE first use; uses lexical `this`
          const setDateInterim = (anchor, asEnd = false) => {
            if (asEnd){
              setDateSilently(inst, [anchor]);
              this.#inputIn.value  = '';
              this.#inputOut.value = inst.formatDate(anchor, displayFmt);
              setTimeout(() => {
                openedBy = 'in';
                this.#inputIn.focus();
                inst.jumpToDate(anchor, true);
                pill(inst,'start');
              }, 0);
            } else {
              setDateSilently(inst, [anchor]);
              this.#mirrorInputs(inst);
              this.#inputOut.value = '';
              setTimeout(() => {
                openedBy = 'out';
                this.#inputOut.focus();
                inst.jumpToDate(anchor, true);
                pill(inst,'end');
              }, 0);
            }
          };

          if (dates.length === 0){
            this.#inputIn.value = this.#inputOut.value = '';
            return;
          }

          if (dates.length === 1){
            this.#mirrorInputs(inst);
            if (openedBy === 'in') { setTimeout(() => this.#inputOut.focus(), 0); pill(inst,'end'); }
            else                   { setTimeout(() => this.#inputIn .focus(), 0); pill(inst,'start'); }
            return;
          }

          let [s,e] = dates;

          // If starting from check-in and user clicked earlier/same day → re-anchor start only
          if (openedBy === 'in' && e.getTime() <= s.getTime()){
            setDateInterim(s);
            return;
          }
          // If starting from check-out and user clicked before start → treat click as new END anchor
          if (openedBy === 'out' && e.getTime() <= s.getTime()){
            setDateInterim(e, /*asEnd*/ true);
            return;
          }

          // Enforce minimum nights
          const nights = Math.round((e - s) / 86400000);
          const minNights = Math.max(1, Number(this.getAttribute('min-nights') || '1'));
          if (nights < minNights){
            setDateInterim(s);
            return;
          }

          this.#mirrorInputs(inst);
          setTimeout(() => inst.close(), 0);
        }
      });

      // BOOK NOW handoff
      btn.addEventListener('click', () => {
        const url = this.getAttribute('book-url') || '';
        const [s,e] = this.#fp.selectedDates;
        if (!url || !s || !e) return;
        const q = new URLSearchParams({ checkin: fmtYMD(s), checkout: fmtYMD(e) });
        location.href = `${url}?${q.toString()}`;
      });

      // reflect alignment preference
      this.setAttribute('align', align);
    }
  }

  customElements.define('mtolives-book-now', MtOlivesBookNow);
})();
