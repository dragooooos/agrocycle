# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.

## Earth visualization

The landing-page globe uses NASA's Blue Marble true-color global mosaic as the preferred Earth texture, with a Three.js example texture as a fallback. NASA describes the Blue Marble mosaic as a satellite-based, true-color global image using MODIS observations. See: https://svs.gsfc.nasa.gov/2915

The globe also includes a procedural fallback so the hero remains visible if remote imagery is unavailable.

## 3D Hero

The landing page uses NASA's Landsat 8 GLB as the primary interactive 3D asset. NASA lists the model in its 3D Resources library and credits NASA/Christopher R. Meaney. The browser loads the GLB from the official NASA asset host; a procedural fallback is shown if the remote asset is unavailable.
