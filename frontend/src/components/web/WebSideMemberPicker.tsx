import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

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

/** Replaces native `components/SideMemberPicker.tsx` for `CreateChallengeScreen.web.tsx` — same
 * mutual-exclusion behavior (a member on Side A is disabled, not just visually differentiated, on
 * Side B's list) and data source, now Vaporwave/Luminous chrome. Reuses the already-generic
 * `WebAvatar` (Feed/Friends/Voting's own member-avatar primitive) for each row's avatar instead
 * of duplicating an initials-fallback circle, per this pass's explicit reuse instruction. Row
 * itself stays on the quiet `border`/`surfaceGlass` roles, not a glow/emphasis surface — this is
 * a working checklist, not a celebratory moment. */
export function WebSideMemberPicker({ members, sideName, selectedUserIds, disabledUserIds, onToggle }: WebSideMemberPickerProps) {
  const { colors, type, radius, spacing, mode } = useVaporwaveTheme();
  const styles = useMemo(() => createStyles(radius, spacing), [radius, spacing]);
  const ringColor = mode === 'dark' ? colors.indigoPrimary : colors.indigoSecondary;

  return (
    <View style={[styles.card, { backgroundColor: colors.surfaceGlass, borderColor: colors.border }]}>
      <Text style={[type.label, { color: colors.foregroundMuted, marginBottom: spacing.sm }]}>
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
              selected && { backgroundColor: colors.indigoSecondary },
              disabledByOtherSide && styles.disabledRow,
              hovered && !selected && !disabledByOtherSide && { backgroundColor: colors.surfaceHover },
              focused && { outlineColor: ringColor, outlineWidth: 2, outlineOffset: 1 },
            ]}>
            <WebAvatar username={member.user.username} avatarUrl={member.user.avatar_url} size={28} />
            <Text style={[type.body, { color: selected ? colors.onAccent : colors.foreground }]}>
              {member.user.username}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const createStyles = (radius: VaporwaveTheme['radius'], spacing: VaporwaveTheme['spacing']) =>
  StyleSheet.create({
    card: {
      marginBottom: spacing.lg,
      borderRadius: radius.card,
      borderWidth: 1,
      padding: spacing.md,
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
    disabledRow: {
      opacity: 0.3,
    },
  });
