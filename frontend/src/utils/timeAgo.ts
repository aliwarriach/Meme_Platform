import { formatDistanceToNowStrict } from 'date-fns';

// Compact relative time for card headers ("2h", "5m") — date-fns' strict distance
// without the "about"/"ago" prose, since feed/friend-request cards show it as a
// terse trailing label, not a sentence.
export function timeAgo(isoDate: string): string {
  return formatDistanceToNowStrict(new Date(isoDate), { addSuffix: false })
    .replace('seconds', 's')
    .replace('second', 's')
    .replace('minutes', 'm')
    .replace('minute', 'm')
    .replace('hours', 'h')
    .replace('hour', 'h')
    .replace('days', 'd')
    .replace('day', 'd')
    .replace('months', 'mo')
    .replace('month', 'mo')
    .replace('years', 'y')
    .replace('year', 'y')
    .replace(/\s+/g, '');
}
