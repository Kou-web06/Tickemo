import React, { useMemo } from 'react';
import {
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableWithoutFeedback,
  Animated as RNAnimated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

// Light leak images
const LIGHT_LEAK_IMAGES = [
  require('../assets/light-leaks/lightLeak1.jpg'),
  require('../assets/light-leaks/lightLeak2.jpg'),
  require('../assets/light-leaks/lightLeak3.jpg'),
];

// Film grain noise
const NOISE_DATA_URI =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAQAAAC1+jfqAAAAT0lEQVQoU2NkYGD4z0ABYBxVSFUBCkYWBgYG/jMwMDCwIYg1A2NgYHBg0YBgGBiY/4HhGGAMEzMwMDKysjPwPxhyIDRmYGBgAAE9WAhvpJv5uAAAAAElFTkSuQmCC';

interface Memory {
  id: string;
  artist: string;
  date: string;
  imageUrl: string;
  memo: string;
  detail?: string;
}

interface FlipChekiCardProps {
  memory: Memory;
  onPress?: () => void;
  width: number;
}

export const FlipChekiCard: React.FC<FlipChekiCardProps> = ({
  memory,
  onPress,
  width,
}) => {
  const [isModalVisible, setIsModalVisible] = React.useState(false);
  const [isFlipped, setIsFlipped] = React.useState(false);
  const flipAnimRef = React.useRef(new RNAnimated.Value(0)).current;

  const lightLeakImage = useMemo(() => {
    return LIGHT_LEAK_IMAGES[Math.floor(Math.random() * LIGHT_LEAK_IMAGES.length)];
  }, [memory.id]);

  const formattedDate = useMemo(() => {
    const date = new Date(memory.date);
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  }, [memory.date]);

  const handleCardPress = () => {
    setIsModalVisible(true);
  };

  const handleFlipPress = () => {
    const newIsFlipped = !isFlipped;
    setIsFlipped(newIsFlipped);

    RNAnimated.timing(flipAnimRef, {
      toValue: newIsFlipped ? 1 : 0,
      duration: 600,
      useNativeDriver: false,
    }).start();
  };

  const closeModal = () => {
    setIsModalVisible(false);
    setIsFlipped(false);
    flipAnimRef.setValue(0);
  };

  const frontOpacity = flipAnimRef.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 0, 0],
  });

  const backOpacity = flipAnimRef.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0, 1],
  });

  const styles = StyleSheet.create({
    // List Card
    listCard: {
      width,
      marginBottom: 16,
    },
    listCardTouchable: {
      backgroundColor: '#FFFFFF',
      borderRadius: 12,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.18,
      shadowRadius: 14,
      elevation: 6,
    },
    listCardInner: {
      paddingTop: 20,
      paddingBottom: 8,
      paddingHorizontal: 12,
    },
    imageWrapper: {
      width: '100%',
      aspectRatio: 3 / 4,
      overflow: 'hidden',
      backgroundColor: '#E5E5EA',
      borderRadius: 8,
      position: 'relative',
    },
    image: {
      width: '100%',
      height: '100%',
    },
    glossOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    tintOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(255, 235, 205, 0.18)',
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
      opacity: 0.25,
    },
    listCardInfo: {
      paddingHorizontal: 12,
      paddingVertical: 12,
      backgroundColor: '#FFFFFF',
      borderTopWidth: 1,
      borderTopColor: '#F2F2F7',
    },
    listCardArtist: {
      fontSize: 13,
      fontWeight: '900' as const,
      fontFamily: 'Aoharu',
      color: '#000',
      marginBottom: 4,
    },
    listCardDate: {
      fontSize: 11,
      fontWeight: '500' as const,
      color: '#8E8E93',
    },

    // Modal
    modalContainer: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.88)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    flipCardContainer: {
      width: 75,
      height: 100,
      backgroundColor: '#FFFFFF',
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.4,
      shadowRadius: 24,
      elevation: 12,
    },
    cardInner: {
      width: '100%',
      height: '100%',
      position: 'relative',
    },
    card: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      overflow: 'hidden',
      backgroundColor: '#FFF',
      flexDirection: 'column',
    },

    // Front
    frontCard: {
      backgroundColor: '#FFFFFF',
    },
    frontContent: {
      flex: 1,
      flexDirection: 'column',
    },
    frontImageWrapper: {
      height: 52,
      backgroundColor: '#E5E5EA',
      overflow: 'hidden',
      position: 'relative',
      borderRadius: 4,
      marginHorizontal: 8,
      marginTop: 8,
    },
    frontGlossOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    frontInfoBox: {
      paddingHorizontal: 8,
      paddingTop: 4,
      paddingBottom: 6,
      backgroundColor: '#FFFCF7',
    },
    frontArtist: {
      fontSize: 10,
      fontWeight: '700' as const,
      fontFamily: 'Aoharu',
      color: '#1A1A1A',
      marginBottom: 2,
      lineHeight: 14,
    },
    frontDate: {
      fontSize: 8,
      fontWeight: '500' as const,
      color: '#8E8E93',
      marginBottom: 2,
    },
    frontTapHint: {
      fontSize: 7,
      fontWeight: '400' as const,
      color: '#C7C7CC',
      fontStyle: 'italic' as const,
    },

    // Back
    backCard: {
      backgroundColor: '#FFFCF7',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 24,
      paddingBottom: 16,
    },
    backContent: {
      width: '100%',
      height: '100%',
      justifyContent: 'space-between',
    },
    backHeader: {
      paddingTop: 8,
    },
    backLabel: {
      fontSize: 11,
      fontWeight: '600' as const,
      color: '#B0B0B5',
      letterSpacing: 1.4,
      marginBottom: 8,
      textTransform: 'uppercase',
    },
    backTitle: {
      fontSize: 16,
      fontWeight: '700' as const,
      color: '#1A1A1A',
      fontFamily: 'Aoharu',
    },
    backMemoBox: {
      flex: 1,
      marginVertical: 16,
      justifyContent: 'flex-start',
    },
    backMemoText: {
      fontSize: 13,
      fontWeight: '400' as const,
      lineHeight: 22,
      color: '#333333',
      fontStyle: 'italic' as const,
    },
    backFooter: {
      alignItems: 'flex-end',
    },
    backFooterText: {
      fontSize: 10,
      fontWeight: '500' as const,
      color: '#B0B0B5',
      letterSpacing: 0.5,
    },

    // Close Button
    closeButton: {
      position: 'absolute',
      top: 30,
      right: 16,
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 10,
    },
    closeButtonText: {
      fontSize: 28,
      fontWeight: '300' as const,
      color: '#FFFFFF',
      marginTop: -4,
    },
    tapHintText: {
      position: 'absolute',
      bottom: 48,
      color: 'rgba(255, 255, 255, 0.45)',
      fontSize: 12,
      fontStyle: 'italic' as const,
      letterSpacing: 0.3,
    },
  });

  // List Card
  const renderListCard = () => (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={handleCardPress}
      style={styles.listCard}
    >
      <View style={styles.listCardTouchable}>
        <View style={styles.listCardInner}>
          <View style={styles.imageWrapper}>
            <Image
              source={{ uri: memory.imageUrl }}
              style={styles.image}
              contentFit="cover"
            />
            <LinearGradient
              colors={[
                'rgba(255, 255, 255, 0.4)',
                'rgba(255, 255, 255, 0.1)',
                'rgba(255, 255, 255, 0)',
              ]}
              start={{ x: 0.25, y: 0.15 }}
              end={{ x: 1, y: 0.55 }}
              style={styles.glossOverlay}
            />
            <View style={styles.tintOverlay} />
            <Image
              source={{ uri: NOISE_DATA_URI }}
              style={styles.noiseOverlay}
            />
            <Image
              source={lightLeakImage}
              style={styles.lightLeakOverlay}
              contentFit="cover"
            />
          </View>
        </View>
        <View style={styles.listCardInfo}>
          <Text style={styles.listCardArtist} numberOfLines={1}>
            {memory.artist}
          </Text>
          <Text style={styles.listCardDate}>{formattedDate}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  // Flip Card Modal
  const renderFlipCard = () => (
    <Modal visible={isModalVisible} transparent animationType="fade">
      <SafeAreaView style={styles.modalContainer}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={closeModal}
          activeOpacity={0.6}
        >
          <Text style={styles.closeButtonText}>×</Text>
        </TouchableOpacity>

        <TouchableWithoutFeedback onPress={handleFlipPress}>
          <View style={styles.flipCardContainer}>
            <View style={styles.cardInner}>
              {/* Front Face */}
              <RNAnimated.View style={[styles.card, styles.frontCard, { opacity: frontOpacity }]}>
                <View style={styles.frontContent}>
                  <View style={styles.frontImageWrapper}>
                    <Image
                      source={{ uri: memory.imageUrl }}
                      style={styles.image}
                      contentFit="cover"
                    />
                    <LinearGradient
                      colors={[
                        'rgba(255, 255, 255, 0.45)',
                        'rgba(255, 255, 255, 0.2)',
                        'rgba(255, 255, 255, 0)',
                      ]}
                      start={{ x: 0.2, y: 0.12 }}
                      end={{ x: 1, y: 0.65 }}
                      style={styles.frontGlossOverlay}
                    />
                    <View style={styles.tintOverlay} />
                    <Image
                      source={{ uri: NOISE_DATA_URI }}
                      style={styles.noiseOverlay}
                    />
                    <Image
                      source={lightLeakImage}
                      style={styles.lightLeakOverlay}
                      contentFit="cover"
                    />
                  </View>

                  <View style={styles.frontInfoBox}>
                    <Text style={styles.frontArtist} numberOfLines={2}>
                      {memory.artist}
                    </Text>
                    <Text style={styles.frontDate}>{formattedDate}</Text>
                    <Text style={styles.frontTapHint}>⤷ Tap to flip</Text>
                  </View>
                </View>
              </RNAnimated.View>

              {/* Back Face */}
              <RNAnimated.View style={[styles.card, styles.backCard, { opacity: backOpacity }]}>
                <View style={styles.backContent}>
                  <View style={styles.backHeader}>
                    <Text style={styles.backLabel}>SET LIST</Text>
                    <Text style={styles.backTitle}>{memory.artist}</Text>
                  </View>

                  <View style={styles.backMemoBox}>
                    <Text style={styles.backMemoText}>
                      {memory.detail || memory.memo}
                    </Text>
                  </View>

                  <View style={styles.backFooter}>
                    <Text style={styles.backFooterText}>{formattedDate}</Text>
                  </View>
                </View>
              </RNAnimated.View>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </SafeAreaView>
    </Modal>
  );

  return (
    <View>
      {renderListCard()}
      {renderFlipCard()}
    </View>
  );
};
