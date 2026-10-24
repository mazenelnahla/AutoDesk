import { STATUS_COLORS, effectiveStatus } from '../utils/statusColors';
import { useMemo, useState } from 'react';
import { BarChart3, ChevronDown, ChevronUp, Crosshair, Search } from 'lucide-react';
import type { ElementScheduleData } from '../types/aps';
import { scheduleRecordKey } from '../utils/scheduleRecords';

interface Props {
  records: Record<string, ElementScheduleData>;
  onFocus: (dbId: number) => void;
}

export function PartProgressPanel({ records, onFocus }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const parts = useMemo(() => Object.values(records), [records]);
  const state = effectiveStatus;
  const counts = { completed: 0, in_progress: 0, delayed: 0, not_started: 0 };
  parts.forEach((part) => counts[state(part)]++);
  let angle = 0;
  const segments = (Object.keys(counts) as (keyof typeof counts)[]).map(status => {
    const start = angle;
    angle += parts.length ? counts[status] / parts.length * 360 : 0;
    return `${STATUS_COLORS[status]} ${start}deg ${angle}deg`;
  });
  const visible = parts.filter((part) => (filter === 'all' || state(part) === filter)
    && `${part.saipemIdent} ${part.elementName || ''} ${part.dbId ?? ''}`.toLowerCase().includes(query.toLowerCase()));

  return <section className={`part-progress-panel${open ? ' is-open' : ''}`} aria-label="Part progress charts">
    <button className="part-progress-toggle" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="part-progress-content">
      <span><BarChart3 size={17} /> Part progress <span className="part-progress-total">{parts.length} tracked</span></span>
      <span>{open ? 'Collapse' : 'Open chart'}{open ? <ChevronDown size={16} /> : <ChevronUp size={16} />}</span>
    </button>
    {open && <div id="part-progress-content" className="part-progress-content">
      <div className="part-progress-controls">
        <div className="part-progress-filters" aria-label="Filter part status">
          {(['all', 'completed', 'in_progress', 'delayed', 'not_started'] as const).map((status) => <button key={status} onClick={() => setFilter(status)} aria-pressed={filter === status}>
            {status !== 'all' && <i className={`progress-dot ${status}`} />}
            {status === 'all' ? 'All' : (status[0].toUpperCase() + status.slice(1)).replace('_', ' ')} <b>{status === 'all' ? parts.length : counts[status]}</b>
          </button>)}
        </div>
        <label className="part-progress-search"><Search size={14} /><input aria-label="Search chart parts" placeholder="Search part or dbId" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      </div>
      <div className="part-progress-overview">
        <div className="part-progress-summary-pie" role="img" aria-label={`${counts.completed} completed, ${counts.in_progress} in progress, ${counts.delayed} delayed, ${counts.not_started} not started`}
          style={{ background: parts.length ? `conic-gradient(${segments.join(', ')})` : STATUS_COLORS.not_started }}>
          <span><strong>{parts.length}</strong><small>tracked</small></span>
        </div>
        <div><strong className="part-progress-overview-title">Tracked part status</strong><p className="part-progress-explanation">The overview counts parts by status. Colors match the model: green completed, orange in progress, red delayed, and light gray not started. Bar length shows completion.</p></div>
      </div>
      <div className="part-progress-rows">
        {visible.map((part) => {
          const status = state(part);
          const percent = Math.max(0, Math.min(100, part.completionPercentage || 0));
          return <div className="part-progress-row" key={scheduleRecordKey(part)}>
            <div className="part-progress-identity"><strong title={part.elementName || part.saipemIdent}>{part.elementName || part.saipemIdent}</strong><small>{part.saipemIdent} · {part.dbId == null ? 'Shared IDENT schedule' : `dbId ${part.dbId}`}</small></div>
            <div className="part-progress-bar" role="img" aria-label={`${part.elementName || part.saipemIdent}, ${percent}% complete, ${100 - percent}% remaining, ${status}`}>
              <span style={{ width: `${percent}%`, background: STATUS_COLORS[status] }} /><span style={{ width: `${100 - percent}%`, background: STATUS_COLORS.not_started, opacity: 0.25 }} />
            </div>
            <strong className="part-progress-percent">{percent}%</strong>
            <span className={`part-progress-status ${status}`}>{status.replace('_', ' ')}</span>
            {part.dbId != null ? <button className="part-progress-focus" onClick={() => onFocus(part.dbId!)} title={`Isolate part dbId ${part.dbId}`} aria-label={`Isolate part dbId ${part.dbId}`}><Crosshair size={16} /></button> : <span />}
          </div>;
        })}
        {!visible.length && <p className="part-progress-empty">{parts.length ? 'No parts match this search or status.' : 'Import a schedule to see progress charts for your parts.'}</p>}
      </div>
    </div>}
  </section>;
}
