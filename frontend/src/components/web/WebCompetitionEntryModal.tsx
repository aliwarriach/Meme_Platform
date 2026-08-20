import { MaterialIcons } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import WebModalFrame from '@/components/web/WebModalFrame';
import { useVaporwaveTheme } from '@/constants/VaporwaveWebTheme';
import { MemeCard } from '@/features/feed/components/MemeCard';
import { ContainerCard } from '@/features/instagram-companion/ContainerCard';
import type { StandingContent } from '@/services/competitions';

interface WebCompetitionEntryModalProps {
  content: StandingContent | null;
  onClose: () => void;
}

/**
 * Web-scoped sibling of `features/voting/components/CompetitionEntryModal.tsx` (native-resolved,
 * untouched), migrated onto the Vaporwave/Luminous system. KNOWN SEAM, carried forward unchanged
 * from the retired independent-theme version (deliberate, not an oversight — same precedent
 * `community-web.md` set for its own out-of-primary-scope drill-in content): the entry body
 * itself reuses the shared native `MemeCard`/`ContainerCard` exactly as the native modal does,
 * rather than rebuilding full share/comment/send parity in this system for a secondary
 * interaction. Voting itself still works — those cards carry their own live vote pill. Only the
 * close header and modal frame get this screen's theme.
 */
export function WebCompetitionEntryModal({ content, onClose }: WebCompetitionEntryModalProps) {
  const { colors, spacing } = useVaporwaveTheme();

  return (
    <Modal visible={!!content} animationType="slide" onRequestClose={onClose}>
      <WebModalFrame>
        <View style={[styles.root, { backgroundColor: colors.gradientBottom }]}>
          <View style={[styles.header, { borderBottomColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: spacing.md }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={onClose}
              style={({ hovered }) => [
                styles.closeButton,
                { backgroundColor: colors.surfaceElevated },
                hovered ? { backgroundColor: colors.surfaceHover } : null,
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
