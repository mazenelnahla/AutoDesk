import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)), quiet: true });
const baseUrl = process.env.AUTODESK_URL || `http://127.0.0.1:${process.env.PORT || 3001}`;
const server = new McpServer({ name: 'autodesk-bim', version: '1.0.0' });
async function request(path, body) {
  if (!process.env.MCP_BRIDGE_TOKEN) throw new Error('Set MCP_BRIDGE_TOKEN in the project .env and restart the app.');
  const response = await fetch(`${baseUrl}/api/mcp${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${process.env.MCP_BRIDGE_TOKEN}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(12000),
  });
  const data = await response.json();
  if (!response.ok || data.error) throw new Error(data.error || `Bridge returned ${response.status}`);
  return data;
}
const tool = handler => async args => {
  try { return { content: [{ type: 'text', text: JSON.stringify(await handler(args)) }] }; }
  catch (error) { return { isError: true, content: [{ type: 'text', text: error.message }] }; }
};
server.registerTool('get_model_context', {
  description: 'Read the active browser model, categories, selected element properties and isolation state. Requires the AutoDesk app open and signed in.',
  inputSchema: {},
  annotations: { readOnlyHint: true },
}, tool(async () => {
  const { scheduleDataMap, modelIdentsMap, ...context } = await request('/context');
  return { ...context, scheduleCount: Object.keys(scheduleDataMap || {}).length, identCount: Object.keys(modelIdentsMap || {}).length };
}));
server.registerTool('get_schedule', {
  description: 'Read construction schedule records, optionally filtered by status or exact Saipem IDENT. Results are paginated.',
  inputSchema: { status: z.enum(['delayed', 'completed', 'in_progress', 'not_started']).optional(), ident: z.string().optional(), offset: z.number().int().min(0).default(0), limit: z.number().int().min(1).max(200).default(50) },
  annotations: { readOnlyHint: true },
}, tool(async ({ status, ident, offset, limit }) => {
  const context = await request('/context');
  const records = Object.values(context.scheduleDataMap || {}).filter(row => (!status || row.status === status) && (!ident || row.saipemIdent === ident));
  return { total: records.length, records: records.slice(offset, offset + limit).map(row => ({ ...row, modelDbIds: context.modelIdentsMap?.[row.saipemIdent]?.dbIds || [] })) };
}));
server.registerTool('control_viewer', {
  description: 'Isolate element IDs, reset isolation, or fit the camera. Changes the open browser viewer. Reports browser acknowledgement, or an error.',
  inputSchema: { action: z.enum(['isolate', 'reset', 'fit']), dbIds: z.array(z.number().int().positive()).max(10000).optional() },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
}, tool(args => request('/command', args)));
await server.connect(new StdioServerTransport());
