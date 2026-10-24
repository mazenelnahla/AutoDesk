import { useEffect, useRef } from 'react';
import type { ModelBimContext } from './llmStudio';

type Context = ModelBimContext & { modelId?: string };
type Command = { id: string; modelId: string; action: 'isolate' | 'reset' | 'fit'; dbIds?: number[] };

export function useMcpBridge(enabled: boolean, context: Context, isolate: (dbId?: number, ident?: string, dbIds?: number[]) => void, reset: () => void) {
  const current = useRef({ context, isolate, reset });
  current.current = { context, isolate, reset };
  useEffect(() => {
    if (!enabled) return;
    const tabId = crypto.randomUUID();
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    let results: { id: string; ok?: boolean; error?: string }[] = [];
    const controller = new AbortController();
    async function sync() {
      try {
        const response = await fetch('/api/mcp/sync', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tabId, context: current.current.context, results }), signal: controller.signal,
        });
        if (response.status === 503) return; // Bridge disabled until configured and page reloaded.
        if (response.ok) {
          const { commands } = await response.json() as { commands: Command[] };
          results = [];
          for (const command of commands) {
            if (stopped) return;
            try {
              const { context: latest, isolate: doIsolate, reset: doReset } = current.current;
              const viewer = (window as any).apsViewer;
              if (!viewer?.model || latest.modelId !== command.modelId) throw new Error('Requested model is no longer active.');
              if (command.action === 'isolate') doIsolate(undefined, undefined, command.dbIds);
              if (command.action === 'reset') doReset();
              if (command.action === 'fit') viewer.fitToView(command.dbIds);
              results.push({ id: command.id, ok: true });
            } catch (error) { results.push({ id: command.id, error: error instanceof Error ? error.message : 'Viewer action failed' }); }
          }
        }
      } catch { /* Retry while app is mounted. */ }
      if (!stopped) timer = setTimeout(sync, 1000);
    }
    void sync();
    return () => { stopped = true; clearTimeout(timer); controller.abort(); };
  }, [enabled]);
}
