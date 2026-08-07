import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Modal, Platform, Pressable, Text, View } from 'react-native';

import PillButton from '@/components/PillButton';
import { DESKTOP_MODAL_MAX_WIDTH } from '@/constants/webLayout';
import { useProposeDuelMutation } from '@/services/useChallenges';

interface DuelProposeModalProps {
  visible: boolean;
  onClose: () => void;
  opponentId: string;
  opponentUsername: string;
}

const DURATION_PRESETS = [
  { label: '1 hour', hours: 1 },
  { label: '24 hours', hours: 24 },
  { label: '3 days', hours: 72 },
] as const;

export default function DuelProposeModal({
  visible,
  onClose,
  opponentId,
  opponentUsername,
}: DuelProposeModalProps) {
  const router = useRouter();
  const proposeDuel = useProposeDuelMutation();
  const [durationHours, setDurationHours] = useState<number>(24);

  const onConfirm = () => {
    const now = new Date();
    proposeDuel.mutate(
      {
        opponentId,
        title: `Duel vs ${opponentUsername}`,
        start_time: now.toISOString(),
        end_time: new Date(now.getTime() + durationHours * 60 * 60 * 1000).toISOString(),
      },
      {
        onSuccess: (challenge) => {
          onClose();
          router.push({ pathname: '/challenges/[challengeId]', params: { challengeId: challenge.id } });
        },
      }
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent>
      <View
        className="flex-1 justify-end bg-black/60"
        style={Platform.OS === 'web' ? { alignItems: 'center' } : undefined}>
        <View
          className="overflow-hidden rounded-t-card"
          style={
            Platform.OS === 'web' ? { width: '100%', maxWidth: DESKTOP_MODAL_MAX_WIDTH } : undefined
          }>
          <BlurView
            intensity={60}
            tint="dark"
            className="border-t border-outline-variant/40 bg-surface/85 p-4">
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="font-heading text-lg text-heading">Challenge {opponentUsername}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close"
                onPress={onClose}
                className="h-11 w-11 items-center justify-center">
                <Text className="font-body text-ink-muted">Close</Text>
              </Pressable>
            </View>

            <Text className="mb-2 font-label text-xs uppercase tracking-wide text-ink-muted">
              Duration
            </Text>
            <View className="mb-4 flex-row gap-2">
              {DURATION_PRESETS.map((preset) => (
                <PillButton
                  key={preset.hours}
                  label={preset.label}
                  variant={durationHours === preset.hours ? 'primary' : 'outline'}
                  onPress={() => setDurationHours(preset.hours)}
                  className="flex-1"
                />
              ))}
            </View>

            <PillButton
              label={proposeDuel.isPending ? 'Sending challenge…' : 'Send duel invite'}
              onPress={onConfirm}
              loading={proposeDuel.isPending}
            />
            {proposeDuel.isError ? (
              <Text className="mt-2 font-body text-xs text-error">{proposeDuel.error.message}</Text>
            ) : null}
          </BlurView>
        </View>
      </View>
    </Modal>
  );
}
