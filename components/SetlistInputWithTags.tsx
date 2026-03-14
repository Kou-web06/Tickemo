import React, { useMemo, useState } from 'react';
import {
  NativeSyntheticEvent,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputSelectionChangeEventData,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';

interface CursorPosition {
  start: number;
  end: number;
}

interface SetlistInputWithTagsProps {
  value: string;
  onChangeText: (next: string) => void;
  placeholder?: string;
  title?: string;
  tags?: string[];
  minHeight?: number;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  headerRight?: React.ReactNode;
}

const DEFAULT_TAGS = ['SE', 'MC', 'Encore', 'Session'];

function insertTagAtCursor(text: string, cursor: CursorPosition, label: string) {
  const boundedStart = Math.max(0, Math.min(cursor.start, text.length));
  const boundedEnd = Math.max(0, Math.min(cursor.end, text.length));

  const before = text.slice(0, boundedStart);
  const after = text.slice(boundedEnd);

  const tag = `--- ${label} ---`;
  const needsLeadingNewline = before.length > 0 && !before.endsWith('\n');
  const needsTrailingNewline = !after.startsWith('\n');

  const insertion = `${needsLeadingNewline ? '\n' : ''}${tag}${needsTrailingNewline ? '\n' : ''}`;
  const nextText = `${before}${insertion}${after}`;
  const nextCursor = (before + insertion).length;

  return { nextText, nextCursor };
}

export default function SetlistInputWithTags({
  value,
  onChangeText,
  placeholder,
  title = 'セットリスト',
  tags = DEFAULT_TAGS,
  minHeight = 150,
  containerStyle,
  inputStyle,
  headerRight,
}: SetlistInputWithTagsProps) {
  const [cursorPosition, setCursorPosition] = useState<CursorPosition>({ start: 0, end: 0 });
  const [selection, setSelection] = useState<CursorPosition>({ start: 0, end: 0 });

  const resolvedTags = useMemo(() => tags.filter((tag) => tag.trim().length > 0), [tags]);

  const handleSelectionChange = (event: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
    const next = event.nativeEvent.selection;
    setCursorPosition(next);
    setSelection(next);
  };

  const handlePressTag = (tagLabel: string) => {
    const { nextText, nextCursor } = insertTagAtCursor(value, cursorPosition, tagLabel);
    onChangeText(nextText);
    const nextSelection = { start: nextCursor, end: nextCursor };
    setCursorPosition(nextSelection);
    setSelection(nextSelection);
  };

  return (
    <View style={containerStyle}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{title}</Text>
        {headerRight}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsRow}
        keyboardShouldPersistTaps="always"
      >
        {resolvedTags.map((tag) => (
          <TouchableOpacity key={tag} style={styles.chip} onPress={() => handlePressTag(tag)} activeOpacity={0.85}>
            <Text style={styles.chipText}>{tag}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <TextInput
        style={[styles.input, { minHeight }, inputStyle]}
        value={value}
        onChangeText={onChangeText}
        onSelectionChange={handleSelectionChange}
        selection={selection}
        multiline
        scrollEnabled
        textAlignVertical="top"
        placeholder={placeholder}
        placeholderTextColor="#CCCCCC"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  title: {
    color: '#808080',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
    marginTop: 4,
  },
  chipsRow: {
    paddingBottom: 10,
    paddingRight: 6,
  },
  chip: {
    backgroundColor: '#F3E5FA',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 8,
  },
  chipText: {
    color: '#A226D9',
    fontSize: 12,
    fontWeight: 'bold',
  },
  input: {
    minHeight: 150,
    maxHeight: 240,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#EEEEEE',
    fontSize: 16,
    color: '#222222',
  },
});
