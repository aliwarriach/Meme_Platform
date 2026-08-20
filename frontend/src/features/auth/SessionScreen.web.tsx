import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';

import FloatingBottomNav from '@/components/FloatingBottomNav';
import WebAvatar from '@/components/web/WebAvatar';
import WebBadgeChip from '@/components/web/WebBadgeChip';
import { WebEmailVerificationBanner } from '@/components/web/WebEmailVerificationBanner';
import WebProfileTopBar from '@/components/web/WebProfileTopBar';
import WebScoreCard from '@/components/web/WebScoreCard';
import WebSettingsRow from '@/components/web/WebSettingsRow';
import type { VaporwaveTheme } from '@/constants/webFeedThemeVapor';
import { injectFeedWebFont } from '@/constants/webFeedThemeVapor';
import { VaporwaveThemeProvider, useVaporwaveTheme } from '@/constants/VaporwaveWebTheme';
import { useMyBadges } from '@/services/useBadges';
import { useProfileScore } from '@/services/useLeaderboards';
import { signOut } from '@/store/authSlice';
import type { AppDispatch, RootState } from '@/store/store';

const ENTRY_LINKS: { label: string; href: string; icon: keyof typeof MaterialIcons.glyphMap }[] = [
  { label: 'Friends', href: '/friends', icon: 'people-outline' },
  { label: 'Communities', href: '/communities', icon: 'groups' },
  { label: 'Compete', href: '/compete', icon: 'emoji-events' },
  { label: 'Competitions', href: '/voting', icon: 'military-tech' },
  { label: 'Inbox', href: '/inbox', icon: 'mail-outline' },
];

function SessionScreenContent() {
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const { colors, type, spacing } = useVaporwaveTheme();
  const styles = useMemo(() => createStyles(colors, spacing), [colors, spacing]);
  const user = useSelector((state: RootState) => state.auth.user);
  const profileScoreQuery = useProfileScore(user?.id ?? '', !!user);
  const badgesQuery = useMyBadges();

  useEffect(() => {
    injectFeedWebFont();
  }, []);

  const onLogout = async () => {
    await dispatch(signOut());
    router.replace('/login');
  };

  if (!user) return null;

  const badges = badgesQuery.data ?? [];

  return (
    <View style={styles.root}>
      <LinearGradient colors={[colors.gradientTop, colors.gradientMid, colors.gradientBottom]} style={StyleSheet.absoluteFill} />

      <SafeAreaView style={styles.safe} edges={['top']}>
        <WebProfileTopBar title="Profile" />

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <View style={styles.identity}>
            <WebAvatar username={user.username} avatarUrl={user.avatarUrl} size={88} />
            <Text accessibilityRole="header" style={[type.display, styles.username, { color: colors.foreground }]}>
              {user.username}
            </Text>
            <Text style={[type.body, { color: colors.foregroundMuted }]}>{user.email}</Text>
            {user.bio ? <Text style={[type.body, styles.bio, { color: colors.foreground }]}>{user.bio}</Text> : null}
          </View>

          {!user.emailVerifiedAt ? <WebEmailVerificationBanner /> : null}

          {/* Two stat cards side by side: Meme Score gets primary read order, badge count is a
              secondary at-a-glance stat — the same information-hierarchy gain the retired web
              pass identified over the native screen's single centered score block plus an
              uncounted chip row. Additive only, no new fetch. */}
          <View style={styles.statsRow}>
            <WebScoreCard label="Meme Score" value={profileScoreQuery.data?.score} isLoading={profileScoreQuery.isLoading} icon="military-tech" />
            <WebScoreCard label="Badges" value={badges.length} isLoading={badgesQuery.isLoading} icon="emoji-events" />
          </View>

          <Text style={[type.label, styles.sectionLabel, { color: colors.foregroundMuted }]}>Badges</Text>
          {badgesQuery.isLoading ? null : badges.length === 0 ? (
            <Text style={[type.body, styles.emptyText, { color: colors.foregroundMuted }]}>
              No badges yet — win a challenge to earn one.
            </Text>
          ) : (
            <View style={styles.badgeRow}>
              {badges.map((badge) => (
                <WebBadgeChip key={badge.id} label={badge.label} points={badge.points} />
              ))}
            </View>
          )}

          <Text style={[type.label, styles.sectionLabel, { color: colors.foregroundMuted }]}>Explore</Text>
          <View style={styles.settingsGroup}>
            {ENTRY_LINKS.map((link) => (
              <WebSettingsRow key={link.href} label={link.label} icon={link.icon} onPress={() => router.push(link.href as never)} />
            ))}
          </View>

          <Text style={[type.label, styles.sectionLabel, { color: colors.foregroundMuted }]}>Account</Text>
          <View style={styles.settingsGroup}>
            <WebSettingsRow label="Log Out" icon="logout" onPress={onLogout} destructive />
          </View>
        </ScrollView>
      </SafeAreaView>

      <FloatingBottomNav active="profile" />
    </View>
  );
}

/**
 * Web-only sibling of `features/auth/SessionScreen.tsx` (native-resolved, byte-for-byte untouched
 * — Expo Router's platform-extension resolution prefers this file for the web bundle, `app/profile.tsx`
 * needs zero changes). Migrated off the retired independent theme (`webProfileTheme.ts` +
 * `ProfileWebTheme.tsx`) onto the project's standing Vaporwave/Luminous default — screen 4 of 5 in
 * the ordered migration sequence (Voting -> Challenges -> Leaderboard -> **Profile** -> Inbox). See
 * `design-system/meme-platform/pages/profile-web.md` for the full migration record.
 */
export default function SessionScreen() {
  return (
    <VaporwaveThemeProvider>
      <SessionScreenContent />
    </VaporwaveThemeProvider>
  );
}

const createStyles = (colors: VaporwaveTheme['colors'], spacing: VaporwaveTheme['spacing']) =>
  StyleSheet.create({
    root: { flex: 1 },
    safe: { flex: 1 },
    scroll: {
      flex: 1,
      paddingHorizontal: spacing.lg,
    },
    scrollContent: {
      paddingBottom: 100,
      paddingTop: spacing.lg,
    },
    identity: {
      alignItems: 'center',
      marginBottom: spacing.xl,
    },
    username: {
      marginTop: spacing.md,
    },
    bio: {
      marginTop: spacing.sm,
      textAlign: 'center',
      maxWidth: 480,
    },
    statsRow: {
      flexDirection: 'row',
      gap: spacing.md,
      marginBottom: spacing.xl,
    },
    sectionLabel: {
      marginBottom: spacing.sm,
      marginTop: spacing.md,
    },
    badgeRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginBottom: spacing.xl,
    },
    emptyText: {
      marginBottom: spacing.xl,
    },
    settingsGroup: {
      gap: spacing.sm,
      marginBottom: spacing.xl,
    },
  });
