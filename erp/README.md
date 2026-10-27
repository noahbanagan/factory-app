# Dynamic ERP

One web app for the whole shop: Sales, Engineering (Dynamic CAD/CAM), Planning, Production (Floor Board + Operator app), Quality, Tools, Materials & Purchasing, Machines & Maintenance, Facilities, Delivery & Billing, Costing, People.

## Run

    node erp/server.js --demo          # http://localhost:8080/erp   (demo data on first run)
    node erp/server.js --port 80 --db /srv/erp/erp.sqlite

No dependencies: Node 22+ with its built-in SQLite. Data lives in one file (`erp/data/erp.sqlite` by default); back it up nightly.

Pages: `/erp` office app · `/erp/board.html` floor TV (`?station=CNC1,CNC2`, `?view=today`) · `/erp/op.html` operator app (add to home screen) · `/erp/portal.html?t=…` customer portal · `/cam.html` CAD/CAM.

Demo sign-ins: Noah 1234 (owner), Office 1111, QA 4444, Maintenance 5555, Operator CNC1 2222, Operator WEDM 3333.

## API (for the Claude agents: RFQ intake, PO booking, billing)

Sign in: `POST /api/login {name, pin}` → token, then header `x-token`.
Tables: `GET/POST /api/<table>`, `GET/PUT/DELETE /api/<table>/<id>` for customers, rfqs, jobs, operations, tools, machines, maint, facilities, materials, purchase_req, docs, qa, stations, users.
Actions: `POST /api/rfqs/:id/book`, `POST /api/jobs/:id/routing {ops:[{station_id,name,est_min,tool_nums}]}`, `/release`, `/ship`, `POST /api/ops/:id/start|setup|pause|stop|finish|block|unblock|move`, `POST /api/reorder`, `POST /api/tools/import`, `GET /api/board`, `GET /api/dashboard`, `GET /api/costing[/:jobId]`, `GET /api/events`, `GET /api/stream` (live events).
