import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';

import FloatingBottomNav from '@/components/FloatingBottomNav';
import WebBadgeChip from '@/components/web/WebBadgeChip';
import WebPillButton from '@/components/web/WebPillButton';
import WebProfileAvatar from '@/components/web/WebProfileAvatar';
import WebProfileTopBar from '@/components/web/WebProfileTopBar';
import WebScoreCard from '@/components/web/WebScoreCard';
import WebSettingsRow from '@/components/web/WebSettingsRow';
import { ProfileThemeProvider, useProfileWebTheme } from '@/constants/ProfileWebTheme';
import { PROFILE_WEB_SPACING, PROFILE_WEB_TYPE, injectProfileWebFont } from '@/constants/webProfileTheme';
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

/**
 * Web-only sibling of `features/auth/SessionScreen.tsx` (native-resolved, untouched — Expo
 * Router prefers this file for every web bundle via platform-extension resolution; `app/profile.tsx`
 * needs zero changes). FULL MODE pass, reusing the `voting-web` palette/typography/shape system
 * verbatim per this task's brief, extended with profile-specific patterns (identity block, stat
 * cards, settings-list rows, danger-zone action) not present in that prior pass.
 *
 * Renders inside `DesktopShell`'s content column (mounted app-wide in `app/_layout.tsx`, out of
 * bounds for this pass) — at >= DESKTOP_FRAME_MIN_WIDTH that supplies the sidebar + centered
 * column; below it, this screen renders full-bleed with `FloatingBottomNav`, matching every
 * other web screen's convention.
 */
function SessionScreenContent() {
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const { colors } = useProfileWebTheme();
  const user = useSelector((state: RootState) => state.auth.user);
  const profileScoreQuery = useProfileScore(user?.id ?? '', !!user);
  const badgesQuery = useMyBadges();

  useEffect(() => {
    injectProfileWebFont();
  }, []);

  const onLogout = async () => {
    await dispatch(signOut());
    router.replace('/login');
  };

  if (!user) return null;

  const badges = badgesQuery.data ?? [];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <WebProfileTopBar title="Profile" />

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <View style={styles.identity}>
            <WebProfileAvatar username={user.username} avatarUrl={user.avatarUrl} size={88} />
            <Text
              accessibilityRole="header"
              style={[PROFILE_WEB_TYPE.display, { color: colors.foreground, marginTop: PROFILE_WEB_SPACING.md }]}>
              {user.username}
            </Text>
            <Text style={[PROFILE_WEB_TYPE.body, { color: colors.foregroundMuted }]}>{user.email}</Text>
            {user.bio ? (
              <Text style={[PROFILE_WEB_TYPE.body, styles.bio, { color: colors.foreground }]}>{user.bio}</Text>
            ) : null}
          </View>

          {/* Two stat cards side by side: Meme Score gets primary emphasis (accent color), badge
              count is a secondary at-a-glance stat — a genuine information-hierarchy improvement
              over the native screen, which only ever surfaces the score and buries the badge
              *count* inside a chip row a viewer has to count by eye. Additive only, no new
              fetch: both numbers come from queries the native screen already runs. */}
          <View style={styles.statsRow}>
            <WebScoreCard
              label="Meme Score"
              value={profileScoreQuery.data?.score}
              isLoading={profileScoreQuery.isLoading}
              accentColor={colors.primaryText}
            />
            <WebScoreCard label="Badges" value={badges.length} isLoading={badgesQuery.isLoading} accentColor={colors.goldText} />
          </View>

          <Text style={[PROFILE_WEB_TYPE.label, styles.sectionLabel, { color: colors.foregroundMuted }]}>
            Badges
          </Text>
          {badgesQuery.isLoading ? null : badges.length === 0 ? (
            <Text style={[PROFILE_WEB_TYPE.body, styles.emptyText, { color: colors.foregroundMuted }]}>
              No badges yet — win a challenge to earn one.
            </Text>
          ) : (
            <View style={styles.badgeRow}>
              {badges.map((badge) => (
                <WebBadgeChip key={badge.id} label={badge.label} points={badge.points} />
              ))}
            </View>
          )}

          <Text style={[PROFILE_WEB_TYPE.label, styles.sectionLabel, { color: colors.foregroundMuted }]}>
            Explore
          </Text>
          <View style={styles.settingsGroup}>
            {ENTRY_LINKS.map((link) => (
              <WebSettingsRow
                key={link.href}
                label={link.label}
                icon={link.icon}
                onPress={() => router.push(link.href as never)}
              />
            ))}
          </View>

          <Text style={[PROFILE_WEB_TYPE.label, styles.sectionLabel, { color: colors.foregroundMuted }]}>
            Account
          </Text>
          <View style={styles.settingsGroup}>
            <WebSettingsRow label="Log Out" icon="logout" onPress={onLogout} destructive />
          </View>
        </ScrollView>
      </SafeAreaView>

      <FloatingBottomNav active="profile" />
    </View>
  );
}

export default function SessionScreen() {
  return (
    <ProfileThemeProvider>
      <SessionScreenContent />
    </ProfileThemeProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  scroll: {
    flex: 1,
    paddingHorizontal: PROFILE_WEB_SPACING.lg,
  },
  scrollContent: {
    paddingBottom: 100,
    paddingTop: PROFILE_WEB_SPACING.lg,
  },
  identity: {
    alignItems: 'center',
    marginBottom: PROFILE_WEB_SPACING.xl,
  },
  bio: {
    marginTop: PROFILE_WEB_SPACING.sm,
    textAlign: 'center',
    maxWidth: 480,
  },
  statsRow: {
    flexDirection: 'row',
    gap: PROFILE_WEB_SPACING.md,
    marginBottom: PROFILE_WEB_SPACING.xl,
  },
  sectionLabel: {
    marginBottom: PROFILE_WEB_SPACING.sm,
    marginTop: PROFILE_WEB_SPACING.md,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: PROFILE_WEB_SPACING.sm,
    marginBottom: PROFILE_WEB_SPACING.xl,
  },
  emptyText: {
    marginBottom: PROFILE_WEB_SPACING.xl,
  },
  settingsGroup: {
    gap: PROFILE_WEB_SPACING.sm,
    marginBottom: PROFILE_WEB_SPACING.xl,
  },
});
