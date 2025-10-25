/*! mtolives-book-now v0.4.6 — max-nights + hover-split | (c) 2025 Mount of Olives Hotel Ltd. | MIT */
(() => {
  const WIDGET_VERSION = '0.4.6';
  console.info(`mtolives-book-now ${WIDGET_VERSION} loaded`);

  // helpers
  const once = (k, fn) => (once[k] ? undefined : (once[k] = fn()));
  const loadScript = (src) => new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.defer = true; s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
  const loadCss = (href) => { const l = document.createElement('link'); l.rel='stylesheet'; l.href=href; document.head.appendChild(l); return l; };
  const pad = n => String(n).padStart(2, '0');
  const fmtYMD = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

  // small global polish if any calendar leaks into <body>
  once('global-flatpickr-css', () => {
    const style = document.createElement('style');
    style.textContent = `
      .flatpickr-calendar{border:1px solid rgba(0,0,0,.08)!important;box-shadow:0 10px 30px rgba(0,0,0,.18)!important}
      .flatpickr-calendar:before,.flatpickr-calendar:after,
      .flatpickr-calendar.arrowTop:before,.flatpickr-calendar.arrowTop:after,
      .flatpickr-calendar.arrowBottom:before,.flatpickr-calendar.arrowBottom:after{display:none!important;border:0!important;content:''!important}
      .fp-intent-pill{font:600 12px/1 system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#2b2b2b;background:#f4f6f8;border:1px solid #e5e7eb;border-radius:999px;padding:6px 10px;margin:8px 10px}
    `;
    document.head.appendChild(style);
  });

  class MtOlivesBookNow extends HTMLElement {
    #fp; #inputIn; #inputOut;

    static get observedAttributes () {
      return [
        'book-url','show-months','popup','display-format','min-nights','max-nights',
        'align','labels','accent','rounded',
        'label-checkin','label-checkout','label-choose-start','label-choose-end',
        'placeholder-checkin','placeholder-checkout'
      ];
    }

    get i18n(){
      const labIn  = this.getAttribute('label-checkin')  || 'Check-in';
      const labOut = this.getAttribute('label-checkout') || 'Check-out';
      return {
        checkin: labIn,
        checkout: labOut,
        chooseStart: this.getAttribute('label-choose-start') || 'Choose check-in',
        chooseEnd:   this.getAttribute('label-choose-end')   || 'Choose check-out',
        displayFmt:  this.getAttribute('display-format')     || 'd M Y',
        placeholderCheckin:  this.getAttribute('placeholder-checkin')  || labIn,
        placeholderCheckout: this.getAttribute('placeholder-checkout') || labOut,
      };
    }

    constructor(){
      super();
      this.attachShadow({mode:'open'});

      const accent  = this.getAttribute('accent')  || '#808000';
      const rounded = this.getAttribute('rounded') || '12px';
      const labels  = (this.getAttribute('labels') || 'none').toLowerCase();

      this.shadowRoot.innerHTML = `
        <link id="fp-css" rel="stylesheet" href="./vendor/flatpickr/flatpickr.min.css">
        <style>
          :host{
            --accent: ${accent};
            /* legacy alias kept; split tokens for clarity */
            --hover: rgba(128,128,0,.24);
            --range: var(--hover);          /* in-range tint (back-compat)   */
            --hover-day: rgba(0,0,0,.06);   /* true mouse hover on a single day */
            --fieldW: 250px;
            --rounded: ${rounded};
            --shadow: 0 10px 28px rgba(0,0,0,.18);
            font:14px/1.4 system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;
          }
          *,*::before,*::after{box-sizing:border-box}

          .bar{display:flex;gap:12px;align-items:center}
          :host([align="center"]) .bar{justify-content:center}
          :host([align="right"])  .bar{justify-content:flex-end}

          .group{display:flex;flex-direction:column;gap:6px}
          label{font-weight:600;color:#2b2b2b}
          .hideLabel label{display:none}

          input{
            width:var(--fieldW);height:42px;padding:12px;
            border:1px solid #d9dde2;border-radius:var(--rounded);
            background:#fff;outline:none;box-shadow:0 1px 0 rgba(0,0,0,.04) inset;
          }
          input:focus{border-color:#67b1ff;box-shadow:0 0 0 3px rgba(103,177,255,.22)}

          button{
            height:42px;padding:10px 18px;border-radius:999px;border:0;
            background:var(--accent);color:#000;font-weight:700;letter-spacing:.02em;
            cursor:pointer;box-shadow:var(--shadow);
          }
          button:disabled{opacity:.5;cursor:not-allowed}

          /* --- Flatpickr theming inside shadow --- */
          .flatpickr-calendar:before,
          .flatpickr-calendar:after,
          .flatpickr-calendar.arrowTop:before,
          .flatpickr-calendar.arrowTop:after,
          .flatpickr-calendar.arrowBottom:before,
          .flatpickr-calendar.arrowBottom:after{display:none!important;border:0!important;content:''!important}

          .flatpickr-day.selected,
          .flatpickr-day.startRange,
          .flatpickr-day.endRange{background:var(--accent);border-color:var(--accent);color:#fff}
          .flatpickr-day.selected:hover,
          .flatpickr-day.startRange:hover,
          .flatpickr-day.endRange:hover{background:var(--accent);border-color:var(--accent);color:#fff}

          .flatpickr-day.inRange,
          .flatpickr-day.inRange:hover{
            background:var(--range)!important;
            border-color:transparent!important;
            color:#111!important;
          }

          /* 1-night bridge: recolor Flatpickr’s endpoint connector (was theme blue) */
          .mto-one-night .flatpickr-day.startRange,
          .mto-one-night-preview .flatpickr-day.startRange{
            box-shadow: 5px 0 0 var(--range) !important;   /* connector to the right */
          }
          
          .mto-one-night .flatpickr-day.endRange,
          .mto-one-night-preview .flatpickr-day.endRange{
            box-shadow: -5px 0 0 var(--range) !important;  /* connector to the left */
          }



          /* Bridge color for exactly 1-night ranges (adjacent start/end days) */
          .mto-one-night .flatpickr-day.startRange{
            /* right half = range tint, left half = accent on the start day */
            background-image: linear-gradient(to right, var(--accent) 0 50%, var(--range) 50% 100%) !important;
            background-color: var(--accent) !important;
            color: #fff !important;
          }
          .mto-one-night .flatpickr-day.endRange{
            /* left half = range tint, right half = accent on the end day */
            background-image: linear-gradient(to left, var(--accent) 0 50%, var(--range) 50% 100%) !important;
            background-color: var(--accent) !important;
            color: #fff !important;
          }



          .flatpickr-day:not(.selected):not(.startRange):not(.endRange):not(.disabled):hover{
            background:var(--hover-day)!important;
            color:#000!important;border-color:transparent!important;
          }

          .flatpickr-calendar .flatpickr-day[aria-disabled="true"],
          .flatpickr-calendar .flatpickr-day.flatpickr-disabled,
          .flatpickr-calendar .flatpickr-day.prevMonthDay,
          .flatpickr-calendar .flatpickr-day.nextMonthDay{
            color:#c0c0c0!important;background:transparent!important;border-color:transparent!important;box-shadow:none!important;opacity:1!important;
          }

          .mto-pin{
            position:absolute;top:-8px;left:0;transform:translateX(-50%);
            width:0;height:0;border-left:8px solid transparent;border-right:8px solid transparent;
            border-bottom:8px solid #e5e7eb;pointer-events:none;z-index:3;filter:drop-shadow(0 1px 0 rgba(0,0,0,.05));
          }
        </style>

        <div class="bar ${labels==='none'?'hideLabel':''}">
          <div class="group"><label>Check-in</label><input id="checkin" type="text" placeholder="Check-in" inputmode="none"></div>
          <div class="group"><label>Check-out</label><input id="checkout" type="text" placeholder="Check-out" inputmode="none"></div>
          <button id="book">BOOK NOW</button>
        </div>
      `;
    }

    applyLabels(){
      const r=this.shadowRoot;
      const [labIn,labOut]=r.querySelectorAll('.group > label');
      const inputIn=r.getElementById('checkin');
      const inputOut=r.getElementById('checkout');

      if(labIn)  labIn.textContent=this.i18n.checkin;
      if(labOut) labOut.textContent=this.i18n.checkout;

      const hide=(this.getAttribute('labels')||'').toLowerCase();
      const wrap=r.querySelector('.bar');
      const shouldHide = hide==='hidden'||hide==='none'||hide==='false';
      if(wrap) wrap.classList.toggle('hideLabel', shouldHide);

      if(inputIn)  inputIn.placeholder=this.i18n.placeholderCheckin;
      if(inputOut) inputOut.placeholder=this.i18n.placeholderCheckout;
    }

    #mirrorInputs(inst=this.#fp){
      if(!inst||!this.#inputIn||!this.#inputOut) return;
      const df=inst.config?.dateFormat||this.i18n.displayFmt;
      const d=inst.selectedDates;
      if(d.length===0){ this.#inputIn.value=this.#inputOut.value=''; return; }
      if(d.length===1){ this.#inputIn.value=inst.formatDate(d[0],df); this.#inputOut.value=''; return; }
      this.#inputIn.value=inst.formatDate(d[0],df);
      this.#inputOut.value=inst.formatDate(d[1],df);
    }

    connectedCallback(){ this.applyLabels(); this.init(); }

    attributeChangedCallback(name,oldVal,newVal){
      if(oldVal===newVal) return;
      switch(name){
        case 'labels':
        case 'label-checkin':
        case 'label-checkout':
        case 'label-choose-start':
        case 'label-choose-end':
        case 'placeholder-checkin':
        case 'placeholder-checkout':
          this.applyLabels?.();
          if(this.#fp && this.#fp.calendarContainer){
            const pillEl=this.#fp.calendarContainer.querySelector('.fp-intent-pill');
            if(pillEl){
              const activeIsOut=(this.shadowRoot?.activeElement===this.#inputOut)||(document.activeElement===this.#inputOut);
              pillEl.textContent=activeIsOut?this.i18n.chooseEnd:this.i18n.chooseStart;
            }
          }
          break;
        case 'display-format':
          if(this.#fp){ this.#fp.set('dateFormat', this.i18n.displayFmt); this.#mirrorInputs(); }
          break;
      }
    }

    async ensureFlatpickr(){
      if(window.flatpickr) return;
      const LOCAL='./vendor/flatpickr';
      const CDN='https://cdn.jsdelivr.net/npm/flatpickr@4.6.13';
      once('flatpickr-css',()=>loadCss(`${LOCAL}/flatpickr.min.css`));
      try{ await loadScript(`${LOCAL}/flatpickr.min.js`);}catch{ await loadScript(`${CDN}/dist/flatpickr.min.js`);}
      try{ await loadScript(`${LOCAL}/plugins/rangePlugin.js`);}catch{ await loadScript(`${CDN}/dist/plugins/rangePlugin.js`);}
    }

    async init(){
      await this.ensureFlatpickr();
      const link=this.shadowRoot.getElementById('fp-css');
      if(link && !link.sheet){ await new Promise(r=>link.addEventListener('load',r,{once:true})); }

      const r=this.shadowRoot;
      this.#inputIn=r.getElementById('checkin');
      this.#inputOut=r.getElementById('checkout');
      const btn=r.getElementById('book');

      const showMonths=Number(this.getAttribute('show-months')||'2');
      const displayFmt=this.i18n.displayFmt;
      const align=this.getAttribute('align')||'center';

      let openedBy='in';
      this.#inputIn .addEventListener('mousedown',()=>{openedBy='in';},{capture:true});
      this.#inputOut.addEventListener('mousedown',()=>{openedBy='out';},{capture:true});

      let mutating=false;
      const setDateSilently=(inst,arr)=>{ mutating=true; try{ inst.setDate(Array.isArray(arr)?arr:[arr], false); } finally{ mutating=false; } };

      const pill=(inst,side,suffix='')=>{
        const c=inst.calendarContainer;
        let x=c.querySelector('.fp-intent-pill');
        if(!x){ x=document.createElement('div'); x.className='fp-intent-pill'; c.insertBefore(x,c.firstChild); }
        const base = side==='end' ? this.i18n.chooseEnd : this.i18n.chooseStart;
        x.textContent = suffix ? `${base} ${suffix}` : base;
      };

      const ensurePin=(inst)=>{
        const c=inst.calendarContainer;
        if(!c.querySelector('.mto-pin')){
          const pin=document.createElement('div'); pin.className='mto-pin'; c.appendChild(pin);
        }
      };
      const positionPin=(inst,side)=>{
        const c=inst.calendarContainer; const pin=c.querySelector('.mto-pin'); if(!pin) return;
        const target=(side==='end'||openedBy==='out'||document.activeElement===this.#inputOut)?this.#inputOut:this.#inputIn;
        const cr=c.getBoundingClientRect(); const tr=target.getBoundingClientRect();
        pin.style.left=`${tr.left+tr.width/2-cr.left}px`;
      };

      const setOneNightClass = (inst) => {
        const c = inst.calendarContainer;
        const d = inst.selectedDates || [];
        const isOneNight = (d.length === 2) && Math.round((d[1] - d[0]) / 86400000) === 1;
        c.classList.toggle('mto-one-night', isOneNight);
      };

      // Preview helper: when one date is selected and the hovered day is exactly ±1,
      // flip on a class so the connector uses your --range color during hover.
      const setOneNightPreview = (inst, hoveredDate) => {
        const d = inst.selectedDates || [];
        const isPreviewOneNight =
          d.length === 1 && hoveredDate &&
          Math.abs(Math.round((hoveredDate - d[0]) / 86400000)) === 1;
      
        inst.calendarContainer.classList.toggle('mto-one-night-preview', !!isPreviewOneNight);
      };

      
      
      
      this.#fp = flatpickr(this.#inputIn, {
        plugins: [ new rangePlugin({ input: this.#inputOut }) ],
        showMonths, appendTo: this.shadowRoot.querySelector('.bar'),
        static:true, disableMobile:true, minDate:'today',
        dateFormat: displayFmt, allowInput:false, closeOnSelect:false,

        onOpen: (_d,_s,inst)=>{
          if(inst.selectedDates[0]) inst.jumpToDate(inst.selectedDates[0],true);
          pill(inst, openedBy==='out'?'end':'start');
          ensurePin(inst); 
          positionPin(inst, openedBy==='out'?'end':'start');

          // keep/clear the final-selection class on open
          setOneNightClass(inst);
          
          // wire hover preview once
          const c = inst.calendarContainer;
          if (!c._mtoHoverWired) {
            const days = inst.daysContainer;
            if (days) {
              days.addEventListener('mouseover', (ev) => {
                const cell = ev.target.closest('.flatpickr-day');
                setOneNightPreview(inst, cell ? cell.dateObj : null);
              });
              days.addEventListener('mouseleave', () => {
                setOneNightPreview(inst, null);
              });
            }
            c._mtoHoverWired = true; // avoid duplicate listeners on subsequent opens
          }
        },

        onReady: (_d,_s,inst)=>{
          const cal=inst.calendarContainer; const lnk=this.shadowRoot.getElementById('fp-css');
          cal.style.visibility='hidden';
          const show=()=>{ try{inst.redraw&&inst.redraw();}catch{} requestAnimationFrame(()=>{try{inst.redraw();}catch{} cal.style.visibility='visible';}); setTimeout(()=>{try{inst.redraw();}catch{} cal.style.visibility='visible';},120); };
          if(lnk && !lnk.sheet) lnk.addEventListener('load',show,{once:true}); else show();
        },

        onChange: (dates,_str,inst)=>{
          if(mutating) return;

          const setDateInterim=(anchor,asEnd=false,suffix='')=>{
            if(asEnd){
              setDateSilently(inst,[anchor]);
              this.#inputIn.value=''; this.#inputOut.value=inst.formatDate(anchor,displayFmt);
              setTimeout(()=>{ openedBy='in'; this.#inputIn.focus(); inst.jumpToDate(anchor,true); pill(inst,'start',suffix); },0);
            }else{
              setDateSilently(inst,[anchor]);
              this.#mirrorInputs(inst); this.#inputOut.value='';
              setTimeout(()=>{ openedBy='out'; this.#inputOut.focus(); inst.jumpToDate(anchor,true); pill(inst,'end',suffix); },0);
            }
          };

          if(dates.length===0){ this.#inputIn.value=this.#inputOut.value=''; return; }

          if (dates.length === 1){
            this.#mirrorInputs(inst);
            setOneNightClass(inst); // clears if previously set
            setOneNightPreview(inst, null);
            if (openedBy === 'in') { setTimeout(() => this.#inputOut.focus(), 0); pill(inst,'end'); }
            else                   { setTimeout(() => this.#inputIn .focus(), 0); pill(inst,'start'); }
            return;
          }
          
          let [s,e]=dates;
          if(openedBy==='in' && e.getTime()<=s.getTime()){ setDateInterim(s); return; }
          if(openedBy==='out'&& e.getTime()<=s.getTime()){ setDateInterim(e,true); return; }

          const nights=Math.round((e - s)/86400000);
          const minN=Math.max(1, Number(this.getAttribute('min-nights')||'1'));
          if(nights < minN){ setDateInterim(s,false,`(min ${minN} nights)`); return; }

          const maxAttr=Number(this.getAttribute('max-nights')||'0');
          const maxN = isNaN(maxAttr) ? 0 : Math.max(0, maxAttr); // 0 = unlimited
          if(maxN>0 && nights > maxN){ setDateInterim(s,false,`(max ${maxN} nights)`); return; }

          this.#mirrorInputs(inst);
          setOneNightClass(inst);   // sets the bridge class if nights === 1
          setOneNightPreview(inst, null);
          setTimeout(()=>inst.close(),0);
        }
      });

      btn.addEventListener('click', ()=>{
        const url=this.getAttribute('book-url')||'';
        const [s,e]=this.#fp.selectedDates;
        if(!url||!s||!e) return;
        const q=new URLSearchParams({checkin:fmtYMD(s),checkout:fmtYMD(e)});
        location.href = `${url}?${q.toString()}`;
      });

      this.setAttribute('align', align);
    }
  }

  customElements.define('mtolives-book-now', MtOlivesBookNow);
})();
