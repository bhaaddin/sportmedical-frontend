# three.js r160 (vendored)

MIT licence, see `LICENSE`. `three.min.js` is `build/three.module.min.js`; `GLTFLoader.js`, `BufferGeometryUtils.js` and
`OrbitControls.js` are `examples/jsm/*` with their `from 'three'` imports pointed at the local file. Vendored (not installed)
because the shared `node_modules` of the worktrees is never modified. Used only by the lazy 3D anatomy viewer of
`src/movement/anatomy3d`; nothing else imports it, so it is never part of a first load.
