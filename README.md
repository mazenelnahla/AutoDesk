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

## MCP integration

This project exposes a local stdio MCP server to compatible clients (including LM Studio). It keeps the existing in-app chat integration.

1. Install dependencies with `npm install`.
2. Set `MCP_BRIDGE_TOKEN` to a long random secret in `.env`. The backend and MCP process read the same project `.env`; never commit the secret.
3. Start or restart the app with `npm run dev`. Sign in, load a model, and keep one browser tab open. Reload the page if you enabled MCP after opening it.
4. Add the entry from `mcp.config.example.json` to your MCP client's server configuration, replacing the path with this project's absolute path. Use an absolute Node executable path too if your client cannot find `node`.
5. Restart/reconnect the MCP client. The client launches the server; `npm run mcp` by itself waits for protocol input.

Available tools:

- `get_model_context`: active model, categories, selected element properties, isolation state and record counts.
- `get_schedule`: paginated schedule records filtered by status or Saipem IDENT, including linked model element IDs.
- `control_viewer`: `isolate` with `dbIds`, `reset`, or `fit` with optional `dbIds`.

Example: ask the client to get delayed schedule records, collect their `modelDbIds`, and isolate those IDs. Commands require the active browser viewer and return its acknowledgement. Isolation acknowledgement means the browser accepted the state update, not that rendering has completed. An acknowledgement timeout leaves the outcome unknown; inspect the viewer before retrying.

The bridge uses a bearer secret for MCP access and the existing Autodesk session plus same-origin validation for browser synchronization. Only one tab owns the bridge at a time; snapshots expire after 10 seconds. A second tab can take over after the first stops syncing. Browser synchronization is memory-only, and requires the backend to remain running. This is intended for a local development deployment, not a shared remote MCP endpoint. For a custom app URL set `AUTODESK_URL` in the MCP process environment (default `http://127.0.0.1:3001`, or the configured `PORT`).
