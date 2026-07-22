import { Pressable, Text, View } from 'react-native';

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
    <View className="mb-4 rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
      <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
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
            className={`mb-1 min-h-[44px] flex-row items-center rounded-lg px-2 ${
              selected ? 'bg-orange-500' : ''
            } ${disabledByOtherSide ? 'opacity-30' : ''}`}>
            <Text className={selected ? 'font-bold text-white' : 'text-neutral-900 dark:text-white'}>
              {member.user.username}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
