import { BlurView } from 'expo-blur';
import type { ReactNode } from 'react';
import { View, type ViewProps } from 'react-native';

import { useThemeMode } from '@/constants/ThemeMode';

type GlassCardProps = ViewProps & {
  children: ReactNode;
  /** Blur strength passed to BlurView; lower = more transparent. */
  intensity?: number;
};

/** Frosted-glass card: translucent surface + blur, per the "Neon Plum" elevation system. */
export default function GlassCard({
  children,
  intensity = 40,
  className,
  style,
  ...rest
}: GlassCardProps) {
  const { mode } = useThemeMode();
  return (
    <View className={`overflow-hidden rounded-card ${className ?? ''}`} style={style} {...rest}>
      <BlurView
        intensity={intensity}
        tint={mode === 'dark' ? 'dark' : 'light'}
        className="border border-outline-variant/40 bg-surface-glass p-4">
        {children}
      </BlurView>
    </View>
  );
}
