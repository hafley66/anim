// Ambient declarations for the renderer .tsx files: css side-effect imports and
// the untyped cytoscape plugins. The plugins are register-once extensions whose
// API surface we touch only through cy.* calls, so `any` is the honest type.
declare module '*.css'
declare module 'cytoscape-dagre'
declare module 'cytoscape-elk'
declare module 'cytoscape-expand-collapse'
declare module 'shiki-magic-move/react'
