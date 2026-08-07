import { SafeAreaView } from 'react-native-safe-area-context';

import FloatingBottomNav from '@/components/FloatingBottomNav';
import TopBar from '@/components/TopBar';
import LeaderboardsPanel from '@/features/leaderboards/LeaderboardsPanel';

export default function LeaderboardsScreen() {
  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <TopBar title="Leaderboards" showBack />
      <LeaderboardsPanel />
      <FloatingBottomNav active="compete" />
    </SafeAreaView>
  );
}
