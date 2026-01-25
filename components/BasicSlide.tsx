import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width - 40;

interface BasicSlideProps {
  totalCheckIns: number;
  sinceDate: string;
  topArtist: string;
  topArtistCount: number;
}

export default function BasicSlide({
  totalCheckIns,
  sinceDate,
  topArtist,
  topArtistCount,
}: BasicSlideProps) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>基本情報</Text>
      </View>

      <View style={styles.mainSection}>
        <View style={styles.mainContent}>
          <Text style={styles.mainLabel}>総参戦数</Text>
          <Text style={styles.mainValue}>{totalCheckIns}</Text>
          <Text style={styles.mainUnit}>Lives</Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.subSection}>
        <View style={styles.subItem}>
          <Text style={styles.subLabel}>初参戦</Text>
          <Text style={styles.subValue}>{sinceDate || '—'}</Text>
        </View>
        <View style={styles.subDivider} />
        <View style={styles.subItem}>
          <Text style={styles.subLabel}>最多参戦</Text>
          <Text style={[styles.subValue, (topArtist || '').length > 10 && {fontSize: 14}]}>{topArtist || '—'}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 3,
    shadowColor: '#d2d2d2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 8,
    height: 300,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
    letterSpacing: 0.5,
  },
  mainSection: {
    alignItems: 'center',
    paddingVertical: 10,
    minHeight: 120,
  },
  mainContent: {
    alignItems: 'center',
  },
  mainLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#8E8E93',
    marginBottom: 12,
  },
  mainValue: {
    fontSize: 80,
    fontWeight: '900',
    color: '#000000',
    lineHeight: 80,
  },
  mainUnit: {
    fontSize: 12,
    fontWeight: '500',
    color: '#8E8E93',
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#E8E8E8',
    marginVertical: 16,
  },
  subSection: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  subItem: {
    flex: 1,
    alignItems: 'center',
  },
  subLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#8E8E93',
    marginBottom: 4,
  },
  subValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#000000',
  },
  subUnit: {
    fontSize: 10,
    fontWeight: '500',
    color: '#8E8E93',
    marginTop: 2,
  },
  subDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#E8E8E8',
    marginHorizontal: 12,
  },
});
