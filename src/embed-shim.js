// Side-effect module, imported FIRST by embed.jsx so it evaluates before react-dom.
// React + some deps read process.env.NODE_ENV at runtime; a bare <script> CDN drop-in
// has no process global. Guarantee one.
globalThis.process ||= { env: { NODE_ENV: 'production' } }
