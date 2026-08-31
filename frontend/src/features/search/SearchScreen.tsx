import { MaterialIcons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';

import { KeyboardAvoidingScreen } from '@/components/KeyboardAvoidingScreen';
import TopBar from '@/components/TopBar';
import { NEON_PLUM_DARK, NEON_PLUM_LIGHT } from '@/constants/theme';
import { useThemeMode } from '@/constants/ThemeMode';
import { SearchResultsList } from '@/features/search/components/SearchResultsList';
import { SEARCH_TAB_ORDER, SearchTabs, selectAutoTab, type SearchTabKey } from '@/features/search/components/SearchTabs';
import { TrendingList } from '@/features/search/components/TrendingList';
import { useSearchAll } from '@/services/useSearch';

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

/** The search screen (Roadmap_Search.md S6) — empty state is Trending, a 2+ char query
 * debounced 300ms fires the `scope=all` preview, and tab selection auto-picks the first
 * non-empty section rather than opening on a possibly-empty Challenges tab. */
export default function SearchScreen() {
  const { mode } = useThemeMode();
  const c = mode === 'dark' ? NEON_PLUM_DARK : NEON_PLUM_LIGHT;
  const queryClient = useQueryClient();

  const [input, setInput] = useState('');
  const [debounced, setDebounced] = useState('');
  // The user's explicit tab click, paired with the query it was made against — a query
  // change makes a stale pairing fall through to the auto-selected tab below, computed
  // during render rather than reset via a `setState`-in-effect (avoids the extra render
  // cascade that pattern causes).
  const [manualTab, setManualTab] = useState<SearchTabKey | null>(null);
  const [manualTabQuery, setManualTabQuery] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(input), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [input]);

  const trimmed = debounced.trim();
  const isQueryActive = trimmed.length >= MIN_QUERY_LENGTH;
  const searchAllQuery = useSearchAll(debounced);
  const sections = searchAllQuery.data;

  // Seed every scope's infinite-query cache with the preview's first page, so switching
  // tabs renders instantly instead of flashing a spinner for data already in hand. This is
  // synchronizing React state into TanStack Query's external cache, not deriving render
  // state, so it belongs in an effect (unlike the tab-selection logic above).
  useEffect(() => {
    if (!sections) return;
    for (const tab of SEARCH_TAB_ORDER) {
      queryClient.setQueryData(['search', 'scope', tab, trimmed], {
        pages: [sections[tab]],
        pageParams: [0],
      });
    }
  }, [sections, trimmed, queryClient]);

  const everySectionEmpty = useMemo(
    () => (sections ? SEARCH_TAB_ORDER.every((tab) => sections[tab].items.length === 0) : false),
    [sections]
  );

  // Auto-select the first tab with results — falls back to it whenever the manual pick
  // doesn't belong to the current query (a fresh search, or no manual pick has been made).
  const autoTab = sections ? selectAutoTab(sections) : null;
  const activeTab = manualTabQuery === trimmed ? manualTab : autoTab;

  const onChangeTab = (tab: SearchTabKey) => {
    setManualTab(tab);
    setManualTabQuery(trimmed);
  };

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <KeyboardAvoidingScreen>
      <TopBar
        title="Search"
        showBack
        rightActions={
          input ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              onPress={() => setInput('')}
              className="h-11 w-11 items-center justify-center">
              <MaterialIcons name="close" size={20} color={c.inkMuted} />
            </Pressable>
          ) : undefined
        }
      />

      <View className="flex-row items-center gap-2 rounded-full border border-outline-variant bg-surface-high/60 px-4 py-2 mx-4 mt-3">
        <MaterialIcons name="search" size={18} color={c.inkMuted} />
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Search challenges, posts, people, communities, tags"
          placeholderTextColor={c.outline}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
          returnKeyType="search"
          accessibilityLabel="Search"
          className="flex-1 py-1 font-body text-base text-heading"
        />
        {input && input.trim().length < MIN_QUERY_LENGTH ? (
          <MaterialIcons name="hourglass-empty" size={16} color={c.outline} />
        ) : null}
      </View>

      <View className="flex-1">
        {!isQueryActive ? (
          <TrendingList />
        ) : searchAllQuery.isLoading ? (
          <View className="mt-8 items-center">
            <Text className="font-body text-sm text-ink-muted">Searching…</Text>
          </View>
        ) : searchAllQuery.isError ? (
          <Text className="mx-4 mt-4 font-body text-sm text-error">{searchAllQuery.error.message}</Text>
        ) : !sections ? null : everySectionEmpty ? (
          <Text className="mx-4 mt-8 text-center font-body text-sm text-ink-muted">
            No results for &quot;{trimmed}&quot;
          </Text>
        ) : (
          <>
            <SearchTabs sections={sections} active={activeTab ?? SEARCH_TAB_ORDER[0]} onChange={onChangeTab} />
            {activeTab ? <SearchResultsList query={trimmed} scope={activeTab} /> : null}
          </>
        )}
      </View>
      </KeyboardAvoidingScreen>
    </SafeAreaView>
  );
}
