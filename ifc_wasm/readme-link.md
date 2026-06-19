# web-ifc WASM Files

These files are required by the [web-ifc](https://github.com/tomvandig/web-ifc) library to parse IFC models in the browser.

## Files

| File | Description |
|------|-------------|
| `web-ifc.wasm` | Main WASM binary (single-threaded) |
| `web-ifc-mt.wasm` | Multi-threaded variant |

## Source

Version used: **0.0.77**

Download directly from unpkg:

```
https://unpkg.com/web-ifc@0.0.77/web-ifc.wasm
https://unpkg.com/web-ifc@0.0.77/web-ifc-mt.wasm
```

Or install via npm and copy from `node_modules`:

```bash
npm install web-ifc@0.0.77
# files are at node_modules/web-ifc/web-ifc.wasm
```

## Why local?

Serving WASM locally avoids a network fetch from unpkg on every page load and allows the app to work offline.
