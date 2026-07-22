import { format, getISOWeek, getISOWeekYear, subDays, subMonths } from 'date-fns';

import type { CompetitionPeriodType } from '@/services/competitions';

// Mirrors backend/app/services/competitions.py::period_key() exactly — day "YYYY-MM-DD",
// week ISO "YYYY-Www", month "YYYY-MM" — so a client-computed key for "yesterday" / "last
// week" / "last month" always matches the period the backend considers already closed.
export function previousPeriodKey(periodType: CompetitionPeriodType): string {
  const now = new Date();
  if (periodType === 'day') return format(subDays(now, 1), 'yyyy-MM-dd');
  if (periodType === 'month') return format(subMonths(now, 1), 'yyyy-MM');

  const lastWeek = subDays(now, 7);
  const isoWeek = getISOWeek(lastWeek);
  const isoYear = getISOWeekYear(lastWeek);
  return `${isoYear}-W${String(isoWeek).padStart(2, '0')}`;
}
