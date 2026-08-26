import { Image } from 'expo-image';
import { format } from 'date-fns';
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import type { MessageResponse } from '@/services/messaging';

interface MessageBubbleProps {
  message: MessageResponse;
  isOwn: boolean;
  /** Pending sends have no server row yet — shown dimmed rather than blocking the thread. */
  isPending: boolean;
}

export default function MessageBubble({ message, isOwn, isPending }: MessageBubbleProps) {
  const router = useRouter();

  return (
    <View className={`px-4 py-1 ${isOwn ? 'items-end' : 'items-start'}`}>
      <View
        className={`max-w-[80%] overflow-hidden rounded-card ${
          isOwn ? 'bg-primary/20' : 'bg-surface'
        } ${isPending ? 'opacity-50' : ''}`}>
        {message.kind === 'meme' ? (
          message.meme ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open meme from ${message.sender.username}`}
              disabled={isPending}
              onPress={() => router.push({ pathname: '/memes/[id]', params: { id: message.meme!.id } })}>
              <Image
                source={{ uri: message.meme.image_url }}
                style={{ width: 220, aspectRatio: 4 / 5 }}
                contentFit="cover"
              />
              {message.meme.caption ? (
                <Text className="px-3 py-2 font-body text-sm text-ink">{message.meme.caption}</Text>
              ) : null}
            </Pressable>
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
