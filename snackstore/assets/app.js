/* Omiyage PH front end: catalogue rendering, filters, cart (localStorage), shared UI. No backend yet. */
(function(){
  "use strict";
  const $ = (s,el=document)=>el.querySelector(s);
  const $$ = (s,el=document)=>Array.from(el.querySelectorAll(s));
  const peso = n => "₱" + Number(n).toLocaleString("en-PH",{minimumFractionDigits:0,maximumFractionDigits:2});
  const byId = Object.fromEntries(PRODUCTS.map(p=>[p.id,p]));
  const catById = Object.fromEntries(CATEGORIES.map(c=>[c.id,c]));

  /* ---------- storage ---------- */
  const KEY="omiyage-cart-v1";
  function loadCart(){ try{ return JSON.parse(localStorage.getItem(KEY)||"[]"); }catch(e){ return []; } }
  function saveCart(c){ try{ localStorage.setItem(KEY,JSON.stringify(c)); }catch(e){} updateCount(); }
  let cart = loadCart();

  function addToCart(id, qty=1, unit="unit"){
    const p = byId[id]; if(!p) return;
    if(unit==="case" && !p.casePrice) unit="unit";
    const line = cart.find(l=>l.id===id && l.unit===unit);
    if(line) line.qty += qty; else cart.push({id,qty,unit});
    saveCart(cart);
    toast(`${p.name}${unit==="case"?" (case)":""} added to cart`);
  }
  function linePrice(l){ const p=byId[l.id]; return l.unit==="case" ? p.casePrice : p.price; }
  function cartCount(){ return cart.reduce((n,l)=>n+l.qty,0); }
  function updateCount(){ $$(".cart-count").forEach(el=>{ const n=cartCount(); el.textContent=n; el.hidden = n===0; }); }

  /* ---------- UI bits ---------- */
  let toastTimer;
  function toast(msg){
    let t=$(".toast"); if(!t){ t=document.createElement("div"); t.className="toast"; t.setAttribute("role","status"); document.body.appendChild(t); }
    t.textContent=msg; t.classList.add("show"); clearTimeout(toastTimer); toastTimer=setTimeout(()=>t.classList.remove("show"),2200);
  }
  function art(p, cls="art"){
    const c = catById[p.cat];
    const kana = c.kana;
    const hue = c.color;
    return `<div class="${cls}" style="background:linear-gradient(135deg,${hue},${shade(hue,-25)})" aria-hidden="true">${kana}</div>`;
  }
  function shade(hex,pct){
    const n=parseInt(hex.slice(1),16); let r=n>>16,g=(n>>8)&255,b=n&255;
    const f=v=>Math.max(0,Math.min(255,Math.round(v+(pct/100)*255)));
    return `rgb(${f(r)},${f(g)},${f(b)})`;
  }
  function stockLabel(p){
    if(p.stock===0) return `<span class="stock out">Out of stock</span>`;
    if(p.stock<=15) return `<span class="stock low">Only ${p.stock} left</span>`;
    return `<span class="stock">In stock</span>`;
  }
  function card(p){
    const badge = p.compareAt ? `<span class="badge sale">Save ${peso(p.compareAt-p.price)}</span>` : p.new ? `<span class="badge new">New</span>` : p.best ? `<span class="badge">Best seller</span>` : "";
    return `<article class="card">
      <div class="art" style="background:linear-gradient(135deg,${catById[p.cat].color},${shade(catById[p.cat].color,-25)})">${catById[p.cat].kana}${badge}<a href="product.html#${p.id}" aria-label="${esc(p.name)}"></a></div>
      <div class="body">
        <div class="brand-line">${esc(p.brand)} · ${esc(p.weight)}</div>
        <h3><a href="product.html#${p.id}">${esc(p.name)}</a></h3>
        <div class="jp" lang="ja">${esc(p.jp)}</div>
        <div class="price-row"><span class="price num">${peso(p.price)}${p.compareAt?` <s>${peso(p.compareAt)}</s>`:""}</span>${p.casePrice?`<span class="small muted num">case of ${p.caseQty}: ${peso(p.casePrice)}</span>`:""}</div>
      </div>
      <div class="foot">${stockLabel(p)}<button class="btn btn-ghost btn-sm" data-add="${p.id}" ${p.stock===0?"disabled":""}>Add</button></div>
    </article>`;
  }
  const esc = s => String(s).replace(/[&<>"]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[ch]));

  /* ---------- page renderers ---------- */
  function renderGrid(el, list){
    if(!el) return;
    el.innerHTML = list.length ? list.map(card).join("") : `<div class="empty" style="grid-column:1/-1">No products match these filters. Clear a filter or two.</div>`;
  }

  function initHome(){
    renderGrid($("#best-sellers"), PRODUCTS.filter(p=>p.best).slice(0,8));
    const cats=$("#category-grid");
    if(cats) cats.innerHTML = CATEGORIES.map(c=>`<a class="cat" href="shop.html#cat=${c.id}"><span class="swatch" style="background:${c.color}">${c.kana.slice(0,2)}</span><div><strong>${esc(c.name)}</strong><span>${esc(c.blurb)}</span></div></a>`).join("");
  }

  function initShop(){
    const grid=$("#shop-grid"); if(!grid) return;
    const state={cats:new Set(),tags:new Set(),q:"",sort:"featured",inStock:false};
    function readHash(){
      state.cats.clear(); state.q="";
      location.hash.replace("#","").split("&").forEach(kv=>{ const [k,v]=kv.split("="); if(k==="cat"&&catById[v]) state.cats.add(v); if(k==="q"&&v) state.q=decodeURIComponent(v); });
    }
    readHash();
    // build filters
    $("#filter-cats").innerHTML = CATEGORIES.map(c=>`<label><input type="checkbox" name="cat" value="${c.id}" id="cat-${c.id}" ${state.cats.has(c.id)?"checked":""}> ${esc(c.name)} <span class="muted small">(${PRODUCTS.filter(p=>p.cat===c.id).length})</span></label>`).join("");
    const TAGS=[["vegetarian","Vegetarian"],["no-alcohol","No alcohol"]];
    $("#filter-tags").innerHTML = TAGS.map(([id,n])=>`<label><input type="checkbox" name="tag" value="${id}" id="tag-${id}"> ${n}</label>`).join("") + `<label><input type="checkbox" id="in-stock"> In stock only</label>`;
    const qInput=$("#shop-q"); if(qInput) qInput.value=state.q;
    function apply(){
      let list=PRODUCTS.filter(p=>(!state.cats.size||state.cats.has(p.cat)) && [...state.tags].every(t=>p.tags.includes(t)) && (!state.inStock||p.stock>0));
      if(state.q){ const q=state.q.toLowerCase(); list=list.filter(p=>[p.name,p.brand,p.jp,p.desc,catById[p.cat].name].join(" ").toLowerCase().includes(q)); }
      const s=state.sort;
      if(s==="price-asc") list.sort((a,b)=>a.price-b.price);
      else if(s==="price-desc") list.sort((a,b)=>b.price-a.price);
      else if(s==="name") list.sort((a,b)=>a.name.localeCompare(b.name));
      else list.sort((a,b)=>(b.best?1:0)-(a.best?1:0) || (b.new?1:0)-(a.new?1:0));
      renderGrid(grid,list);
      $("#result-count").textContent = `${list.length} of ${PRODUCTS.length} products`;
      const chips=$("#active-chips");
      chips.innerHTML=[...state.cats].map(c=>`<button class="chip" aria-pressed="true" data-clear-cat="${c}">${esc(catById[c].name)} ×</button>`).join("")+[...state.tags].map(t=>`<button class="chip" aria-pressed="true" data-clear-tag="${t}">${TAGS.find(x=>x[0]===t)[1]} ×</button>`).join("")+(state.q?`<button class="chip" aria-pressed="true" data-clear-q>“${esc(state.q)}” ×</button>`:"");
    }
    $("#filters").addEventListener("change",e=>{
      const t=e.target;
      if(t.name==="cat"){ t.checked?state.cats.add(t.value):state.cats.delete(t.value); }
      if(t.name==="tag"){ t.checked?state.tags.add(t.value):state.tags.delete(t.value); }
      if(t.id==="in-stock") state.inStock=t.checked;
      apply();
    });
    $("#sort").addEventListener("change",e=>{state.sort=e.target.value;apply();});
    if(qInput) qInput.addEventListener("input",e=>{state.q=e.target.value.trim();apply();});
    $("#active-chips").addEventListener("click",e=>{
      const b=e.target.closest("button"); if(!b) return;
      if(b.dataset.clearCat){ state.cats.delete(b.dataset.clearCat); $("#cat-"+b.dataset.clearCat).checked=false; }
      if(b.dataset.clearTag){ state.tags.delete(b.dataset.clearTag); $("#tag-"+b.dataset.clearTag).checked=false; }
      if("clearQ" in b.dataset){ state.q=""; if(qInput) qInput.value=""; }
      apply();
    });
    $("#clear-filters").addEventListener("click",()=>{ state.cats.clear(); state.tags.clear(); state.q=""; state.inStock=false; $$("#filters input").forEach(i=>i.checked=false); if(qInput) qInput.value=""; apply(); });
    window.addEventListener("hashchange",()=>{ readHash(); $$('#filters input[name=cat]').forEach(i=>i.checked=state.cats.has(i.value)); if(qInput) qInput.value=state.q; apply(); });
    apply();
  }

  function initProduct(){
    const root=$("#pdp"); if(!root) return;
    function render(){
      const id=location.hash.replace("#","") || "glico-pocky-chocolate";
      const p=byId[id];
      if(!p){ root.innerHTML=`<div class="empty">We could not find that product. <a href="shop.html">Back to the shop</a>.</div>`; return; }
      const c=catById[p.cat];
      document.title=`${p.name} | Omiyage PH`;
      $("#crumb-cat").textContent=c.name; $("#crumb-cat").href=`shop.html#cat=${c.id}`;
      $("#crumb-name").textContent=p.name;
      const containsAlcohol = !p.tags.includes("no-alcohol");
      root.innerHTML=`
        <div class="gallery"><div class="main-art" style="background:linear-gradient(135deg,${c.color},${shade(c.color,-25)})" aria-hidden="true">${c.kana}</div>
          <p class="small muted" style="margin-top:10px">Product photo to follow. Colour tile shows the category.</p></div>
        <div class="info">
          <div><div class="eyebrow">${esc(p.brand)} · ${esc(c.name)}</div><h1>${esc(p.name)}</h1><div class="jp" lang="ja">${esc(p.jp)}</div></div>
          <p>${esc(p.desc)}</p>
          <div class="buy-box">
            <div class="row" style="justify-content:space-between"><div class="price num" id="pdp-price">${peso(p.price)}${p.compareAt?` <s>${peso(p.compareAt)}</s>`:""}<span class="vat">Price in Philippine pesos, 12% VAT included</span></div>${stockLabel(p)}</div>
            ${p.casePrice?`<div class="stack" role="radiogroup" aria-label="Pack size">
              <label class="option"><input type="radio" name="unit" value="unit" id="unit-single" checked><div><strong>Single · ${esc(p.weight)}</strong><span>${peso(p.price)} each</span></div></label>
              <label class="option"><input type="radio" name="unit" value="case" id="unit-case"><div><strong>Full case · ${p.caseQty} units</strong><span>${peso(p.casePrice)}, ${peso((p.casePrice/p.caseQty))} each, save ${Math.round((1-p.casePrice/(p.price*p.caseQty))*100)}%</span></div></label>
            </div>`:""}
            <div class="row">
              <div class="qty"><button type="button" data-q="-1" aria-label="Decrease quantity">−</button><input type="number" id="qty" value="1" min="1" max="99" aria-label="Quantity"><button type="button" data-q="1" aria-label="Increase quantity">+</button></div>
              <button class="btn btn-primary" id="add" ${p.stock===0?"disabled":""}>${p.stock===0?"Out of stock":"Add to cart"}</button>
            </div>
            ${containsAlcohol?`<div class="notice">Contains alcohol. Not sold to buyers under 18. Excluded from the no-alcohol filter.</div>`:""}
            <p class="small muted">Ships from our Metro Manila warehouse. Metro Manila 1–2 business days, provincial 2–7. Free shipping on orders over ${peso(SHIPPING.freeOver)}.</p>
          </div>
          <dl class="specs">
            <dt>Brand</dt><dd>${esc(p.brand)}</dd>
            <dt>Net weight</dt><dd>${esc(p.weight)}</dd>
            <dt>Country of origin</dt><dd>Japan</dd>
            <dt>Shelf life</dt><dd>We ship stock with at least 60 days before best-before. The date is printed on every pack.</dd>
            <dt>Dietary notes</dt><dd>${p.tags.includes("vegetarian")?"Vegetarian":"Not vegetarian"}${containsAlcohol?", contains alcohol":", no alcohol"}. Based on the manufacturer's Japanese ingredient list, not a certification.</dd>
          </dl>
          <div class="tabs">
            <details open><summary>Ingredients</summary><div class="prose"><p>${esc(p.ingredients)}</p></div></details>
            <details><summary>Allergens</summary><div class="prose"><p>${esc(p.allergens)}</p><p class="small muted">Japanese labelling lists 8 mandatory allergens (wheat, egg, milk, shrimp, crab, buckwheat, peanut, walnut). We translate the full label; if you have a severe allergy, email us the product name before ordering and we will photograph the pack for you.</p></div></details>
            <details><summary>Shipping and returns</summary><div class="prose"><p>Orders placed before 2 PM ship the same business day. Chocolate ships with an ice pack from March to June and we hold chocolate orders during typhoon signal 3 or higher. Damaged or wrong items are replaced or refunded within 7 days of delivery. <a href="shipping.html">Full shipping policy</a>.</p></div></details>
          </div>
        </div>`;
      $("#add").addEventListener("click",()=>{ const unit=($('input[name=unit]:checked')||{}).value||"unit"; addToCart(p.id, Math.max(1,parseInt($("#qty").value)||1), unit); });
      $$("[data-q]").forEach(b=>b.addEventListener("click",()=>{ const i=$("#qty"); i.value=Math.max(1,Math.min(99,(parseInt(i.value)||1)+parseInt(b.dataset.q))); }));
      renderGrid($("#related"), PRODUCTS.filter(x=>x.cat===p.cat&&x.id!==p.id).slice(0,4));
    }
    render(); window.addEventListener("hashchange",render);
  }

  function initCart(){
    const root=$("#cart-lines"); if(!root) return;
    const regionSel=$("#region");
    regionSel.innerHTML=SHIPPING.regions.map(r=>`<option value="${r.id}">${r.name} · ${peso(r.fee)} · ${r.days}</option>`).join("");
    try{ const saved=localStorage.getItem("omiyage-region"); if(saved) regionSel.value=saved; }catch(e){}
    function render(){
      cart=cart.filter(l=>byId[l.id]);
      if(!cart.length){ root.innerHTML=`<div class="empty">Your cart is empty. <a href="shop.html">Start with the best sellers</a>.</div>`; $("#summary").hidden=true; return; }
      $("#summary").hidden=false;
      root.innerHTML=cart.map((l,i)=>{ const p=byId[l.id]; const c=catById[p.cat]; return `<div class="line">
        <div class="art" style="background:linear-gradient(135deg,${c.color},${shade(c.color,-25)})" aria-hidden="true">${c.kana.slice(0,2)}</div>
        <div class="meta"><strong><a href="product.html#${p.id}">${esc(p.name)}</a></strong><span class="small muted">${esc(p.brand)} · ${l.unit==="case"?`case of ${p.caseQty}`:esc(p.weight)} · ${peso(linePrice(l))} each</span><button class="remove" data-rm="${i}">Remove</button></div>
        <div class="right stack" style="justify-items:end"><div class="qty"><button type="button" data-i="${i}" data-d="-1" aria-label="Decrease">−</button><input type="number" value="${l.qty}" min="1" max="99" data-i="${i}" aria-label="Quantity"><button type="button" data-i="${i}" data-d="1" aria-label="Increase">+</button></div><strong class="num">${peso(linePrice(l)*l.qty)}</strong></div>
      </div>`;}).join("");
      const sub=cart.reduce((n,l)=>n+linePrice(l)*l.qty,0);
      const region=SHIPPING.regions.find(r=>r.id===regionSel.value)||SHIPPING.regions[0];
      const ship= sub>=SHIPPING.freeOver ? 0 : region.fee;
      const vat= sub - sub/1.12;
      $("#t-sub").textContent=peso(sub);
      $("#t-ship").textContent= ship===0 ? "Free" : peso(ship);
      $("#t-vat").textContent=peso(vat.toFixed(2));
      $("#t-total").textContent=peso(sub+ship);
      $("#t-eta").textContent=region.days;
      $("#t-cod").textContent= region.cod ? "GCash, Maya, card, bank transfer, or cash on delivery" : "GCash, Maya, card or bank transfer (no COD for this region)";
      const gap=SHIPPING.freeOver-sub;
      $("#free-ship").textContent = gap>0 ? `Add ${peso(gap)} more for free shipping.` : "You have free shipping.";
    }
    root.addEventListener("click",e=>{
      const rm=e.target.closest("[data-rm]"); if(rm){ cart.splice(+rm.dataset.rm,1); saveCart(cart); render(); return; }
      const b=e.target.closest("button[data-d]"); if(b){ const l=cart[+b.dataset.i]; l.qty=Math.max(1,Math.min(99,l.qty+ +b.dataset.d)); saveCart(cart); render(); }
    });
    root.addEventListener("change",e=>{ const i=e.target.closest("input[data-i]"); if(i){ cart[+i.dataset.i].qty=Math.max(1,Math.min(99,parseInt(i.value)||1)); saveCart(cart); render(); } });
    regionSel.addEventListener("change",()=>{ try{localStorage.setItem("omiyage-region",regionSel.value);}catch(e){} render(); });
    $("#checkout").addEventListener("click",()=>{ $("#checkout-note").hidden=false; $("#checkout-note").scrollIntoView({behavior:"smooth",block:"nearest"}); });
    render();
  }

  /* ---------- global ---------- */
  document.addEventListener("click",e=>{
    const b=e.target.closest("[data-add]"); if(b){ addToCart(b.dataset.add,1,"unit"); }
  });
  document.addEventListener("DOMContentLoaded",()=>{
    updateCount();
    const mb=$(".menu-btn"), nav=$(".nav");
    if(mb&&nav) mb.addEventListener("click",()=>{ const open=nav.classList.toggle("open"); mb.setAttribute("aria-expanded",open); });
    const hs=$("#header-search");
    if(hs) hs.addEventListener("submit",e=>{ e.preventDefault(); const q=hs.q.value.trim(); location.href=`shop.html#q=${encodeURIComponent(q)}`; });
    $$("form[data-demo]").forEach(f=>f.addEventListener("submit",e=>{ e.preventDefault(); const n=f.querySelector(".form-result"); if(n){ n.hidden=false; } f.reset(); }));
    const path=location.pathname.split("/").pop()||"index.html";
    $$(".nav a").forEach(a=>{ if(a.getAttribute("href")===path) a.setAttribute("aria-current","page"); });
    initHome(); initShop(); initProduct(); initCart();
  });
})();
