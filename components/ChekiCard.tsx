import React, { useMemo } from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';

// Light leak images for film effect
const LIGHT_LEAK_IMAGES = [
  require('../assets/light-leaks/lightLeak1.jpg'),
  require('../assets/light-leaks/lightLeak2.jpg'),
  require('../assets/light-leaks/lightLeak3.jpg'),
];

// Small tiling noise texture (base64 PNG) to add subtle film grain
const NOISE_DATA_URI =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAQAAAC1+jfqAAAAT0lEQVQoU2NkYGD4z0ABYBxVSFUBCkYWBgYG/jMwMDCwIYg1A2NgYHBg0YBgGBiY/4HhGGAMEzMwMDKysjPwPxhyIDRmYGBgAAE9WAhvpJv5uAAAAAElFTkSuQmCC';

interface ChekiRecord {
  id: string;
  artist: string;
  date: string;
  imageUrl: string;
  memo: string;
}

interface ChekiCardProps {
  record: ChekiRecord;
  onPress: () => void;
  width: number;
}

export const ChekiCard: React.FC<ChekiCardProps> = ({ record, onPress, width }) => {
  // Randomly select a light leak image (memoized per card)
  const lightLeakImage = useMemo(() => {
    return LIGHT_LEAK_IMAGES[Math.floor(Math.random() * LIGHT_LEAK_IMAGES.length)];
  }, [record.id]);

  const styles = StyleSheet.create({
    card: {
      width,
      marginBottom: 16,
    },
    cardInner: {
      backgroundColor: '#FFFFFF',
      paddingTop: 20,
      paddingBottom: 8,
      paddingHorizontal: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 5,
    },
    imageWrapper: {
      width: '100%',
      aspectRatio: 3 / 4,
      overflow: 'hidden',
      backgroundColor: '#E5E5EA',
    },
    cardImage: {
      width: '100%',
      height: '100%',
    },
    tintOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(255, 235, 205, 0.18)', // warm, slightly sepia
    },
    noiseOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      opacity: 0.14,
    },
    lightLeakOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      opacity: 0.30,
    },
    cardInfo: {
      paddingHorizontal: 12,
      paddingVertical: 12,
      backgroundColor: '#FFFFFF',
    },
    cardArtist: {
      fontSize: 13,
      fontWeight: '900' as const,
      fontFamily: 'Aoharu',
      color: '#000',
      marginBottom: 4,
      textShadowColor: '#00000055',
      textShadowOffset: { width: 0.4, height: 0.6 },
      textShadowRadius: 0.8,
    },
    cardDate: {
      fontSize: 10,
      fontWeight: '700' as const,
      fontFamily: 'Aoharu',
      color: '#8E8E93',
      textShadowColor: '#00000040',
      textShadowOffset: { width: 0.3, height: 0.4 },
      textShadowRadius: 0.6,
    },
  });

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={styles.cardInner}>
        <View style={styles.imageWrapper}>
          <Image
            source={{ uri: record.imageUrl }}
            style={styles.cardImage}
            contentFit="cover"
            blurRadius={0.4}
          />
          <View style={styles.tintOverlay} pointerEvents="none" />
          <Image
            source={lightLeakImage}
            style={styles.lightLeakOverlay}
            contentFit="cover"
            pointerEvents="none"
          />
          <Image
            source={{ uri: NOISE_DATA_URI }}
            style={styles.noiseOverlay}
            contentFit="cover"
            pointerEvents="none"
          />
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardArtist} numberOfLines={1}>
            {record.artist}
          </Text>
          <Text style={styles.cardDate}>{record.date}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};
