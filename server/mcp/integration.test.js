import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

 test('MCP discovery, bridge authorization, schedule filtering and command acknowledgement', async () => {
  process.env.MCP_BRIDGE_TOKEN = 'integration-test-secret';
  const { bridgeRouter } = await import('./bridge.js');
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { if (req.get('x-test-session')) req.session = { internal_token: 'test' }; next(); });
  app.use('/api/mcp', bridgeRouter);
  const http = app.listen(0, '127.0.0.1');
  await new Promise(resolve => http.once('listening', resolve));
  const url = `http://127.0.0.1:${http.address().port}`;
  const client = new Client({ name: 'test', version: '1' });
  const transport = new StdioClientTransport({ command: process.execPath, args: ['server/mcp/index.js'], env: { ...process.env, AUTODESK_URL: url } });
  const sync = (results = [], tabId = 'tab') => fetch(`${url}/api/mcp/sync`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: url, 'x-test-session': 'yes' }, body: JSON.stringify({ tabId, context: { modelId: 'model', modelName: 'Test', scheduleDataMap: { A: { saipemIdent: 'A', status: 'delayed' }, B: { saipemIdent: 'B', status: 'completed' } }, modelIdentsMap: { A: { dbIds: [12] } } }, results }) });
  try {
    assert.equal((await fetch(`${url}/api/mcp/context`)).status, 401);
    assert.equal((await fetch(`${url}/api/mcp/sync`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 401);
    await client.connect(transport);
    assert.equal((await client.listTools()).tools.length, 3);
    assert.equal((await client.callTool({ name: 'get_model_context', arguments: {} })).isError, true);
    assert.equal((await sync()).status, 200);
    assert.equal((await sync([], 'other-tab')).status, 409);
    const schedule = await client.callTool({ name: 'get_schedule', arguments: { status: 'delayed' } });
    const parsed = JSON.parse(schedule.content[0].text);
    assert.equal(parsed.total, 1);
    assert.deepEqual(parsed.records[0].modelDbIds, [12]);
    const command = client.callTool({ name: 'control_viewer', arguments: { action: 'isolate', dbIds: [12] } });
    let commands = [];
    for (let i = 0; i < 20 && !commands.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 10));
      commands = (await (await sync()).json()).commands;
    }
    assert.equal(commands.length, 1);
    await sync([{ id: commands[0].id, ok: true }]);
    assert.equal(JSON.parse((await command).content[0].text).ok, true);
  } finally { await client.close(); await new Promise(resolve => http.close(resolve)); }
});
