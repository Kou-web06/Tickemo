import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { View, FlatList, TouchableOpacity, Alert, StyleSheet, Text, TextInput, ScrollView, Modal, Animated, ActivityIndicator, useWindowDimensions, ImageBackground, Linking, Easing, LayoutAnimation, UIManager, Platform, Keyboard, DeviceEventEmitter } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, Ionicons, MaterialIcons } from '@expo/vector-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { Tap03Icon, Search01Icon, LayoutGridIcon, LeftToRightListDashIcon, CalendarAdd01Icon, Ticket01Icon, UserMultiple02Icon } from '@hugeicons/core-free-icons';
import QRCode from 'react-native-qrcode-svg';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TicketCard } from '../components/TicketCard';
import { TicketDetail } from '../components/TicketDetail';
import SettingsScreen, { MusicProviderScreen } from './SettingsScreen';
import ProfileEditScreen from './ProfileEditScreen';
import LiveEditScreen from './LiveEditScreen';
import PaywallScreen from './PaywallScreen';
import { theme } from '../theme';
import { useRecords, ChekiRecord } from '../contexts/RecordsContext';
import { useAppStore } from '../store/useAppStore';
import { uploadImage, normalizeStoredImageUri, resolveLocalImageUri, deleteImage } from '../lib/imageUpload';
import { saveSetlist } from '../lib/setlistDb';
import { buildSpotifyCommunityFallbackUrl, searchSpotifyTrackId } from '../utils/spotifyApi';
import type { SetlistItem } from '../types/setlist';
import { getArtworkUrl, searchAppleMusicSongs, AppleMusicSong, getAppleMusicSongUrl } from '../utils/appleMusicApi';
import { useTranslation } from 'react-i18next';
import { normalizeLiveType } from '../utils/liveType';
import { getAppWidth } from '../utils/layout';
import { useFonts, LINESeedJP_400Regular, LINESeedJP_700Bold, LINESeedJP_800ExtraBold } from '@expo-google-fonts/line-seed-jp';
import { ArtistGridItem } from '../components/ArtistGridItem';
import ArtistDetailScreen from './ArtistDetailScreen';
import { useTheme } from '../src/theme';
import { getCachedThemePreference, hydrateThemePreference } from '../lib/themePreference';

const Stack = createNativeStackNavigator();
const FREE_TICKET_LIMIT = 3;
const APPLE_MUSIC_DEVELOPER_TOKEN = 'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjMyTVlRNk5WOTYifQ.eyJpc3MiOiJRMkxMMkI3OTJWIiwiaWF0IjoxNzY5ODQ5MDA5LCJleHAiOjE3ODU0MDEwMDksImF1ZCI6Imh0dHBzOi8vYXBwbGVpZC5hcHBsZS5jb20iLCJzdWIiOiJtZWRpYS5jb20uYW5vbnltb3VzLlRpY2tlbW8ifQ.ect6vO1q3aC9XJVYCUBVLlTHaVEcZebm0-dVZ3ak6uglI33e1ra3qcwkawXaScFFcLB8sgX5TEcFEj9QGF1Z8A';

const MUSIC_PROVIDER_KEY = '@music_provider';

type MusicProvider = 'spotify' | 'apple';

const buildCollectionPalette = (isDarkMode: boolean) => ({
  screenBackground: isDarkMode ? '#121212' : '#F8F8F8',
  headerBackground: isDarkMode ? 'rgba(18, 18, 18, 0.74)' : 'rgba(248, 248, 248, 0.62)',
  headerBorder: 'transparent',
  primaryText: isDarkMode ? '#F5F5F7' : '#333333',
  secondaryText: isDarkMode ? '#B7B7C2' : '#777777',
  tertiaryText: isDarkMode ? '#8A8A94' : '#8A8A8A',
  searchFieldBackground: isDarkMode ? '#2A2A2F' : '#EBEBEB',
  emptyText: isDarkMode ? '#A1A1AA' : '#555555',
  modalSurface: isDarkMode ? 'rgba(34, 34, 39, 0.9)' : 'rgba(255, 255, 255, 0.5)',
  modalBorder: isDarkMode ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.3)',
  iconOnDark: isDarkMode ? '#F5F5F7' : '#000000',
  searchEmptyIcon: isDarkMode ? '#8F8F9A' : '#B4B4B4',
});

const seededRandom = (seed: number): number => {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
};

const normalizeArtistName = (value: string) => {
  return value
    .toLowerCase()
    .replace(/[\s・･·•]/g, '')
    .trim();
};

const getHistoryKey = (artistName?: string) => {
  const normalized = normalizeArtistName(artistName || 'unknown');
  return `@today_song_history:${normalized}`;
};

const getDailyPickKey = (artistName: string, dateKey: string) => {
  const normalized = normalizeArtistName(artistName || 'unknown');
  return `@today_song_pick:${normalized}:${dateKey}`;
};

const MAX_TODAY_SONG_HISTORY = 20;

const formatSongDuration = (durationInMillis?: number) => {
  if (!durationInMillis || durationInMillis <= 0) return '-';
  const totalSeconds = Math.floor(durationInMillis / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const formatReleaseDate = (releaseDate?: string) => {
  if (!releaseDate) return '-';
  const [year, month, day] = releaseDate.split('-');
  if (!year) return '-';
  if (!month || !day) return year;
  return `${year}.${month}.${day}`;
};

const isPersistedImageUri = (uri: string) => {
  return uri.startsWith('Tickemo/') || uri.startsWith('http://') || uri.startsWith('https://');
};

const sanitizeTicketPrice = (value: unknown): number | undefined => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === 'string') {
    const normalized = value
      .replace(/[０-９]/g, (digit) => String(digit.charCodeAt(0) - 0xfee0))
      .replace(/[^0-9]/g, '');
    if (!normalized) return undefined;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
};

const styles = StyleSheet.create({
  listContainer: {
    flex: 1,
    backgroundColor: '#F8F8F8',
    paddingHorizontal: 0,
  },
  glassHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    overflow: 'hidden',
    backgroundColor: 'rgba(248, 248, 248, 0.62)',
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
    paddingHorizontal: 24,
    paddingBottom: 5,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    marginBottom: 10,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  searchingHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchHeaderContent: {
    gap: 10,
  },
  inlineSearchField: {
    flex: 1,
    height: 40,
    marginTop: 2,
    backgroundColor: '#EBEBEB',
    borderRadius: 10,
    justifyContent: 'center',
  },
  inlineSearchInput: {
    flex: 1,
    height: 40,
    paddingHorizontal: 12,
    paddingRight: 34,
    fontSize: 16,
    color: '#333333',
    paddingVertical: 0,
  },
  searchClearButton: {
    position: 'absolute',
    right: 10,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchClearButtonText: {
    fontSize: 18,
    color: '#8A8A8A',
    lineHeight: 18,
  },
  cancelSearchText: {
    color: '#A226D9',
    fontWeight: 'bold',
    marginLeft: 12,
    fontSize: 16,
  },
  quickFilterWrap: {
    marginTop: 2,
  },
  quickFilterContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 8,
    rowGap: 8,
  },
  quickFilterChip: {
    minHeight: 30,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 30,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickFilterChipText: {
    fontSize: 12,
    letterSpacing: 0.8,
    fontFamily: Platform.select({
      ios: 'Menlo',
      android: 'monospace',
      default: 'monospace',
    }),
  },
  headerIconButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchEmptyStateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 120,
    gap: 12,
  },
  searchEmptyStateText: {
    fontSize: 15,
    color: '#777777',
    textAlign: 'center',
    fontFamily: 'LINESeedJP_400Regular',
  },
  gridColumnWrapper: {
    paddingHorizontal: 20,
    gap: 12,
  },
  artistColumnWrapper: {
    paddingHorizontal: 20,
    gap: 16,
  },
  gridItemShell: {
    marginBottom: 10,
  },
  gridJacketButton: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#ECECEC',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  gridJacketImage: {
    width: '100%',
    height: '100%',
  },
  gridJacketFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFEFEF',
  },
  gridAddTile: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFEFEF',
    borderWidth: 1,
    borderColor: '#E1E1E1',
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
  },
  headerButtonBlur: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 26,
    color: '#333333',
    fontFamily: 'LINESeedJP_800ExtraBold',
  },
  detailContainer: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
  },
  detailImageContainer: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: 80,
    paddingBottom: theme.spacing.sm,
  },
  detailImage: {
    width: '100%',
    aspectRatio: theme.card.aspectRatio,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.border.light,
  },
  detailForm: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: 20,
  },
  formGroup: {
    marginBottom: theme.spacing.xl,
  },
  formLabel: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.sm,
  },
  formInput: {
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    fontSize: theme.typography.fontSize.lg,
    color: theme.colors.text.primary,
    borderWidth: 1,
    borderColor: theme.colors.border.dark,
    ...theme.shadows.sm,
  },
  memoInput: {
    height: 120,
    paddingVertical: theme.spacing.md,
  },
  editButton: {
    backgroundColor: theme.colors.accent.primary,
    borderRadius: theme.borderRadius.sm,
    paddingVertical: theme.spacing.lg,
    alignItems: 'center',
    marginTop: theme.spacing.md,
    ...theme.shadows.md,
  },
  editButtonText: {
    color: theme.colors.text.primary,
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
  },
  imagePickerButton: {
    backgroundColor: theme.colors.accent.primary,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
    marginTop: theme.spacing.sm,
  },
  imagePickerButtonText: {
    color: theme.colors.text.primary,
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  datePickerModal: {
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.borderRadius.xl,
    width: '85%',
    maxHeight: '70%',
    ...theme.shadows.lg,
  },
  datePickerHeader: {
    padding: theme.spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.dark,
  },
  datePickerTitle: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.primary,
    textAlign: 'center',
  },
  datePickerContent: {
    flexDirection: 'row',
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  pickerColumn: {
    flex: 1,
    alignItems: 'center',
  },
  pickerLabel: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.sm,
  },
  pickerScroll: {
    maxHeight: 200,
    width: '100%',
  },
  pickerItem: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.sm,
    alignItems: 'center',
    borderRadius: theme.borderRadius.sm,
    marginVertical: 2,
  },
  pickerItemSelected: {
    backgroundColor: theme.colors.accent.primary,
  },
  pickerItemText: {
    fontSize: theme.typography.fontSize.lg,
    color: theme.colors.text.primary,
  },
  pickerItemTextSelected: {
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.primary,
  },
  datePickerActions: {
    flexDirection: 'row',
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border.dark,
  },
  datePickerButton: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
  },
  datePickerButtonCancel: {
    backgroundColor: theme.colors.border.dark,
  },
  datePickerButtonConfirm: {
    backgroundColor: theme.colors.accent.primary,
  },
  datePickerButtonTextCancel: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.text.secondary,
  },
  datePickerButtonTextConfirm: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.primary,
  },
  detailScreenContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 12,
    paddingHorizontal: 20,
    backgroundColor: '#000',
  },
  detailHeaderButton: {
    padding: 8,
    width: 44,
  },
  detailHeaderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
  },
  ticketDetailContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailScrollView: {
    flex: 1,
  },
  detailScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  detailSection: {
    marginBottom: 24,
  },
  detailSectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#999999',
    marginBottom: 8,
    marginLeft: 4,
  },
  detailInputContainer: {
    borderRadius: 25,
    backgroundColor: '#8315B1',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  detailInputBlur: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  detailInputText: {
    fontSize: 16,
    color: '#000',
  },
  detailImageWrapper: {
    borderRadius: 12,
    height: 280,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    overflow: 'hidden',
  },
  detailImageNew: {
    width: '100%',
    height: '100%',
  },
  addImagePickerButton: {
    borderRadius: 12,
    height: 150,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addImagePickerContent: {
    alignItems: 'center',
    gap: 12,
  },
  addImagePickerText: {
    fontSize: 14,
    color: '#999999',
  },
  addImagePreviewContainer: {
    alignItems: 'center',
    gap: 8,
    padding: 10,
  },
  addImagePreview: {
    width: 80,
    height: 90,
    borderRadius: 8,
  },
  addImagePreviewText: {
    fontSize: 12,
    color: '#999999',
  },
  addInput: {
    fontSize: 16,
    color: '#000',
  },
  addMultilineInput: {
    minHeight: 100,
  },
  addDateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  previewContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingTop: 140,
  },
  previewCloseButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  previewPolaroid: {
    backgroundColor: '#FFF',
    borderRadius: 35,
    padding: 5,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  previewImageWrapper: {
    width: '100%',
    aspectRatio: 0.75,
    borderRadius: 30,
    overflow: 'hidden',
    backgroundColor: '#F0F0F0',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewInfo: {
    marginTop: 20,
    marginBottom: 20,
    alignItems: 'center',
  },
  previewArtist: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 8,
    textAlign: 'center',
  },
  previewDate: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
  },
  previewDetailButton: {
    position: 'absolute',
    top: 60,
    right: 74,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  previewDetailButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
  flipCardContainer: {
    width: '100%',
    maxWidth: 400,
    aspectRatio: 0.8,
  },
  previewBackFace: {
    backgroundColor: '#FFF',
    borderRadius: 35,
    padding: 5,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  setListTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 16,
    textAlign: 'center',
  },
  setListScroll: {
    flex: 1,
  },
  setListContent: {
    paddingVertical: 8,
  },
  setListItem: {
    fontSize: 16,
    color: '#333',
    marginBottom: 12,
    paddingLeft: 8,
  },
  noSetList: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  cardInfoBelow: {
    marginBottom: theme.spacing.xxxl,
    paddingHorizontal: theme.spacing.xs,
  },
  cardLiveName: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: 900,
    color: theme.colors.text.secondary,
    textAlign: 'center',
  },
  backgroundImage: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  blurOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  vignetteOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  filterDropdownOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  filterDropdownContainer: {
    position: 'absolute',
    top: 60,
    right: 75,
    minWidth: 210,
  },
  filterDropdown: {
    borderRadius: 25,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderWidth: 0.1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.40,
    shadowRadius: 20,
    elevation: 10,
  },
  filterDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
  },
  filterDropdownItemText: {
    fontSize: 17,
    color: '#000',
    fontWeight: '400',
  },
  nextLiveSection: {
    marginBottom: 50,
  },
  nextLiveLabel: {
    fontSize: 15,
    fontFamily: 'LINESeedJP_800ExtraBold',
    color: '#333333',
    marginBottom: 12,
    marginHorizontal: 30,
  },
  nextLiveCard: {
    marginHorizontal: 20,
    height: 180,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#3B3B3B',
    position: 'relative',
  },
  nextLiveFace: {
    ...StyleSheet.absoluteFillObject,
    backfaceVisibility: 'hidden',
  },
  nextLiveFlipLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  nextLiveBackFace: {
    zIndex: 1,
  },
  nextLiveOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  nextLiveBackOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(16,16,16,0.66)',
  },
  nextLiveCardContent: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 18,
    justifyContent: 'space-between',
  },
  nextLiveTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontFamily: 'LINESeedJP_800ExtraBold',
    lineHeight: 40,
  },
  nextLiveArtist: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: 'LINESeedJP_400Regular',
    marginTop: 4,
    lineHeight: 17,
  },
  nextLiveMeta: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: 'LINESeedJP_700Bold',
    marginTop: 10,
    lineHeight: 19,
  },
  nextLiveCountdown: {
    fontSize: 34,
    fontWeight: 'bold',
    color: '#FFFFFF',
    lineHeight: 44,
    marginTop: 2,
  },
  nextLiveCountdownMessage: {
    fontSize: 28,
    lineHeight: 36,
  },
  nextLiveQrButton: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    width: 48,
    height: 48,
    backgroundColor: '#FFF',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextLiveFlipToggleButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  todaySongHeader: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'LINESeedJP_700Bold',
    letterSpacing: 0.4,
    marginBottom: 12,
  },
  todaySongRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  todaySongArtwork: {
    width: 52,
    height: 52,
    borderRadius: 8,
    backgroundColor: '#E9E9E9',
  },
  todaySongFallback: {
    width: 52,
    height: 52,
    borderRadius: 8,
    backgroundColor: '#ECECEC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  todaySongTextWrap: {
    flex: 1,
    marginLeft: 12,
  },
  todaySongTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: 'LINESeedJP_800ExtraBold',
    lineHeight: 28,
  },
  todaySongArtist: {
    color: '#E5E5E5',
    fontSize: 13,
    fontFamily: 'LINESeedJP_400Regular',
    marginTop: 4,
  },
  todaySongMetaGrid: {
    marginTop: 12,
    paddingRight: 108,
    rowGap: 6,
  },
  todaySongMetaRow: {
    flexDirection: 'row',
    columnGap: 14,
  },
  todaySongMetaItem: {
    flex: 1,
    minHeight: 28,
  },
  todaySongMetaLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 6,
    letterSpacing: 0.7,
    fontFamily: 'LINESeedJP_700Bold',
    textTransform: 'uppercase',
  },
  todaySongMetaValue: {
    color: 'rgba(255,255,255,0.86)',
    fontSize: 9,
    lineHeight: 14,
    fontFamily: 'LINESeedJP_400Regular',
    marginTop: 2,
  },
  appleMusicBadge: {
    position: 'absolute',
    right: 14,
    bottom: 14,
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: 30,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: 'rgba(12,12,12,0.38)',
  },
  todaySongProviderIcon: {
    width: 15,
    height: 15,
    marginRight: 6,
  },
  todaySongProviderText: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 10,
    fontFamily: 'LINESeedJP_700Bold',
    letterSpacing: 0.2,
  },
  todaySongProviderActionIcon: {
    marginLeft: 6,
  },
  sectionLeadLabelText: {
    color: '#343434',
    fontSize: 14,
    fontFamily: 'LINESeedJP_800ExtraBold',
    letterSpacing: 0.4,
    marginBottom: 12,
    marginLeft: 2,
  },
  emptyStateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 120,
  },
  emptyStateImage: {
    width: 120,
    height: 120,
    marginBottom: 24,
  },
  emptyStateSubtitle: {
    fontSize: 15,
    color: '#555555',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
    fontFamily: 'LINESeedJP_400Regular',
  },
  emptyStateTitle: {
    fontSize: 22,
    color: '#333333',
    textAlign: 'center',
    lineHeight: 30,
    marginBottom: 10,
    fontFamily: 'LINESeedJP_800ExtraBold',
  },
  emptyStateButton: {
    backgroundColor: '#A328DD',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 30,
    minWidth: 172,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'LINESeedJP_700Bold',
  },
  floatingAddButton: {
    position: 'absolute',
    right: 20,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#8F17C8',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    zIndex: 200,
  },
  floatingAddButtonDisabled: {
    backgroundColor: '#e6b6fc',
  },
});

const NextLiveCountdown: React.FC<{ date?: string; startTime?: string }> = React.memo(({ date, startTime }) => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timerId = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(timerId);
  }, []);

  const { text, isMessage } = useMemo(() => {
    if (!date) {
      return {
        text: '6 : 23 : 45 : 30',
        isMessage: false,
      };
    }

    const targetDate = new Date(date.replace(/\./g, '-'));
    const [hour, minute] = (startTime || '18:00')
      .split(':')
      .map((value) => Number(value));

    if (!Number.isNaN(hour)) {
      targetDate.setHours(hour, Number.isNaN(minute) ? 0 : minute, 0, 0);
    }

    const diff = targetDate.getTime() - now;
    if (diff <= 0) {
      return {
        text: 'see you next live !!',
        isMessage: true,
      };
    }

    const totalSeconds = Math.max(0, Math.floor(diff / 1000));
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return {
      text: `${days} : ${String(hours).padStart(2, '0')} : ${String(minutes).padStart(2, '0')} : ${String(seconds).padStart(2, '0')}`,
      isMessage: false,
    };
  }, [date, startTime, now]);

  return <Text style={[styles.nextLiveCountdown, isMessage && styles.nextLiveCountdownMessage]}>{text}</Text>;
});

interface ArtistItem {
  id: string;
  name: string;
  imageUri: string | null;
  showCount: number;
  latestDate: string;
  latestDateTs: number;
}

type QuickFilterKey = 'year-current' | 'upcoming' | 'archive' | 'one-man';

const ListScreen: React.FC<{ navigation: any; records: ChekiRecord[]; addNewRecord: (record: ChekiRecord) => Promise<void>; deleteRecord: (id: string) => Promise<void>; isPremium: boolean }> = ({ navigation, records, addNewRecord, deleteRecord, isPremium }) => {
  const { t, i18n } = useTranslation();
  const { isDark: isSystemDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const setlists = useAppStore((state) => state.setlists);
  const [fontsLoaded] = useFonts({
    LINESeedJP_400Regular,
    LINESeedJP_700Bold,
    LINESeedJP_800ExtraBold,
  });
  const [selectedRecord, setSelectedRecord] = useState<ChekiRecord | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'upcoming' | 'past'>('all');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [isGridLayout, setIsGridLayout] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeQuickFilter, setActiveQuickFilter] = useState<QuickFilterKey | null>(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [isListAnimating, setIsListAnimating] = useState(false);
  const [isNextLiveFlipped, setIsNextLiveFlipped] = useState(false);
  const [isOpeningTodaySongCta, setIsOpeningTodaySongCta] = useState(false);
  const [todaySongForNextLive, setTodaySongForNextLive] = useState<AppleMusicSong | null>(null);
  const [musicProvider, setMusicProvider] = useState<MusicProvider>('spotify');
  const [manualDarkMode, setManualDarkMode] = useState<boolean | null | undefined>(() => getCachedThemePreference());
  const itemAnimations = useRef(new Map<string, Animated.Value>()).current;
  const nextLiveFlipAnim = useRef(new Animated.Value(0)).current;
  const nextLiveFlippedRef = useRef(false);
  const didInitialListAnimation = useRef(false);
  const prevFilterType = useRef(filterType);
  const prefetchedCollectionImageUris = useRef(new Set<string>()).current;
  const renderCountRef = useRef(0);
  
  renderCountRef.current++;

  const loadThemePreference = useCallback(async () => {
    const value = await hydrateThemePreference();
    setManualDarkMode(value);
  }, []);

  useEffect(() => {
    void loadThemePreference();
  }, [loadThemePreference]);

  useFocusEffect(
    useCallback(() => {
      void loadThemePreference();
    }, [loadThemePreference])
  );

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('theme:changed', (nextValue?: boolean) => {
      if (typeof nextValue === 'boolean') {
        setManualDarkMode(nextValue);
      } else {
        void loadThemePreference();
      }
      setIsListAnimating(false);
      itemAnimations.forEach((value) => {
        value.setValue(1);
      });
    });

    return () => {
      subscription.remove();
    };
  }, [itemAnimations, loadThemePreference]);

  useEffect(() => {
    const loadMusicProvider = async () => {
      try {
        const stored = await AsyncStorage.getItem(MUSIC_PROVIDER_KEY);
        if (stored === 'spotify' || stored === 'apple') {
          setMusicProvider(stored);
          return;
        }
        setMusicProvider('spotify');
      } catch {
        setMusicProvider('spotify');
      }
    };

    void loadMusicProvider();

    const subscription = DeviceEventEmitter.addListener('music-provider:changed', (nextValue?: MusicProvider) => {
      if (nextValue === 'spotify' || nextValue === 'apple') {
        setMusicProvider(nextValue);
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const isDarkMode = manualDarkMode ?? false;
  const palette = useMemo(() => buildCollectionPalette(isDarkMode), [isDarkMode]);

  useEffect(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  useEffect(() => {
    const preloadCollectionImages = async () => {
      try {
        const nextUris: string[] = [];
        records.forEach((record) => {
          if (record.imageUrls && Array.isArray(record.imageUrls)) {
            record.imageUrls.forEach((uri) => {
              if (uri && !uri.startsWith('file://') && !prefetchedCollectionImageUris.has(uri)) {
                prefetchedCollectionImageUris.add(uri);
                nextUris.push(uri);
              }
            });
          }
        });

        if (nextUris.length === 0) return;

        await Image.prefetch(nextUris);
      } catch (error) {
        // Image preload failed, continue
      }
    };

    preloadCollectionImages();
  }, [records, prefetchedCollectionImageUris]);

  const screenWidth = getAppWidth();
  const PADDING = Math.min(Math.max(windowWidth * 0.06, 16), 28);
  const cardWidth = screenWidth - PADDING * 2;
  const gridGap = 12;
  const gridHorizontalPadding = 20;
  const gridColumns = 3;
  const gridCardWidth = Math.floor((screenWidth - gridHorizontalPadding * 2 - gridGap * (gridColumns - 1)) / gridColumns);
  const currentCardWidth = isGridLayout ? gridCardWidth : cardWidth;
  const artistGridGap = 16;
  const artistCardWidth = Math.floor((screenWidth - gridHorizontalPadding * 2 - artistGridGap) / 2);
  const headerMarginTop = insets.top + windowHeight * -0.045;
  const headerButtonSize = Math.min(46, Math.max(40, windowWidth * 0.11));
  const headerButtonRadius = headerButtonSize / 2;
  const listBottomPadding = insets.bottom + windowHeight * 0.15;
  const floatingAddBottom = insets.bottom + 80;
  const isAddLimitReached = !isPremium && records.length >= FREE_TICKET_LIMIT;
  const filterTop = insets.top + windowHeight * 0.10;
  const filterRight = windowWidth * 0.2;
  const emptyImageSize = Math.min(150, windowWidth * 0.38);
  const fallbackHeaderHeight = insets.top + (isSearching ? 152 : 68);
  const headerContentPaddingTop = Math.max(headerHeight + (isSearching ? 18 : 0), fallbackHeaderHeight);
  const currentYear = new Date().getFullYear();

  const quickFilterChips = useMemo(
    () => [
      { key: 'year-current' as const, label: `${currentYear}` },
      { key: 'upcoming' as const, label: '#UPCOMING' },
      { key: 'archive' as const, label: '#ARCHIVE' },
      { key: 'one-man' as const, label: 'ONE-MAN' },
    ],
    [currentYear]
  );

  const handleCardPress = (record: ChekiRecord) => {
    setSelectedRecord(record);
  };

  const handleCloseModal = () => {
    setSelectedRecord(null);
  };

  const handleAddPress = () => {
    if (!isPremium && records.length >= FREE_TICKET_LIMIT) {
      navigation.navigate('Paywall');
      return;
    }
    navigation.navigate('Add');
  };

  const handleSearchPress = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsSearching(true);
  }, []);

  const handleToggleLayoutPress = useCallback(() => {
    setIsGridLayout((prev) => !prev);
  }, []);

  const handleCancelSearch = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsSearching(false);
    setSearchQuery('');
    Keyboard.dismiss();
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
  }, []);

  const handleQuickFilterPress = useCallback((nextFilter: QuickFilterKey) => {
    setActiveQuickFilter((prev) => (prev === nextFilter ? null : nextFilter));
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {
      // Ignore haptics errors on unsupported devices.
    });
  }, []);

  const handleDuplicateRecord = async (record: ChekiRecord) => {
    if (!isPremium && records.length >= FREE_TICKET_LIMIT) {
      navigation.navigate('Paywall');
      return;
    }

    const newRecord: ChekiRecord = {
      ...record,
      id: Crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      imageUrls: record.imageUrls ? [...record.imageUrls] : [],
      imageAssetIds: record.imageAssetIds ? [...record.imageAssetIds] : [],
    };
    await addNewRecord(newRecord);
    setSelectedRecord(newRecord);
  };

  const handleDeleteRecord = async (record: ChekiRecord) => {
    await deleteRecord(record.id);
    if (selectedRecord?.id === record.id) {
      setSelectedRecord(null);
    }
  };

  const handleLongPress = (record: ChekiRecord) => {
    Alert.alert(
      t('collection.alerts.ticketActionTitle'),
      t('collection.alerts.ticketActionMessage'),
      [
        {
          text: t('collection.alerts.duplicate'),
          onPress: () => {
            void handleDuplicateRecord(record);
          },
        },
        {
          text: t('collection.alerts.delete'),
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              t('collection.alerts.deleteConfirmTitle'),
              t('collection.alerts.deleteConfirmMessage'),
              [
                { text: t('collection.alerts.cancel'), style: 'cancel' },
                {
                  text: t('collection.alerts.delete'),
                  style: 'destructive',
                  onPress: () => {
                    void handleDeleteRecord(record);
                  },
                },
              ]
            );
          },
        },
        { text: t('collection.alerts.cancel'), style: 'cancel' },
      ]
    );
  };
  // 日付文字列をタイムスタンプに変換
  const toTime = (record: ChekiRecord) => {
    if (!record?.date) return 0;
    const time = new Date(record.date.replace(/\./g, '-')).getTime();
    return Number.isNaN(time) ? 0 : time;
  };
  
  // フィルタリング処理
  const filterRecords = (records: ChekiRecord[]) => {
    const now = new Date();
    now.setHours(0, 0, 0, 0); // 今日の0時に正規化
    
    if (filterType === 'upcoming') {
      return records.filter(record => {
        const recordDate = new Date(record.date.replace(/\./g, '-'));
        recordDate.setHours(0, 0, 0, 0);
        return recordDate >= now;
      });
    } else if (filterType === 'past') {
      return records.filter(record => {
        const recordDate = new Date(record.date.replace(/\./g, '-'));
        recordDate.setHours(0, 0, 0, 0);
        return recordDate < now;
      });
    }
    return records; // allの場合
  };
  
  const sortedRecords = useMemo(() => [...records].sort((a, b) => toTime(b) - toTime(a)), [records]);
  const normalizedSearchQuery = useMemo(() => searchQuery.trim().toLowerCase(), [searchQuery]);

  const quickFilteredRecords = useMemo(() => {
    const baseRecords = filterRecords(sortedRecords);
    if (!activeQuickFilter) {
      return baseRecords;
    }

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    return baseRecords.filter((record) => {
      const recordDate = new Date(record.date.replace(/\./g, '-'));
      recordDate.setHours(0, 0, 0, 0);
      const normalizedLiveType = normalizeLiveType(record.liveType);

      if (activeQuickFilter === 'year-current') {
        return recordDate.getFullYear() === currentYear;
      }

      if (activeQuickFilter === 'upcoming') {
        return recordDate >= now;
      }

      if (activeQuickFilter === 'archive') {
        return recordDate < now;
      }

      if (activeQuickFilter === 'one-man') {
        return normalizedLiveType === 'one-man';
      }

      return true;
    });
  }, [activeQuickFilter, currentYear, filterType, sortedRecords]);

  const filteredRecords = useMemo(() => {
    const baseRecords = quickFilteredRecords;
    if (!normalizedSearchQuery) {
      return baseRecords;
    }

    return baseRecords.filter((record) => {
      const setlistMatches = (setlists[record.id] || []).some(
        (item) => item.type === 'song' && item.songName.toLowerCase().includes(normalizedSearchQuery)
      );
      const haystacks = [
        record.liveName,
        record.artist,
        ...(record.artists || []),
        record.venue,
        record.date,
        record.memo,
        record.detail,
      ];

      return setlistMatches || haystacks.some((value) => value?.toLowerCase().includes(normalizedSearchQuery));
    });
  }, [quickFilteredRecords, normalizedSearchQuery, setlists]);
  const nextLiveRecord = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcoming = records
      .filter((record) => {
        const time = toTime(record);
        return time > 0 && time >= today.getTime();
      })
      .sort((a, b) => toTime(a) - toTime(b));

    if (upcoming.length > 0) {
      return upcoming[0];
    }

    return sortedRecords[0] ?? null;
  }, [records, sortedRecords]);

  const nextLiveImageUri = useMemo(() => {
    const imageUri = nextLiveRecord?.imageUrls?.[0];
    if (!imageUri) return null;
    return resolveLocalImageUri(imageUri);
  }, [nextLiveRecord]);

  const isNextLivePast = useMemo(() => {
    if (!nextLiveRecord?.date) return false;

    const targetDate = new Date(nextLiveRecord.date.replace(/\./g, '-'));
    const [hour, minute] = (nextLiveRecord.startTime || '18:00')
      .split(':')
      .map((value) => Number(value));

    if (!Number.isNaN(hour)) {
      targetDate.setHours(hour, Number.isNaN(minute) ? 0 : minute, 0, 0);
    }

    return targetDate.getTime() - Date.now() <= 0;
  }, [nextLiveRecord]);

  useEffect(() => {
    let isActive = true;

    const fetchTodaySongForArtist = async () => {
      const artistName = nextLiveRecord?.artist?.trim();
      if (!artistName) {
        if (isActive) setTodaySongForNextLive(null);
        return;
      }

      try {
        const today = new Date();
        const dateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        const dailyPickKey = getDailyPickKey(artistName, dateKey);

        const cachedPick = await AsyncStorage.getItem(dailyPickKey);
        if (cachedPick) {
          const parsed = JSON.parse(cachedPick) as AppleMusicSong;
          if (parsed?.id) {
            if (isActive) setTodaySongForNextLive(parsed);
            return;
          }
        }

        const songs = await searchAppleMusicSongs(artistName, APPLE_MUSIC_DEVELOPER_TOKEN, 20);
        if (!isActive) return;

        if (songs.length === 0) {
          setTodaySongForNextLive(null);
          return;
        }

        const normalizedTarget = normalizeArtistName(artistName);
        const artistMatched = songs.filter((item) => {
          const normalizedArtist = normalizeArtistName(item.attributes.artistName || '');
          return normalizedArtist.includes(normalizedTarget) || normalizedTarget.includes(normalizedArtist);
        });

        const filteredSongs = artistMatched.length > 0 ? artistMatched : songs;

        const historyKey = getHistoryKey(artistName);
        const storedHistory = await AsyncStorage.getItem(historyKey);
        const history = storedHistory ? (JSON.parse(storedHistory) as string[]) : [];

        const freshCandidates = filteredSongs.filter((item) => !history.includes(item.id));
        const candidates = freshCandidates.length > 0 ? freshCandidates : filteredSongs;

        const seed = parseInt(dateKey.replace(/-/g, ''), 10);
        const shuffled = [...candidates]
          .map((item, index) => ({ item, score: seededRandom(seed + index * 13) }))
          .sort((a, b) => a.score - b.score)
          .map(({ item }) => item);

        const selectedSong = shuffled[0] || candidates[0] || null;
        if (!selectedSong) {
          setTodaySongForNextLive(null);
          return;
        }

        setTodaySongForNextLive(selectedSong);

        const nextHistory = [selectedSong.id, ...history.filter((id) => id !== selectedSong.id)].slice(0, MAX_TODAY_SONG_HISTORY);
        await AsyncStorage.setItem(historyKey, JSON.stringify(nextHistory));
        await AsyncStorage.setItem(dailyPickKey, JSON.stringify(selectedSong));
      } catch {
        if (isActive) setTodaySongForNextLive(null);
      }
    };

    setTodaySongForNextLive(null);
    void fetchTodaySongForArtist();

    return () => {
      isActive = false;
    };
  }, [nextLiveRecord?.artist, nextLiveRecord?.id]);

  const todaySongDisplay = useMemo(() => {
    if (!todaySongForNextLive) {
      return null;
    }

    const spotifyTrackIdCandidates = [
      nextLiveRecord?.detail,
      nextLiveRecord?.memo,
      nextLiveRecord?.qrCode,
    ]
      .filter((value): value is string => Boolean(value))
      .map((value) => {
        const webMatch = value.match(/open\.spotify\.com\/track\/([A-Za-z0-9]+)/i);
        if (webMatch?.[1]) return webMatch[1];
        const appMatch = value.match(/spotify:track:([A-Za-z0-9]+)/i);
        return appMatch?.[1] || '';
      })
      .filter((value) => value.length > 0);

    const spotifyTrackId = spotifyTrackIdCandidates[0] || undefined;

    return {
      title: todaySongForNextLive.attributes.name || 'Unknown song',
      artist: todaySongForNextLive.attributes.artistName || nextLiveRecord?.artist || '-',
      album: todaySongForNextLive.attributes.albumName || '-',
      genre: todaySongForNextLive.attributes.genreNames?.[0] || '-',
      duration: formatSongDuration(todaySongForNextLive.attributes.durationInMillis),
      releaseDate: formatReleaseDate(todaySongForNextLive.attributes.releaseDate),
      artworkUrl: todaySongForNextLive.attributes.artwork?.url
        ? getArtworkUrl(todaySongForNextLive.attributes.artwork.url, 200)
        : undefined,
      appleMusicUrl: todaySongForNextLive.id ? getAppleMusicSongUrl(todaySongForNextLive.id) : undefined,
      spotifyTrackId,
    };
  }, [nextLiveRecord?.artist, nextLiveRecord?.detail, nextLiveRecord?.memo, nextLiveRecord?.qrCode, todaySongForNextLive]);

  useEffect(() => {
    nextLiveFlippedRef.current = false;
    setIsNextLiveFlipped(false);
    nextLiveFlipAnim.setValue(0);
  }, [nextLiveRecord?.id, nextLiveFlipAnim]);

  // プレビュー用画像（カード背景/楽曲アートワーク）を先読み
  // 体感速度改善のため、表示前にキャッシュしておく
  useEffect(() => {
    const urls: string[] = [];
    if (nextLiveImageUri) urls.push(nextLiveImageUri);
    if (todaySongDisplay?.artworkUrl) urls.push(todaySongDisplay.artworkUrl);
    if (urls.length > 0) void Image.prefetch(urls);
  }, [nextLiveImageUri, todaySongDisplay?.artworkUrl]);

  const handleToggleNextLiveFlip = useCallback(() => {
    const nextFlipped = !nextLiveFlippedRef.current;
    const toValue = nextFlipped ? 1 : 0;
    nextLiveFlippedRef.current = nextFlipped;
    setIsNextLiveFlipped(nextFlipped);

    Animated.timing(nextLiveFlipAnim, {
      toValue,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [nextLiveFlipAnim]);

  const nextLiveFrontRotate = nextLiveFlipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const nextLiveBackRotate = nextLiveFlipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['180deg', '360deg'],
  });

  // Create display data
  const displayData = useMemo(() => {
    if (filteredRecords.length === 0) {
      return [{ id: 'empty-state' }];
    }
    return filteredRecords;
  }, [filteredRecords]);

  const firstSectionLabelRecordIds = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let firstUpcomingId: string | null = null;
    let firstArchiveId: string | null = null;

    filteredRecords.forEach((record) => {
      const recordDate = new Date((record.date || '').replace(/\./g, '-'));
      recordDate.setHours(0, 0, 0, 0);
      const ts = recordDate.getTime();
      if (!Number.isFinite(ts)) return;

      if (firstUpcomingId === null && ts >= today.getTime()) {
        firstUpcomingId = record.id;
      }

      if (firstArchiveId === null && ts < today.getTime()) {
        firstArchiveId = record.id;
      }
    });

    return { firstUpcomingId, firstArchiveId };
  }, [filteredRecords]);

  const artistGridData = useMemo((): ArtistItem[] => {
    if (!isGridLayout) return [];
    const nowTs = Date.now();

    const toLiveTimeWithStart = (record: ChekiRecord) => {
      if (!record?.date) return 0;

      const date = new Date(record.date.replace(/\./g, '-'));
      const [hour, minute] = (record.startTime || '').split(':').map((value) => Number(value));

      if (!Number.isNaN(hour)) {
        date.setHours(hour, Number.isNaN(minute) ? 0 : minute, 0, 0);
      } else {
        date.setHours(23, 59, 59, 999);
      }

      const ts = date.getTime();
      return Number.isFinite(ts) ? ts : 0;
    };

    const map = new Map<string, ArtistItem>();
    filteredRecords.forEach((record) => {
      const names =
        record.artists && record.artists.filter(Boolean).length > 0
          ? record.artists
          : [record.artist ?? ''];
      names.forEach((rawName) => {
        const name = rawName?.trim();
        if (!name) return;
        const key = name.toLowerCase();
        if (!map.has(key)) {
          const artistImgUrl = record.artistImageUrl?.trim();
          const chekiImgUrl = record.imageUrls?.[0];
          const resolvedUri = artistImgUrl
            ? resolveLocalImageUri(getArtworkUrl(artistImgUrl, 400))
            : chekiImgUrl
            ? resolveLocalImageUri(chekiImgUrl)
            : null;

          map.set(key, {
            id: key,
            name,
            imageUri: resolvedUri,
            showCount: 0,
            latestDate: '-',
            latestDateTs: 0,
          });
        }
        const artistItem = map.get(key)!;
        artistItem.showCount++;

        const currentRecordDateTs = toLiveTimeWithStart(record);
        if (currentRecordDateTs > 0 && currentRecordDateTs < nowTs && currentRecordDateTs > artistItem.latestDateTs) {
          artistItem.latestDateTs = currentRecordDateTs;
          artistItem.latestDate = record.date || '-';
        }
      });
    });
    return Array.from(map.values()).sort((a, b) => b.showCount - a.showCount);
  }, [isGridLayout, filteredRecords]);

  const handleOpenQrLink = useCallback(async () => {
    const url = nextLiveRecord?.qrCode?.trim();
    if (!url) return;

    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      Alert.alert('Unable to open', 'QR code URL is invalid.');
      return;
    }

    await Linking.openURL(url);
  }, [nextLiveRecord]);

  const handleOpenTodaySongLink = useCallback(async () => {
    if (musicProvider === 'spotify') {
      if (isOpeningTodaySongCta) return;
      setIsOpeningTodaySongCta(true);

      const songName = todaySongDisplay?.title || '';
      const artistName = todaySongDisplay?.artist || nextLiveRecord?.artist || '';

      try {
        const trackId = await searchSpotifyTrackId(songName, artistName);
        const fallbackTrackId = trackId || todaySongDisplay?.spotifyTrackId;

        if (!fallbackTrackId) {
          Alert.alert('Unable to open', 'Spotify track could not be found.');
          return;
        }

        const appUrl = `spotify:track:${fallbackTrackId}`;
        const webUrl = buildSpotifyCommunityFallbackUrl(fallbackTrackId);

        try {
          const canOpenApp = await Linking.canOpenURL(appUrl);
          if (canOpenApp) {
            await Linking.openURL(appUrl);
          } else {
            await Linking.openURL(webUrl);
          }
        } catch {
          await Linking.openURL(webUrl);
        }

        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {
          // Ignore haptics errors on unsupported devices.
        });
      } catch {
        const fallbackTrackId = todaySongDisplay?.spotifyTrackId;
        if (fallbackTrackId) {
          const webUrl = buildSpotifyCommunityFallbackUrl(fallbackTrackId);
          await Linking.openURL(webUrl);
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {
            // Ignore haptics errors on unsupported devices.
          });
        } else {
          Alert.alert('Unable to open', 'Spotify track could not be found.');
        }
      } finally {
        setIsOpeningTodaySongCta(false);
      }
      return;
    }

    const appleUrl = todaySongDisplay?.appleMusicUrl?.trim();
    if (!appleUrl) return;

    const canOpen = await Linking.canOpenURL(appleUrl);
    if (!canOpen) {
      Alert.alert('Unable to open', 'Apple Music URL is invalid.');
      return;
    }

    await Linking.openURL(appleUrl);
  }, [isOpeningTodaySongCta, musicProvider, nextLiveRecord?.artist, todaySongDisplay]);

  const todaySongProviderCta = useMemo(() => {
    const isSpotify = musicProvider === 'spotify';
    const iconSource = isSpotify ? require('../assets/spotify.webp') : require('../assets/apple.webp');
    const label = isSpotify ? 'Spotifyで聞く' : 'Apple Musicで聞く';
    const spotifyQuery = `${todaySongDisplay?.title || ''} ${todaySongDisplay?.artist || nextLiveRecord?.artist || ''}`.trim();
    const url = isSpotify
      ? (todaySongDisplay?.spotifyTrackId
        ? `https://open.spotify.com/track/${todaySongDisplay.spotifyTrackId}`
        : (spotifyQuery ? `https://open.spotify.com/search/${encodeURIComponent(spotifyQuery)}` : ''))
      : (todaySongDisplay?.appleMusicUrl?.trim() || '');

    const isEnabled = isSpotify
      ? Boolean(todaySongDisplay?.title || todaySongDisplay?.artist || nextLiveRecord?.artist)
      : Boolean(todaySongDisplay?.appleMusicUrl?.trim());

    return { iconSource, label, url, isEnabled };
  }, [musicProvider, nextLiveRecord?.artist, todaySongDisplay]);

  const getItemAnimation = (id: string) => {
    const existing = itemAnimations.get(id);
    if (existing) return existing;
    const value = new Animated.Value(1);
    itemAnimations.set(id, value);
    return value;
  };

  useEffect(() => {
    const ids = new Set(displayData.map((item) => item.id));
    itemAnimations.forEach((_, key) => {
      if (!ids.has(key)) {
        itemAnimations.delete(key);
      }
    });

    if (displayData.length === 0) {
      setIsListAnimating(false);
      return;
    }

    const filterChanged = prevFilterType.current !== filterType;
    prevFilterType.current = filterType;

    const shouldAnimate = !didInitialListAnimation.current;
    if (!shouldAnimate) {
      setIsListAnimating(false);
      displayData.forEach((item) => {
        getItemAnimation(item.id).setValue(1);
      });
      return;
    }

    didInitialListAnimation.current = true;
    setIsListAnimating(true);

    displayData.forEach((item) => {
      getItemAnimation(item.id).setValue(0);
    });

    const animations = displayData.map((item) =>
      Animated.timing(getItemAnimation(item.id), {
        toValue: 1,
        duration: 260,
        useNativeDriver: true,
      })
    );

    Animated.stagger(70, animations).start(() => {
      setIsListAnimating(false);
    });
  }, [displayData, itemAnimations, filterType]);

  if (!fontsLoaded) {
    return <View style={[styles.listContainer, { backgroundColor: palette.screenBackground }]} />;
  }

  const renderEmptyState = () => (
    <View style={styles.emptyStateContainer}>
      <Image
        source={require('../assets/ticketEmpty.png')}
        style={styles.emptyStateImage}
        contentFit="contain"
        transition={0}
      />
      <Text style={styles.emptyStateTitle}>{t('collection.emptyState.title')}</Text>
      <Text style={styles.emptyStateSubtitle}>
        {t('collection.emptyState.subtitle')}
      </Text>
      <TouchableOpacity style={styles.emptyStateButton} activeOpacity={0.9} onPress={handleAddPress}>
        <Text style={styles.emptyStateButtonText}>{t('collection.emptyState.cta')}</Text>
      </TouchableOpacity>
    </View>
  );

  const renderSearchEmptyState = () => (
    <View style={styles.searchEmptyStateContainer}>
      <MaterialIcons name="sentiment-dissatisfied" size={44} color={palette.searchEmptyIcon} />
      <Text style={[styles.searchEmptyStateText, { color: palette.secondaryText }]}>この条件のライブ記録は見つかりません</Text>
    </View>
  );

  return (
    <SafeAreaView style={[styles.listContainer, { backgroundColor: palette.screenBackground }]} edges={['left', 'right', 'bottom']}> 
      <BlurView
        tint={isDarkMode ? 'dark' : 'light'}
        intensity={80}
        style={[
          styles.glassHeader,
          {
            paddingTop: insets.top + 10,
            backgroundColor: palette.headerBackground,
            borderBottomColor: palette.headerBorder,
          },
        ]}
        onLayout={(event) => {
          const nextHeight = Math.ceil(event.nativeEvent.layout.height);
          setHeaderHeight((prev) => (prev === nextHeight ? prev : nextHeight));
        }}
      >
        {isSearching ? (
          <View style={styles.searchHeaderContent}>
            <View style={styles.searchingHeaderContainer}>
              <View style={[styles.inlineSearchField, { backgroundColor: palette.searchFieldBackground }]}>
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="アーティスト、会場、曲名で検索..."
                  placeholderTextColor={palette.tertiaryText}
                  style={[styles.inlineSearchInput, { color: palette.primaryText }]}
                  autoFocus={true}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="search"
                />
                {searchQuery.length > 0 ? (
                  <TouchableOpacity style={styles.searchClearButton} onPress={handleClearSearch} activeOpacity={0.7}>
                    <Text style={[styles.searchClearButtonText, { color: palette.tertiaryText }]}>×</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              <TouchableOpacity onPress={handleCancelSearch} activeOpacity={0.7}>
                <Text style={[styles.cancelSearchText, { color: '#A226D9' }]}>キャンセル</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.quickFilterWrap}>
              <View style={styles.quickFilterContent}>
              {quickFilterChips.map((chip) => {
                const isActive = activeQuickFilter === chip.key;
                return (
                  <TouchableOpacity
                    key={chip.key}
                    activeOpacity={0.75}
                    onPress={() => handleQuickFilterPress(chip.key)}
                    style={[
                      styles.quickFilterChip,
                      {
                        borderColor: isActive ? '#A226D9' : palette.secondaryText,
                        backgroundColor: isActive ? '#A226D9' : 'transparent',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.quickFilterChipText,
                        {
                          color: isActive ? '#F8F8F8' : palette.secondaryText,
                          fontWeight: isActive ? '800' : '600',
                        },
                      ]}
                    >
                      {chip.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.headerContainer}>
            <Text style={[styles.title, { color: palette.primaryText }]}>Collection</Text>
            <View style={styles.headerActions}>
              <TouchableOpacity style={styles.headerIconButton} activeOpacity={0.7} onPress={handleSearchPress}>
                <HugeiconsIcon icon={Search01Icon} size={24} color={palette.primaryText} strokeWidth={2} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.headerIconButton} activeOpacity={0.7} onPress={handleToggleLayoutPress}>
                <HugeiconsIcon
                  icon={isGridLayout ? Ticket01Icon : UserMultiple02Icon}
                  size={24}
                  color={palette.primaryText}
                  strokeWidth={2}
                />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </BlurView>
      
      <View style={{ flex: 1 }}>
        {filteredRecords.length === 0 ? (
          <View style={{ flex: 1, paddingTop: headerContentPaddingTop }}>
            {normalizedSearchQuery || activeQuickFilter ? renderSearchEmptyState() : renderEmptyState()}
          </View>
        ) : (
        <FlatList
          key={isGridLayout ? 'artist-grid' : `collection-list-${isDarkMode ? 'dark' : 'light'}`}
          data={(isGridLayout ? artistGridData : displayData) as any[]}
          extraData={isDarkMode}
          numColumns={isGridLayout ? 2 : 1}
          keyExtractor={(item) => (item as { id: string }).id}
          columnWrapperStyle={isGridLayout ? styles.artistColumnWrapper : undefined}
          ListHeaderComponent={
            !isSearching && !isGridLayout && nextLiveRecord ? (
              <View style={styles.nextLiveSection}>
                <Text style={[styles.nextLiveLabel, { color: palette.primaryText }]}>{isNextLivePast ? 'LAST LIVE' : 'NEXT LIVE'}</Text>
                <View>
                  <ImageBackground
                    source={nextLiveImageUri ? { uri: nextLiveImageUri } : require('../assets/ticketEmpty.png')}
                    style={styles.nextLiveCard}
                    imageStyle={{ borderRadius: 16 }}
                  >
                    <View style={styles.nextLiveOverlay} />
                    <TouchableOpacity
                      style={styles.nextLiveFlipToggleButton}
                      activeOpacity={0.8}
                      onPress={handleToggleNextLiveFlip}
                    >
                      <HugeiconsIcon icon={Tap03Icon} size={18} color="#ffffff" strokeWidth={2.0} />
                    </TouchableOpacity>

                    <View style={styles.nextLiveFlipLayer}>
                      <Animated.View
                        pointerEvents={isNextLiveFlipped ? 'none' : 'auto'}
                        style={[
                          styles.nextLiveFace,
                          {
                            transform: [{ perspective: 1200 }, { rotateY: nextLiveFrontRotate }],
                          },
                        ]}
                      >
                        <View style={styles.nextLiveCardContent}>
                          <View>
                            <Text style={styles.nextLiveTitle} numberOfLines={1}>
                              {nextLiveRecord.liveName || 'LIVE TITLE'}
                            </Text>
                            <Text style={styles.nextLiveArtist} numberOfLines={1}>
                              {nextLiveRecord.artist || '-'}
                            </Text>
                            <Text style={styles.nextLiveMeta}>
                              {`DATE    ${nextLiveRecord.date || '-'}${nextLiveRecord.startTime ? `  ${nextLiveRecord.startTime}` : ''}`}
                              {'\n'}
                              {`VENUE    ${nextLiveRecord.venue || '-'}`}
                            </Text>
                            <NextLiveCountdown date={nextLiveRecord.date} startTime={nextLiveRecord.startTime} />
                          </View>
                        </View>
                        <TouchableOpacity
                          style={styles.nextLiveQrButton}
                          activeOpacity={nextLiveRecord.qrCode ? 0.75 : 1}
                          onPress={() => {
                            void handleOpenQrLink();
                          }}
                          disabled={!nextLiveRecord.qrCode}
                        >
                          {nextLiveRecord.qrCode ? (
                            <QRCode
                              value={nextLiveRecord.qrCode}
                              size={32}
                              backgroundColor="transparent"
                              color="#111111"
                              quietZone={0}
                            />
                          ) : (
                            <MaterialIcons name="qr-code-2" size={32} color="#2c2c2c" />
                          )}
                        </TouchableOpacity>
                      </Animated.View>

                      <Animated.View
                        pointerEvents={isNextLiveFlipped ? 'auto' : 'none'}
                        style={[
                          styles.nextLiveFace,
                          styles.nextLiveBackFace,
                          {
                            transform: [{ perspective: 1200 }, { rotateY: nextLiveBackRotate }],
                          },
                        ]}
                      >
                        <View style={styles.nextLiveBackOverlay} />
                        <View style={styles.nextLiveCardContent}>
                          <View>
                            <Text style={styles.todaySongHeader}>TODAY'S SONG</Text>
                            <View style={styles.todaySongRow}>
                              {todaySongDisplay?.artworkUrl ? (
                                <Image source={{ uri: todaySongDisplay.artworkUrl }} style={styles.todaySongArtwork} contentFit="cover" />
                              ) : (
                                <View style={styles.todaySongFallback}>
                                  <MaterialIcons name="music-note" size={18} color="#A0A0A0" />
                                </View>
                              )}
                              <View style={styles.todaySongTextWrap}>
                                <Text style={styles.todaySongTitle} numberOfLines={1}>{todaySongDisplay?.title || 'No song data'}</Text>
                                <Text style={styles.todaySongArtist} numberOfLines={1}>{todaySongDisplay?.artist || nextLiveRecord.artist || '-'}</Text>
                              </View>
                            </View>
                            <View style={styles.todaySongMetaGrid}>
                              <View style={styles.todaySongMetaRow}>
                                <View style={styles.todaySongMetaItem}>
                                  <Text style={styles.todaySongMetaLabel}>ALBUM</Text>
                                  <Text style={styles.todaySongMetaValue} numberOfLines={1}>{todaySongDisplay?.album || '-'}</Text>
                                </View>
                                <View style={styles.todaySongMetaItem}>
                                  <Text style={styles.todaySongMetaLabel}>TIME</Text>
                                  <Text style={styles.todaySongMetaValue} numberOfLines={1}>{todaySongDisplay?.duration || '-'}</Text>
                                </View>
                              </View>
                              <View style={styles.todaySongMetaRow}>
                                <View style={styles.todaySongMetaItem}>
                                  <Text style={styles.todaySongMetaLabel}>GENRE</Text>
                                  <Text style={styles.todaySongMetaValue} numberOfLines={1}>{todaySongDisplay?.genre || '-'}</Text>
                                </View>
                                <View style={styles.todaySongMetaItem}>
                                  <Text style={styles.todaySongMetaLabel}>REL</Text>
                                  <Text style={styles.todaySongMetaValue} numberOfLines={1}>{todaySongDisplay?.releaseDate || '-'}</Text>
                                </View>
                              </View>
                            </View>
                          </View>
                        </View>
                        <TouchableOpacity
                          style={styles.appleMusicBadge}
                          activeOpacity={todaySongProviderCta.isEnabled && !isOpeningTodaySongCta ? 0.8 : 1}
                          onPress={() => {
                            void handleOpenTodaySongLink();
                          }}
                          disabled={!todaySongProviderCta.isEnabled || isOpeningTodaySongCta}
                        >
                          {isOpeningTodaySongCta ? (
                            <ActivityIndicator size="small" color="rgba(255,255,255,0.92)" />
                          ) : (
                            <>
                              <Image
                                source={todaySongProviderCta.iconSource}
                                style={styles.todaySongProviderIcon}
                                contentFit="contain"
                                transition={0}
                              />
                              <Text style={styles.todaySongProviderText}>{todaySongProviderCta.label}</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      </Animated.View>
                    </View>
                  </ImageBackground>
                </View>
              </View>
            ) : null
          }
          renderItem={({ item }) => {
          if (isGridLayout) {
            const artistItem = item as unknown as ArtistItem;
            return (
              <ArtistGridItem
                artistName={artistItem.name}
                imageUri={artistItem.imageUri}
                latestDate={artistItem.latestDate}
                showCount={artistItem.showCount}
                onPress={() => navigation.navigate('ArtistDetail', { artistName: artistItem.name })}
                width={artistCardWidth}
              />
            );
          }

          const itemAnim = getItemAnimation(item.id);
          const animatedStyle = {
            opacity: itemAnim,
            transform: [
              {
                translateY: itemAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [18, 0],
                }),
              },
            ],
          } as const;
          if (item.id === 'empty-state') return null;

          const recordItem = item as ChekiRecord;
          const sectionLabel = recordItem.id === firstSectionLabelRecordIds.firstUpcomingId
            ? '#UP COMING'
            : recordItem.id === firstSectionLabelRecordIds.firstArchiveId
              ? '#ARCHIVE'
              : null;

          if (isListAnimating) {
            return (
              <Animated.View
                style={animatedStyle}
              >
                <TouchableOpacity
                  style={{ width: currentCardWidth, marginBottom: 12, alignSelf: isGridLayout ? 'auto' : 'center' }}
                  onPress={() => handleCardPress(recordItem)}
                  onLongPress={() => handleLongPress(recordItem)}
                  activeOpacity={0.9}
                >
                  {sectionLabel ? (
                    <Text style={styles.sectionLeadLabelText}>{sectionLabel}</Text>
                  ) : null}
                  <TicketCard
                    record={recordItem}
                    width={currentCardWidth}
                    isAnimating={false}
                    animationDirection="out"
                    onAnimationEnd={() => {}}
                  />
                </TouchableOpacity>
              </Animated.View>
            );
          }

          return (
            <TouchableOpacity
              style={{ width: currentCardWidth, marginBottom: 12, alignSelf: isGridLayout ? 'auto' : 'center' }}
              onPress={() => handleCardPress(recordItem)}
              onLongPress={() => handleLongPress(recordItem)}
              activeOpacity={0.9}
            >
              {sectionLabel ? (
                <Text style={styles.sectionLeadLabelText}>{sectionLabel}</Text>
              ) : null}
              <TicketCard
                record={recordItem}
                width={currentCardWidth}
                isAnimating={false}
                animationDirection="out"
                onAnimationEnd={() => {}}
              />
            </TouchableOpacity>
          );
        }}
          scrollEnabled
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: headerContentPaddingTop, paddingBottom: listBottomPadding }}
          windowSize={5}
          maxToRenderPerBatch={5}
          initialNumToRender={8}
          removeClippedSubviews={false}
        />
        )}
      </View>

      {!isSearching ? (
        <TouchableOpacity
          style={[styles.floatingAddButton, isAddLimitReached && styles.floatingAddButtonDisabled, { bottom: floatingAddBottom }]}
          activeOpacity={0.9}
          onPress={handleAddPress}
        >
          <HugeiconsIcon icon={CalendarAdd01Icon} size={26} color="#FFFFFF" strokeWidth={2.2} />
        </TouchableOpacity>
      ) : null}

      {selectedRecord && (
        <Modal
          animationType="fade"
          transparent={true}
          visible={true}
          onRequestClose={handleCloseModal}
        >
          <View style={styles.modalOverlay}>
            <TicketDetail record={selectedRecord} onBack={handleCloseModal} />
          </View>
        </Modal>
      )}

      {showFilterModal && (
        <Modal
          animationType="fade"
          transparent={true}
          visible={true}
          onRequestClose={() => setShowFilterModal(false)}
        >
          <TouchableOpacity 
            style={styles.filterDropdownOverlay}
            activeOpacity={1}
            onPress={() => setShowFilterModal(false)}
          >
            <View style={[styles.filterDropdownContainer, { top: filterTop, right: filterRight, minWidth: Math.max(180, windowWidth * 0.52) }]}>
              <BlurView intensity={30} tint={isDarkMode ? 'dark' : 'light'} style={[styles.filterDropdown, { backgroundColor: palette.modalSurface, borderColor: palette.modalBorder }]}>
                <TouchableOpacity
                  style={styles.filterDropdownItem}
                  onPress={() => {
                    setFilterType('all');
                    setShowFilterModal(false);
                  }}
                >
                  {filterType === 'all' ? (
                    <Ionicons name="checkmark" size={20} color={palette.iconOnDark} />
                  ) : (
                    <View style={{ width: Math.max(18, windowWidth * 0.05) }} />
                  )}
                  <Text style={[styles.filterDropdownItemText, { color: palette.primaryText }]}>{t('collection.filters.all')}</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.filterDropdownItem}
                  onPress={() => {
                    setFilterType('upcoming');
                    setShowFilterModal(false);
                  }}
                >
                  {filterType === 'upcoming' ? (
                    <Ionicons name="checkmark" size={20} color={palette.iconOnDark} />
                  ) : (
                    <View style={{ width: Math.max(18, windowWidth * 0.05) }} />
                  )}
                  <Text style={[styles.filterDropdownItemText, { color: palette.primaryText }]}>{t('collection.filters.upcoming')}</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.filterDropdownItem}
                  onPress={() => {
                    setFilterType('past');
                    setShowFilterModal(false);
                  }}
                >
                  {filterType === 'past' ? (
                    <Ionicons name="checkmark" size={20} color={palette.iconOnDark} />
                  ) : (
                    <View style={{ width: Math.max(18, windowWidth * 0.05) }} />
                  )}
                  <Text style={[styles.filterDropdownItemText, { color: palette.primaryText }]}>{t('collection.filters.past')}</Text>
                </TouchableOpacity>
              </BlurView>
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </SafeAreaView>
  );
};

const DetailScreen: React.FC<{ route: any; navigation: any }> = ({
  route,
  navigation,
}) => {
  const { record } = route.params;

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={true}
      onRequestClose={() => navigation.goBack()}
    >
      <View style={styles.modalOverlay}>
        <TicketDetail record={record} onBack={() => navigation.goBack()} />
      </View>
    </Modal>
  );
};

const AddScreen: React.FC<{ navigation: any; addNewRecord: (record: ChekiRecord) => Promise<void> }> = ({ navigation, addNewRecord }) => {
  const { t } = useTranslation();
  const { records } = useRecords();
  const isPremium = useAppStore((state) => state.isPremium);

  const dedupeImageEntries = (
    urls: string[],
    assetIds: Array<string | null>
  ): { urls: string[]; assetIds: Array<string | null> } => {
    const seen = new Set<string>();
    const nextUrls: string[] = [];
    const nextAssetIds: Array<string | null> = [];

    urls.forEach((url, index) => {
      const key = normalizeStoredImageUri(url) || url;
      if (seen.has(key)) return;
      seen.add(key);
      nextUrls.push(url);
      nextAssetIds.push(assetIds[index] ?? null);
    });

    return { urls: nextUrls, assetIds: nextAssetIds };
  };

  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}.${month}.${day}`;
  };

  const handleSave = async (info: any) => {
    if (!isPremium && records.length >= FREE_TICKET_LIMIT) {
      navigation.navigate('Paywall');
      return;
    }

    const minLoadingMs = 700;
    const loadingStart = Date.now();
    let caughtError: unknown;
    try {
      
      const userId = 'local-user';

      const uploadedImageUrls: string[] = [];
      const uploadedImageAssetIds: Array<string | null> = [];
      const newRecordId = Crypto.randomUUID();

      if (info.imageUrls && info.imageUrls.length > 0) {
        const rawUri = info.imageUrls[0];
        if (rawUri) {
          const normalizedUri = normalizeStoredImageUri(rawUri) || rawUri;
          if (!isPersistedImageUri(normalizedUri)) {
            const newBaseName = `cover-${Date.now()}`;
            const uploaded = await uploadImage(normalizedUri, userId, newRecordId, newBaseName);
            if (uploaded) {
              uploadedImageUrls.push(uploaded);
              uploadedImageAssetIds.push(null);
            }
          } else {
            uploadedImageUrls.push(normalizedUri);
            uploadedImageAssetIds.push(null);
          }
        }
      }


      const finalImageAssetIds = uploadedImageUrls.length > 0 ? [null] : [];

      const filteredArtists = (Array.isArray(info.artists) ? info.artists : [info.artist || ''])
        .map((artist: string) => artist.trim())
        .filter((artist: string) => artist !== '');
      const filteredArtistImageUrls = (Array.isArray(info.artistImageUrls) ? info.artistImageUrls : [info.artistImageUrl || ''])
        .map((imageUrl: string) => imageUrl.trim())
        .slice(0, Math.max(filteredArtists.length, 0));

      const newRecord: ChekiRecord = {
        id: newRecordId,
        user_id: userId,
        artists: filteredArtists,
        artist: filteredArtists[0] || '',
        artistImageUrls: filteredArtistImageUrls,
        artistImageUrl: filteredArtistImageUrls[0] || info.artistImageUrl || '',
        liveName: info.name,
        liveType: normalizeLiveType(info.liveType),
        date: formatDate(info.date),
        venue: info.venue,
        seat: info.seat || '',
        ticketPrice: sanitizeTicketPrice(info.ticketPrice),
        startTime: info.startTime || '',
        endTime: info.endTime || '',
        imageUrls: uploadedImageUrls, // [url] or []
        imageAssetIds: finalImageAssetIds,
        memo: info.memo || '',
        detail: info.detail || '',
        qrCode: info.qrCode || '',
        createdAt: new Date().toISOString(),
      };
      
      await addNewRecord(newRecord);
      
      if (info.setlistSongs && info.setlistSongs.length > 0) {
        try {
          await saveSetlist(newRecord.id, info.setlistSongs);
        } catch (setlistError) {
        }
      }

    } catch (error) {
      Alert.alert(t('collection.alerts.error'), t('collection.alerts.saveFailed'));
      caughtError = error;
    } finally {
      const elapsed = Date.now() - loadingStart;
      if (elapsed < minLoadingMs) {
        await new Promise(resolve => setTimeout(resolve, minLoadingMs - elapsed));
      }
    }
    if (caughtError) {
      throw caughtError;
    }

  };

  return (
    <LiveEditScreen
      initialData={null}
      onSave={handleSave}
      onCancel={() => navigation.navigate('List')}
      successHoldDuration={1200}
    />
  );
};

const EditScreen: React.FC<{ route: any; navigation: any; records: ChekiRecord[]; updateRecord: (id: string, record: ChekiRecord) => Promise<void> }> = ({ route, navigation, records, updateRecord }) => {
  const { t } = useTranslation();
  const { record, focusMemo = false } = route.params || {};
  
  const resolvedImageUrls = useMemo(() => {
    return (record?.imageUrls || []).map((url: string) => resolveLocalImageUri(url));
  }, [record?.id]);
  
  const dedupeImageEntries = useCallback(
    (urls: string[], assetIds: Array<string | null>): { urls: string[]; assetIds: Array<string | null> } => {
      const seen = new Set<string>();
      const nextUrls: string[] = [];
      const nextAssetIds: Array<string | null> = [];

      urls.forEach((url, index) => {
        const key = normalizeStoredImageUri(url) || url;
        if (seen.has(key)) return;
        seen.add(key);
        nextUrls.push(url);
        nextAssetIds.push(assetIds[index] ?? null);
      });

      return { urls: nextUrls, assetIds: nextAssetIds };
    },
    []
  );

  if (!record) {
    return null;
  }

  const formatDate = useCallback((date: Date) => {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}.${month}.${day}`;
  }, []);

  const handleSave = useCallback(async (info: any) => {
    try {
      const userId = 'local-user';
      const filteredArtists = (Array.isArray(info.artists) ? info.artists : [info.artist || record.artist || ''])
        .map((artist: string) => artist.trim())
        .filter((artist: string) => artist !== '');
      const filteredArtistImageUrls = (Array.isArray(info.artistImageUrls) ? info.artistImageUrls : [info.artistImageUrl || record.artistImageUrl || ''])
        .map((imageUrl: string) => imageUrl.trim())
        .slice(0, Math.max(filteredArtists.length, 0));
      let uploadedImageUrls: string[] = [];
      let uploadedImageAssetIds: Array<string | null> = [];

      if (info.imageUrls && info.imageUrls.length > 0) {
        const rawUri = info.imageUrls[0];
        if (rawUri) {
          const normalizedUri = normalizeStoredImageUri(rawUri) || rawUri;
          
          if (!isPersistedImageUri(normalizedUri)) {
            const newBaseName = `cover-${Date.now()}`;
            const uploaded = await uploadImage(normalizedUri, userId, record.id, newBaseName);
            if (uploaded) {
              if (record.imageUrls && record.imageUrls.length > 0) {
                 const oldUri = record.imageUrls[0];
                 try {
                   await deleteImage(oldUri);
                 } catch (e) {
                   // Old image deletion failed, continue
                 }
              }

              uploadedImageUrls = [uploaded];
              uploadedImageAssetIds = [null];
            }
          } else {
            uploadedImageUrls = [normalizedUri];
            const originalIndex = (record.imageUrls || []).indexOf(rawUri);
            const originalAssetId = originalIndex !== -1 ? (record.imageAssetIds?.[originalIndex] ?? null) : null;
            uploadedImageAssetIds = [originalAssetId];
          }
        }
      }

      const updatedRecord: ChekiRecord = {
        ...record,
        user_id: userId,
        artists: filteredArtists,
        artist: filteredArtists[0] || '',
        artistImageUrls: filteredArtistImageUrls,
        artistImageUrl: filteredArtistImageUrls[0] || info.artistImageUrl || '',
        liveName: info.name,
        liveType: normalizeLiveType(info.liveType || record.liveType),
        date: formatDate(info.date),
        venue: info.venue,
        seat: info.seat || '',
        ticketPrice: sanitizeTicketPrice(info.ticketPrice) ?? sanitizeTicketPrice(record.ticketPrice),
        startTime: info.startTime || '',
        memo: info.memo || '',
        detail: info.detail || '',
        qrCode: info.qrCode || '',
      };

      await updateRecord(record.id, updatedRecord);

      if (info.setlistSongs && info.setlistSongs.length > 0) {
        try {
          await saveSetlist(record.id, info.setlistSongs);
        } catch (setlistError) {
          // Setlist save failed, continue
        }
      }
    } catch (error) {
      Alert.alert(t('collection.alerts.error'), t('collection.alerts.saveFailed'));
    }
  }, [record, formatDate, updateRecord, t]);

  const initialData = useMemo(() => ({
    name: record.liveName,
    artists: record.artists && record.artists.length > 0 ? record.artists : [record.artist || ''],
    artist: record.artist,
    artistImageUrls: record.artistImageUrls,
    liveType: record.liveType,
    artistImageUrl: record.artistImageUrl,
    date: new Date(record.date.replace(/\./g, '-')),
    venue: record.venue,
    seat: record.seat,
    ticketPrice: sanitizeTicketPrice(record.ticketPrice),
    startTime: record.startTime,
    endTime: record.endTime,
    imageUrls: resolvedImageUrls,
    memo: record.memo,
    detail: record.detail,
    qrCode: record.qrCode,
  }), [record.liveName, record.artists, record.artist, record.artistImageUrls, record.liveType, record.artistImageUrl, record.date, record.venue, record.seat, record.ticketPrice, record.startTime, record.endTime, resolvedImageUrls, record.memo, record.detail, record.qrCode]);

  return (
    <LiveEditScreen
      initialData={initialData}
      onSave={handleSave}
      onCancel={() => navigation.navigate('List')}
      focusMemo={focusMemo}
    />
  );
};

// Collection Stack Navigator
const CollectionStack = ({ records, addNewRecord, updateRecord, deleteRecord, navigation }: { records: ChekiRecord[]; addNewRecord: (record: ChekiRecord) => Promise<void>; updateRecord: (id: string, record: ChekiRecord) => Promise<void>; deleteRecord: (id: string) => Promise<void>; navigation: any }) => {
  const isPremium = useAppStore((state) => state.isPremium);

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        presentation: 'card',
        gestureEnabled: false,
        fullScreenGestureEnabled: false,
        contentStyle: {
          backgroundColor: theme.colors.background.primary,
        },
      }}
    >
      <Stack.Screen name="List">
        {(props) => <ListScreen {...props} records={records} addNewRecord={addNewRecord} deleteRecord={deleteRecord} isPremium={isPremium} />}
      </Stack.Screen>
      <Stack.Screen
        name="Settings"
        options={{
          headerShown: false,
          animation: 'none',
          presentation: 'card',
          gestureEnabled: false,
          fullScreenGestureEnabled: false,
        }}
      >
        {(props) => <SettingsScreen {...props} />}
      </Stack.Screen>
      <Stack.Screen
        name="MusicProvider"
        options={{
          headerShown: false,
          animation: 'slide_from_right',
          presentation: 'card',
          gestureEnabled: false,
          fullScreenGestureEnabled: false,
        }}
      >
        {(props) => <MusicProviderScreen {...props} />}
      </Stack.Screen>
      <Stack.Screen
        name="ProfileEdit"
        options={{
          headerShown: false,
          animation: 'none',
          presentation: 'card',
          gestureEnabled: false,
          fullScreenGestureEnabled: false,
        }}
      >
        {(props) => <ProfileEditScreen {...props} />}
      </Stack.Screen>
      <Stack.Screen
        name="Add"
        options={{
          headerShown: false,
          animation: 'slide_from_bottom',
          presentation: 'modal',
          gestureEnabled: false,
          fullScreenGestureEnabled: false,
        }}
      >
        {(props) => <AddScreen {...props} addNewRecord={addNewRecord} />}
      </Stack.Screen>
      <Stack.Screen
        name="Detail"
        component={DetailScreen}
        options={{
          headerShown: false,
          animation: 'none',
          presentation: 'transparentModal',
          gestureEnabled: false,
          fullScreenGestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="Edit"
        options={{
          headerShown: false,
          animation: 'slide_from_bottom',
          presentation: 'modal',
          gestureEnabled: false,
          fullScreenGestureEnabled: false,
        }}
      >
        {(props) => <EditScreen {...props} records={records} updateRecord={updateRecord} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
};

export default function CollectionScreen() {
  const { records, addRecord, updateRecord, deleteRecord } = useRecords();

  return (
    <>
      <CollectionStackWrapper records={records} addNewRecord={addRecord} updateRecord={updateRecord} deleteRecord={deleteRecord} />
    </>
  );
}

interface CollectionStackWrapperProps {
  records: ChekiRecord[];
  addNewRecord: (record: ChekiRecord) => Promise<void>;
  updateRecord: (id: string, record: ChekiRecord) => Promise<void>;
  deleteRecord: (id: string) => Promise<void>;
}

function CollectionStackWrapper({ records, addNewRecord, updateRecord, deleteRecord }: CollectionStackWrapperProps) {
  const navigation = useNavigation<any>();
  const isPremium = useAppStore((state) => state.isPremium);
  const [pendingNotification, setPendingNotification] = useState<{ recordId: string; kind: string } | null>(null);

  useEffect(() => {
    const { getGlobalNotification } = require('../contexts/NotificationContext');
    const notification = getGlobalNotification();
    if (notification) {
      setPendingNotification(notification);
    }
  }, []);

  useEffect(() => {
    if (pendingNotification && pendingNotification.recordId) {
      const record = records.find((r) => r.id === pendingNotification.recordId);
      if (record) {
        if (pendingNotification.kind === 'timecapsule') {
          navigation.navigate('Detail', { record });
        }
        else if (pendingNotification.kind === 'after_show') {
          navigation.navigate('Edit', {
            record,
            focusMemo: true,
          });
        }
        
        setPendingNotification(null);
      }
    }
  }, [pendingNotification, records, navigation]);

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        presentation: 'card',
        gestureEnabled: false,
        fullScreenGestureEnabled: false,
        contentStyle: {
          backgroundColor: theme.colors.background.primary,
        },
      }}
    >
      <Stack.Screen name="List">
        {(props) => <ListScreen {...props} records={records} addNewRecord={addNewRecord} deleteRecord={deleteRecord} isPremium={isPremium} />}
      </Stack.Screen>
      <Stack.Screen
        name="Settings"
        options={{
          headerShown: false,
          animation: 'none',
          presentation: 'card',
          gestureEnabled: false,
          fullScreenGestureEnabled: false,
        }}
      >
        {(props) => <SettingsScreen {...props} />}
      </Stack.Screen>
      <Stack.Screen
        name="MusicProvider"
        options={{
          headerShown: false,
          animation: 'slide_from_right',
          presentation: 'card',
          gestureEnabled: false,
          fullScreenGestureEnabled: false,
        }}
      >
        {(props) => <MusicProviderScreen {...props} />}
      </Stack.Screen>
      <Stack.Screen
        name="ProfileEdit"
        options={{
          headerShown: false,
          animation: 'none',
          presentation: 'card',
          gestureEnabled: false,
          fullScreenGestureEnabled: false,
        }}
      >
        {(props) => <ProfileEditScreen {...props} />}
      </Stack.Screen>
      <Stack.Screen
        name="Add"
        options={{
          headerShown: false,
          animation: 'slide_from_bottom',
          presentation: 'modal',
          gestureEnabled: false,
          fullScreenGestureEnabled: false,
        }}
      >
        {(props) => <AddScreen {...props} addNewRecord={addNewRecord} />}
      </Stack.Screen>
      <Stack.Screen
        name="Paywall"
        component={PaywallScreen}
        options={{
          animation: 'fade',
          presentation: 'transparentModal',
          contentStyle: {
            backgroundColor: 'transparent',
          },
          gestureEnabled: false,
          fullScreenGestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="Detail"
        component={DetailScreen}
        options={{
          headerShown: false,
          animation: 'none',
          presentation: 'transparentModal',
          gestureEnabled: false,
          fullScreenGestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="Edit"
        options={{
          headerShown: false,
          animation: 'slide_from_bottom',
          presentation: 'modal',
          gestureEnabled: false,
          fullScreenGestureEnabled: false,
        }}
      >
        {(props) => <EditScreen {...props} records={records} updateRecord={updateRecord} />}
      </Stack.Screen>
      <Stack.Screen
        name="ArtistDetail"
        component={ArtistDetailScreen}
        options={{
          headerShown: false,
          animation: 'slide_from_right',
          gestureEnabled: false,
          fullScreenGestureEnabled: false,
        }}
      />
    </Stack.Navigator>
  );
}


