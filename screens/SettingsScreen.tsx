import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { theme } from '../theme';
import { useTabBar } from '../contexts/TabBarContext';
import { useRecords } from '../contexts/RecordsContext';
import DataCarousel from '../components/DataCarousel';
import BasicSlide from '../components/BasicSlide';
import HeatmapSlide from '../components/HeatmapSlide';
import StatusSvgDisplay from '../components/StatusSvgDisplay';

interface SettingItem {
  id: string;
  label: string;
  value?: string;
  destructive?: boolean;
}

interface SettingSection {
  title: string;
  data: SettingItem[];
}

// SVGアセットルート
// Note: statusSvgUrisをはcontent内のuseMemoで管理し、レンダリング時の总次訴がその時だけならうえで

const SECTIONS: SettingSection[] = [
  {
    title: 'アカウント管理',
    data: [
      { id: 'delete', label: 'アカウント削除', destructive: true },
    ],
  },
  {
    title: 'サポート',
    data: [
      { id: 'review', label: '5つ星レビューをお願いします' },
      { id: 'feedback', label: 'ヘルプ・フィードバック' },
      { id: 'sns', label: '開発者SNS' },
    ],
  },
];

const APP_ICONS = [
  { id: 'icon1', image: require('../assets/app-icon/icon1.png') },
  { id: 'icon2', image: require('../assets/app-icon/icon2.png') },
  { id: 'icon3', image: require('../assets/app-icon/icon3.png') },
  { id: 'icon4', image: require('../assets/app-icon/icon4.png') },
];

export default function SettingsScreen({ navigation }: any) {
  const { setTabBarVisible } = useTabBar();
  const { records, clearRecords } = useRecords();
  const [selectedIcon, setSelectedIcon] = useState<string>('icon1');

  // 統計情報
  const stats = useMemo(() => {
    const formatDate = (dateStr: string) => {
      if (!dateStr) return '';
      const parsed = new Date(dateStr.replace(/\./g, '-'));
      if (Number.isNaN(parsed.getTime())) return dateStr;
      const y = parsed.getFullYear();
      const m = `${parsed.getMonth() + 1}`.padStart(2, '0');
      const d = `${parsed.getDate()}`.padStart(2, '0');
      return `${y}.${m}.${d}`;
    };

    // 現在の日付より前の記録のみをフィルタ
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const pastRecords = records.filter((record) => {
      const recordDate = new Date(record.date.replace(/\./g, '-'));
      recordDate.setHours(0, 0, 0, 0);
      return recordDate < today;
    });

    const totalCheckIns = pastRecords.length;
    
    let daysSinceStart = 0;
    let sinceDate = '';
    if (pastRecords.length > 0) {
      const oldestRecord = pastRecords[pastRecords.length - 1];
      sinceDate = formatDate(oldestRecord.date);
      const startDate = new Date(formatDate(oldestRecord.date).replace(/\./g, '-'));
      const diffTime = Math.abs(today.getTime() - startDate.getTime());
      daysSinceStart = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    let fanLevel = 'ROOKIE';
    let nextLevel = 'EXPERT';
    let remainingLives = 5;
    let progressPercentage = 0;
    
    if (totalCheckIns >= 15) {
      fanLevel = 'LEGEND';
      nextLevel = 'LEGEND';
      remainingLives = 0;
      progressPercentage = 100;
    } else if (totalCheckIns >= 10) {
      fanLevel = 'MASTER';
      nextLevel = 'LEGEND';
      remainingLives = 15 - totalCheckIns;
      progressPercentage = ((totalCheckIns - 10) / 5) * 100;
    } else if (totalCheckIns >= 5) {
      fanLevel = 'EXPERT';
      nextLevel = 'MASTER';
      remainingLives = 10 - totalCheckIns;
      progressPercentage = ((totalCheckIns - 5) / 5) * 100;
    } else {
      fanLevel = 'ROOKIE';
      nextLevel = 'EXPERT';
      remainingLives = 5 - totalCheckIns;
      progressPercentage = (totalCheckIns / 5) * 100;
    }

    // アーティストごとの参戦回数を集計
    const artistCounts: { [key: string]: number } = {};
    pastRecords.forEach((record) => {
      const artist = record.artist || '不明';
      artistCounts[artist] = (artistCounts[artist] || 0) + 1;
    });

    // 最多参戦アーティストを特定
    let topArtist = '';
    let topArtistCount = 0;
    Object.entries(artistCounts).forEach(([artist, count]) => {
      if (count > topArtistCount) {
        topArtist = artist;
        topArtistCount = count;
      }
    });

    return {
      totalCheckIns,
      days: daysSinceStart,
      sinceDate,
      fanLevel,
      nextLevel,
      remainingLives,
      progressPercentage,
      pastRecords,
      topArtist,
      topArtistCount,
    };
  }, [records]);

  useEffect(() => {
    setTabBarVisible(false);
    loadSelectedIcon();
    return () => {
      setTabBarVisible(true);
    };
  }, []);

  const loadSelectedIcon = async () => {
    try {
      const saved = await AsyncStorage.getItem('selectedAppIcon');
      if (saved) {
        setSelectedIcon(saved);
      }
    } catch (error) {
      console.log('Failed to load icon:', error);
    }
  };

  const handleIconSelect = async (iconId: string) => {
    try {
      await AsyncStorage.setItem('selectedAppIcon', iconId);
      setSelectedIcon(iconId);
      // Note: 実際のアプリアイコン変更はExpoの設定やネイティブコードが必要
      // この実装では選択状態の保存のみ
    } catch (error) {
      console.log('Failed to save icon:', error);
    }
  };

  const handleAccountDelete = () => {
    Alert.alert(
      'アカウント削除',
      'これまでの記録と設定がすべて削除されます。本当に削除しますか？',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除する',
          style: 'destructive',
          onPress: async () => {
            try {
              clearRecords();
              await AsyncStorage.multiRemove(['@records', 'selectedAppIcon']);
              navigation.goBack();
            } catch (error) {
              console.log('Failed to delete account:', error);
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={28} color="#000000" />
        </TouchableOpacity>
        <View style={styles.headerSpacer} />
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
        <Text style={styles.title}>マイページ</Text>

        {/* レベルカード */}
        <View style={styles.levelCardContainer}>
          <View style={styles.levelCard}>
            <View style={styles.levelCardContent}>
              <View style={styles.levelInfo}>
                <Text style={styles.levelName}>{stats.fanLevel}</Text>
                {stats.fanLevel !== 'LEGEND' && (
                  <>
                    <Text style={styles.nextLevelText}>次のランクまで {stats.remainingLives} Live</Text>
                    <View style={styles.progressBarContainer}>
                      <View style={styles.progressBarBackground}>
                        <View
                          style={[
                            styles.progressBarFill,
                            { width: `${stats.progressPercentage}%` },
                          ]}
                        />
                      </View>
                    </View>
                  </>
                )}
              </View>
              <StatusSvgDisplay 
                fanLevel={stats.fanLevel as 'ROOKIE' | 'EXPERT' | 'MASTER' | 'LEGEND'}
                style={styles.levelCardImage}
              />
            </View>
          </View>
        </View>

        {/* データセクション - カルーセル */}
        <View style={styles.sectionWrapper}>
          <Text style={styles.sectionLabel}>データ</Text>
          <DataCarousel>
            <BasicSlide
              totalCheckIns={stats.totalCheckIns}
              sinceDate={stats.sinceDate}
              topArtist={stats.topArtist}
              topArtistCount={stats.topArtistCount}
            />
            <HeatmapSlide records={stats.pastRecords} />
          </DataCarousel>
        </View>

        {/* アプリアイコン変更セクション */}
        <View style={styles.sectionWrapper}>
          <Text style={styles.sectionLabel}>アプリアイコン</Text>
          <View style={styles.iconCard}>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.iconGrid}
            >
              {APP_ICONS.map((icon) => (
                <TouchableOpacity
                  key={icon.id}
                  style={[
                    styles.iconItem,
                    selectedIcon === icon.id && styles.iconItemSelected,
                  ]}
                  onPress={() => handleIconSelect(icon.id)}
                  activeOpacity={0.7}
                >
                  <Image source={icon.image} style={styles.iconImage} />
                  {selectedIcon === icon.id && (
                    <View style={styles.checkmarkContainer}>
                      <Ionicons name="checkmark-circle" size={24} color="#FF0099" />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>

        {SECTIONS.map((section) => (
          <View key={section.title} style={styles.sectionWrapper}>
            <Text style={styles.sectionLabel}>{section.title}</Text>
            <View style={styles.card}>
              {section.data.map((item, index) => {
                const isLast = index === section.data.length - 1;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.row, isLast && styles.rowLast]}
                    activeOpacity={0.7}
                    onPress={() => {
                      if (item.id === 'delete') {
                        handleAccountDelete();
                      }
                    }}
                  >
                    <Text
                      style={[
                        styles.rowLabel,
                        item.destructive && styles.rowLabelDestructive,
                      ]}
                    >
                      {item.label}
                    </Text>
                    <View style={styles.rowRight}>
                      {item.value && <Text style={styles.rowValue}>{item.value}</Text>}
                      {!item.destructive && (
                        <Feather name="chevron-right" size={20} color="#C7C7CC" />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}

        <View style={styles.footer}>
          <Image source={require('../assets/logo.simple.png')} style={styles.footerLogo} />
          <View style={{ alignItems: 'flex-start' }}>
            <Text style={styles.version}>Tickemo</Text>
            <Text style={styles.version}>バージョン0.0.1</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F8F8',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 3,
    paddingTop: 50,
    backgroundColor: '#F8F8F8',
  },
  backButton: {
    padding: 2,
    backgroundColor: 'transparent',
  },
  headerSpacer: {
    width: 44,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 50,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#000000',
    marginBottom: 50,
    letterSpacing: -0.5,
  },
  levelCardContainer: {
    alignItems: 'center',
    marginBottom: 15,
  },
  levelCard: {
    position: 'relative',
    width: '100%',
    height: 120,
    backgroundColor: '#171714',
    borderRadius: 30,
    borderWidth: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 30,
    paddingVertical: 16,
  },
  levelCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: '100%',
  },
  levelInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  levelName: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  nextLevelText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#CCCCCC',
    marginBottom: 8,
  },
  progressBarContainer: {
    width: '50%',
  },
  progressBarBackground: {
    height: 8,
    backgroundColor: '#404038',
    borderRadius: 10,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
  },
  levelCardImage: {
    position: 'absolute',
    bottom: -18,
    right: -24,
    width: 110,
    height: 110,
    resizeMode: 'contain',
  },

  sectionWrapper: {
    marginTop: 28,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '400',
    color: '#999999',
    marginBottom: 20,
    marginLeft: 4,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    shadowColor: '#d2d2d2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 8,
  },
  iconCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    shadowColor: '#d2d2d2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 8,
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  iconGrid: {
    flexDirection: 'row',
    gap: 18,
    paddingHorizontal: 1,
  },
  iconItem: {
    width: 80,
    height: 80,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#F5F5F5',
  },
  iconItemSelected: {
    borderWidth: 3,
    borderColor: '#FF0099',
  },
  iconImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  checkmarkContainer: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E8E8E8',
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  rowLabelDestructive: {
    color: '#FF3B30',
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowValue: {
    fontSize: 16,
    color: '#8E8E93',
    marginRight: 6,
  },
  footer: {
    flexDirection: 'row',
    marginTop: 80,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  footerLogo: {
    width: 28,
    height: 28,
    resizeMode: 'contain',
    opacity: 0.6,
  },
  version: {
    fontSize: 11,
    color: '#8E8E93',
    lineHeight: 14,
  },
});
