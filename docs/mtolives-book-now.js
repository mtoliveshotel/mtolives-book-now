/*! mtolives-book-now v0.4.5 | (c) 2025 Mount of Olives Hotel Ltd. | MIT */
(() => {
  const WIDGET_VERSION = '0.4.5';
  console.info(`mtolives-book-now ${ WIDGET_VERSION } loaded`);

  // ---------- helpers ----------
  const once = (k, fn) => (once[k] ? undefined : (once[k] = fn()));
  const loadScript = (src) => new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.defer = true; s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
  const loadCss = (href) => { const l = document.createElement('link'); l.rel='stylesheet'; l.href=href; document.head.appendChild(l); };
  const pad = n => String(n).padStart(2,'0');
  const fmtYMD = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

  // subtle global polish for the popup calendar (renders in <body>)
  once('global-flatpickr-css', () => {
    const style = document.createElement('style');
    style.textContent = `
      .flatpickr-calendar{border:1px solid rgba(0,0,0,.08)!important;box-shadow:0 10px 30px rgba(0,0,0,.18)!important}

      /* Hard-disable Flatpickr pointer pseudos (prevents giant chevron bug) */
      .flatpickr-calendar:before,
      .flatpickr-calendar:after{
        content:'' !important;
        border:0 !important;
        display:none !important;
      }
      .flatpickr-calendar.arrowTop:before,
      .flatpickr-calendar.arrowTop:after,
      .flatpickr-calendar.arrowBottom:before,
      .flatpickr-calendar.arrowBottom:after{
        content:'' !important;
        border:0 !important;
        display:none !important;
      }

      /* Hide pointer arrows/chevrons to prevent giant artifacts */
      .flatpickr-calendar.arrowTop:before,
      .flatpickr-calendar.arrowTop:after,
      .flatpickr-calendar.arrowBottom:before,
      .flatpickr-calendar.arrowBottom:after{
      display:none !important;
      }

      // .flatpickr-day.selected,.flatpickr-day.startRange,.flatpickr-day.endRange{background:#4a90e2;border-color:#4a90e2;color:#fff}
      // .flatpickr-day.inRange{background:rgba(74,144,226,.16)}
      // .flatpickr-day.flatpickr-disabled{opacity:.55}
      .flatpickr-day.selected,.flatpickr-day.startRange,.flatpickr-day.endRange{background:#808000;border-color:#808000;color:#fff}
      .flatpickr-day.inRange{background:rgba(128,128,0,.18)}
      .flatpickr-day.flatpickr-disabled,
      .flatpickr-day.disabled,
      .flatpickr-day.disabled:hover,
      .flatpickr-day.prevMonthDay,
      .flatpickr-day.nextMonthDay{background:#e5e7eb;color:#6b7280;opacity:1 !important;box-shadow:none !important;cursor:not-allowed !important}

      .fp-intent-pill{font:600 12px/1 system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#2b2b2b;
        background:#f4f6f8;border:1px solid #e5e7eb;border-radius:999px;padding:6px 10px;margin:8px 10px}
    `;
    document.head.appendChild(style);
  });

  class MtOlivesBookNow extends HTMLElement {
    static get observedAttributes() {
      return ['book-url','show-months','popup','display-format','locale','min-nights','max-nights','align','labels'];
    }

    constructor(){
      super();
      this.attachShadow({mode:'open'});
      const accent  = this.getAttribute('accent') || '#808000';
      const rounded = this.getAttribute('rounded')|| '10px';
      const labels  = (this.getAttribute('labels') || 'none').toLowerCase(); // 'none' | 'show'

      this.shadowRoot.innerHTML = `
        <link rel="stylesheet" href="./vendor/flatpickr/flatpickr.min.css">
        <style>
          :host{
            --accent:${accent}; --fieldW:250px; --rounded:${rounded};
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

          /* Darker disabled/past days */
          .flatpickr-day.disabled,
          .flatpickr-day.disabled:hover,
          .flatpickr-day.prevMonthDay,
          .flatpickr-day.nextMonthDay{
             background:#e5e7eb;
             color:#6b7280;
             opacity:1 !important;
            box-shadow:none !important;
            cursor:not-allowed !important;
          }

          /* Brand-colored selections */
          .flatpickr-day.selected,
          .flatpickr-day.startRange,
          .flatpickr-day.endRange{
            background: var(--accent, #808000);
            border-color: var(--accent, #808000);
            color: #fff;
          }
          .flatpickr-day.inRange{
            background: var(--hover, rgba(74,144,226,.22)); /* uses your --hover var */
            border-color: transparent;
          }



/* Kill Flatpickr pointer chevrons when calendar is rendered inside Shadow DOM */
.flatpickr-calendar:before,
.flatpickr-calendar:after,
.flatpickr-calendar.arrowTop:before,
.flatpickr-calendar.arrowTop:after,
.flatpickr-calendar.arrowBottom:before,
.flatpickr-calendar.arrowBottom:after{
  content:'' !important;
  border:0 !important;
  display:none !important;
}

/* Stabilize Flatpickr layout inside Shadow DOM */
/* Stabilize Flatpickr layout inside Shadow DOM */
.flatpickr-calendar,
.flatpickr-calendar *,
.flatpickr-calendar *::before,
.flatpickr-calendar *::after{
  box-sizing: border-box !important; /* align headers with day grid */
}

/* Let Flatpickr use its defaults for layout */
.flatpickr-calendar .flatpickr-days{ display:block; }
.flatpickr-calendar .dayContainer{ display:inline-block; }







        </style>
        <div class="bar ${labels === 'none' ? 'hideLabel' : ''}">
          <div class="group"><label>Check-in</label><input id="checkin" type="text" placeholder="Check-in" inputmode="none"></div>
          <div class="group"><label>Check-out</label><input id="checkout" type="text" placeholder="Check-out" inputmode="none"></div>
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
      try { await loadScript(`${LOCAL}/flatpickr.min.js`); }   catch { await loadScript(`${CDN}/dist/flatpickr.min.js`); }
      try { await loadScript(`${LOCAL}/plugins/rangePlugin.js`);} catch { await loadScript(`${CDN}/dist/plugins/rangePlugin.js`); }
    }

    async init(){
      await this.ensureFlatpickr();

      const r         = this.shadowRoot;
      const inputIn   = r.getElementById('checkin');
      const inputOut  = r.getElementById('checkout');
      const btn       = r.getElementById('book');

      const showMonths = Number(this.getAttribute('show-months') || '2');
      const displayFmt = this.getAttribute('display-format') || 'd M Y';
      const align      = this.getAttribute('align') || 'center';
      const minNights  = Math.max(1, Number(this.getAttribute('min-nights') || '1'));

      // who opened the popup last?
      let openedBy = 'in';
      inputIn .addEventListener('mousedown', () => { openedBy = 'in';  }, {capture:true});
      inputOut.addEventListener('mousedown', () => { openedBy = 'out'; }, {capture:true});

      // guard to avoid onChange -> setDate -> onChange recursion
      let mutating = false;
      const setDateSilently = (inst, dates) => {
        mutating = true;
        try { inst.setDate(dates, false); } finally { mutating = false; }
      };

      const mirrorInputs = (inst) => {
        const d = inst.selectedDates;
        if (d.length === 0){ inputIn.value=''; inputOut.value=''; return; }
        if (d.length === 1){ inputIn.value = inst.formatDate(d[0], displayFmt); inputOut.value=''; return; }
        inputIn.value  = inst.formatDate(d[0], displayFmt);
        inputOut.value = inst.formatDate(d[1], displayFmt);
      };

      const pill = (inst, side) => {
        const c = inst.calendarContainer;
        let x = c.querySelector('.fp-intent-pill');
        const text = side === 'end' ? 'Choose check-out' : 'Choose check-in';
        if (!x){ x = document.createElement('div'); x.className='fp-intent-pill'; c.insertBefore(x, c.firstChild); }
        x.textContent = text;
      };

      const fp = flatpickr(inputIn, {
        plugins: [ new rangePlugin({ input: inputOut }) ],
        showMonths,
        appendTo: this.shadowRoot.querySelector('.bar'),
        disableMobile: true,
        static: false,
        minDate: 'today',
        dateFormat: displayFmt,
        allowInput: false,
        closeOnSelect: false,

        onOpen: (_d,_s,inst) => {
          if (inst.selectedDates[0]) inst.jumpToDate(inst.selectedDates[0], true);
          pill(inst, openedBy === 'out' ? 'end' : 'start');
        },

        onChange: (dates,_str,inst) => {
          if (mutating) return; // prevent loops

          if (dates.length === 0){
            inputIn.value = inputOut.value = '';
            return;
          }

          if (dates.length === 1){
            mirrorInputs(inst);
            // nudge focus toward the next side
            if (openedBy === 'in') { setTimeout(() => inputOut.focus(), 0); pill(inst,'end'); }
            else                   { setTimeout(() => inputIn .focus(), 0); pill(inst,'start'); }
            return;
          }

          // two clicks made a range (or a collapsed same-day)
          let [s,e] = dates;

          // Case A: started from Check-in, clicked same/earlier -> re-anchor to start only
          if (openedBy === 'in' && e.getTime() <= s.getTime()){
            setDateSilently(inst, [s]);   // no re-entrant onChange
            mirrorInputs(inst);
            inputOut.value = '';          // clear checkout
            setTimeout(() => { openedBy='out'; inputOut.focus(); inst.jumpToDate(s,true); pill(inst,'end'); }, 0);
            return;
          }

          // Case B: started from Check-out, clicked before start -> treat click as new END
          if (openedBy === 'out' && e.getTime() <= s.getTime()){
            const end = e;
            setDateSilently(inst, [end]); // single anchor
            inputIn.value = '';
            inputOut.value = inst.formatDate(end, displayFmt);
            setTimeout(() => { openedBy='in'; inputIn.focus(); inst.jumpToDate(end,true); pill(inst,'start'); }, 0);
            return;
          }

          // Normal range, enforce min nights
          const nights = Math.round((e - s) / 86400000);
          if (nights < minNights){
            setDateSilently(inst, [s]); // re-anchor to start
            mirrorInputs(inst);
            inputOut.value = '';
            setTimeout(() => { openedBy='out'; inputOut.focus(); pill(inst,'end'); }, 0);
            return;
          }

          mirrorInputs(inst);
          setTimeout(() => inst.close(), 0);
        }
      });

      // BOOK NOW handoff
      btn.addEventListener('click', () => {
        const url = this.getAttribute('book-url') || '';
        const [s,e] = fp.selectedDates;
        if (!url || !s || !e) return;
        const q = new URLSearchParams({ checkin: fmtYMD(s), checkout: fmtYMD(e) });
        location.href = `${url}?${q.toString()}`;
      });

      this.setAttribute('align', align);
    }
  }

  customElements.define('mtolives-book-now', MtOlivesBookNow);
})();
