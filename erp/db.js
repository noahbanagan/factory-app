// Dynamic ERP — database (SQLite via node:sqlite, no native build needed). One file, one shop.
'use strict';
const {DatabaseSync} = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, name TEXT NOT NULL, pin TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'operator', station_id INTEGER, active INTEGER DEFAULT 1, token TEXT);
CREATE TABLE IF NOT EXISTS customers(id INTEGER PRIMARY KEY, name TEXT NOT NULL, code TEXT, contact TEXT, email TEXT, phone TEXT, priority INTEGER DEFAULT 2, portal_token TEXT, qb_id TEXT, notes TEXT);
CREATE TABLE IF NOT EXISTS rfqs(id INTEGER PRIMARY KEY, no TEXT, customer_id INTEGER, received TEXT, due TEXT, status TEXT DEFAULT 'new', items TEXT DEFAULT '[]', notes TEXT, quote_total REAL, quoted_at TEXT, followup_at TEXT, po_no TEXT, po_date TEXT, drive_url TEXT, trello_url TEXT, qb_estimate_id TEXT, created TEXT, lost_reason TEXT);
CREATE TABLE IF NOT EXISTS jobs(id INTEGER PRIMARY KEY, no TEXT, rfq_id INTEGER, customer_id INTEGER, part TEXT, drawing_no TEXT, rev TEXT DEFAULT 'A', material TEXT, qty INTEGER DEFAULT 1, due TEXT, status TEXT DEFAULT 'planned', priority INTEGER DEFAULT 2, est_hours REAL, est_material REAL, price REAL, notes TEXT, drive_url TEXT, cam_file TEXT, created TEXT, shipped_at TEXT, dr_no TEXT, invoice_no TEXT);
CREATE TABLE IF NOT EXISTS stations(id INTEGER PRIMARY KEY, code TEXT UNIQUE, name TEXT, kind TEXT, hours_per_day REAL DEFAULT 8, sort INTEGER DEFAULT 0, active INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS operations(id INTEGER PRIMARY KEY, job_id INTEGER NOT NULL, seq INTEGER, station_id INTEGER, name TEXT, est_min REAL DEFAULT 0, status TEXT DEFAULT 'queued', order_idx INTEGER DEFAULT 0, qty_done INTEGER DEFAULT 0, scrap INTEGER DEFAULT 0, block_reason TEXT, started_at TEXT, finished_at TEXT, pinned INTEGER DEFAULT 0, tool_nums TEXT);
CREATE TABLE IF NOT EXISTS time_logs(id INTEGER PRIMARY KEY, op_id INTEGER, user_id INTEGER, kind TEXT DEFAULT 'run', start TEXT, end TEXT, minutes REAL, note TEXT);
CREATE TABLE IF NOT EXISTS tools(id INTEGER PRIMARY KEY, machine_code TEXT, num INTEGER, name TEXT, type TEXT, dia REAL, flutes INTEGER, len REAL, pocket INTEGER, loaded INTEGER DEFAULT 1, stock INTEGER DEFAULT 1, min_stock INTEGER DEFAULT 0, life_min REAL DEFAULT 0, used_min REAL DEFAULT 0, notes TEXT);
CREATE TABLE IF NOT EXISTS machines(id INTEGER PRIMARY KEY, code TEXT UNIQUE, name TEXT, model TEXT, kind TEXT, serial TEXT, installed TEXT, meter_hours REAL DEFAULT 0, status TEXT DEFAULT 'ok', pm_interval_days INTEGER DEFAULT 90, last_pm TEXT, notes TEXT, station_id INTEGER);
CREATE TABLE IF NOT EXISTS maint(id INTEGER PRIMARY KEY, machine_id INTEGER, kind TEXT DEFAULT 'pm', date TEXT, done INTEGER DEFAULT 0, hours_down REAL DEFAULT 0, descr TEXT, parts TEXT, cost REAL DEFAULT 0, by_user INTEGER);
CREATE TABLE IF NOT EXISTS facilities(id INTEGER PRIMARY KEY, name TEXT, kind TEXT, detail TEXT, renew_on TEXT, status TEXT DEFAULT 'ok', notes TEXT);
CREATE TABLE IF NOT EXISTS materials(id INTEGER PRIMARY KEY, name TEXT, spec TEXT, size TEXT, unit TEXT DEFAULT 'pc', stock REAL DEFAULT 0, min_stock REAL DEFAULT 0, heat_no TEXT, supplier TEXT, location TEXT);
CREATE TABLE IF NOT EXISTS purchase_req(id INTEGER PRIMARY KEY, item TEXT, qty REAL, unit TEXT, reason TEXT, status TEXT DEFAULT 'open', supplier TEXT, po_no TEXT, created TEXT, received_at TEXT, cost REAL);
CREATE TABLE IF NOT EXISTS docs(id INTEGER PRIMARY KEY, job_id INTEGER, name TEXT, rev TEXT, status TEXT DEFAULT 'current', url TEXT, uploaded TEXT, by_user INTEGER);
CREATE TABLE IF NOT EXISTS qa(id INTEGER PRIMARY KEY, job_id INTEGER, op_id INTEGER, kind TEXT DEFAULT 'first_article', result TEXT, measured TEXT, remarks TEXT, by_user INTEGER, at TEXT);
CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY, ts TEXT, kind TEXT, ref TEXT, msg TEXT, user_id INTEGER);
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT);
CREATE INDEX IF NOT EXISTS ix_ops_station ON operations(station_id, status, order_idx);
CREATE INDEX IF NOT EXISTS ix_logs_op ON time_logs(op_id);
`;

const STATIONS = [
  ['CNC1', 'CNC1 - Chevalier QP1620-L', 'cnc', 1], ['CNC2', 'CNC2 - Chevalier QP1620-L', 'cnc', 2], ['WEDM', 'Wire cut - Mitsubishi BA24', 'wedm', 3],
  ['LATHE', 'Lathe (turning)', 'lathe', 4], ['MILL', 'Manual milling', 'mill', 5], ['GRIND', 'Surface grinding', 'grind', 6], ['DRILL', 'Drilling & tapping', 'drill', 7],
  ['BENCH', 'Bench / deburr / assembly', 'bench', 8], ['QA', 'Quality inspection', 'qa', 9], ['PACK', 'Packing & delivery', 'pack', 10]
];

function now(){ return new Date().toISOString(); }
function today(){ return new Date().toISOString().slice(0, 10); }
function token(){ return [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, '0')).join(''); }

function open(file){
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), {recursive:true});
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');
  db.exec(SCHEMA);
  const q = (sql, ...a) => db.prepare(sql).all(...a), one = (sql, ...a) => db.prepare(sql).get(...a), run = (sql, ...a) => db.prepare(sql).run(...a);
  if (!one('SELECT 1 FROM stations LIMIT 1')) STATIONS.forEach(([code, name, kind, sort]) => run('INSERT INTO stations(code,name,kind,sort) VALUES (?,?,?,?)', code, name, kind, sort));
  if (!one('SELECT 1 FROM users LIMIT 1')){
    run("INSERT INTO users(name,pin,role) VALUES ('Noah','1234','owner')");
    run("INSERT INTO users(name,pin,role) VALUES ('Office','1111','office')");
    run("INSERT INTO users(name,pin,role,station_id) VALUES ('Operator CNC1','2222','operator',(SELECT id FROM stations WHERE code='CNC1'))");
    run("INSERT INTO users(name,pin,role,station_id) VALUES ('Operator WEDM','3333','operator',(SELECT id FROM stations WHERE code='WEDM'))");
    run("INSERT INTO users(name,pin,role) VALUES ('QA','4444','qa')");
    run("INSERT INTO users(name,pin,role) VALUES ('Maintenance','5555','maintenance')");
  }
  if (!one('SELECT 1 FROM machines LIMIT 1')){
    run("INSERT INTO machines(code,name,model,kind,station_id,pm_interval_days) VALUES ('CNC1','CNC1','Chevalier QP1620-L (Fanuc 0i-MD)','cnc',(SELECT id FROM stations WHERE code='CNC1'),90)");
    run("INSERT INTO machines(code,name,model,kind,station_id,pm_interval_days) VALUES ('CNC2','CNC2','Chevalier QP1620-L (Fanuc 0i-MD)','cnc',(SELECT id FROM stations WHERE code='CNC2'),90)");
    run("INSERT INTO machines(code,name,model,kind,station_id,pm_interval_days) VALUES ('BA24','Wire cut','Mitsubishi BA24','wedm',(SELECT id FROM stations WHERE code='WEDM'),60)");
  }
  if (!one("SELECT 1 FROM settings WHERE key='company'")) run("INSERT INTO settings(key,value) VALUES ('company','Dynamic Int''l. Precision Technology & Tooling Inc.')");
  return {db, q, one, run, now, today, token,
    event(kind, ref, msg, user_id){ run('INSERT INTO events(ts,kind,ref,msg,user_id) VALUES (?,?,?,?,?)', now(), kind, String(ref || ''), msg || '', user_id || null); },
    nextNo(prefix, table){ const y = new Date().getFullYear(), r = one(`SELECT COUNT(*) c FROM ${table} WHERE no LIKE ?`, `${prefix}-${y}-%`); return `${prefix}-${y}-${String((r ? r.c : 0) + 1).padStart(4, '0')}`; }
  };
}

// demo data so the screens are never empty on first run
function seedDemo(D){
  if (D.one('SELECT 1 FROM jobs LIMIT 1')) return;
  const c1 = D.run("INSERT INTO customers(name,code,contact,email,priority,portal_token) VALUES ('Mahle Filter Systems','MAHLE','Engr. Reyes','purchasing@example.com',1,?)", D.token()).lastInsertRowid;
  const c2 = D.run("INSERT INTO customers(name,code,contact,email,priority,portal_token) VALUES ('JTEKT Philippines','JTEKT','Ms. Santos','buyer@example.com',2,?)", D.token()).lastInsertRowid;
  const c3 = D.run("INSERT INTO customers(name,code,contact,email,priority,portal_token) VALUES ('Toyota Boshoku','TBPH','Mr. Cruz','rfq@example.com',2,?)", D.token()).lastInsertRowid;
  const d = n => { const t = new Date(); t.setDate(t.getDate() + n); return t.toISOString().slice(0, 10); };
  const st = code => D.one('SELECT id FROM stations WHERE code=?', code).id;
  const rfq = (cid, due, status, items, total, extra = {}) => D.run('INSERT INTO rfqs(no,customer_id,received,due,status,items,quote_total,quoted_at,followup_at,created,po_no) VALUES (?,?,?,?,?,?,?,?,?,?,?)', D.nextNo('RFQ', 'rfqs'), cid, D.today(), due, status, JSON.stringify(items), total, extra.quoted_at || null, extra.followup_at || null, D.now(), extra.po_no || null).lastInsertRowid;
  const r1 = rfq(c1, d(10), 'won', [{part:'LOWER PART MOD', qty:4, material:'S45C'}], 48000, {quoted_at:d(-6), po_no:'PO-7781'});
  const r2 = rfq(c2, d(14), 'quoted', [{part:'Guide block', qty:10, material:'SKD11'}], 62000, {quoted_at:d(-7), followup_at:d(-2)});
  rfq(c3, d(20), 'new', [{part:'Jig plate 300x200', qty:2, material:'A6061'}], null);
  const job = (cid, rfqId, part, dwg, mat, qty, due, prio, est, price, ops) => {
    const jid = D.run('INSERT INTO jobs(no,rfq_id,customer_id,part,drawing_no,material,qty,due,status,priority,est_hours,price,created) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)', D.nextNo('JO', 'jobs'), rfqId, cid, part, dwg, mat, qty, due, 'released', prio, est, price, D.now()).lastInsertRowid;
    ops.forEach(([code, name, min], i) => { const o = D.one('SELECT COALESCE(MAX(order_idx),0)+1 n FROM operations WHERE station_id=?', st(code)); D.run('INSERT INTO operations(job_id,seq,station_id,name,est_min,order_idx) VALUES (?,?,?,?,?,?)', jid, i + 1, st(code), name, min, o.n); });
    return jid;
  };
  job(c1, r1, 'LOWER PART MOD', 'MH-2231-B', 'S45C', 4, d(10), 1, 14, 48000, [['CNC1', 'Rough and finish top side', 240], ['CNC1', 'Flip, second side', 180], ['DRILL', 'Tap M8 x 12', 60], ['GRIND', 'Grind datum face', 90], ['QA', 'Final inspection', 45], ['PACK', 'Pack and deliver', 30]]);
  job(c2, r2, 'Guide block', 'JT-0450', 'SKD11', 10, d(14), 2, 22, 62000, [['LATHE', 'Turn blanks', 200], ['CNC2', 'Mill profile and pockets', 420], ['WEDM', 'Wire cut slot 0.5', 300], ['GRIND', 'Grind to size', 240], ['QA', 'Final inspection', 60]]);
  job(c3, null, 'Fixture base', 'FB-01', 'A6061', 1, d(3), 1, 6, 15000, [['CNC2', 'Mill base and holes', 180], ['BENCH', 'Deburr and fit', 45], ['QA', 'Inspection', 30]]);
  job(c1, null, 'Spring steel strip', 'MH-SS-17', 'SK5 0.8', 50, d(7), 2, 9, 21000, [['WEDM', 'Wire cut profile x50', 420], ['BENCH', 'Deburr', 60], ['QA', 'Inspection', 30]]);
  const tools = [[1, '10. FLAT ENDMILL', 'flat', 10, 3, 25, 1], [2, '6. FLAT ENDMILL', 'flat', 6, 3, 18, 2], [3, '6. BALL ENDMILL', 'ball', 6, 2, 15, 3], [4, '63. FACE MILL', 'face', 63, 5, 6, 4], [5, '10. CHAMFER MILL 90DEG', 'chamfer', 10, 2, 8, 5], [6, '6.8 DRILL', 'drill', 6.8, 2, 60, 6], [7, 'M8 TAP', 'tap', 8, 0, 25, 7], [8, '5. SPOT DRILL', 'spot', 5, 2, 10, 8]];
  for (const mc of ['CNC1', 'CNC2']) tools.forEach(([num, name, type, dia, fl, len, pk]) => D.run('INSERT INTO tools(machine_code,num,name,type,dia,flutes,len,pocket,loaded,stock,min_stock,life_min) VALUES (?,?,?,?,?,?,?,?,1,?,1,?)', mc, num, name, type, dia, fl, len, pk, 2, type === 'drill' || type === 'tap' ? 300 : 600));
  D.run("INSERT INTO materials(name,spec,size,unit,stock,min_stock,heat_no,supplier,location) VALUES ('S45C plate','S45C','25 x 300 x 600','pc',3,2,'H2210','Metalsource','Rack A')");
  D.run("INSERT INTO materials(name,spec,size,unit,stock,min_stock,heat_no,supplier,location) VALUES ('A6061 plate','A6061-T6','20 x 300 x 300','pc',1,2,'','Alumax','Rack B')");
  D.run("INSERT INTO materials(name,spec,size,unit,stock,min_stock,heat_no,supplier,location) VALUES ('SKD11 block','SKD11','40 x 100 x 100','pc',6,4,'K7781','Daido','Rack C')");
  D.run("INSERT INTO purchase_req(item,qty,unit,reason,status,created) VALUES ('A6061 plate 20 x 300 x 300',2,'pc','Below minimum stock','open',?)", D.now());
  D.run("INSERT INTO facilities(name,kind,detail,renew_on,status) VALUES ('Air compressor 15HP','equipment','Service every 500 h',?,'ok')", d(20));
  D.run("INSERT INTO facilities(name,kind,detail,renew_on,status) VALUES ('Fire permit','permit','City fire safety inspection certificate',?,'ok')", d(45));
  D.run("INSERT INTO facilities(name,kind,detail,renew_on,status) VALUES ('Coolant change CNC1','consumable','Flood coolant 5% mix',?,'ok')", d(-3));
  D.run("INSERT INTO maint(machine_id,kind,date,done,descr) VALUES ((SELECT id FROM machines WHERE code='CNC1'),'pm',?,0,'Quarterly PM: way lube, spindle check, level, backlash')", d(5));
  D.run("INSERT INTO maint(machine_id,kind,date,done,hours_down,descr,cost) VALUES ((SELECT id FROM machines WHERE code='BA24'),'breakdown',?,1,6,'Wire feed roller worn - replaced',8500)", d(-12));
  D.event('seed', '', 'Demo data loaded');
}
module.exports = {open, seedDemo};
