// Builds the <atlas-graph> web component into ONE self-contained IIFE script:
// React + cytoscape + AtlasPanel + CSS all inlined, dynamic elk chunk folded in.
// Drop the output anywhere behind a <script src>; it self-registers the element.
//   npm run build:embed  ->  dist/atlas.js
// Host via jsDelivr-over-GitHub: https://cdn.jsdelivr.net/gh/<user>/<repo>@<ref>/dist/atlas.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import cssInjected from 'vite-plugin-css-injected-by-js'

export default defineConfig({
  plugins: [react(), cssInjected()],
  define: { 'process.env.NODE_ENV': '"production"' },   // dead-code elim; the shim covers stray runtime reads
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    lib: { entry: 'src/embed.jsx', formats: ['iife'], name: 'AtlasEmbed', fileName: () => 'atlas.js' },
    rollupOptions: { output: { inlineDynamicImports: true } },   // fold the lazy elk chunk in -> one file
  },
})
