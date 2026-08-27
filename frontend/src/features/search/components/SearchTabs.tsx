import { ScrollView, View } from 'react-native';

import Chip from '@/components/Chip';
import type { SearchAllResponse } from '@/services/search';

export type SearchTabKey = keyof SearchAllResponse;

const TAB_LABELS: Record<SearchTabKey, string> = {
  challenges: 'Challenges',
  posts: 'Posts',
  people: 'People',
  communities: 'Communities',
  tags: 'Tags',
};

// Fixed order — matches the roadmap's "Challenges · Posts · People · Communities · Tags".
export const SEARCH_TAB_ORDER: SearchTabKey[] = [
  'challenges',
  'posts',
  'people',
  'communities',
  'tags',
];

interface SearchTabsProps {
  sections: SearchAllResponse;
  active: SearchTabKey;
  onChange: (tab: SearchTabKey) => void;
}

/** Pure so it's unit-testable without a component-rendering harness (none exists in this
 * codebase yet) — the screen never opens on a possibly-empty Challenges tab when another
 * scope actually has results (Roadmap_Search.md S6 step 2). */
export function selectAutoTab(sections: SearchAllResponse): SearchTabKey {
  return SEARCH_TAB_ORDER.find((tab) => sections[tab].items.length > 0) ?? SEARCH_TAB_ORDER[0];
}

/** Chip row carrying each section's result count, `10+` once a section hit the preview
 * cap (Roadmap_Search.md S6 step 2) — reuses the exact `Chip` component the Communities
 * screen's "Pending (3)" chip already establishes, not a fork. */
export function SearchTabs({ sections, active, onChange }: SearchTabsProps) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-4 pb-2">
      <View className="flex-row gap-2">
        {SEARCH_TAB_ORDER.map((tab) => {
          const section = sections[tab];
          const countLabel = section.capped ? `${section.count}+` : `${section.count}`;
          return (
            <Chip
              key={tab}
              label={`${TAB_LABELS[tab]} (${countLabel})`}
              selected={active === tab}
              onPress={() => onChange(tab)}
            />
          );
        })}
      </View>
    </ScrollView>
  );
}
