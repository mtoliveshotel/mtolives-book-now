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
  const loadCss = (href) => { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; document.head.appendChild(l); };
  const pad = n => String(n).padStart(2, '0');
  const fmtYMD = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  // Optional global polish if any popup ever renders in <body>
  once('global-flatpickr-css', () => {
    const style = document.createElement('style');
    style.textContent = `
      .flatpickr-calendar{border:1px solid rgba(0,0,0,.08)!important;box-shadow:0 10px 30px rgba(0,0,0,.18)!important}
      /* disable pointer chevrons globally as a safety net */
      .flatpickr-calendar:before,.flatpickr-calendar:after,
      .flatpickr-calendar.arrowTop:before,.flatpickr-calendar.arrowTop:after,
      .flatpickr-calendar.arrowBottom:before,.flatpickr-calendar.arrowBottom:after{display:none!important;border:0!important;content:''!important}
      .fp-intent-pill{font:600 12px/1 system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#2b2b2b; background:#f4f6f8;border:1px solid #e5e7eb;border-radius:999px;padding:6px 10px;margin:8px 10px}
    `;
    document.head.appendChild(style);
  });

  class MtOlivesBookNow extends HTMLElement {
    static get observedAttributes() {
      return ['book-url','show-months','display-format','min-nights','align','labels','accent','rounded'];
    }

    constructor(){
      super();
      this.attachShadow({ mode: 'open' });

      const accent  = this.getAttribute('accent')  || '#808000';
      const rounded = this.getAttribute('rounded') || '12px';
      const labels  = (this.getAttribute('labels') || 'none').toLowerCase(); // 'none' | 'show'

      this.shadowRoot.innerHTML = `
        <!-- Ensure Flatpickr CSS is available *inside* the shadow root -->
        <link id=\"fp-css\" rel=\"stylesheet\" href=\"./vendor/flatpickr/flatpickr.min.css\"> 
        <style>
          :host{
            --accent:${accent};

            --hover: rgba(128,128,0,.24);

            --fieldW: 250px;
            --rounded:${rounded};
            --shadow: 0 10px 28px rgba(0,0,0,.18);
            font: 14px/1.4 system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;
          }
          *,*::before,*::after{ box-sizing: border-box; }

          .bar{ display:flex; gap:12px; align-items:center; }
          :host([align=\"center\"]) .bar{ justify-content:center; }
          :host([align=\"right\"])  .bar{ justify-content:flex-end; }

          .group{ display:flex; flex-direction:column; gap:6px; }
          label{ font-weight:600; color:#2b2b2b; }
          .hideLabel label{ display:none; }

          input{
            width:var(--fieldW); height:42px; padding:12px; border:1px solid #d9dde2; border-radius:var(--rounded);
            outline: none; background:#fff; box-shadow:0 1px 0 rgba(0,0,0,.04) inset;
          }
          input:focus{ border-color:#67b1ff; box-shadow:0 0 0 3px rgba(103,177,255,.22); }

          button{ height:42px; padding:10px 18px; border-radius:999px; border:0; background:var(--accent); color:#000;
                  font-weight:700; letter-spacing:.02em; cursor:pointer; box-shadow:var(--shadow); }
          button:disabled{ opacity:.5; cursor:not-allowed; }

          /* --- Flatpickr theming inside shadow --- */
          .flatpickr-day.disabled,
          .flatpickr-day.disabled:hover,
          .flatpickr-day.prevMonthDay,
          .flatpickr-day.nextMonthDay{ background:#e5e7eb; color:#6b7280; opacity:1!important; box-shadow:none!important; cursor:not-allowed!important; }

          .flatpickr-day.selected,
          .flatpickr-day.startRange,
          .flatpickr-day.endRange{ background:var(--accent); border-color:var(--accent); color:#fff; }
          .flatpickr-day.selected:hover,
          .flatpickr-day.startRange:hover,
          .flatpickr-day.endRange:hover{ background:var(--accent); border-color:var(--accent); color:#fff; }

          .flatpickr-day.inRange{ background:var(--hover); border-color:transparent; }
          .flatpickr-day.inRange:hover{ background:rgba(128,128,0,.22); }

          /* hide pointer chevrons when rendered in shadow */
          .flatpickr-calendar:before,
          .flatpickr-calendar:after,
          .flatpickr-calendar.arrowTop:before,
          .flatpickr-calendar.arrowTop:after,
          .flatpickr-calendar.arrowBottom:before,
          .flatpickr-calendar.arrowBottom:after{ display:none!important; border:0!important; content:''!important; }


/* Tiny pointer triangle that will track the focused field */
.mto-pin{
  position: absolute;
  top: -8px;                  /* sits just above the calendar */
  left: 0;                    /* JS will set the exact left in px */
  transform: translateX(-50%);
  width: 0; height: 0;
  border-left: 8px solid transparent;
  border-right: 8px solid transparent;
  border-bottom: 8px solid #e5e7eb;  /* match calendar border color */
  pointer-events: none;
  z-index: 3;
  filter: drop-shadow(0 1px 0 rgba(0,0,0,.05));
}




/* Force brand olive for in-range (override any theme defaults) */
.flatpickr-day.inRange,
.flatpickr-day.inRange:hover{
  background: var(--hover, rgba(128,128,0,.24)) !important;
  border-color: transparent !important;
  color: #111 !important; /* keep numerals readable */
}




/* Hard override: make in-range use olive (no blue, no glow) — works with rangePlugin */
.flatpickr-calendar .flatpickr-days .dayContainer .flatpickr-day.inRange,
.flatpickr-calendar .flatpickr-days .dayContainer .flatpickr-day.inRange:hover,
.flatpickr-calendar .flatpickr-days .dayContainer .flatpickr-day.inRange:focus{
  background: var(--hover, rgba(128,128,0,.24)) !important;
  background-image: none !important;
  border-color: transparent !important;
  box-shadow: none !important;
  color: #111 !important;
}


/* Center the BOOK NOW button inside the bar */
#book{
  margin-inline: auto;   /* centers within the flex row */
  align-self: center;    /* vertical centering in the row */
}


        
        </style>
        <div class=\"bar ${labels === 'none' ? 'hideLabel' : ''}\"> 
          <div class=\"group\"><label>Check-in</label><input id=\"checkin\" type=\"text\" placeholder=\"Check-in\" inputmode=\"none\"></div>
          <div class=\"group\"><label>Check-out</label><input id=\"checkout\" type=\"text\" placeholder=\"Check-out\" inputmode=\"none\"></div>
          <button id=\"book\">BOOK NOW</button>
        </div>
      `;
    }

    connectedCallback(){ this.init(); }

    async ensureFlatpickr(){
      if (window.flatpickr) return;
      const LOCAL = './vendor/flatpickr';
      const CDN   = 'https://cdn.jsdelivr.net/npm/flatpickr@4.6.13';
      // keep a global link too (helps tools that pop outside shadow)
      once('flatpickr-css', () => loadCss(`${LOCAL}/flatpickr.min.css`));
      try { await loadScript(`${LOCAL}/flatpickr.min.js`); }   catch { await loadScript(`${CDN}/dist/flatpickr.min.js`); }
      try { await loadScript(`${LOCAL}/plugins/rangePlugin.js`);} catch { await loadScript(`${CDN}/dist/plugins/rangePlugin.js`); }
    }

    async init(){
      await this.ensureFlatpickr();

// Wait for the Shadow-DOM flatpickr CSS to be parsed before creating the picker.
// This prevents chevron flash and bad first-paint measurements on hard reload.
{
  const link = this.shadowRoot.getElementById('fp-css');
  if (link && !link.sheet) {
    await new Promise(resolve => link.addEventListener('load', resolve, { once: true }));
  }
}


      const r        = this.shadowRoot;
      const inputIn  = r.getElementById('checkin');
      const inputOut = r.getElementById('checkout');
      const btn      = r.getElementById('book');

      const showMonths  = Number(this.getAttribute('show-months') || '2');
      const displayFmt  = this.getAttribute('display-format') || 'd M Y';
      const align       = this.getAttribute('align') || 'center';
      const minNights   = Math.max(1, Number(this.getAttribute('min-nights') || '1'));

      // track which input the user touched last (guides re-anchoring/labels)
      let openedBy = 'in';
      inputIn .addEventListener('mousedown', () => { openedBy = 'in';  }, { capture:true });
      inputOut.addEventListener('mousedown', () => { openedBy = 'out'; }, { capture:true });

      // prevent onChange recursion
      let mutating = false;
      const setDateSilently = (inst, arr) => { mutating = true; try { inst.setDate(Array.isArray(arr)?arr:[arr], false); } finally { mutating = false; } };

      const mirrorInputs = (inst) => {
        const d = inst.selectedDates;
        if (d.length === 0){ inputIn.value = ''; inputOut.value = ''; return; }
        if (d.length === 1){ inputIn.value = inst.formatDate(d[0], displayFmt); inputOut.value = ''; return; }
        inputIn.value  = inst.formatDate(d[0], displayFmt);
        inputOut.value = inst.formatDate(d[1], displayFmt);
      };

      const pill = (inst, side) => {
        const c = inst.calendarContainer;
        let x = c.querySelector('.fp-intent-pill');
        const text = side === 'end' ? 'Choose check-out' : 'Choose check-in';
        if (!x){ x = document.createElement('div'); x.className = 'fp-intent-pill'; c.insertBefore(x, c.firstChild); }
        x.textContent = text;
      };

      
// --- pointer that follows the active input ---
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
  const pin = c.querySelector('.mto-pin');
  if (!pin) return;
  // choose target input based on focus/openedBy or explicit side
  const target = (side === 'end' || openedBy === 'out' || document.activeElement === inputOut)
    ? inputOut : inputIn;
  const cr = c.getBoundingClientRect();
  const tr = target.getBoundingClientRect();
  const left = tr.left + tr.width / 2 - cr.left;
  pin.style.left = `${left}px`;
};
















      

      

      
      const fp = flatpickr(inputIn, {
        plugins: [ new rangePlugin({ input: inputOut }) ],
        showMonths,
        appendTo: this.shadowRoot.querySelector('.bar'), // render inside shadow
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




        
        
        
        // Critical: reflow after the shadow <link id="fp-css"> is loaded so headers match grids
onReady: (_dates, _str, inst) => {
  const cal  = inst.calendarContainer;
  const link = this.shadowRoot.getElementById('fp-css');

  // Hide until CSS is definitely applied to avoid chevron flash & bad measurements
  cal.style.visibility = 'hidden';

  const showAndRedraw = () => {
    try { inst.redraw && inst.redraw(); } catch {}
    // extra safety passes for hard-reload races
    requestAnimationFrame(() => { try { inst.redraw(); } catch {} cal.style.visibility = 'visible'; });
    setTimeout(() => { try { inst.redraw(); } catch {} cal.style.visibility = 'visible'; }, 120);
  };

  if (link && !link.sheet) {
    // CSS not parsed yet: wait for it, then redraw & show
    link.addEventListener('load', showAndRedraw, { once: true });
  } else {
    // CSS already parsed (or no link found): still do staggered redraws
    showAndRedraw();
  }
},





        

        
        onChange: (dates,_str,inst) => {
          if (mutating) return;

          if (dates.length === 0){ inputIn.value = inputOut.value = ''; return; }

          if (dates.length === 1){
            // user picked first anchor; show that and move focus to the other input
            mirrorInputs(inst);
            if (openedBy === 'in') { setTimeout(() => inputOut.focus(), 0); pill(inst,'end'); }
            else                   { setTimeout(() => inputIn .focus(), 0); pill(inst,'start'); }
            return;
          }

          // two dates present => candidate range
          let [s,e] = dates;

          // If starting from check-in and user clicked an earlier/same day, re-anchor start only
          if (openedBy === 'in' && e.getTime() <= s.getTime()){
            setDateInterim(s);
            return;
          }

          // If starting from check-out and user clicked before start, treat click as new END anchor
          if (openedBy === 'out' && e.getTime() <= s.getTime()){
            setDateInterim(e, /*asEnd*/ true);
            return;
          }

          // Enforce minimum nights
          const nights = Math.round((e - s) / 86400000);
          if (nights < minNights){
            setDateInterim(s);
            return;
          }

          mirrorInputs(inst);
          setTimeout(() => inst.close(), 0);

          function setDateInterim(anchor, asEnd){
            if (asEnd){
              setDateSilently(inst, [anchor]);
              inputIn.value = '';
              inputOut.value = inst.formatDate(anchor, displayFmt);
              setTimeout(() => { openedBy='in'; inputIn.focus(); inst.jumpToDate(anchor, true); pill(inst,'start'); }, 0);
            } else {
              setDateSilently(inst, [anchor]);
              mirrorInputs(inst);
              inputOut.value = '';
              setTimeout(() => { openedBy='out'; inputOut.focus(); inst.jumpToDate(anchor, true); pill(inst,'end'); }, 0);
            }
          }
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

      // reflect alignment preference once
      this.setAttribute('align', align);
    }
  }

  customElements.define('mtolives-book-now', MtOlivesBookNow);
})();
