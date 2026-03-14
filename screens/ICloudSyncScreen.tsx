import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { AntDesign, Ionicons } from '@expo/vector-icons';
import { useCloudSync } from '../hooks/useCloudSync';
import { useTranslation } from 'react-i18next';

interface ICloudSyncScreenProps {
  navigation: any;
}

export default function ICloudSyncScreen({ navigation }: ICloudSyncScreenProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { isSyncing, lastSyncTime, forceSync } = useCloudSync();
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const handleManualSync = async () => {
    setIsManualSyncing(true);
    try {
      await forceSync();
    } catch (error) {
      console.log('[ICloudSyncScreen] Manual sync failed:', error);
    } finally {
      setIsManualSyncing(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    handleManualSync();
  };

  const formatLastSyncTime = () => {
    if (!lastSyncTime) return t('icloudSync.notSynced');
    const date = new Date(lastSyncTime);
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    const hours = `${date.getHours()}`.padStart(2, '0');
    const minutes = `${date.getMinutes()}`.padStart(2, '0');
    return `${year}/${month}/${day} ${hours}:${minutes}`;
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      {/* ヘッダー */}
      <BlurView tint="light" intensity={80} style={[styles.glassHeader, { paddingTop: Math.max(insets.top, 12) }]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={28} color="#000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('icloudSync.title')}</Text>
          <View style={styles.headerSpacer} />
        </View>
      </BlurView>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            tintColor="#888"
          />
        }
      >
        {/* ステータスカード */}
        <View style={styles.statusCard}>
          <View style={styles.statusCardContent}>
            <Text style={styles.statusLabel}>{t('icloudSync.statusLabel')}</Text>
            <View style={styles.statusIndicator}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>{t('icloudSync.statusSynced')}</Text>
            </View>
          </View>
        </View>

        {/* 説明テキスト */}
        <Text style={styles.descriptionText}>{t('icloudSync.description')}</Text>

        {/* 最終同期日時 */}
        <View style={styles.syncTimeCardContainer}>
          <Text style={styles.syncTimeLabel}>{t('icloudSync.lastSync')}: {formatLastSyncTime()}</Text>
        </View>

        {/* 手動同期ボタン */}
        <TouchableOpacity
          style={[styles.syncButton, (isManualSyncing || isSyncing) && styles.syncButtonDisabled]}
          onPress={handleManualSync}
          disabled={isManualSyncing || isSyncing}
          activeOpacity={0.7}
        >
          {isManualSyncing || isSyncing ? (
            <>
              <ActivityIndicator color="#666" size="small" />
              <Text style={styles.syncButtonText}>{t('icloudSync.syncing')}</Text>
            </>
          ) : (
            <>
              <AntDesign name="cloud-sync" size={18} color="#666" />
              <Text style={styles.syncButtonText}>{t('icloudSync.syncNow')}</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  glassHeader: {
    backgroundColor: 'rgba(248, 248, 248, 0.62)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.45)',
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    letterSpacing: -0.5,
  },
  headerSpacer: {
    width: 44,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  statusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    paddingHorizontal: 18,
    paddingVertical: 18,
    marginBottom: 24,
    shadowColor: '#5d5d5d',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 3,
  },
  statusCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#34C759',
    shadowColor: '#34C759',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
    elevation: 2,
  },
  statusText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
  },
  descriptionText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#888',
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  syncTimeCardContainer: {
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  syncTimeLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#999',
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    paddingVertical: 14,
    marginBottom: 40,
    shadowColor: '#5d5d5d',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 3,
  },
  syncButtonDisabled: {
    opacity: 0.6,
  },
  syncButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666',
  },
});
