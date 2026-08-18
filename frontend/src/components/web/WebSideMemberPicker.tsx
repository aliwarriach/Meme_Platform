import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useCompeteWebTheme } from '@/constants/CompeteWebTheme';
import { COMPETE_WEB_RADIUS, COMPETE_WEB_SPACING, COMPETE_WEB_TYPE, type WebPressableState } from '@/constants/webCompeteTheme';
import type { MembershipResponse } from '@/services/communities';

interface WebSideMemberPickerProps {
  members: MembershipResponse[];
  sideName: string;
  selectedUserIds: Set<string>;
  disabledUserIds: Set<string>;
  onToggle: (userId: string) => void;
}

/** Replaces native `components/SideMemberPicker.tsx` for `CreateChallengeScreen.web.tsx` — same
 * mutual-exclusion behavior (a member on Side A is disabled, not just visually differentiated, on
 * Side B's list) and data source, new chrome. Row-level, so it deliberately stays on the quiet
 * `border` role, not `outline` — this is a working checklist, not an emphasis surface. */
export function WebSideMemberPicker({ members, sideName, selectedUserIds, disabledUserIds, onToggle }: WebSideMemberPickerProps) {
  const { colors } = useCompeteWebTheme();

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[COMPETE_WEB_TYPE.label, { color: colors.foregroundMuted, marginBottom: COMPETE_WEB_SPACING.sm }]}>
        {sideName || 'Unnamed side'}
      </Text>
      {members.map((member) => {
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
              selected && { backgroundColor: colors.primary },
              disabledByOtherSide && styles.disabledRow,
              hovered && !selected && !disabledByOtherSide && { backgroundColor: colors.elevatedHover },
              focused && { outlineColor: colors.ring, outlineWidth: 2, outlineOffset: 1 },
            ]}>
            <View style={[styles.avatar, { backgroundColor: selected ? colors.onPrimary : colors.elevated }]}>
              <Text style={[COMPETE_WEB_TYPE.meta, { color: selected ? colors.primary : colors.cardForeground }]}>
                {member.user.username.slice(0, 2).toUpperCase()}
              </Text>
            </View>
            <Text style={[COMPETE_WEB_TYPE.body, { color: selected ? colors.onPrimary : colors.cardForeground }]}>
              {member.user.username}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: COMPETE_WEB_SPACING.lg,
    borderRadius: COMPETE_WEB_RADIUS.card,
    borderWidth: 1,
    padding: COMPETE_WEB_SPACING.md,
  },
  row: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: COMPETE_WEB_SPACING.sm,
    borderRadius: COMPETE_WEB_RADIUS.pill,
    paddingHorizontal: COMPETE_WEB_SPACING.sm,
    marginBottom: 2,
  },
  disabledRow: {
    opacity: 0.3,
  },
  avatar: {
    height: 32,
    width: 32,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
