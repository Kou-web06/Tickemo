import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface AddCardButtonProps {
  width: number;
}

export const AddCardButton: React.FC<AddCardButtonProps> = ({ width }) => {
  const height = width * 0.366;

  return (
    <View style={[styles.container, { width, height }]}>
      <Ionicons name="add" size={44} color="#d1d1d1" />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed',
    backgroundColor: '#f7f7f7',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
