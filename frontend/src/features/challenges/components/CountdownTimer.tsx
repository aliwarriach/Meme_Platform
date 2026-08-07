import { useEffect, useState } from 'react';
import { Text } from 'react-native';

interface CountdownTimerProps {
  endTime: string;
  className?: string;
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return 'Ended';
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
}

/** Live countdown to `endTime`, ticking once a minute — cheap enough not to need a
 * shared clock, and a challenge's remaining time never needs second-level precision. */
export function CountdownTimer({ endTime, className }: CountdownTimerProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  const remaining = new Date(endTime).getTime() - now;
  return <Text className={className}>{formatRemaining(remaining)}</Text>;
}
