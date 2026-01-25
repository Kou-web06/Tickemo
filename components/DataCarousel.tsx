import React, { useState, useRef } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width - 40; // padding を考慮

interface DataCarouselProps {
  children: React.ReactNode[];
}

export default function DataCarousel({ children }: DataCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const currentIndex = Math.round(contentOffsetX / CARD_WIDTH);
    setActiveIndex(Math.min(currentIndex, children.length - 1));
  };

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        scrollEventThrottle={16}
        onScroll={handleScroll}
        showsHorizontalScrollIndicator={false}
        style={styles.scrollView}
      >
        {React.Children.map(children, (child, index) => (
          <View key={index} style={{ width: CARD_WIDTH }}>
            {child}
          </View>
        ))}
      </ScrollView>

      {/* ページネーションドット */}
      <View style={styles.paginationContainer}>
        {React.Children.map(children, (_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              {
                backgroundColor: activeIndex === index ? '#FFFFFF' : '#D0D0D0',
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  scrollView: {
    marginHorizontal: 0,
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    marginBottom: 0,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
});
