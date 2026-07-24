import { useEffect, useRef } from 'react';
import { Platform, type View } from 'react-native';

// FlatList's onViewableItemsChanged/viewabilityConfig (used at the list level) relies on
// VirtualizedList's native scroll-metrics tracking, which is unreliable on react-native-web
// — callbacks frequently never fire in the browser regardless of scroll position. On web,
// react-native-web forwards a real DOM node through View's ref, so IntersectionObserver is
// used directly instead — the standard, reliable browser primitive for "is this element
// >=50% visible." Native (iOS/Android) keeps working via the list's own viewability config;
// this hook is a no-op there since VirtualizedList already handles it correctly.
export function useRecordViewOnVisible(onVisible: () => void) {
  const ref = useRef<View>(null);
  const firedRef = useRef(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || firedRef.current) return;

    const node = ref.current as unknown as Element | null;
    if (!node || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !firedRef.current) {
          firedRef.current = true;
          onVisible();
          observer.disconnect();
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(node);

    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onVisible is a mutation trigger, re-subscribing on identity change would re-observe pointlessly
  }, []);

  return ref;
}
