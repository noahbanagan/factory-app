// Dynamic Intl CAM — desktop shell. Serves the CAM from an app:// origin (modules, wasm and localStorage work offline),
// signs the operator in with their Google account through the system browser, saves NC files to disk, and self-updates.
const { app, BrowserWindow, protocol, net, ipcMain, dialog, shell, safeStorage } = require('electron');
const path = require('path'), fs = require('fs'), http = require('http'), crypto = require('crypto');
let autoUpdater = null; try { autoUpdater = require('electron-updater').autoUpdater; } catch (e) {}

protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }]);
const APP_DIR = path.join(__dirname, 'app');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.wasm': 'application/wasm', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };

// ---------- Google sign-in (installed-app flow: system browser + loopback redirect + PKCE) ----------
const authFile = () => path.join(app.getPath('userData'), 'auth.bin');
const confFile = () => path.join(app.getPath('userData'), 'google-client.json');
const SCOPES = 'openid email https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/spreadsheets.readonly';
let AUTH = null; // {refresh_token, access_token, exp, email}
function loadAuth(){ try { const enc = fs.readFileSync(authFile()); AUTH = JSON.parse(safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(enc) : enc.toString()); } catch (e) { AUTH = null; } }
function saveAuth(){ try { const s = JSON.stringify(AUTH || {}); fs.writeFileSync(authFile(), safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(s) : Buffer.from(s)); } catch (e) {} }
function client(){ try { return JSON.parse(fs.readFileSync(confFile(), 'utf8')); } catch (e) { return { clientId: '', clientSecret: '' }; } }
async function tokenPost(params){
  const body = new URLSearchParams(params).toString();
  const r = await net.fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body });
  const j = await r.json(); if (!r.ok) throw new Error(j.error_description || j.error || ('HTTP ' + r.status)); return j;
}
async function signIn(){
  const c = client(); if (!c.clientId) throw new Error('No Google client ID set. Settings ▸ Google connection ▸ Desktop client ID and secret.');
  const verifier = crypto.randomBytes(32).toString('base64url'), challenge = crypto.createHash('sha256').update(verifier).digest('base64url'), state = crypto.randomBytes(8).toString('hex');
  return new Promise((resolve, reject) => {
    const srv = http.createServer(async (req, res) => {
      const u = new URL(req.url, 'http://127.0.0.1'); if (u.pathname !== '/cb') { res.writeHead(404); res.end(); return; }
      const page = (t) => { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(`<html><body style="font-family:Segoe UI,Arial;padding:40px"><h2>${t}</h2><p>You can close this tab and go back to Dynamic Intl CAM.</p></body></html>`); };
      try {
        if (u.searchParams.get('state') !== state) throw new Error('state mismatch');
        if (u.searchParams.get('error')) throw new Error(u.searchParams.get('error'));
        const port = srv.address().port, redirect = `http://127.0.0.1:${port}/cb`;
        const tok = await tokenPost({ code: u.searchParams.get('code'), client_id: c.clientId, client_secret: c.clientSecret || '', redirect_uri: redirect, grant_type: 'authorization_code', code_verifier: verifier });
        let email = ''; try { const ui = await net.fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: 'Bearer ' + tok.access_token } }); email = (await ui.json()).email || ''; } catch (e) {}
        AUTH = { refresh_token: tok.refresh_token || (AUTH && AUTH.refresh_token) || '', access_token: tok.access_token, exp: Date.now() + (tok.expires_in || 3600) * 1000, email }; saveAuth();
        page('Signed in ✔'); srv.close(); resolve({ email });
      } catch (e) { page('Sign-in failed: ' + e.message); srv.close(); reject(e); }
    });
    srv.listen(0, '127.0.0.1', () => {
      const port = srv.address().port, redirect = `http://127.0.0.1:${port}/cb`;
      const url = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({ client_id: c.clientId, redirect_uri: redirect, response_type: 'code', scope: SCOPES, access_type: 'offline', prompt: 'consent', code_challenge: challenge, code_challenge_method: 'S256', state }).toString();
      shell.openExternal(url);
      setTimeout(() => { try { srv.close(); } catch (e) {} reject(new Error('Sign-in timed out (5 minutes).')); }, 5 * 60 * 1000);
    });
  });
}
async function accessToken(){
  if (!AUTH || !AUTH.refresh_token) throw new Error('not signed in');
  if (AUTH.access_token && Date.now() < AUTH.exp - 60000) return { token: AUTH.access_token, email: AUTH.email };
  const c = client();
  const tok = await tokenPost({ refresh_token: AUTH.refresh_token, client_id: c.clientId, client_secret: c.clientSecret || '', grant_type: 'refresh_token' });
  AUTH.access_token = tok.access_token; AUTH.exp = Date.now() + (tok.expires_in || 3600) * 1000; saveAuth();
  return { token: AUTH.access_token, email: AUTH.email };
}

// ---------- IPC ----------
ipcMain.handle('app:version', () => app.getVersion());
ipcMain.handle('fs:save', async (e, { name, text }) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  const r = await dialog.showSaveDialog(win, { defaultPath: path.join(app.getPath('documents'), name), filters: [{ name: 'NC program', extensions: ['NC', 'nc', 'txt'] }, { name: 'All files', extensions: ['*'] }] });
  if (r.canceled || !r.filePath) return { ok: false, canceled: true };
  fs.writeFileSync(r.filePath, text); return { ok: true, path: r.filePath };
});
ipcMain.handle('fs:open', async (e, { filters }) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  const r = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: filters || [{ name: 'Drawings and models', extensions: ['pdf', 'dxf', 'step', 'stp', 'iges', 'igs', 'stl', 'json', 'cam'] }] });
  if (r.canceled || !r.filePaths.length) return null;
  const p = r.filePaths[0]; return { name: path.basename(p), data: fs.readFileSync(p).toString('base64') };
});
ipcMain.handle('auth:status', () => ({ signedIn: !!(AUTH && AUTH.refresh_token), email: AUTH ? AUTH.email : '', hasClient: !!client().clientId, online: net.isOnline() }));
ipcMain.handle('auth:setClient', (e, { clientId, clientSecret }) => { fs.mkdirSync(app.getPath('userData'), { recursive: true }); fs.writeFileSync(confFile(), JSON.stringify({ clientId: (clientId || '').trim(), clientSecret: (clientSecret || '').trim() })); return true; });
ipcMain.handle('auth:signIn', () => signIn());
ipcMain.handle('auth:token', () => accessToken());
ipcMain.handle('auth:signOut', () => { AUTH = null; try { fs.unlinkSync(authFile()); } catch (e) {} return true; });
ipcMain.handle('update:check', async () => { if (!autoUpdater || !app.isPackaged) return { available: false, reason: 'not packaged' }; try { const r = await autoUpdater.checkForUpdates(); return { available: !!(r && r.updateInfo && r.updateInfo.version !== app.getVersion()), version: r && r.updateInfo && r.updateInfo.version }; } catch (e) { return { available: false, reason: e.message }; } });

// ---------- window ----------
function createWindow(){
  const win = new BrowserWindow({ width: 1400, height: 900, minWidth: 1000, minHeight: 650, title: 'Dynamic Intl CAM', backgroundColor: '#F0F0F0', webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: false } });
  win.setMenuBarVisibility(false);
  win.loadURL('app://cam/index.html');
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  if (autoUpdater && app.isPackaged){
    autoUpdater.autoDownload = true; autoUpdater.autoInstallOnAppQuit = true;
    ['checking-for-update', 'update-available', 'update-not-available', 'download-progress', 'update-downloaded', 'error'].forEach(ev => autoUpdater.on(ev, (info) => { try { win.webContents.send('update:event', { type: ev, info: info && (info.version || info.percent || info.message) }); } catch (e) {} }));
    setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), 8000);
  }
}
app.whenReady().then(() => {
  loadAuth();
  protocol.handle('app', (req) => {
    const u = new URL(req.url); let p = decodeURIComponent(u.pathname); if (p === '/' || p === '') p = '/index.html';
    const file = path.normalize(path.join(APP_DIR, p)); if (!file.startsWith(APP_DIR)) return new Response('forbidden', { status: 403 });
    if (!fs.existsSync(file)) return new Response('not found', { status: 404 });
    return new Response(fs.readFileSync(file), { headers: { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' } });
  });
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
