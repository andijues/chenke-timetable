import {defineConfig} from 'vite';
import {copyFileSync} from 'node:fs';
export default defineConfig({
  base: './',
  build: {target:'chrome114', lib: {entry:'src/main.mjs', name:'Chenke', formats:['iife'], fileName:()=>'app.js'}, assetsInlineLimit:0, sourcemap:true, rolldownOptions:{output:{format:'iife'}}},
  define: {'import.meta.url':'globalThis.location.href'},
  plugins:[{name:'copy-entry', transformIndexHtml(html, context){return context.server ? html.replace('<script src="./app.js" defer></script>', '<script type="module" src="/src/main.mjs"></script>') : html;}, closeBundle(){copyFileSync('index.html','dist/index.html');}}]
});
