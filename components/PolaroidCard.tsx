import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { theme } from '../theme';

interface ChekiRecord {
  id: string;
  artist: string;
  liveName: string;
  date: string;
  imageUrl: string;
  memo: string;
}

interface PolaroidCardProps {
  record: ChekiRecord;
  onPress: () => void;
  width: number;
  columnIndex: number; // 0 for left column, 1 for right column
  index: number; // Overall index for row calculation
}

export const PolaroidCard: React.FC<PolaroidCardProps> = ({ 
  record, 
  onPress, 
  width,
  columnIndex,
  index
}) => {
  // Calculate row index (which row in the grid)
  const rowIndex = Math.floor(index / 2);
  const isEvenRow = rowIndex % 2 === 0;
  
  // Left column: -4deg, 4deg, -4deg, 4deg...
  // Right column: 4deg, -4deg, 4deg, -4deg...
  let tiltDegree;
  if (columnIndex === 0) {
    tiltDegree = isEvenRow ? '-4deg' : '4deg';
  } else {
    tiltDegree = isEvenRow ? '4deg' : '-4deg';
  }

  return (
    <TouchableOpacity
      style={[
        styles.card,
        { 
          width,
        }
      ]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={styles.cardInner}>
        <View style={styles.imageWrapper}>
          <Image
            source={{ uri: record.imageUrl }}
            style={styles.cardImage}
            contentFit="cover"
          />
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: theme.spacing.lg,
  },
  cardInner: {
    backgroundColor: theme.colors.background.card,
    paddingTop: theme.card.padding.top,
    paddingBottom: theme.card.padding.bottom,
    paddingHorizontal: theme.card.padding.horizontal,
    borderRadius: 25,
    ...theme.shadows.card,
  },
  imageWrapper: {
    width: '100%',
    aspectRatio: theme.card.aspectRatio,
    overflow: 'hidden',
    borderRadius: 21,
    backgroundColor: theme.colors.border.light,
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
});
