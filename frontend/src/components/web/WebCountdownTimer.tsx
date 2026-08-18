import { useEffect, useState } from 'react';
import { Text, type TextStyle } from 'react-native';

interface WebCountdownTimerProps {
  endTime: string;
  style?: TextStyle | TextStyle[];
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

/** Themed rebuild of the native `components/CountdownTimer.tsx` (same tick-once-a-minute logic
 * and formatting — a live countdown never needs second-level precision) with a `style` prop
 * instead of a NativeWind `className`, since the native component aliases the old token set. */
export function WebCountdownTimer({ endTime, style }: WebCountdownTimerProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  const remaining = new Date(endTime).getTime() - now;
  return <Text style={style}>{formatRemaining(remaining)}</Text>;
}
