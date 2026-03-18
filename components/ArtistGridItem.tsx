import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';

interface ArtistGridItemProps {
  artistName: string;
  imageUri: string | null;
  latestDate: string;
  showCount: number;
  onPress: () => void;
  width: number;
}

export const ArtistGridItem: React.FC<ArtistGridItemProps> = React.memo(
  ({ artistName, imageUri, latestDate, showCount, onPress, width }) => (
    <TouchableOpacity
      style={[styles.container, { width }]}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <View style={styles.imageWrapper}>
        {imageUri ? (
          <Image
            source={{ uri: imageUri }}
            style={styles.image}
            contentFit="cover"
            transition={120}
          />
        ) : (
          <View style={styles.imageFallback}>
            <MaterialIcons name="person" size={40} color="#C4C4C4" />
          </View>
        )}

        <LinearGradient
          colors={['rgba(28, 36, 47, 0.95)', 'rgba(28, 36, 47, 0.55)', 'rgba(28, 36, 47, 0)']}
          locations={[0, 0.55, 1]}
          start={{ x: 0.5, y: 1 }}
          end={{ x: 0.5, y: 0 }}
          style={styles.bottomGradientLayer}
        />

        <View style={styles.textOverlay}>
          <Text style={styles.name} numberOfLines={1}>
            {artistName}
          </Text>
          <View style={styles.badgeRow}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{(latestDate || '-').replace(/\./g, '/')}</Text>
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{`${showCount}`}</Text>
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  ),
);

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  imageWrapper: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#ECECEC',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 3,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageFallback: {
    flex: 1,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomGradientLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '62%',
  },
  textOverlay: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 10,
  },
  name: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badge: {
    borderRadius: 999,
    backgroundColor: '#9A7CF8',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
