import { MaterialIcons } from '@expo/vector-icons';
import { useThemeMode } from '@/constants/ThemeMode';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import Avatar from '@/components/Avatar';
import { NEON_PLUM_DARK, NEON_PLUM_LIGHT } from '@/constants/theme';
import type { MembershipResponse } from '@/services/communities';

interface SideMemberPickerProps {
  members: MembershipResponse[];
  sideName: string;
  selectedUserIds: Set<string>;
  disabledUserIds: Set<string>;
  onToggle: (userId: string) => void;
}

// Bounded to ~3 visible rows (internally scrollable) plus a search field, instead of an
// unbounded `.map()` — on a community with 100+ members the old flat list stretched to take
// over the whole screen. Meant to sit side by side with the other side's picker (set by the
// parent screen's own `flex-row` wrapper), so each box only gets roughly half the phone's width.
export function SideMemberPicker({
  members,
  sideName,
  selectedUserIds,
  disabledUserIds,
  onToggle,
}: SideMemberPickerProps) {
  const { mode } = useThemeMode();
  const c = mode === 'dark' ? NEON_PLUM_DARK : NEON_PLUM_LIGHT;
  const [search, setSearch] = useState('');

  const filteredMembers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return members;
    return members.filter((member) => member.user.username.toLowerCase().includes(query));
  }, [members, search]);

  return (
    <View className="mb-4 rounded-card border border-outline-variant/30 bg-surface p-2">
      <Text className="mb-2 px-1 font-label text-xs uppercase tracking-wide text-ink-muted" numberOfLines={1}>
        {sideName || 'Unnamed side'}
      </Text>

      <View className="mb-2 flex-row items-center gap-1.5 rounded-full border border-outline-variant bg-surface-high/60 pl-3 pr-2">
        <MaterialIcons name="search" size={14} color={c.inkMuted} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search"
          placeholderTextColor={c.inkMuted}
          className="min-h-[36px] flex-1 font-body text-sm text-heading"
        />
      </View>

      <ScrollView className="max-h-[148px]" nestedScrollEnabled showsVerticalScrollIndicator={false}>
        {filteredMembers.length === 0 ? (
          <Text className="px-1 py-2 font-body text-xs text-ink-muted">No members found</Text>
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
                className={`mb-1 min-h-[44px] flex-row items-center gap-2 rounded-full px-2 ${
                  selected ? 'bg-primary-container' : ''
                } ${disabledByOtherSide ? 'opacity-30' : ''}`}>
                <Avatar username={member.user.username} size="sm" />
                <Text
                  className={`flex-1 font-body text-sm ${selected ? 'font-title text-white' : 'text-heading'}`}
                  numberOfLines={1}>
                  {member.user.username}
                </Text>
              </Pressable>
            );
          })
        )}
      </ScrollView>

      <Text className="mt-1 px-1 font-body text-xs text-ink-muted">{selectedUserIds.size} selected</Text>
    </View>
  );
}
