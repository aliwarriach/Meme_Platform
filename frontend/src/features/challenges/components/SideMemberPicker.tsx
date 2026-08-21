import { Pressable, Text, View } from 'react-native';

import Avatar from '@/components/Avatar';
import type { MembershipResponse } from '@/services/communities';

interface SideMemberPickerProps {
  members: MembershipResponse[];
  sideName: string;
  selectedUserIds: Set<string>;
  disabledUserIds: Set<string>;
  onToggle: (userId: string) => void;
}

export function SideMemberPicker({
  members,
  sideName,
  selectedUserIds,
  disabledUserIds,
  onToggle,
}: SideMemberPickerProps) {
  return (
    <View className="mb-4 rounded-card border border-outline-variant/30 bg-surface p-3">
      <Text className="mb-2 font-label text-xs uppercase tracking-wide text-ink-muted">
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
            className={`mb-1 min-h-[44px] flex-row items-center gap-2 rounded-full px-2 ${
              selected ? 'bg-primary-container' : ''
            } ${disabledByOtherSide ? 'opacity-30' : ''}`}>
            <Avatar username={member.user.username} size="sm" />
            <Text className={`font-body ${selected ? 'font-title text-white' : 'text-heading'}`}>
              {member.user.username}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
