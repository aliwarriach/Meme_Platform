import { Image } from 'expo-image';
import { format } from 'date-fns';
import { Text, View } from 'react-native';

import type { MessageResponse } from '@/services/messaging';

interface MessageBubbleProps {
  message: MessageResponse;
  isOwn: boolean;
  /** Pending sends have no server row yet — shown dimmed rather than blocking the thread. */
  isPending: boolean;
}

export default function MessageBubble({ message, isOwn, isPending }: MessageBubbleProps) {
  return (
    <View className={`px-4 py-1 ${isOwn ? 'items-end' : 'items-start'}`}>
      <View
        className={`max-w-[80%] overflow-hidden rounded-card ${
          isOwn ? 'bg-primary/20' : 'bg-surface'
        } ${isPending ? 'opacity-50' : ''}`}>
        {message.kind === 'meme' ? (
          message.meme ? (
            <View accessibilityLabel={`Meme from ${message.sender.username}`}>
              <Image
                source={{ uri: message.meme.image_url }}
                style={{ width: 220, aspectRatio: 4 / 5 }}
                contentFit="cover"
              />
              {message.meme.caption ? (
                <Text className="px-3 py-2 font-body text-sm text-ink">{message.meme.caption}</Text>
              ) : null}
            </View>
          ) : (
            <Text className="px-3 py-2 font-body text-sm italic text-ink-muted">
              {isPending ? 'Sending meme…' : 'This meme is no longer available'}
            </Text>
          )
        ) : (
          <Text className="px-3 py-2 font-body text-ink">{message.body}</Text>
        )}
      </View>

      <View className="flex-row items-center gap-1 px-1 pt-0.5">
        <Text className="font-body text-[10px] text-ink-muted">
          {format(new Date(message.created_at), 'HH:mm')}
        </Text>
        {isOwn && !isPending ? (
          <Text className="font-body text-[10px] text-ink-muted">
            {message.read_at ? '· Read' : '· Sent'}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
