// Prepare the packaged app folder: the CAM page with its libraries vendored locally so it runs with no internet.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), app = path.join(__dirname, 'app'), vend = path.join(app, 'vendor');
const nm = p => { const a = path.join(__dirname, 'node_modules', p); if (fs.existsSync(a)) return a; const b = path.join(root, 'node_modules', p); if (fs.existsSync(b)) return b; throw new Error('missing module ' + p + ' — run npm install in desktop/'); };
fs.rmSync(app, {recursive:true, force:true}); fs.mkdirSync(vend, {recursive:true});
const cp = (src, dst) => { fs.mkdirSync(path.dirname(dst), {recursive:true}); fs.cpSync(src, dst, {recursive:true}); };
cp(path.join(nm('three'), 'build', 'three.module.js'), path.join(vend, 'three', 'build', 'three.module.js'));
cp(path.join(nm('three'), 'examples', 'jsm'), path.join(vend, 'three', 'examples', 'jsm'));
cp(path.join(nm('clipper-lib'), 'clipper.js'), path.join(vend, 'clipper-lib', 'clipper.js'));
cp(path.join(nm('occt-import-js'), 'dist'), path.join(vend, 'occt-import-js', 'dist'));
for (const f of ['pdf.min.mjs', 'pdf.worker.min.mjs']) cp(path.join(nm('pdfjs-dist'), 'build', f), path.join(vend, 'pdfjs-dist', 'build', f));
let html = fs.readFileSync(path.join(root, 'cam.html'), 'utf8');
html = html.replace(/https:\/\/cdn\.jsdelivr\.net\/npm\/clipper-lib@[\d.]+\//g, './vendor/clipper-lib/')
           .replace(/https:\/\/cdn\.jsdelivr\.net\/npm\/three@[\d.]+\//g, './vendor/three/')
           .replace(/https:\/\/cdn\.jsdelivr\.net\/npm\/pdfjs-dist@[\d.]+\//g, './vendor/pdfjs-dist/')
           .replace(/https:\/\/cdn\.jsdelivr\.net\/npm\/occt-import-js@[\d.]+\//g, './vendor/occt-import-js/');
if (/cdn\.jsdelivr\.net/.test(html)) throw new Error('a CDN reference was not rewritten');
fs.writeFileSync(path.join(app, 'index.html'), html);
fs.writeFileSync(path.join(app, 'version.json'), JSON.stringify({version:require('./package.json').version, built:new Date().toISOString()}));
console.log('app prepared:', app, Math.round(fs.statSync(path.join(app, 'index.html')).size/1024) + ' KB page');
