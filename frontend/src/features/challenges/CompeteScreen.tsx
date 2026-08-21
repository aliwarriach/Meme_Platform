import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';

import Chip from '@/components/Chip';
import FloatingBottomNav from '@/components/FloatingBottomNav';
import TopBar from '@/components/TopBar';
import { NEON_PLUM_DARK, NEON_PLUM_LIGHT } from '@/constants/theme';
import { ChallengeRow } from '@/features/challenges/components/ChallengeRow';
import LeaderboardsPanel from '@/features/leaderboards/LeaderboardsPanel';
import { getFlag, setFlag } from '@/services/localFlags';
import type { ChallengeResponse } from '@/services/challenges';
import { useMyChallenges, useOpenChallenges } from '@/services/useChallenges';

type Segment = 'challenges' | 'leaderboards';

const EXPLAINER_FLAG = 'hasSeenCompeteExplainer';

/** Community-scoped challenges route through their community; `open`/`duel` (no
 * community) route through the flat detail screen. */
function goToChallenge(router: ReturnType<typeof useRouter>, challenge: ChallengeResponse) {
  if (challenge.community_id) {
    router.push({
      pathname: '/communities/[id]/challenges/[challengeId]',
      params: { id: challenge.community_id, challengeId: challenge.id },
    });
  } else {
    router.push({ pathname: '/challenges/[challengeId]', params: { challengeId: challenge.id } });
  }
}

export default function CompeteScreen() {
  const { colorScheme } = useColorScheme();
  const c = colorScheme === 'dark' ? NEON_PLUM_DARK : NEON_PLUM_LIGHT;
  const router = useRouter();
  const [segment, setSegment] = useState<Segment>('challenges');
  const [showExplainer, setShowExplainer] = useState(false);

  const myChallengesQuery = useMyChallenges();
  const openChallengesQuery = useOpenChallenges();

  useEffect(() => {
    getFlag(EXPLAINER_FLAG).then((seen) => setShowExplainer(!seen));
  }, []);

  const dismissExplainer = () => {
    setShowExplainer(false);
    setFlag(EXPLAINER_FLAG, true);
  };

  const myChallenges = myChallengesQuery.data ?? [];
  const active = myChallenges.filter((c) => c.status === 'active' || c.status === 'setup');
  const results = myChallenges.filter((c) => c.status === 'evaluated');
  const myChallengeIds = new Set(myChallenges.map((c) => c.id));
  const openToJoin = (openChallengesQuery.data ?? []).filter((c) => !myChallengeIds.has(c.id));

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <TopBar
        title="Compete"
        rightActions={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Start an open challenge"
            onPress={() => router.push('/compete/open/new')}
            className="h-11 w-11 items-center justify-center">
            <MaterialIcons name="add" size={22} color={c.white} />
          </Pressable>
        }
      />

      <View className="mb-2 flex-row gap-2 px-6 pt-4">
        <Chip label="Challenges" selected={segment === 'challenges'} onPress={() => setSegment('challenges')} />
        <Chip
          label="Leaderboards"
          selected={segment === 'leaderboards'}
          onPress={() => setSegment('leaderboards')}
        />
      </View>

      {segment === 'leaderboards' ? (
        <LeaderboardsPanel />
      ) : (
        <ScrollView className="flex-1 px-6" contentContainerStyle={{ paddingBottom: 100 }}>
          {showExplainer ? (
            <View className="mb-4 rounded-card border border-primary/40 bg-primary/10 p-4">
              <Text className="mb-1 font-title text-heading">Compete in challenges</Text>
              <Text className="font-body text-sm text-ink-muted">
                Join a challenge from your communities, an open challenge anyone can enter, or
                challenge a friend to a duel — post a meme to compete, and watch the scoreboard
                live.
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Dismiss"
                onPress={dismissExplainer}
                className="mt-2 min-h-[44px] items-end justify-center">
                <Text className="font-label text-xs uppercase text-primary-dim">Got it</Text>
              </Pressable>
            </View>
          ) : null}

          <Text className="mb-2 font-label text-xs uppercase tracking-wide text-ink-muted">Active</Text>
          {myChallengesQuery.isLoading ? (
            <ActivityIndicator className="my-4" color={c.inkMuted} />
          ) : myChallengesQuery.isError ? (
            <Text className="mb-4 font-body text-sm text-error">{myChallengesQuery.error.message}</Text>
          ) : active.length === 0 ? (
            <Text className="mb-4 font-body text-sm text-ink-muted">
              Nothing active — join an open challenge below or challenge a friend from your
              friends list.
            </Text>
          ) : (
            active.map((challenge) => (
              <ChallengeRow key={challenge.id} challenge={challenge} onPress={() => goToChallenge(router, challenge)} />
            ))
          )}

          <Text className="mb-2 mt-4 font-label text-xs uppercase tracking-wide text-ink-muted">
            Open to join
          </Text>
          {openChallengesQuery.isLoading ? (
            <ActivityIndicator className="my-4" color={c.inkMuted} />
          ) : openChallengesQuery.isError ? (
            <Text className="mb-4 font-body text-sm text-error">{openChallengesQuery.error.message}</Text>
          ) : openToJoin.length === 0 ? (
            <Text className="mb-4 font-body text-sm text-ink-muted">No open challenges right now.</Text>
          ) : (
            openToJoin.map((challenge) => (
              <ChallengeRow key={challenge.id} challenge={challenge} onPress={() => goToChallenge(router, challenge)} />
            ))
          )}

          {results.length > 0 ? (
            <>
              <Text className="mb-2 mt-4 font-label text-xs uppercase tracking-wide text-ink-muted">
                Results
              </Text>
              {results.map((challenge) => (
                <ChallengeRow key={challenge.id} challenge={challenge} onPress={() => goToChallenge(router, challenge)} />
              ))}
            </>
          ) : null}
        </ScrollView>
      )}

      <FloatingBottomNav active="compete" />
    </SafeAreaView>
  );
}
