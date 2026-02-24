import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Pressable,
} from 'react-native';

export interface Sticker {
  id: string;
  emoji: string;
  label?: string;
}

interface StickerPickerTooltipProps {
  visible: boolean;
  onClose: () => void;
  onSelectSticker: (sticker: Sticker) => void;
  stickers?: Sticker[];
  useModal?: boolean;
}

// デフォルトステッカーリスト（テスト用）
const DEFAULT_STICKERS: Sticker[] = [
  { id: '1', emoji: '✨', label: 'sparkle' },
  { id: '2', emoji: '🔥', label: 'fire' },
  { id: '3', emoji: '🎸', label: 'guitar' },
  { id: '4', emoji: '🎤', label: 'mic' },
  { id: '5', emoji: '🎫', label: 'ticket' },
  { id: '6', emoji: '🎵', label: 'music' },
  { id: '7', emoji: '⭐', label: 'star' },
  { id: '8', emoji: '💫', label: 'dizzy' },
  { id: '9', emoji: '🎆', label: 'fireworks' },
  { id: '10', emoji: '👑', label: 'crown' },
  { id: '11', emoji: '💎', label: 'gem' },
  { id: '12', emoji: '🌟', label: 'gstar' },
];

const StickerPickerTooltip: React.FC<StickerPickerTooltipProps> = ({
  visible,
  onClose,
  onSelectSticker,
  stickers = DEFAULT_STICKERS,
  useModal = true,
}) => {
  const handleStickerPress = useCallback(
    (sticker: Sticker) => {
      onSelectSticker(sticker);
      onClose();
    },
    [onSelectSticker, onClose]
  );

  const content = (
    <View style={styles.overlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

      <View style={styles.tooltipWrapper} pointerEvents="box-none">
        <View style={styles.tooltipBody}>
          <ScrollView
            scrollEnabled={stickers.length > 12}
            style={styles.stickerGrid}
            contentContainerStyle={styles.gridContent}
          >
            {stickers.map((sticker) => (
              <TouchableOpacity
                key={sticker.id}
                style={styles.stickerItem}
                onPress={() => handleStickerPress(sticker)}
              >
                <Text style={styles.stickerEmoji}>{sticker.emoji}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.tail} />
      </View>
    </View>
  );

  if (!visible) {
    return null;
  }

  if (!useModal) {
    return content;
  }

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      {content}
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 50,
  },
  tooltipWrapper: {
    alignItems: 'center',
    maxWidth: Dimensions.get('window').width - 32,
  },
  tooltipBody: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
    minWidth: 280,
  },
  stickerGrid: {
    maxHeight: 250,
  },
  gridContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  stickerItem: {
    width: '25%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
  },
  stickerEmoji: {
    fontSize: 32,
  },
  // Triangle tail using border trick
  tail: {
    width: 0,
    height: 0,
    borderLeftWidth: 12,
    borderRightWidth: 12,
    borderTopWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#FFFFFF',
    marginTop: -1,
  },
});

export default StickerPickerTooltip;
