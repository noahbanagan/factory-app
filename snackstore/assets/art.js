/* Omiyage PH preview artwork. Procedural SVG packaging illustrations so the catalogue looks
   finished before product photography exists. Replace ART.product() with <img> tags later. */
window.ART = (function(){
  const esc = s => String(s).replace(/[&<>"]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[ch]));
  const dark = (hex,amt=.25)=>{const n=parseInt(hex.slice(1),16);const f=v=>Math.max(0,Math.round(v*(1-amt)));return `rgb(${f(n>>16)},${f((n>>8)&255)},${f(n&255)})`;};
  const light= (hex,amt=.35)=>{const n=parseInt(hex.slice(1),16);const f=v=>Math.min(255,Math.round(v+(255-v)*amt));return `rgb(${f(n>>16)},${f((n>>8)&255)},${f(n&255)})`;};
  let uid=0;
  const FONT='font-family="Zen Kaku Gothic New, Hiragino Sans, Yu Gothic, system-ui, sans-serif"';

  /* ---------- motifs drawn inside the label window (local coords: 0..100 x 0..60) ---------- */
  const motifs={
    sticks:(c)=>{let s="";for(let i=0;i<7;i++){const x=12+i*11;s+=`<rect x="${x}" y="${8+(i%2)*3}" width="5" height="52" rx="2.5" fill="#e8c9a0"/><rect x="${x}" y="${8+(i%2)*3}" width="5" height="34" rx="2.5" fill="${c}"/>`;}return s;},
    wafer:(c)=>{let s="";for(let i=0;i<3;i++){const x=10+i*28;s+=`<rect x="${x}" y="10" width="24" height="42" rx="4" fill="${c}"/><rect x="${x+3}" y="14" width="18" height="34" rx="3" fill="${dark(c,.15)}"/><text x="${x+12}" y="36" text-anchor="middle" font-size="7" fill="#fff" font-weight="700" ${FONT}>KitKat</text>`;}return s;},
    mushroom:(c)=>{let s="";for(let i=0;i<4;i++){const x=16+i*22;s+=`<rect x="${x-3}" y="30" width="6" height="22" rx="2" fill="#e9d2a8"/><ellipse cx="${x}" cy="28" rx="11" ry="9" fill="${c}"/>`;}return s;},
    bamboo:(c)=>{let s="";for(let i=0;i<4;i++){const x=16+i*22;s+=`<path d="M${x-9} 52 L${x} 8 L${x+9} 52 Z" fill="${c}"/><path d="M${x-7} 52 L${x} 24 L${x+7} 52 Z" fill="#e9d2a8"/>`;}return s;},
    cookie:(c)=>{let s="";for(let i=0;i<3;i++){const x=20+i*30;s+=`<rect x="${x-12}" y="14" width="24" height="24" rx="4" fill="#d9b27c"/><rect x="${x-12}" y="14" width="24" height="18" rx="4" fill="${c}"/><path d="M${x-6} 26 l4 -5 l4 5 l-4 5z" fill="${light(c,.5)}"/>`;}return s;},
    bar:(c)=>`<rect x="14" y="16" width="72" height="30" rx="6" fill="${c}"/><path d="M26 16 l8 30 M46 16 l8 30 M66 16 l8 30" stroke="${dark(c,.3)}" stroke-width="2"/><path d="M20 10 l8 8 l-6 2 l10 10" stroke="#ffd54f" stroke-width="3" fill="none" stroke-linecap="round"/>`,
    puff:(c)=>{let s="";for(let i=0;i<9;i++){const x=12+(i%5)*19,y=14+Math.floor(i/5)*24;s+=`<circle cx="${x+(i>4?9:0)}" cy="${y}" r="9" fill="${c}"/><circle cx="${x+(i>4?9:0)-3}" cy="${y-3}" r="3" fill="${light(c,.5)}"/>`;}return s;},
    shrimp:(c)=>{let s="";for(let i=0;i<5;i++){const x=14+i*17;s+=`<path d="M${x} 48 C${x-4} 30 ${x+2} 14 ${x+8} 10" stroke="${c}" stroke-width="7" fill="none" stroke-linecap="round"/><circle cx="${x+9}" cy="9" r="2" fill="${dark(c,.4)}"/>`;}return s;},
    fries:(c)=>{let s="";for(let i=0;i<8;i++){const x=16+i*9.5;s+=`<rect x="${x}" y="${10+(i%3)*4}" width="5" height="${40-(i%3)*4}" rx="2" fill="${c}"/>`;}return s+`<rect x="8" y="40" width="84" height="16" rx="4" fill="${dark(c,.35)}"/>`;},
    cracker:(c)=>{let s="";for(let i=0;i<3;i++){const x=20+i*30;s+=`<ellipse cx="${x}" cy="30" rx="13" ry="16" fill="${c}"/><ellipse cx="${x}" cy="30" rx="8" ry="11" fill="${light(c,.3)}" opacity=".6"/>`;}return s;},
    heart:(c)=>{let s="";for(let i=0;i<4;i++){const x=16+i*22,y=28;s+=`<path d="M${x} ${y+14} C${x-14} ${y+2} ${x-8} ${y-12} ${x} ${y-4} C${x+8} ${y-12} ${x+14} ${y+2} ${x} ${y+14}Z" fill="${c}"/><circle cx="${x-3}" cy="${y-1}" r="2" fill="#fff" opacity=".7"/>`;}return s;},
    chew:(c)=>{let s="";for(let i=0;i<4;i++){const x=12+i*20;s+=`<rect x="${x}" y="18" width="16" height="26" rx="5" fill="${light(c,.6)}"/><rect x="${x+3}" y="21" width="10" height="20" rx="4" fill="${c}"/>`;}return s+`<circle cx="86" cy="22" r="8" fill="${c}"/><circle cx="90" cy="36" r="6" fill="${c}"/>`;},
    candy:(c)=>{let s="";for(let i=0;i<3;i++){const x=22+i*28;s+=`<path d="M${x-18} 24 l8 -6 v12z M${x+18} 24 l-8 -6 v12z" fill="${light(c,.3)}"/><ellipse cx="${x}" cy="26" rx="11" ry="11" fill="${c}"/><path d="M${x-7} 20 q7 6 14 0" stroke="#fff" stroke-width="2" fill="none" opacity=".7"/>`;}return s+`<circle cx="30" cy="48" r="5" fill="${c}"/><circle cx="60" cy="50" r="5" fill="${c}"/>`;},
    milk:(c)=>`<ellipse cx="50" cy="32" rx="28" ry="14" fill="#fff8e1"/><circle cx="38" cy="30" r="5" fill="#ffd54f"/><circle cx="60" cy="33" r="4" fill="#ffd54f"/><circle cx="50" cy="22" r="3" fill="#ffd54f"/>`,
    noodle:(c)=>`<path d="M12 44 q10 -20 20 0 t20 0 t20 0 t20 0" stroke="#f2c572" stroke-width="5" fill="none"/><path d="M12 32 q10 -20 20 0 t20 0 t20 0 t20 0" stroke="#f2c572" stroke-width="5" fill="none"/><path d="M12 20 q10 -20 20 0 t20 0 t20 0 t20 0" stroke="#f2c572" stroke-width="5" fill="none"/><circle cx="70" cy="30" r="7" fill="${c}"/><rect x="24" y="20" width="12" height="12" rx="2" fill="#4caf50"/>`,
    cupnoodle:(c)=>`<path d="M20 14 h60 l-6 44 h-48z" fill="#fff"/><path d="M26 22 q12 -14 24 0 t24 0" stroke="${c}" stroke-width="5" fill="none"/><rect x="22" y="30" width="56" height="4" fill="${c}"/><text x="50" y="50" text-anchor="middle" font-size="9" font-weight="700" fill="${c}" ${FONT}>CUP</text>`,
    leaf:(c)=>{let s="";for(let i=0;i<3;i++){const x=22+i*28;s+=`<path d="M${x} 50 C${x-18} 36 ${x-10} 12 ${x+8} 8 C${x+16} 28 ${x+10} 46 ${x} 50Z" fill="${c}"/><path d="M${x} 50 C${x+2} 34 ${x+4} 22 ${x+8} 10" stroke="#fff" stroke-width="1.5" fill="none" opacity=".6"/>`;}return s;},
    marble:(c)=>`<circle cx="50" cy="30" r="18" fill="#dff3fb"/><circle cx="44" cy="24" r="6" fill="#fff" opacity=".9"/><circle cx="24" cy="42" r="4" fill="${c}" opacity=".6"/><circle cx="76" cy="18" r="3" fill="${c}" opacity=".6"/><circle cx="80" cy="46" r="5" fill="${c}" opacity=".6"/>`,
    wave:(c)=>`<path d="M0 40 q12 -14 25 0 t25 0 t25 0 t25 0 V60 H0z" fill="#fff" opacity=".85"/><circle cx="20" cy="18" r="4" fill="#fff" opacity=".7"/><circle cx="66" cy="14" r="6" fill="#fff" opacity=".7"/>`,
    sushi:(c)=>{const f=["#ff6f61","#ffd54f","#ffab91"];let s="";for(let i=0;i<3;i++){const x=20+i*30;s+=`<rect x="${x-13}" y="30" width="26" height="14" rx="5" fill="#fff"/><rect x="${x-13}" y="22" width="26" height="12" rx="5" fill="${f[i]}"/><rect x="${x-3}" y="22" width="6" height="22" fill="#2e4a2e" opacity=".8"/>`;}return s;},
    foam:(c)=>`<path d="M14 50 h72 l-6 -26 h-60z" fill="#fff"/><circle cx="30" cy="22" r="10" fill="${c}"/><circle cx="48" cy="16" r="12" fill="${light(c,.3)}"/><circle cx="68" cy="22" r="9" fill="${c}"/><circle cx="56" cy="30" r="6" fill="#fff"/>`,
    gift:(c)=>`<rect x="20" y="22" width="60" height="32" rx="3" fill="#d9b27c"/><rect x="16" y="14" width="68" height="12" rx="2" fill="#c89b5e"/><rect x="46" y="14" width="8" height="40" fill="${c}"/><rect x="16" y="18" width="68" height="5" fill="${c}"/><path d="M50 14 c-10 -12 -16 -4 -4 0 c-12 4 -6 12 4 0 c10 12 16 4 4 0 c12 -4 6 -12 -4 0z" fill="${light(c,.2)}"/>`,
    ribbon:(c)=>`<rect x="18" y="20" width="64" height="34" rx="3" fill="#ead9bd"/><rect x="18" y="20" width="64" height="8" fill="${c}"/><rect x="46" y="20" width="8" height="34" fill="${c}"/><circle cx="50" cy="22" r="7" fill="${light(c,.2)}"/>`,
    grape:(c)=>{let s="";const pts=[[50,14],[42,24],[58,24],[34,34],[50,34],[66,34],[42,44],[58,44],[50,54]];pts.forEach(([x,y])=>{s+=`<circle cx="${x}" cy="${y}" r="7" fill="${c}"/><circle cx="${x-2}" cy="${y-2}" r="2" fill="#fff" opacity=".6"/>`;});return s+`<path d="M50 14 q4 -10 10 -8" stroke="#4caf50" stroke-width="3" fill="none"/>`;},
    soda:(c)=>{let s="";for(let i=0;i<8;i++){s+=`<circle cx="${14+i*11}" cy="${18+(i*7)%30}" r="${3+(i%3)}" fill="#fff" opacity=".8"/>`;}return `<rect x="8" y="8" width="84" height="46" rx="8" fill="${c}"/>`+s;}
  };

  /* ---------- package shapes; each returns svg body for a 300x300 canvas ---------- */
  function label(p,x,y,w,fill,textFill,size=15){
    const name=p.short||p.name.replace(/\(.*?\)/,"").trim();
    return `<text x="${x+w/2}" y="${y}" text-anchor="middle" font-size="${size}" font-weight="700" fill="${textFill}" ${FONT}>${esc(name)}</text>
            <text x="${x+w/2}" y="${y+size*1.15}" text-anchor="middle" font-size="${Math.round(size*.68)}" fill="${textFill}" opacity=".85" ${FONT}>${esc(p.jp.split(" ")[0])}</text>`;
  }
  function brandTag(p,x,y,fill){ return `<rect x="${x}" y="${y}" width="${Math.max(36,p.brand.length*6.5)}" height="14" rx="2" fill="${fill}"/><text x="${x+Math.max(36,p.brand.length*6.5)/2}" y="${y+10}" text-anchor="middle" font-size="8" font-weight="700" fill="#fff" ${FONT}>${esc(p.brand.toUpperCase())}</text>`; }
  const shapes={
    box(p,c1,c2,id){ // upright box with top + side face
      return `<g transform="translate(70,36)">
        <path d="M0 28 L24 8 L164 8 L140 28 Z" fill="${light(c1,.25)}"/>
        <path d="M140 28 L164 8 L164 212 L140 232 Z" fill="${dark(c1,.35)}"/>
        <rect x="0" y="28" width="140" height="204" rx="4" fill="url(#g${id})"/>
        ${brandTag(p,10,38,dark(c1,.45))}
        ${label(p,0,80,140,c1,c2,16)}
        <rect x="14" y="118" width="112" height="76" rx="8" fill="${light(c1,.75)}"/>
        <g transform="translate(20,126) scale(1.0)">${motifs[p.motif](c1==="#ffffff"?c2:c1)}</g>
        <text x="70" y="218" text-anchor="middle" font-size="9" fill="${c2}" opacity=".8" ${FONT}>${esc(p.weight)} · MADE IN JAPAN</text></g>`;
    },
    bag(p,c1,c2,id){ // pillow bag with crimped ends
      return `<g transform="translate(54,30)">
        <path d="M8 14 l8 -8 l8 8 l8 -8 l8 8 l8 -8 l8 8 l8 -8 l8 8 l8 -8 l8 8 l8 -8 l8 8 l8 -8 l8 8 l8 -8 l8 8 l8 -8 l8 8 l8 -8 l8 8 l8 -8 l6 8
                 C196 90 196 160 184 234 l-8 -8 l-8 8 l-8 -8 l-8 8 l-8 -8 l-8 8 l-8 -8 l-8 8 l-8 -8 l-8 8 l-8 -8 l-8 8 l-8 -8 l-8 8 l-8 -8 l-8 8 l-8 -8 l-8 8 l-8 -8 l-8 8 l-8 -8 l-8 8 l-8 -8 l-8 8 l-8 -8
                 C-4 160 -4 90 8 14Z" fill="url(#g${id})"/>
        <path d="M30 40 C40 120 40 160 34 210" stroke="#fff" stroke-width="8" opacity=".12" stroke-linecap="round"/>
        ${brandTag(p,30,36,dark(c1,.45))}
        ${label(p,16,86,160,c1,c2,17)}
        <ellipse cx="96" cy="160" rx="66" ry="42" fill="${light(c1,.78)}"/>
        <g transform="translate(46,130)">${motifs[p.motif](c1)}</g>
        <text x="96" y="222" text-anchor="middle" font-size="9" fill="${c2}" opacity=".85" ${FONT}>${esc(p.weight)}</text></g>`;
    },
    stick(p,c1,c2,id){ // umaibo: wrapped cylinder
      return `<g transform="translate(150,150) rotate(-28)">
        <path d="M-118 -28 l-12 -10 l0 76 l12 -10z M118 -28 l12 -10 l0 76 l-12 -10z" fill="${dark(c1,.2)}"/>
        <rect x="-118" y="-30" width="236" height="60" rx="30" fill="url(#g${id})"/>
        <rect x="-118" y="-30" width="236" height="20" rx="10" fill="#fff" opacity=".15"/>
        <text x="0" y="-2" text-anchor="middle" font-size="22" font-weight="700" fill="${c2}" ${FONT}>うまい棒</text>
        <text x="0" y="18" text-anchor="middle" font-size="11" fill="${c2}" opacity=".9" ${FONT}>${esc(p.short||p.name)}</text>
        <circle cx="-86" cy="0" r="16" fill="${light(c1,.6)}"/><g transform="translate(-100,-10) scale(.3)">${motifs.puff(c1)}</g>
        <circle cx="86" cy="0" r="16" fill="${light(c1,.6)}"/><g transform="translate(72,-10) scale(.3)">${motifs.puff(c1)}</g></g>`;
    },
    pouch(p,c1,c2,id){ // Hi-Chew / Puccho stick pack lying at an angle
      return `<g transform="translate(150,150) rotate(-18)">
        <rect x="-110" y="-36" width="220" height="72" rx="10" fill="url(#g${id})"/>
        <path d="M-110 -36 h220 v10 h-220z" fill="#fff" opacity=".18"/>
        ${brandTag(p,-100,-28,dark(c1,.45))}
        <text x="-10" y="6" text-anchor="middle" font-size="24" font-weight="700" fill="${c2}" ${FONT}>${esc(p.short||p.name.split(" ")[0])}</text>
        <text x="-10" y="26" text-anchor="middle" font-size="10" fill="${c2}" opacity=".85" ${FONT}>${esc(p.jp)}</text>
        <g transform="translate(60,-22) scale(.75)">${motifs[p.motif](light(c1,.1))}</g></g>`;
    },
    bottle(p,c1,c2,id){ // PET bottle
      return `<g transform="translate(96,22)">
        <rect x="42" y="0" width="24" height="18" rx="3" fill="${dark(c1,.2)}"/>
        <path d="M30 24 C30 10 78 10 78 24 L94 60 L94 250 C94 258 86 262 78 262 L30 262 C22 262 14 258 14 250 L14 60 Z" fill="${light(c1,.55)}"/>
        <rect x="14" y="96" width="80" height="110" fill="url(#g${id})"/>
        <path d="M24 70 C28 120 28 200 26 240" stroke="#fff" stroke-width="6" opacity=".35" stroke-linecap="round"/>
        ${brandTag(p,22,104,dark(c1,.45))}
        ${label(p,14,146,80,c1,c2,14)}
        <g transform="translate(24,166) scale(.6)">${motifs[p.motif](c2==="#ffffff"?light(c1,.2):c2)}</g>
        <text x="54" y="232" text-anchor="middle" font-size="9" fill="${light(c1,.1)}" ${FONT}>${esc(p.weight)}</text></g>`;
    },
    ramune(p,c1,c2,id){ // codd-neck glass bottle with marble
      return `<g transform="translate(100,16)">
        <rect x="38" y="0" width="24" height="14" rx="4" fill="#b0bec5"/>
        <path d="M34 14 L66 14 L66 50 C72 56 78 60 78 70 L78 86 C70 92 68 100 74 108 L78 112 L78 254 C78 262 72 266 64 266 L36 266 C28 266 22 262 22 254 L22 112 L26 108 C32 100 30 92 22 86 L22 70 C22 60 28 56 34 50 Z" fill="url(#g${id})"/>
        <path d="M34 14 L66 14 L66 50 C72 56 78 60 78 70 L78 86 C70 92 68 100 74 108 L78 112 L78 254 C78 262 72 266 64 266 L36 266 C28 266 22 262 22 254 L22 112 L26 108 C32 100 30 92 22 86 L22 70 C22 60 28 56 34 50 Z" fill="#fff" opacity=".18"/>
        <circle cx="50" cy="80" r="11" fill="#e3f6fd" stroke="#9ad7ee" stroke-width="2"/><circle cx="46" cy="76" r="3" fill="#fff"/>
        <path d="M30 60 C32 120 32 200 30 250" stroke="#fff" stroke-width="5" opacity=".45" stroke-linecap="round"/>
        <rect x="22" y="150" width="56" height="64" fill="${light(c1,.15)}"/>
        <text x="50" y="176" text-anchor="middle" font-size="18" font-weight="700" fill="#fff" ${FONT}>ラムネ</text>
        <text x="50" y="194" text-anchor="middle" font-size="9" fill="#fff" ${FONT}>RAMUNE</text>
        <text x="50" y="208" text-anchor="middle" font-size="7" fill="#fff" opacity=".9" ${FONT}>${esc(p.weight)}</text></g>`;
    },
    cup(p,c1,c2,id){ // cup noodle
      return `<g transform="translate(66,40)">
        <ellipse cx="84" cy="16" rx="84" ry="16" fill="${dark(c1,.1)}"/>
        <path d="M0 16 L22 214 C22 226 146 226 146 214 L168 16 Z" fill="url(#g${id})"/>
        <ellipse cx="84" cy="16" rx="84" ry="16" fill="#fff"/><ellipse cx="84" cy="16" rx="76" ry="11" fill="${light(c1,.6)}"/>
        <path d="M8 60 L160 60 L152 130 L16 130 Z" fill="#fff"/>
        ${brandTag(p,22,66,c1)}
        <text x="84" y="104" text-anchor="middle" font-size="22" font-weight="700" fill="${c1}" ${FONT}>CUP NOODLE</text>
        <text x="84" y="122" text-anchor="middle" font-size="11" fill="${dark(c1,.2)}" ${FONT}>${esc(p.short||p.name.replace("Cup Noodle ",""))} · ${esc(p.jp.split(" ").slice(-1)[0])}</text>
        <g transform="translate(34,138) scale(1)">${motifs[p.motif](c1)}</g>
        <text x="84" y="206" text-anchor="middle" font-size="9" fill="#fff" ${FONT}>${esc(p.weight)}</text></g>`;
    },
    tube(p,c1,c2,id){ // Jagarico tall cup
      return `<g transform="translate(90,30)">
        <ellipse cx="60" cy="14" rx="60" ry="14" fill="${dark(c1,.15)}"/>
        <path d="M0 14 L8 230 C8 242 112 242 112 230 L120 14 Z" fill="url(#g${id})"/>
        <ellipse cx="60" cy="14" rx="60" ry="14" fill="${light(c1,.5)}"/><ellipse cx="60" cy="14" rx="52" ry="10" fill="${light(c1,.75)}"/>
        ${brandTag(p,20,40,dark(c1,.45))}
        <text x="60" y="88" text-anchor="middle" font-size="22" font-weight="700" fill="${c2}" ${FONT}>じゃがりこ</text>
        <text x="60" y="106" text-anchor="middle" font-size="11" fill="${c2}" opacity=".9" ${FONT}>${esc(p.short||p.name.split(" ").slice(-1)[0])}</text>
        <rect x="14" y="120" width="92" height="70" rx="8" fill="${light(c1,.75)}"/>
        <g transform="translate(18,126) scale(.85)">${motifs[p.motif](c1)}</g>
        <text x="60" y="214" text-anchor="middle" font-size="9" fill="${c2}" opacity=".9" ${FONT}>${esc(p.weight)}</text></g>`;
    },
    tray(p,c1,c2,id){ // flat box lying down (Alfort, Kinoko)
      return `<g transform="translate(40,56)">
        <path d="M0 40 L36 0 L220 0 L184 40 Z" fill="${light(c1,.2)}"/>
        <path d="M184 40 L220 0 L220 140 L184 180 Z" fill="${dark(c1,.35)}"/>
        <rect x="0" y="40" width="184" height="140" rx="3" fill="url(#g${id})"/>
        ${brandTag(p,12,50,dark(c1,.45))}
        ${label(p,0,90,184,c1,c2,17)}
        <rect x="18" y="104" width="148" height="62" rx="6" fill="${light(c1,.78)}"/>
        <g transform="translate(42,106)">${motifs[p.motif](c1)}</g></g>`;
    },
    giftbox(p,c1,c2,id){ // kraft gift box with ribbon
      return `<g transform="translate(42,50)">
        <path d="M0 50 L40 10 L216 10 L176 50 Z" fill="#d8bc93"/>
        <path d="M176 50 L216 10 L216 150 L176 190 Z" fill="#a98558"/>
        <rect x="0" y="50" width="176" height="140" rx="3" fill="#c9a877"/>
        <rect x="78" y="50" width="20" height="140" fill="${c1}"/><path d="M78 50 L118 10 L138 10 L98 50 Z" fill="${dark(c1,.1)}"/>
        <rect x="0" y="100" width="176" height="20" fill="${c1}"/><path d="M176 100 L216 60 L216 80 L176 120 Z" fill="${dark(c1,.3)}"/>
        <path d="M88 108 c-18 -22 -30 -6 -8 0 c-22 6 -10 22 8 0 c18 22 30 6 8 0 c22 -6 10 -22 -8 0z" fill="${light(c1,.15)}"/>
        <text x="88" y="150" text-anchor="middle" font-size="17" font-weight="700" fill="#4a3a26" ${FONT}>${esc(p.short||"Omiyage Box")}</text>
        <text x="88" y="168" text-anchor="middle" font-size="10" fill="#4a3a26" opacity=".8" ${FONT}>${esc(p.jp)}</text>
        <text x="88" y="78" text-anchor="middle" font-size="10" fill="#4a3a26" opacity=".7" ${FONT}>お土産 · PASALUBONG</text></g>`;
    },
    sachet(p,c1,c2,id){ // flat pouch (Kracie, Nerunerunerune, Pure Gummy)
      return `<g transform="translate(60,36)">
        <path d="M0 10 L180 10 L176 222 Q90 236 4 222 Z" fill="url(#g${id})"/>
        <path d="M0 10 h180 v10 h-180z" fill="#fff" opacity=".25"/><circle cx="18" cy="26" r="4" fill="#fff" opacity=".6"/>
        ${brandTag(p,16,38,dark(c1,.45))}
        ${label(p,0,88,180,c1,c2,17)}
        <ellipse cx="90" cy="158" rx="66" ry="44" fill="${light(c1,.78)}"/>
        <g transform="translate(40,128)">${motifs[p.motif](c1)}</g>
        <text x="90" y="216" text-anchor="middle" font-size="9" fill="${c2}" opacity=".85" ${FONT}>${esc(p.weight)}</text></g>`;
    },
    multipack(p,c1,c2,id){ // 5-pack ramen bag
      return `<g transform="translate(36,56)">
        <rect x="0" y="0" width="228" height="188" rx="10" fill="url(#g${id})"/>
        <path d="M0 0 h228 v14 h-228z" fill="#fff" opacity=".2"/>
        ${brandTag(p,14,26,dark(c1,.45))}
        <text x="114" y="74" text-anchor="middle" font-size="24" font-weight="700" fill="${c2}" ${FONT}>サッポロ一番</text>
        <text x="114" y="94" text-anchor="middle" font-size="12" fill="${c2}" opacity=".9" ${FONT}>${esc(p.short||p.name)}</text>
        <rect x="20" y="106" width="188" height="62" rx="8" fill="${light(c1,.78)}"/>
        <g transform="translate(64,108)">${motifs[p.motif](c1)}</g>
        <circle cx="200" cy="30" r="22" fill="#fff"/><text x="200" y="36" text-anchor="middle" font-size="16" font-weight="700" fill="${c1}" ${FONT}>5食</text></g>`;
    }
  };

  function product(p, opts={}){
    const id=++uid;
    const c1=p.c1||"#2c3a7a", c2=p.c2||"#ffffff";
    const bgA=opts.bgA||"#f4efe6", bgB=opts.bgB||"#e6ded0";
    const shape=shapes[p.pack]||shapes.bag;
    return `<svg viewBox="0 0 300 300" width="100%" height="100%" role="img" aria-label="${esc(p.name)} packaging illustration" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="g${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${light(c1,.12)}"/><stop offset="1" stop-color="${dark(c1,.18)}"/></linearGradient>
      <radialGradient id="b${id}" cx=".5" cy=".4" r=".8"><stop offset="0" stop-color="${bgA}"/><stop offset="1" stop-color="${bgB}"/></radialGradient></defs>
      ${opts.noBg?"":`<rect width="300" height="300" fill="url(#b${id})"/>`}
      <ellipse cx="150" cy="268" rx="96" ry="12" fill="#000" opacity=".12"/>
      ${shape(p,c1,c2,id)}
    </svg>`;
  }

  /* hero: a shelf of packages */
  function hero(products){
    const picks=products.slice(0,6);
    const pos=[[0,70,.78,-6],[150,20,.9,4],[330,60,.82,-3],[80,230,.86,5],[250,240,.8,-4],[420,220,.74,6]];
    let s=`<svg viewBox="0 0 640 520" width="100%" role="img" aria-label="A shelf of Japanese snack packages" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="hbg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff3d6"/><stop offset="1" stop-color="#f7dba0"/></linearGradient></defs>
      <rect width="640" height="520" rx="24" fill="url(#hbg)"/>
      <circle cx="540" cy="90" r="120" fill="#f2a51a" opacity=".35"/><circle cx="80" cy="460" r="90" fill="#2c3a7a" opacity=".12"/>
      <text x="32" y="60" font-size="44" font-weight="700" fill="#2c3a7a" opacity=".18" ${FONT}>おみやげ</text>`;
    picks.forEach((p,i)=>{const [x,y,sc,r]=pos[i];s+=`<g transform="translate(${x},${y}) scale(${sc}) rotate(${r} 150 150)">${product(p,{noBg:true})}</g>`;});
    return s+`</svg>`;
  }

  /* journal covers */
  const scenes={
    october:()=>`<svg viewBox="0 0 400 225" width="100%" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Autumn arrivals"><rect width="400" height="225" fill="#f6e3c3"/><circle cx="330" cy="60" r="70" fill="#f2a51a" opacity=".6"/>${[0,1,2,3,4].map(i=>`<path d="M${40+i*72} 190 q-18 -30 0 -60 q18 30 0 60z" fill="${["#c62828","#ef6c00","#a1887f","#c62828","#ef6c00"][i]}" opacity=".85" transform="rotate(${-20+i*10} ${40+i*72} 160)"/>`).join("")}<text x="20" y="48" font-size="26" font-weight="700" fill="#5d4037" ${FONT}>10月 新入荷</text></svg>`,
    kinoko:()=>`<svg viewBox="0 0 400 225" width="100%" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Kinoko versus Takenoko"><rect width="200" height="225" fill="#d7ccc8"/><rect x="200" width="200" height="225" fill="#c8e6c9"/><g transform="translate(40,60) scale(1.3)">${motifs.mushroom("#5d4037")}</g><g transform="translate(240,60) scale(1.3)">${motifs.bamboo("#5d4037")}</g><text x="100" y="190" text-anchor="middle" font-size="22" font-weight="700" fill="#3e2723" ${FONT}>きのこ</text><text x="300" y="190" text-anchor="middle" font-size="22" font-weight="700" fill="#1b5e20" ${FONT}>たけのこ</text><text x="200" y="118" text-anchor="middle" font-size="30" font-weight="700" fill="#fff" stroke="#3e2723" stroke-width="1.5" ${FONT}>VS</text></svg>`,
    labels:()=>`<svg viewBox="0 0 400 225" width="100%" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Reading a Japanese label"><rect width="400" height="225" fill="#e3f2fd"/><rect x="60" y="30" width="280" height="165" rx="6" fill="#fff" stroke="#90a4ae"/><text x="76" y="62" font-size="13" font-weight="700" fill="#263238" ${FONT}>名称：菓子</text><text x="76" y="86" font-size="11" fill="#263238" ${FONT}>原材料名：小麦粉、砂糖、植物油脂、全粉乳…</text><text x="76" y="110" font-size="11" fill="#263238" ${FONT}>（一部に小麦・乳成分・大豆を含む）</text><rect x="76" y="124" width="180" height="26" rx="3" fill="#fff59d"/><text x="84" y="142" font-size="13" font-weight="700" fill="#263238" ${FONT}>賞味期限 2027.03.15</text><text x="76" y="178" font-size="11" fill="#263238" ${FONT}>保存方法：直射日光を避け常温保存</text><circle cx="300" cy="137" r="26" fill="none" stroke="#c62828" stroke-width="3"/></svg>`
  };

  return {product,hero,scene:n=>(scenes[n]||scenes.october)(),motifs};
})();
