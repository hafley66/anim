// Builds the WHOLE deck into one self-contained HTML file that opens from
// file:// — no server, no fetches. React, cytoscape, shiki (fine-grained langs,
// base64 wasm), d2 (base64 wasm + the main-thread worker-shim), frames.json,
// inlined graph SVGs, and CSS all ride in one inline classic script, so the
// module-CORS rule that blocks `vite build` output on file:// never applies.
//   npm run build:deck  ->  dist/deck.html  (double-click it)
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import cssInjected from 'vite-plugin-css-injected-by-js'
import { readFileSync, writeFileSync, rmSync } from 'node:fs'

function singleHtml() {
  return {
    name: 'deck-single-html',
    closeBundle() {
      const js = readFileSync('dist/deck.js', 'utf8')
        .replace(/<\/script/gi, '<\\/script')   // keep string literals from closing the inline tag
      const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>anim</title>
</head>
<body>
<div id="root"></div>
<script>
${js}
</script>
</body>
</html>
`
      writeFileSync('dist/deck.html', html)
      rmSync('dist/deck.js')
      console.log(`deck.html: ${(html.length / 1e6).toFixed(1)} MB, file:// ready`)
    },
  }
}

export default defineConfig({
  plugins: [react(), cssInjected(), singleHtml()],
  define: { 'process.env.NODE_ENV': '"production"' },
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    lib: { entry: 'src/main.tsx', formats: ['iife'], name: 'AnimDeck', fileName: () => 'deck.js' },
    rollupOptions: { output: { inlineDynamicImports: true } },   // elk + d2 + lang chunks fold in
  },
})
