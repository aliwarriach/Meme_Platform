import { MaterialIcons } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import WebModalFrame from '@/components/web/WebModalFrame';
import { useVotingWebTheme } from '@/constants/VotingWebTheme';
import { VOTING_WEB_SPACING } from '@/constants/webVotingTheme';
import { MemeCard } from '@/features/feed/components/MemeCard';
import { ContainerCard } from '@/features/instagram-companion/ContainerCard';
import type { StandingContent } from '@/services/competitions';

interface WebCompetitionEntryModalProps {
  content: StandingContent | null;
  onClose: () => void;
}

/**
 * Web-scoped sibling of `features/voting/components/CompetitionEntryModal.tsx` (native-resolved,
 * untouched). KNOWN SEAM (deliberate, documented — see voting-web.md): the entry body itself
 * reuses the shared native `MemeCard`/`ContainerCard` exactly as the native modal does, rather
 * than rebuilding themed parity components (full share/comment/send affordances) for a secondary,
 * drill-in interaction on a RESKIN-scoped pass. This mirrors `community-web.md`'s own precedent of
 * reusing native rows unrestyled inside a themed container for out-of-primary-scope content
 * (there: Leaderboard/Challenges tabs; here: the full entry detail). Voting itself still works —
 * `MemeCard`/`ContainerCard` carry their own live vote pill — this seam is chrome-only. Only the
 * close header and modal frame get this screen's new theme.
 */
export function WebCompetitionEntryModal({ content, onClose }: WebCompetitionEntryModalProps) {
  const { colors } = useVotingWebTheme();

  return (
    <Modal visible={!!content} animationType="slide" onRequestClose={onClose}>
      <WebModalFrame>
        <View style={[styles.root, { backgroundColor: colors.background }]}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={onClose}
              style={({ hovered }) => [
                styles.closeButton,
                { backgroundColor: colors.elevated },
                hovered && { backgroundColor: colors.elevatedHover },
              ]}>
              <MaterialIcons name="close" size={20} color={colors.foreground} />
            </Pressable>
          </View>
          <ScrollView>
            {content?.kind === 'meme' ? (
              <MemeCard meme={content.meme} />
            ) : content?.kind === 'container' ? (
              <ContainerCard container={content.container} />
            ) : null}
          </ScrollView>
        </View>
      </WebModalFrame>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: VOTING_WEB_SPACING.md,
    paddingVertical: VOTING_WEB_SPACING.md,
    borderBottomWidth: 1,
  },
  closeButton: {
    height: 40,
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
  },
});
