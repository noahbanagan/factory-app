// shared client helpers for Dynamic ERP pages
'use strict';
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
const TOKEN = () => localStorage.getItem('erp.token') || '';
async function api(path, method = 'GET', data){
  const r = await fetch('/api/' + path, {method, headers:Object.assign({'x-token':TOKEN()}, data ? {'Content-Type':'application/json'} : {}), body:data ? JSON.stringify(data) : undefined});
  const j = await r.json().catch(() => ({error:'Bad response'})); if (!r.ok){ const e = new Error(j.error || r.statusText); e.code = r.status; throw e; } return j;
}
function toast(msg, bad){ const t = document.createElement('div'); t.className = 'toast' + (bad ? ' bad' : ''); t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), bad ? 5000 : 2500); }
function tag(s){ return `<span class="tag ${esc(s)}">${esc(String(s || '').replace('_', ' '))}</span>`; }
function fmtD(d){ return d ? String(d).slice(0, 10) : ''; }
function fmtT(d){ return d ? new Date(d).toLocaleString('en-PH', {hour12:false}).replace(',', '') : ''; }
function hm(min){ min = +min || 0; const h = Math.floor(min/60), m = Math.round(min % 60); return h ? `${h}h ${m}m` : `${m}m`; }
function since(iso){ return hm((Date.now() - new Date(iso))/60000); }
function dlg(title, html, onOk, okLabel = 'Save'){
  const bg = document.createElement('div'); bg.className = 'dlg-bg'; bg.innerHTML = `<div class="dlg"><h3>${esc(title)}</h3><div class="body">${html}</div><div class="bar" style="justify-content:flex-end;margin-top:12px"><button class="cn">Cancel</button>${onOk ? `<button class="pri ok">${esc(okLabel)}</button>` : ''}</div></div>`;
  document.body.appendChild(bg); const close = () => bg.remove(); bg.querySelector('.cn').onclick = close; bg.addEventListener('click', e => { if (e.target === bg) close(); });
  if (onOk) bg.querySelector('.ok').onclick = async () => { try { const r = await onOk(bg); if (r !== false) close(); } catch (e){ toast(e.message, true); } };
  const f = bg.querySelector('input,select,textarea'); if (f) setTimeout(() => f.focus(), 30); return bg;
}
function form(fields, obj = {}){ return fields.map(([k, label, type, opts]) => { const v = obj[k] == null ? '' : obj[k]; let c; if (type === 'select') c = `<select name="${k}">${opts.map(o => `<option value="${esc(o[0])}" ${String(o[0]) === String(v) ? 'selected' : ''}>${esc(o[1])}</option>`).join('')}</select>`; else if (type === 'textarea') c = `<textarea name="${k}" rows="3">${esc(v)}</textarea>`; else c = `<input name="${k}" type="${type || 'text'}" value="${esc(v)}" ${type === 'number' ? 'step="any"' : ''}>`; return `<div class="fr"><label>${esc(label)}</label>${c}</div>`; }).join(''); }
function read(bg, fields){ const o = {}; for (const [k, , type] of fields){ const el = bg.querySelector(`[name="${k}"]`); if (!el) continue; o[k] = type === 'number' ? (el.value === '' ? null : +el.value) : el.value; } return o; }
function live(onEvent){ let es; const connect = () => { es = new EventSource('/api/stream'); for (const k of ['board', 'sales', 'hello']) es.addEventListener(k, e => onEvent(k, JSON.parse(e.data || '{}'))); es.onerror = () => { es.close(); setTimeout(connect, 3000); }; }; connect(); }
