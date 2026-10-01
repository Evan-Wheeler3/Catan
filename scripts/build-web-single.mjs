// Packs the Expo web export into ONE self-contained HTML page (bundle inlined, assets as
// data: URIs) so the offline practice game can be shared as a single hosted page.
//
//   cd apps/mobile && npx expo export --clear --platform web --output-dir /tmp/tideholm-web
//   node scripts/build-web-single.mjs /tmp/tideholm-web dist/tideholm.html
//
// Build with EXPO_PUBLIC_SUPABASE_* unset: the page is practice-only and needs no network.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';

const [exportDir, outFile] = process.argv.slice(2);
if (!exportDir || !outFile) {
  console.error('usage: node scripts/build-web-single.mjs <expo-web-export-dir> <out.html>');
  process.exit(1);
}

const MIME = { '.png': 'image/png', '.ttf': 'font/ttf', '.otf': 'font/otf', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.jpg': 'image/jpeg' };

const index = readFileSync(join(exportDir, 'index.html'), 'utf8');
const src = index.match(/<script src="\/([^"]+\.js)"/)?.[1];
if (!src) throw new Error('Bundle <script> not found in index.html');
let js = readFileSync(join(exportDir, src), 'utf8');

let inlined = 0;
let bytes = 0;
js = js.replace(/"\/(assets\/[^"]+)"/g, (whole, rel) => {
  const mime = MIME[extname(rel).toLowerCase()];
  if (!mime) return whole;
  try {
    const data = readFileSync(join(exportDir, rel));
    inlined++;
    bytes += data.length;
    return JSON.stringify(`data:${mime};base64,${data.toString('base64')}`);
  } catch {
    return whole; // Unused scale variants etc. can stay as paths.
  }
});
// A literal "</script" inside the bundle would end the inline script early.
js = js.replace(/<\/script/gi, '<\\/script');

const page = `<title>Tideholm</title>
<style>
  /* One-screen app: the Expo/React Native Web root fills the frame. */
  :root { --canvas: #E6F2EE; --ink: #2A1F3D; }
  @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --canvas: #17111F; --ink: #F1ECF7; color-scheme: dark; } }
  :root[data-theme="dark"] { --canvas: #17111F; --ink: #F1ECF7; color-scheme: dark; }
  html { box-sizing: border-box; height: 100%; }
  body { height: 100%; margin: 0; overflow: hidden; background: var(--canvas); color: var(--ink);
    overscroll-behavior: none; touch-action: manipulation; -webkit-user-select: none; user-select: none;
    -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent; }
  #root { display: flex; height: 100%; flex: 1; }
  input, textarea { -webkit-user-select: text; user-select: text; }
</style>
<noscript>Tideholm needs JavaScript to run.</noscript>
<div id="root"></div>
<script>
  // Expo Router reads the URL path; start every visit on the home screen.
  try { if (location.pathname !== '/') history.replaceState(null, '', '/'); } catch (e) {}
  // iOS Safari: keep pinch gestures for the board instead of zooming the whole page.
  document.addEventListener('gesturestart', function (e) { e.preventDefault(); }, { passive: false });
</script>
<script>${js}</script>
`;

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, page);
console.log(`Wrote ${outFile}: ${(page.length / 1024 / 1024).toFixed(2)} MB, ${inlined} assets inlined (${(bytes / 1024).toFixed(0)} KB raw)`);
