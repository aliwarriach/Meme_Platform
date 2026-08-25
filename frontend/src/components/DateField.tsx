import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { format, parse } from 'date-fns';
import { useState } from 'react';
import { useThemeMode } from '@/constants/ThemeMode';
import { BlurView } from 'expo-blur';
import { Modal, Platform, Pressable, Text, View } from 'react-native';

import { NEON_PLUM_DARK, NEON_PLUM_LIGHT } from '@/constants/theme';

interface DateFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  placeholder?: string;
  /** Latest selectable date — defaults to today, since this field is only ever used for a date
   * of birth (never a future date). */
  maximumDate?: Date;
}

const DATE_FORMAT = 'yyyy-MM-dd';

function parseValue(value: string): Date {
  if (!value) return new Date();
  const parsed = parse(value, DATE_FORMAT, new Date());
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

/** Calendar-driven date input — replaces free-typed `YYYY-MM-DD` text entry (error-prone: users
 * routinely mistype the format or transpose month/day) with the platform's native date picker.
 * Android opens its native calendar dialog directly; iOS shows a spinner in a bottom sheet, since
 * `DateTimePicker`'s inline iOS `display` modes don't have an imperative open/close equivalent. */
export function DateField({ label, value, onChange, error, placeholder, maximumDate }: DateFieldProps) {
  const { mode } = useThemeMode();
  const c = mode === 'dark' ? NEON_PLUM_DARK : NEON_PLUM_LIGHT;
  const [iosPickerOpen, setIosPickerOpen] = useState(false);
  const [iosDraft, setIosDraft] = useState(() => parseValue(value));
  const maxDate = maximumDate ?? new Date();

  const openPicker = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: parseValue(value),
        mode: 'date',
        maximumDate: maxDate,
        onChange: (event, selected) => {
          if (event.type === 'set' && selected) onChange(format(selected, DATE_FORMAT));
        },
      });
      return;
    }
    setIosDraft(parseValue(value));
    setIosPickerOpen(true);
  };

  return (
    <View className="mb-4">
      <Text className="mb-1.5 font-label text-xs uppercase tracking-wide text-ink-muted">{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={openPicker}
        className={`min-h-[44px] justify-center rounded-full border bg-surface-high/60 px-5 py-3 ${
          error ? 'border-error' : 'border-outline-variant'
        }`}>
        <Text className={`font-body text-base ${value ? 'text-heading' : 'text-ink-muted'}`}>
          {value || placeholder || 'Select a date'}
        </Text>
      </Pressable>
      {error ? <Text className="mt-1 font-body text-xs text-error">{error}</Text> : null}

      {Platform.OS === 'ios' ? (
        <Modal visible={iosPickerOpen} animationType="slide" transparent onRequestClose={() => setIosPickerOpen(false)}>
          <View className="flex-1 justify-end bg-black/60">
            <BlurView intensity={60} tint="dark" className="overflow-hidden rounded-t-card border-t border-outline-variant/40 bg-surface/85 p-4">
              <View className="mb-2 flex-row items-center justify-between">
                <Pressable accessibilityRole="button" accessibilityLabel="Cancel" onPress={() => setIosPickerOpen(false)}>
                  <Text className="font-body text-ink-muted">Cancel</Text>
                </Pressable>
                <Text className="font-title text-heading">{label}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Confirm date"
                  onPress={() => {
                    onChange(format(iosDraft, DATE_FORMAT));
                    setIosPickerOpen(false);
                  }}>
                  <Text className="font-title text-primary-dim">Done</Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={iosDraft}
                mode="date"
                display="spinner"
                maximumDate={maxDate}
                onChange={(_, selected) => selected && setIosDraft(selected)}
                textColor={c.heading}
              />
            </BlurView>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}
