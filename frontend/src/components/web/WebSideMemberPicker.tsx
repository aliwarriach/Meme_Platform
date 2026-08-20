import { MaterialIcons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import WebAvatar from '@/components/web/WebAvatar';
import type { VaporwaveTheme } from '@/constants/webFeedThemeVapor';
import { useVaporwaveTheme } from '@/constants/VaporwaveWebTheme';
import type { MembershipResponse } from '@/services/communities';

interface WebSideMemberPickerProps {
  members: MembershipResponse[];
  sideName: string;
  selectedUserIds: Set<string>;
  disabledUserIds: Set<string>;
  onToggle: (userId: string) => void;
}

interface WebPressableState {
  pressed: boolean;
  hovered?: boolean;
  focused?: boolean;
}

// Height of exactly 3 rows (44px min row + 2px bottom margin) so the list scrolls after the 3rd
// member instead of stretching the page — the original unbounded `.map()` inside a plain `View`
// took over the entire viewport height on communities with 100+ members.
const VISIBLE_ROWS = 3;
const ROW_HEIGHT = 46;

/** Replaces native `components/SideMemberPicker.tsx` for `CreateChallengeScreen.web.tsx` — same
 * mutual-exclusion behavior (a member on Side A is disabled, not just visually differentiated, on
 * Side B's list) and data source, now Vaporwave/Luminous chrome. Reuses the already-generic
 * `WebAvatar` (Feed/Friends/Voting's own member-avatar primitive) for each row's avatar instead
 * of duplicating an initials-fallback circle, per this pass's explicit reuse instruction. Row
 * itself stays on the quiet `border`/`surfaceGlass` roles, not a glow/emphasis surface — this is
 * a working checklist, not a celebratory moment.
 *
 * Bounded to a fixed-height, internally-scrolling list (3 rows visible) plus a search field,
 * rather than rendering every community member inline — the two pickers are meant to sit side by
 * side in the parent's row layout, and an unbounded member list per side broke that on any
 * community with a non-trivial member count. */
export function WebSideMemberPicker({ members, sideName, selectedUserIds, disabledUserIds, onToggle }: WebSideMemberPickerProps) {
  const { colors, type, radius, spacing, mode } = useVaporwaveTheme();
  const styles = useMemo(() => createStyles(radius, spacing), [radius, spacing]);
  const ringColor = mode === 'dark' ? colors.indigoPrimary : colors.indigoSecondary;
  const [search, setSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  const filteredMembers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return members;
    return members.filter((member) => member.user.username.toLowerCase().includes(query));
  }, [members, search]);

  return (
    <View style={[styles.card, { backgroundColor: colors.surfaceGlass, borderColor: colors.border }]}>
      <Text style={[type.label, { color: colors.foregroundMuted, marginBottom: spacing.sm }]}>
        {sideName || 'Unnamed side'}
      </Text>

      <View
        style={[
          styles.searchRow,
          { backgroundColor: colors.surfaceElevated, borderColor: searchFocused ? ringColor : colors.border },
        ]}>
        <MaterialIcons name="search" size={16} color={colors.foregroundMuted} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          placeholder="Search members"
          placeholderTextColor={colors.foregroundMuted}
          style={[
            type.body,
            styles.searchInput,
            { color: colors.foreground },
            // react-native-web only: suppresses the browser's default blue focus ring — the
            // search row's own border already carries the focus signal above.
            { outlineStyle: 'none' } as Record<string, string>,
          ]}
        />
      </View>

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent} nestedScrollEnabled>
        {filteredMembers.length === 0 ? (
          <Text style={[type.meta, { color: colors.foregroundMuted, paddingVertical: spacing.sm }]}>No members found</Text>
        ) : (
          filteredMembers.map((member) => {
            const selected = selectedUserIds.has(member.user.id);
            const disabledByOtherSide = disabledUserIds.has(member.user.id) && !selected;
            return (
              <Pressable
                key={member.user.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected, disabled: disabledByOtherSide }}
                accessibilityLabel={`Assign ${member.user.username} to ${sideName || 'this side'}`}
                disabled={disabledByOtherSide}
                onPress={() => onToggle(member.user.id)}
                style={({ hovered, focused }: WebPressableState) => [
                  styles.row,
                  selected && { backgroundColor: colors.indigoSecondary },
                  disabledByOtherSide && styles.disabledRow,
                  hovered && !selected && !disabledByOtherSide && { backgroundColor: colors.surfaceHover },
                  focused && { outlineColor: ringColor, outlineWidth: 2, outlineOffset: 1 },
                ]}>
                <WebAvatar username={member.user.username} avatarUrl={member.user.avatar_url} size={28} />
                <Text style={[type.body, styles.rowName, { color: selected ? colors.onAccent : colors.foreground }]} numberOfLines={1}>
                  {member.user.username}
                </Text>
              </Pressable>
            );
          })
        )}
      </ScrollView>

      <Text style={[type.meta, { color: colors.foregroundMuted, marginTop: spacing.xs }]}>
        {selectedUserIds.size} selected
      </Text>
    </View>
  );
}

const createStyles = (radius: VaporwaveTheme['radius'], spacing: VaporwaveTheme['spacing']) =>
  StyleSheet.create({
    card: {
      flex: 1,
      minWidth: 0,
      borderRadius: radius.card,
      borderWidth: 1,
      padding: spacing.md,
    },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      borderRadius: radius.pill,
      borderWidth: 1.5,
      paddingLeft: spacing.md,
      paddingRight: spacing.sm,
      marginBottom: spacing.sm,
    },
    searchInput: {
      flex: 1,
      paddingVertical: 8,
    },
    list: {
      maxHeight: ROW_HEIGHT * VISIBLE_ROWS,
    },
    listContent: {
      flexGrow: 1,
    },
    row: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.sm,
      marginBottom: 2,
    },
    rowName: {
      flex: 1,
    },
    disabledRow: {
      opacity: 0.3,
    },
  });
