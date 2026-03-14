import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';

interface AddCardButtonProps {
  width: number;
}

export const AddCardButton: React.FC<AddCardButtonProps> = ({ width }) => {
  const height = width * 0.366; // Same ratio as TicketCard

  return (
    <View style={[styles.container, { width, height }]}>
      <Svg width={width} height={height} viewBox="0 0 322 118">
        {/* Main ticket shape with notches */}
        <Path
          d="M111 0C111 2.20914 112.791 4 115 4C117.209 4 119 2.20914 119 0H313.014C313.261 4.77874 317.04 8.62009 321.791 8.9707V108.028C316.876 108.391 313 112.492 313 117.5C313 117.668 313.005 117.834 313.014 118H118.874C118.956 117.68 119 117.345 119 117C119 114.791 117.209 113 115 113C112.791 113 111 114.791 111 117C111 117.345 111.044 117.68 111.126 118H9C9 113.029 4.97056 109 0 109V8.98633C0.165593 8.99492 0.33227 9 0.5 9C5.57897 9 9.7263 5.01426 9.98633 0H111ZM115 100C112.791 100 111 101.791 111 104C111 106.209 112.791 108 115 108C117.209 108 119 106.209 119 104C119 101.791 117.209 100 115 100ZM115 87C112.791 87 111 88.7909 111 91C111 93.2091 112.791 95 115 95C117.209 95 119 93.2091 119 91C119 88.7909 117.209 87 115 87ZM115 74C112.791 74 111 75.7909 111 78C111 80.2091 112.791 82 115 82C117.209 82 119 80.2091 119 78C119 75.7909 117.209 74 115 74ZM115 61C112.791 61 111 62.7909 111 65C111 67.2091 112.791 69 115 69C117.209 69 119 67.2091 119 65C119 62.7909 117.209 61 115 61ZM115 48C112.791 48 111 49.7909 111 52C111 54.2091 112.791 56 115 56C117.209 56 119 54.2091 119 52C119 49.7909 117.209 48 115 48ZM115 35C112.791 35 111 36.7909 111 39C111 41.2091 112.791 43 115 43C117.209 43 119 41.2091 119 39C119 36.7909 117.209 35 115 35ZM115 22C112.791 22 111 23.7909 111 26C111 28.2091 112.791 30 115 30C117.209 30 119 28.2091 119 26C119 23.7909 117.209 22 115 22ZM115 9C112.791 9 111 10.7909 111 13C111 15.2091 112.791 17 115 17C117.209 17 119 15.2091 119 13C119 10.7909 117.209 9 115 9Z"
          fill="#e6e6e6"
        />
      </Svg>

      {/* Content overlay */}
      <View style={[styles.contentContainer, { height }]}>
        <View style={styles.plusContainer}>
          <Ionicons name="add" size={60} color="#d1d1d1" />
        </View>
      </View>

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.20,
    shadowRadius: 8,
    elevation: 5,
  },
  contentContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 220,
    justifyContent: 'center',
    alignItems: 'center',
  },
  plusContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
