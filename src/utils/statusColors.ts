import type { ElementScheduleData, ScheduleStatus } from '../types/aps';
export const STATUS_COLORS: Record<ScheduleStatus, string> = {
  completed: '#21c45c', delayed: '#f02b2b', in_progress: '#ff8000', not_started: '#cccccc',
};
export function effectiveStatus(item: Pick<ElementScheduleData, 'status' | 'completionPercentage'>): ScheduleStatus {
  if (item.status === 'delayed') return 'delayed';
  if (item.status === 'completed' || item.completionPercentage >= 100) return 'completed';
  return item.status;
}
