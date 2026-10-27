// Dynamic ERP server — plain Node (no dependencies): static files, JSON API, live updates (SSE), SQLite.
// Run: node erp/server.js  [--port 8080] [--db erp/data/erp.sqlite] [--demo]
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const {open, seedDemo} = require('./db');

const args = process.argv.slice(2), arg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const PORT = +(arg('--port', process.env.PORT || 8080)), DBFILE = arg('--db', path.join(__dirname, 'data', 'erp.sqlite'));
const D = open(DBFILE); if (args.includes('--demo') || process.env.ERP_DEMO) seedDemo(D);
const PUB = path.join(__dirname, 'public'), ROOT = path.join(__dirname, '..');
const MIME = {'.html':'text/html; charset=utf-8', '.js':'application/javascript', '.css':'text/css', '.json':'application/json', '.png':'image/png', '.svg':'image/svg+xml', '.ico':'image/x-icon', '.webmanifest':'application/manifest+json', '.dxf':'text/plain', '.nc':'text/plain', '.txt':'text/plain'};

/* ---------- live bus (server-sent events) ---------- */
const clients = new Set();
function broadcast(kind, data){ const msg = `event: ${kind}\ndata: ${JSON.stringify(data || {})}\n\n`; for (const c of clients){ try { c.write(msg); } catch (e){ clients.delete(c); } } }
setInterval(() => broadcast('ping', {t:Date.now()}), 25000);

/* ---------- helpers ---------- */
const ROLES = {owner:5, office:4, qa:3, maintenance:3, programmer:3, operator:1};
function json(res, code, obj){ res.writeHead(code, {'Content-Type':'application/json', 'Cache-Control':'no-store'}); res.end(JSON.stringify(obj)); }
function body(req){ return new Promise((ok, no) => { let b = ''; req.on('data', c => { b += c; if (b.length > 5e7) req.destroy(); }); req.on('end', () => { try { ok(b ? JSON.parse(b) : {}); } catch (e){ no(new Error('bad json')); } }); }); }
function user(req){ const t = req.headers['x-token'] || new URL(req.url, 'http://x').searchParams.get('token'); return t ? D.one('SELECT id,name,role,station_id FROM users WHERE token=? AND active=1', t) : null; }
function need(u, role){ if (!u) throw Object.assign(new Error('Sign in first'), {code:401}); if ((ROLES[u.role] || 0) < (ROLES[role] || 0)) throw Object.assign(new Error('Not allowed for your role'), {code:403}); }
const minutes = (a, b) => Math.max(0, (new Date(b) - new Date(a))/60000);
const COLS = {customers:['name','code','contact','email','phone','priority','notes','qb_id'], rfqs:['no','customer_id','received','due','status','items','notes','quote_total','quoted_at','followup_at','po_no','po_date','drive_url','trello_url','qb_estimate_id','lost_reason'],
  jobs:['no','rfq_id','customer_id','part','drawing_no','rev','material','qty','due','status','priority','est_hours','est_material','price','notes','drive_url','cam_file','dr_no','invoice_no','shipped_at'],
  operations:['job_id','seq','station_id','name','est_min','status','order_idx','qty_done','scrap','block_reason','pinned','tool_nums'], tools:['machine_code','num','name','type','dia','flutes','len','pocket','loaded','stock','min_stock','life_min','used_min','notes'],
  machines:['code','name','model','kind','serial','installed','meter_hours','status','pm_interval_days','last_pm','notes','station_id'], maint:['machine_id','kind','date','done','hours_down','descr','parts','cost','by_user'],
  facilities:['name','kind','detail','renew_on','status','notes'], materials:['name','spec','size','unit','stock','min_stock','heat_no','supplier','location'], purchase_req:['item','qty','unit','reason','status','supplier','po_no','received_at','cost'],
  docs:['job_id','name','rev','status','url','by_user'], qa:['job_id','op_id','kind','result','measured','remarks','by_user'], stations:['code','name','kind','hours_per_day','sort','active'], users:['name','pin','role','station_id','active']};
const WRITE_ROLE = {customers:'office', rfqs:'office', jobs:'office', operations:'office', tools:'operator', machines:'office', maint:'maintenance', facilities:'office', materials:'office', purchase_req:'operator', docs:'office', qa:'qa', stations:'owner', users:'owner'};

function opQueue(stationId){
  return D.q(`SELECT o.*, j.no job_no, j.part, j.qty, j.due, j.priority, j.drawing_no, j.rev, j.material, c.name customer, c.code ccode,
    (SELECT u.name FROM time_logs t JOIN users u ON u.id=t.user_id WHERE t.op_id=o.id AND t.end IS NULL ORDER BY t.id DESC LIMIT 1) operator,
    (SELECT t.start FROM time_logs t WHERE t.op_id=o.id AND t.end IS NULL ORDER BY t.id DESC LIMIT 1) run_since,
    (SELECT COALESCE(SUM(minutes),0) FROM time_logs t WHERE t.op_id=o.id AND t.end IS NOT NULL) spent_min,
    (SELECT COUNT(*) FROM operations p WHERE p.job_id=o.job_id AND p.seq<o.seq AND p.status<>'done') waiting_on
    FROM operations o JOIN jobs j ON j.id=o.job_id LEFT JOIN customers c ON c.id=j.customer_id
    WHERE o.station_id=? AND o.status<>'done' AND j.status IN ('released','in_progress','qa')
    ORDER BY o.pinned DESC, CASE o.status WHEN 'running' THEN 0 WHEN 'paused' THEN 1 ELSE 2 END, o.order_idx, j.due`, stationId)
    .map(o => { const t0 = D.today(); return Object.assign(o, {late:!!(o.due && o.due < t0), soon:!!(o.due && o.due >= t0 && o.due <= addDays(t0, 2)), ready:o.waiting_on === 0}); });
}
function board(){
  const stations = D.q('SELECT * FROM stations WHERE active=1 ORDER BY sort');
  const t0 = D.today();
  return {ts:D.now(), today:t0, stations:stations.map(s => { const queue = opQueue(s.id); const hours = queue.reduce((a, o) => a + Math.max(0, (o.est_min || 0) - (o.spent_min || 0))/60, 0); return Object.assign({}, s, {queue, hours:+hours.toFixed(1), days:+(hours/(s.hours_per_day || 8)).toFixed(1), done_today:D.one("SELECT COUNT(*) c FROM operations WHERE station_id=? AND status='done' AND substr(finished_at,1,10)=?", s.id, t0).c}); })};
}
function addDays(d, n){ const t = new Date(d); t.setDate(t.getDate() + n); return t.toISOString().slice(0, 10); }
function jobStatusRefresh(jobId){
  const ops = D.q('SELECT status FROM operations WHERE job_id=? ORDER BY seq', jobId); if (!ops.length) return;
  const all = ops.every(o => o.status === 'done'), any = ops.some(o => o.status !== 'queued'), j = D.one('SELECT status FROM jobs WHERE id=?', jobId);
  if (j.status === 'shipped') return;
  const ns = all ? 'done' : any ? 'in_progress' : (j.status === 'planned' ? 'planned' : 'released');
  if (ns !== j.status) D.run('UPDATE jobs SET status=? WHERE id=?', ns, jobId);
}
function stopRun(opId, userId, note){
  const open_ = D.q('SELECT * FROM time_logs WHERE op_id=? AND end IS NULL', opId);
  for (const l of open_){ const end = D.now(); D.run('UPDATE time_logs SET end=?, minutes=?, note=COALESCE(note,?) WHERE id=?', end, minutes(l.start, end), note || null, l.id); if (l.kind === 'run'){ const op = D.one('SELECT tool_nums, station_id FROM operations WHERE id=?', opId); const st = op && D.one('SELECT code FROM stations WHERE id=?', op.station_id); if (op && op.tool_nums && st) for (const n of String(op.tool_nums).split(/[ ,]+/).filter(Boolean)) D.run('UPDATE tools SET used_min=used_min+? WHERE machine_code=? AND num=?', minutes(l.start, end), st.code, +n); } }
}
function dashboard(){
  const t0 = D.today();
  const late = D.q("SELECT j.*, c.name customer FROM jobs j LEFT JOIN customers c ON c.id=j.customer_id WHERE j.status NOT IN ('done','shipped') AND j.due<? ORDER BY j.due", t0);
  const week = D.q("SELECT j.*, c.name customer FROM jobs j LEFT JOIN customers c ON c.id=j.customer_id WHERE j.status NOT IN ('done','shipped') AND j.due>=? AND j.due<=? ORDER BY j.due", t0, addDays(t0, 7));
  const running = D.q("SELECT o.name op, j.no job_no, j.part, s.code station, u.name operator, t.start FROM time_logs t JOIN operations o ON o.id=t.op_id JOIN jobs j ON j.id=o.job_id JOIN stations s ON s.id=o.station_id JOIN users u ON u.id=t.user_id WHERE t.end IS NULL");
  const blocked = D.q("SELECT o.*, j.no job_no, j.part, s.code station FROM operations o JOIN jobs j ON j.id=o.job_id JOIN stations s ON s.id=o.station_id WHERE o.status='blocked'");
  const quotes = D.q("SELECT r.*, c.name customer FROM rfqs r LEFT JOIN customers c ON c.id=r.customer_id WHERE r.status='quoted' AND r.followup_at<=? ORDER BY r.followup_at", t0);
  const newRfq = D.one("SELECT COUNT(*) c FROM rfqs WHERE status IN ('new','estimating')").c;
  const machines = D.q("SELECT m.*, (SELECT MIN(date) FROM maint x WHERE x.machine_id=m.id AND x.done=0) next_pm FROM machines m");
  const reorder = D.q('SELECT * FROM materials WHERE stock<min_stock').concat(D.q('SELECT name, stock, min_stock, machine_code FROM tools WHERE stock<min_stock'));
  const toolsDue = D.q('SELECT * FROM tools WHERE life_min>0 AND used_min>=life_min*0.9');
  const facilities = D.q('SELECT * FROM facilities WHERE renew_on<=? ORDER BY renew_on', addDays(t0, 14));
  const month = t0.slice(0, 7);
  const kpi = {
    on_time: (() => { const r = D.q("SELECT due, shipped_at FROM jobs WHERE status='shipped' AND substr(shipped_at,1,7)=?", month); return r.length ? Math.round(100*r.filter(j => j.shipped_at.slice(0, 10) <= j.due).length/r.length) : null; })(),
    hours_this_week: +(D.one("SELECT COALESCE(SUM(minutes),0) m FROM time_logs WHERE start>=? AND kind='run'", addDays(t0, -7)).m/60).toFixed(1),
    win_rate: (() => { const w = D.one("SELECT COUNT(*) c FROM rfqs WHERE status='won' AND substr(created,1,7)=?", month).c, l = D.one("SELECT COUNT(*) c FROM rfqs WHERE status='lost' AND substr(created,1,7)=?", month).c; return w + l ? Math.round(100*w/(w + l)) : null; })(),
    scrap: D.one("SELECT COALESCE(SUM(scrap),0) s, COALESCE(SUM(qty_done),0) q FROM operations WHERE substr(finished_at,1,7)=?", month),
    open_jobs: D.one("SELECT COUNT(*) c FROM jobs WHERE status NOT IN ('done','shipped')").c
  };
  return {today:t0, late, week, running, blocked, quotes_followup:quotes, new_rfq:newRfq, machines, reorder, tools_due:toolsDue, facilities_due:facilities, kpi};
}
function costing(jobId){
  const j = D.one('SELECT j.*, c.name customer FROM jobs j LEFT JOIN customers c ON c.id=j.customer_id WHERE j.id=?', jobId); if (!j) return null;
  const ops = D.q(`SELECT o.*, s.code station, (SELECT COALESCE(SUM(minutes),0) FROM time_logs t WHERE t.op_id=o.id AND t.kind='run') run_min, (SELECT COALESCE(SUM(minutes),0) FROM time_logs t WHERE t.op_id=o.id AND t.kind='setup') setup_min FROM operations o JOIN stations s ON s.id=o.station_id WHERE o.job_id=? ORDER BY o.seq`, jobId);
  const est = ops.reduce((a, o) => a + (o.est_min || 0), 0), act = ops.reduce((a, o) => a + o.run_min + o.setup_min, 0);
  return {job:j, ops, est_min:est, act_min:+act.toFixed(1), variance_pct:est ? Math.round(100*(act - est)/est) : null, scrap:ops.reduce((a, o) => a + (o.scrap || 0), 0)};
}

/* ---------- API ---------- */
async function api(req, res, u, m, p, qs){
  const seg = p.split('/').filter(Boolean); // ['api', table, id?, action?]
  const t = seg[1], id = seg[2] && /^\d+$/.test(seg[2]) ? +seg[2] : null, act = id != null ? seg[3] : seg[2];
  if (t === 'login' && m === 'POST'){ const b = await body(req); const row = D.one('SELECT * FROM users WHERE name=? AND pin=? AND active=1', b.name || '', String(b.pin || '')); if (!row) return json(res, 401, {error:'Wrong name or PIN'}); const tk = D.token(); D.run('UPDATE users SET token=? WHERE id=?', tk, row.id); D.event('login', row.id, row.name, row.id); return json(res, 200, {token:tk, user:{id:row.id, name:row.name, role:row.role, station_id:row.station_id}}); }
  if (t === 'me') return json(res, 200, {user:u, stations:D.q('SELECT * FROM stations WHERE active=1 ORDER BY sort'), company:D.one("SELECT value FROM settings WHERE key='company'").value});
  if (t === 'board') return json(res, 200, board());
  if (t === 'portal'){ const c = D.one('SELECT id,name,code FROM customers WHERE portal_token=?', qs.get('t') || ''); if (!c) return json(res, 404, {error:'Unknown link'}); return json(res, 200, {customer:c, rfqs:D.q("SELECT no,received,due,status,items,quote_total,quoted_at,po_no FROM rfqs WHERE customer_id=? ORDER BY id DESC", c.id), jobs:D.q("SELECT no,part,drawing_no,rev,qty,due,status,shipped_at,dr_no,(SELECT COUNT(*) FROM operations o WHERE o.job_id=jobs.id AND o.status='done') done_ops,(SELECT COUNT(*) FROM operations o WHERE o.job_id=jobs.id) ops FROM jobs WHERE customer_id=? ORDER BY due", c.id)}); }
  if (t === 'portal_accept' && m === 'POST'){ const b = await body(req); const c = D.one('SELECT id FROM customers WHERE portal_token=?', b.t || ''); const r = c && D.one('SELECT * FROM rfqs WHERE no=? AND customer_id=?', b.no, c.id); if (!r) return json(res, 404, {error:'Unknown'}); D.run("UPDATE rfqs SET status='won', po_no=COALESCE(?,po_no), po_date=? WHERE id=?", b.po_no || null, D.today(), r.id); D.event('rfq.accepted', r.no, `Customer accepted quote ${r.no} via portal`); broadcast('sales', {}); return json(res, 200, {ok:true}); }
  need(u, 'operator');
  if (t === 'dashboard'){ need(u, 'qa'); return json(res, 200, dashboard()); }
  if (t === 'costing'){ need(u, 'office'); return json(res, 200, id ? costing(id) : D.q("SELECT id FROM jobs WHERE status IN ('done','shipped','in_progress')").map(j => costing(j.id)).map(c => ({no:c.job.no, part:c.job.part, customer:c.job.customer, price:c.job.price, est_min:c.est_min, act_min:c.act_min, variance_pct:c.variance_pct, scrap:c.scrap, status:c.job.status}))); }
  if (t === 'events'){ need(u, 'office'); return json(res, 200, D.q('SELECT e.*, u.name user FROM events e LEFT JOIN users u ON u.id=e.user_id ORDER BY e.id DESC LIMIT ?', +(qs.get('limit') || 200))); }
  if (t === 'queue'){ const sid = +(qs.get('station') || u.station_id || 0); return json(res, 200, {station:D.one('SELECT * FROM stations WHERE id=?', sid), queue:opQueue(sid), running:D.q('SELECT t.*, o.name op, j.no job_no FROM time_logs t JOIN operations o ON o.id=t.op_id JOIN jobs j ON j.id=o.job_id WHERE t.user_id=? AND t.end IS NULL', u.id)}); }
  if (t === 'scan'){ const code = (qs.get('code') || '').trim(); const j = D.one('SELECT id FROM jobs WHERE no=?', code.replace(/^JOB:/i, '')); const o = /^OP:(\d+)/i.test(code) ? D.one('SELECT * FROM operations WHERE id=?', +RegExp.$1) : null; return json(res, 200, {job:j ? D.one('SELECT j.*, c.name customer FROM jobs j LEFT JOIN customers c ON c.id=j.customer_id WHERE j.id=?', j.id) : null, op:o, ops:j ? D.q('SELECT o.*, s.code station FROM operations o JOIN stations s ON s.id=o.station_id WHERE job_id=? ORDER BY seq', j.id) : []}); }
  if (t === 'ops' && id && act && m === 'POST'){
    const b = await body(req), op = D.one('SELECT * FROM operations WHERE id=?', id); if (!op) return json(res, 404, {error:'No such operation'});
    const job = D.one('SELECT * FROM jobs WHERE id=?', op.job_id), st = D.one('SELECT code FROM stations WHERE id=?', op.station_id);
    if (act === 'start' || act === 'setup'){
      if (!['released', 'in_progress', 'qa'].includes(job.status)) return json(res, 400, {error:'Job is not released by Planning yet'});
      const mine = D.one('SELECT id, op_id FROM time_logs WHERE user_id=? AND end IS NULL', u.id); if (mine && mine.op_id !== id) return json(res, 400, {error:'You already have a running job — stop it first'});
      const other = D.one('SELECT u.name FROM time_logs t JOIN users u ON u.id=t.user_id WHERE t.op_id=? AND t.end IS NULL AND t.user_id<>?', id, u.id); if (other) return json(res, 400, {error:`${other.name} is already running this operation`});
      if (!mine) D.run('INSERT INTO time_logs(op_id,user_id,kind,start) VALUES (?,?,?,?)', id, u.id, act === 'setup' ? 'setup' : 'run', D.now());
      else if (act === 'start' && D.one("SELECT kind FROM time_logs WHERE id=?", mine.id).kind === 'setup'){ stopRun(id, u.id, 'setup done'); D.run('INSERT INTO time_logs(op_id,user_id,kind,start) VALUES (?,?,?,?)', id, u.id, 'run', D.now()); }
      D.run("UPDATE operations SET status='running', started_at=COALESCE(started_at,?), block_reason=NULL WHERE id=?", D.now(), id); D.run("UPDATE jobs SET status='in_progress' WHERE id=? AND status='released'", job.id);
      D.event('op.start', job.no, `${u.name} started ${act === 'setup' ? 'SETUP ' : ''}${op.name} on ${st.code}`, u.id);
    } else if (act === 'pause'){ stopRun(id, u.id, b.note); D.run("UPDATE operations SET status='paused' WHERE id=?", id); D.event('op.pause', job.no, `${u.name} paused ${op.name}${b.note ? ' - ' + b.note : ''}`, u.id); }
    else if (act === 'stop'){ stopRun(id, u.id, b.note); D.run("UPDATE operations SET status='paused' WHERE id=? AND status='running'", id); D.event('op.stop', job.no, `${u.name} stopped ${op.name}`, u.id); }
    else if (act === 'finish'){ stopRun(id, u.id, b.note); D.run("UPDATE operations SET status='done', finished_at=?, qty_done=?, scrap=?, block_reason=NULL WHERE id=?", D.now(), +(b.qty_done ?? job.qty), +(b.scrap || 0), id); jobStatusRefresh(job.id); D.event('op.finish', job.no, `${u.name} finished ${op.name} on ${st.code}: ${b.qty_done ?? job.qty} pcs${b.scrap ? ', scrap ' + b.scrap : ''}${b.note ? ' - ' + b.note : ''}`, u.id); }
    else if (act === 'block'){ stopRun(id, u.id); D.run("UPDATE operations SET status='blocked', block_reason=? WHERE id=?", b.reason || 'blocked', id); D.event('op.block', job.no, `${u.name}: ${op.name} on ${st.code} BLOCKED - ${b.reason || ''}`, u.id); }
    else if (act === 'unblock'){ need(u, 'office'); D.run("UPDATE operations SET status='queued', block_reason=NULL WHERE id=?", id); D.event('op.unblock', job.no, `${u.name} released the block on ${op.name}`, u.id); }
    else if (act === 'move'){ need(u, 'office'); const list = D.q("SELECT id FROM operations WHERE station_id=? AND status<>'done' ORDER BY pinned DESC, order_idx", op.station_id).map(x => x.id).filter(x => x !== id); const at = Math.max(0, Math.min(list.length, +b.index)); list.splice(at, 0, id); list.forEach((oid, i) => D.run('UPDATE operations SET order_idx=? WHERE id=?', i + 1, oid)); if (b.pin != null) D.run('UPDATE operations SET pinned=? WHERE id=?', b.pin ? 1 : 0, id); }
    else return json(res, 404, {error:'Unknown action'});
    broadcast('board', {station_id:op.station_id, op_id:id}); return json(res, 200, {ok:true, op:D.one('SELECT * FROM operations WHERE id=?', id)});
  }
  if (t === 'jobs' && id && act === 'release' && m === 'POST'){ need(u, 'office'); const j = D.one('SELECT * FROM jobs WHERE id=?', id); if (!j) return json(res, 404, {error:'No job'}); const n = D.one('SELECT COUNT(*) c FROM operations WHERE job_id=?', id).c; if (!n) return json(res, 400, {error:'Add the routing (operations) first'}); D.run("UPDATE jobs SET status='released' WHERE id=? AND status='planned'", id); D.event('job.release', j.no, `${u.name} released ${j.no} to the floor`, u.id); broadcast('board', {}); return json(res, 200, {ok:true}); }
  if (t === 'jobs' && id && act === 'ship' && m === 'POST'){ need(u, 'office'); const b = await body(req); D.run("UPDATE jobs SET status='shipped', shipped_at=?, dr_no=? WHERE id=?", D.now(), b.dr_no || null, id); const j = D.one('SELECT no FROM jobs WHERE id=?', id); D.event('job.ship', j.no, `${u.name} shipped ${j.no} DR ${b.dr_no || ''}`, u.id); broadcast('board', {}); return json(res, 200, {ok:true}); }
  if (t === 'rfqs' && id && act === 'book' && m === 'POST'){
    need(u, 'office'); const r = D.one('SELECT * FROM rfqs WHERE id=?', id); if (!r) return json(res, 404, {error:'No RFQ'}); const b = await body(req);
    const items = JSON.parse(r.items || '[]'), made = [];
    for (const it of items.length ? items : [{part:'Part', qty:1}]){ const jid = D.run('INSERT INTO jobs(no,rfq_id,customer_id,part,drawing_no,material,qty,due,status,priority,est_hours,price,created,drive_url) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)', D.nextNo('JO', 'jobs'), r.id, r.customer_id, it.part || 'Part', it.drawing_no || '', it.material || '', +(it.qty || 1), r.due, 'planned', 2, it.hours || null, it.price || null, D.now(), r.drive_url).lastInsertRowid; made.push(D.one('SELECT * FROM jobs WHERE id=?', jid)); }
    D.run("UPDATE rfqs SET status='won', po_no=COALESCE(?,po_no), po_date=COALESCE(po_date,?) WHERE id=?", b.po_no || null, D.today(), id); D.event('rfq.book', r.no, `${u.name} booked ${r.no} → ${made.map(j => j.no).join(', ')}`, u.id); broadcast('sales', {}); return json(res, 200, {jobs:made});
  }
  if (t === 'jobs' && id && act === 'routing' && m === 'POST'){
    need(u, 'office'); const b = await body(req); const list = Array.isArray(b.ops) ? b.ops : [];
    D.run("DELETE FROM operations WHERE job_id=? AND status='queued' AND NOT EXISTS (SELECT 1 FROM time_logs t WHERE t.op_id=operations.id)", id);
    list.forEach((o, i) => { if (o.id && D.one('SELECT 1 FROM operations WHERE id=? AND job_id=?', o.id, id)){ D.run('UPDATE operations SET seq=?, name=?, est_min=?, tool_nums=? WHERE id=?', i + 1, o.name, +(o.est_min || 0), o.tool_nums || null, o.id); return; } const n = D.one('SELECT COALESCE(MAX(order_idx),0)+1 n FROM operations WHERE station_id=?', +o.station_id).n; D.run('INSERT INTO operations(job_id,seq,station_id,name,est_min,order_idx,tool_nums) VALUES (?,?,?,?,?,?,?)', id, i + 1, +o.station_id, o.name || 'Operation', +(o.est_min || 0), n, o.tool_nums || null); });
    const est = D.one('SELECT COALESCE(SUM(est_min),0) m FROM operations WHERE job_id=?', id).m; D.run('UPDATE jobs SET est_hours=? WHERE id=?', +(est/60).toFixed(2), id); broadcast('board', {}); return json(res, 200, {ops:D.q('SELECT * FROM operations WHERE job_id=? ORDER BY seq', id)});
  }
  if (t === 'tools' && act === 'import' && m === 'POST'){ need(u, 'office'); const b = await body(req); let n = 0; for (const r of b.rows || []){ if (!r.num) continue; const ex = D.one('SELECT id FROM tools WHERE machine_code=? AND num=?', b.machine_code, +r.num); if (ex) D.run('UPDATE tools SET name=?,type=?,dia=?,flutes=?,len=?,pocket=?,loaded=? WHERE id=?', r.name || '', r.type || 'flat', +r.dia || 0, +r.flutes || 0, +r.len || 0, +r.pocket || 0, r.loaded === false ? 0 : 1, ex.id); else D.run('INSERT INTO tools(machine_code,num,name,type,dia,flutes,len,pocket,loaded) VALUES (?,?,?,?,?,?,?,?,?)', b.machine_code, +r.num, r.name || '', r.type || 'flat', +r.dia || 0, +r.flutes || 0, +r.len || 0, +r.pocket || 0, r.loaded === false ? 0 : 1); n++; } return json(res, 200, {imported:n}); }
  if (t === 'tools' && act === 'sheet'){ const mc = qs.get('machine') || 'CNC1'; const rows = D.q('SELECT * FROM tools WHERE machine_code=? ORDER BY num', mc); res.writeHead(200, {'Content-Type':'text/csv'}); return res.end('num,name,type,dia,flutes,len,pocket,loaded,rpm,feed,plunge,notes\n' + rows.map(r => [r.num, JSON.stringify(r.name || ''), r.type, r.dia, r.flutes, r.len, r.pocket, r.loaded ? 'yes' : 'no', '', '', '', JSON.stringify(r.notes || '')].join(',')).join('\n')); }
  if (t === 'reorder' && m === 'POST'){ need(u, 'office'); let n = 0; for (const mt of D.q('SELECT * FROM materials WHERE stock<min_stock')){ if (!D.one("SELECT 1 FROM purchase_req WHERE item=? AND status='open'", mt.name + ' ' + mt.size)){ D.run('INSERT INTO purchase_req(item,qty,unit,reason,status,supplier,created) VALUES (?,?,?,?,?,?,?)', mt.name + ' ' + mt.size, mt.min_stock*2 - mt.stock, mt.unit, 'Below minimum stock', 'open', mt.supplier, D.now()); n++; } } for (const tl of D.q('SELECT * FROM tools WHERE stock<min_stock OR (life_min>0 AND used_min>=life_min*0.9)')){ const item = `${tl.name} (${tl.machine_code} T${tl.num})`; if (!D.one("SELECT 1 FROM purchase_req WHERE item=? AND status='open'", item)){ D.run('INSERT INTO purchase_req(item,qty,unit,reason,status,created) VALUES (?,?,?,?,?,?)', item, Math.max(1, tl.min_stock - tl.stock + 1), 'pc', tl.stock < tl.min_stock ? 'Below minimum stock' : 'Tool life nearly used', 'open', D.now()); n++; } } return json(res, 200, {created:n}); }
  if (t === 'tools' && id && act === 'renew' && m === 'POST'){ D.run('UPDATE tools SET used_min=0, stock=MAX(0,stock-1) WHERE id=?', id); const tl = D.one('SELECT * FROM tools WHERE id=?', id); D.event('tool.renew', tl.machine_code + ' T' + tl.num, `${u.name} changed ${tl.name}`, u.id); return json(res, 200, {ok:true}); }
  if (t === 'customers' && id && act === 'portal' && m === 'POST'){ need(u, 'office'); const tk = D.token(); D.run('UPDATE customers SET portal_token=? WHERE id=?', tk, id); return json(res, 200, {token:tk}); }
  // generic tables
  if (!COLS[t]) return json(res, 404, {error:'Unknown endpoint ' + t});
  if (m === 'GET'){
    if (t === 'users') need(u, 'office');
    if (id){ const row = D.one(`SELECT * FROM ${t} WHERE id=?`, id); if (!row) return json(res, 404, {error:'Not found'}); if (t === 'jobs'){ row.ops = D.q('SELECT o.*, s.code station, s.name station_name, (SELECT COALESCE(SUM(minutes),0) FROM time_logs x WHERE x.op_id=o.id) spent_min FROM operations o JOIN stations s ON s.id=o.station_id WHERE job_id=? ORDER BY seq', id); row.docs = D.q('SELECT * FROM docs WHERE job_id=? ORDER BY id DESC', id); row.qa = D.q('SELECT q.*, u.name by_name FROM qa q LEFT JOIN users u ON u.id=q.by_user WHERE job_id=? ORDER BY id DESC', id); row.logs = D.q('SELECT t.*, u.name user, o.name op FROM time_logs t JOIN users u ON u.id=t.user_id JOIN operations o ON o.id=t.op_id WHERE o.job_id=? ORDER BY t.id DESC', id); row.customer = D.one('SELECT * FROM customers WHERE id=?', row.customer_id); } if (t === 'rfqs') row.customer = D.one('SELECT * FROM customers WHERE id=?', row.customer_id); if (t === 'users') delete row.pin; return json(res, 200, row); }
    let where = '', pars = []; for (const [k, v] of qs){ if (COLS[t].includes(k)){ where += (where ? ' AND ' : ' WHERE ') + `${k}=?`; pars.push(v); } }
    if (qs.get('q')){ const like = `%${qs.get('q')}%`; const cols = COLS[t].filter(c => !/_id$|^id$/.test(c)).slice(0, 6); where += (where ? ' AND (' : ' WHERE (') + cols.map(c => `${c} LIKE ?`).join(' OR ') + ')'; pars.push(...cols.map(() => like)); }
    const join = t === 'jobs' || t === 'rfqs' ? ` LEFT JOIN customers c ON c.id=${t}.customer_id` : t === 'maint' ? ' LEFT JOIN machines mm ON mm.id=maint.machine_id' : '';
    const extra = t === 'jobs' ? ", c.name customer, (SELECT COUNT(*) FROM operations o WHERE o.job_id=jobs.id AND o.status='done') done_ops, (SELECT COUNT(*) FROM operations o WHERE o.job_id=jobs.id) ops, (SELECT GROUP_CONCAT(s.code) FROM operations o JOIN stations s ON s.id=o.station_id WHERE o.job_id=jobs.id AND o.status IN ('running','paused')) active_at" : t === 'rfqs' ? ', c.name customer' : t === 'maint' ? ', mm.code machine' : '';
    const rows = D.q(`SELECT ${t}.*${extra} FROM ${t}${join}${where} ORDER BY ${t}.id DESC LIMIT ?`, ...pars, +(qs.get('limit') || 500)); if (t === 'users') rows.forEach(r => delete r.pin); return json(res, 200, rows);
  }
  need(u, WRITE_ROLE[t]);
  if (m === 'POST' && !id){ const b = await body(req); const cols = COLS[t].filter(c => b[c] !== undefined); if (t === 'rfqs' && !b.no) { cols.push('no'); b.no = D.nextNo('RFQ', 'rfqs'); } if (t === 'jobs' && !b.no){ cols.push('no'); b.no = D.nextNo('JO', 'jobs'); } if (['rfqs', 'jobs', 'purchase_req'].includes(t) && !b.created){ cols.push('created'); b.created = D.now(); } if (t === 'docs'){ cols.push('uploaded'); b.uploaded = D.now(); if (b.job_id) D.run("UPDATE docs SET status='superseded' WHERE job_id=? AND name=? AND status='current'", b.job_id, b.name); } if (t === 'qa'){ cols.push('at'); b.at = D.now(); cols.push('by_user'); b.by_user = u.id; } if (t === 'operations' && b.order_idx === undefined){ cols.push('order_idx'); b.order_idx = D.one('SELECT COALESCE(MAX(order_idx),0)+1 n FROM operations WHERE station_id=?', b.station_id).n; }
    const r = D.run(`INSERT INTO ${t}(${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`, ...cols.map(c => typeof b[c] === 'object' && b[c] !== null ? JSON.stringify(b[c]) : b[c])); D.event(t + '.new', r.lastInsertRowid, `${u.name} added ${t} ${b.no || b.name || b.part || ''}`, u.id); if (['operations', 'jobs', 'stations'].includes(t)) broadcast('board', {}); if (['rfqs', 'customers'].includes(t)) broadcast('sales', {}); return json(res, 200, D.one(`SELECT * FROM ${t} WHERE id=?`, r.lastInsertRowid)); }
  if ((m === 'PUT' || m === 'PATCH') && id){ const b = await body(req); const cols = COLS[t].filter(c => b[c] !== undefined); if (!cols.length) return json(res, 400, {error:'Nothing to update'}); if (t === 'rfqs' && b.status === 'quoted' && !b.quoted_at){ cols.push('quoted_at', 'followup_at'); b.quoted_at = D.today(); b.followup_at = addDays(D.today(), 5); } D.run(`UPDATE ${t} SET ${cols.map(c => c + '=?').join(',')} WHERE id=?`, ...cols.map(c => typeof b[c] === 'object' && b[c] !== null ? JSON.stringify(b[c]) : b[c]), id); if (t === 'maint' && b.done){ const mt = D.one('SELECT * FROM maint WHERE id=?', id); if (mt && mt.kind === 'pm') D.run('UPDATE machines SET last_pm=? WHERE id=?', D.today(), mt.machine_id); } D.event(t + '.edit', id, `${u.name} updated ${t} ${id}: ${cols.join(', ')}`, u.id); if (['operations', 'jobs', 'stations'].includes(t)) broadcast('board', {}); if (['rfqs', 'customers'].includes(t)) broadcast('sales', {}); return json(res, 200, D.one(`SELECT * FROM ${t} WHERE id=?`, id)); }
  if (m === 'DELETE' && id){ need(u, t === 'operations' ? 'office' : 'owner'); D.run(`DELETE FROM ${t} WHERE id=?`, id); D.event(t + '.delete', id, `${u.name} deleted ${t} ${id}`, u.id); broadcast('board', {}); return json(res, 200, {ok:true}); }
  return json(res, 405, {error:'Method not allowed'});
}

/* ---------- server ---------- */
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x'), p = url.pathname, m = req.method;
  try {
    if (p === '/api/stream'){ res.writeHead(200, {'Content-Type':'text/event-stream', 'Cache-Control':'no-cache', Connection:'keep-alive'}); res.write('event: hello\ndata: {}\n\n'); clients.add(res); req.on('close', () => clients.delete(res)); return; }
    if (p.startsWith('/api/')) return await api(req, res, user(req), m, p, url.searchParams);
    // static: /erp/* from public, /cam.html and friends from the repo root (Engineering module)
    let file = p === '/' || p === '/erp' || p === '/erp/' ? path.join(PUB, 'index.html') : p.startsWith('/erp/') ? path.join(PUB, p.slice(5)) : path.join(ROOT, p);
    file = path.normalize(file); if (!file.startsWith(PUB) && !file.startsWith(ROOT)) return json(res, 403, {error:'no'});
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()){ const alt = path.join(PUB, path.basename(p)); if (fs.existsSync(alt)) file = alt; else return json(res, 404, {error:'Not found'}); }
    res.writeHead(200, {'Content-Type':MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control':'no-cache'}); fs.createReadStream(file).pipe(res);
  } catch (e){ json(res, e.code || 500, {error:e.message}); }
});
server.listen(PORT, () => console.log(`Dynamic ERP on http://localhost:${PORT}/erp  (db: ${DBFILE})`));
module.exports = {server, D};
