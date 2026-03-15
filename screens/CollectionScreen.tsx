import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { View, FlatList, TouchableOpacity, Alert, StyleSheet, Text, TextInput, ScrollView, Modal, Animated, ActivityIndicator, useWindowDimensions, ImageBackground, Linking, Easing, LayoutAnimation, UIManager, Platform, Keyboard } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Asset } from 'expo-asset';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { Tap03Icon, Search01Icon, LayoutGridIcon, LeftToRightListDashIcon, CalendarAdd01Icon } from '@hugeicons/core-free-icons';
import QRCode from 'react-native-qrcode-svg';
import { SvgXml } from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TicketCard } from '../components/TicketCard';
import { TicketDetail } from '../components/TicketDetail';
import SettingsScreen from './SettingsScreen';
import ProfileEditScreen from './ProfileEditScreen';
import LiveEditScreen from './LiveEditScreen';
import PaywallScreen from './PaywallScreen';
import { theme } from '../theme';
import { useRecords, ChekiRecord } from '../contexts/RecordsContext';
import { useAppStore } from '../store/useAppStore';
import { uploadImage, normalizeStoredImageUri, resolveLocalImageUri, deleteImage } from '../lib/imageUpload';
import { saveSetlist } from '../lib/setlistDb';
import type { SetlistItem } from '../types/setlist';
import { getArtworkUrl, searchAppleMusicSongs, AppleMusicSong, getAppleMusicSongUrl } from '../utils/appleMusicApi';
import { useTranslation } from 'react-i18next';
import { normalizeLiveType } from '../utils/liveType';
import { getAppWidth } from '../utils/layout';
import { useFonts, LINESeedJP_400Regular, LINESeedJP_700Bold, LINESeedJP_800ExtraBold } from '@expo-google-fonts/line-seed-jp';

const Stack = createNativeStackNavigator();
const FREE_TICKET_LIMIT = 3;
const APPLE_MUSIC_DEVELOPER_TOKEN = 'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjMyTVlRNk5WOTYifQ.eyJpc3MiOiJRMkxMMkI3OTJWIiwiaWF0IjoxNzY5ODQ5MDA5LCJleHAiOjE3ODU0MDEwMDksImF1ZCI6Imh0dHBzOi8vYXBwbGVpZC5hcHBsZS5jb20iLCJzdWIiOiJtZWRpYS5jb20uYW5vbnltb3VzLlRpY2tlbW8ifQ.ect6vO1q3aC9XJVYCUBVLlTHaVEcZebm0-dVZ3ak6uglI33e1ra3qcwkawXaScFFcLB8sgX5TEcFEj9QGF1Z8A';

const APPLE_MUSIC_BADGE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 124.09227 26.77606"><g><g><g><path d="M38.16589,20.42H33.429l-1.13685,3.35888H30.28544l4.48712-12.42727h2.08423L41.3439,23.77891H39.30274Zm-4.246-1.55025H37.675l-1.85169-5.45114H35.77161Z" fill="#fff"/><path d="M51.02436,19.24873c0,2.81686-1.50719,4.62549-3.78089,4.62549a3.07055,3.07055,0,0,1-2.85074-1.5847H44.34966v4.48654h-1.8603V14.71856h1.8v1.50776h0.03445A3.211,3.211,0,0,1,47.209,14.62439C49.50855,14.62439,51.02436,16.44106,51.02436,19.24873Zm-1.912,0c0-1.83389-.94738-3.03964-2.39428-3.03964-1.42106,0-2.37705,1.231-2.37705,3.03964,0,1.82585.956,3.04883,2.37705,3.04883C48.165,22.29756,49.11238,21.101,49.11238,19.24873Z" fill="#fff"/><path d="M60.989,19.24873c0,2.81686-1.50719,4.62549-3.78089,4.62549a3.07055,3.07055,0,0,1-2.85074-1.5847H54.31433v4.48654H52.454V14.71856h1.8v1.50776H54.2885a3.211,3.211,0,0,1,2.88519-1.60193C59.47322,14.62439,60.989,16.44106,60.989,19.24873Zm-1.912,0c0-1.83389-.94738-3.03964-2.39428-3.03964-1.42106,0-2.37705,1.231-2.37705,3.03964,0,1.82585.956,3.04883,2.37705,3.04883C58.12967,22.29756,59.077,21.101,59.077,19.24873Z" fill="#fff"/><path d="M62.4876,11.35164h1.8603V23.77891H62.4876V11.35164Z" fill="#fff"/><path d="M74.02836,21.11822c-0.24976,1.64441-1.85169,2.77323-3.90146,2.77323-2.63543,0-4.2718-1.76614-4.2718-4.59908,0-2.84213,1.645-4.6852,4.19429-4.6852,2.50624,0,4.08233,1.7225,4.08233,4.46932v0.63733H67.73262v0.11254A2.35969,2.35969,0,0,0,70.17,22.39287a2.0515,2.0515,0,0,0,2.09284-1.27465h1.76556Zm-6.28713-2.70433h4.53018a2.179,2.179,0,0,0-2.222-2.30011A2.29426,2.29426,0,0,0,67.74123,18.41389Z" fill="#fff"/><path d="M90.17623,23.77891V14.63243H90.11652l-3.747,9.05232H84.93983l-3.75505-9.05232H81.12506v9.14648h-1.757V11.35164h2.23006l4.02261,9.80907h0.0689l4.01343-9.80907h2.23925V23.77891H90.17623Z" fill="#fff"/><path d="M101.8479,23.77891h-1.78221V22.22062H100.022a2.83019,2.83019,0,0,1-2.80768,1.66164,3.02075,3.02075,0,0,1-3.17744-3.34969v-5.814h1.8603v5.45229a1.80745,1.80745,0,0,0,1.93724,2.10949,2.09861,2.09861,0,0,0,2.15313-2.3426V14.71856h1.8603v9.06036Z" fill="#fff"/><path d="M107.13827,14.61521c2.00614,0,3.445,1.11159,3.48749,2.71351H108.878a1.56135,1.56135,0,0,0-1.7914-1.29188c-1.00824,0-1.68.46508-1.68,1.1713,0,.542.44785.90374,1.38719,1.13685l1.52384.35254c1.82585.43981,2.51485,1.11159,2.51485,2.43791,0,1.63638-1.55025,2.756-3.76309,2.756-2.1359,0-3.57476-1.09436-3.71256-2.748h1.84308A1.68663,1.68663,0,0,0,107.1555,22.479c1.11044,0,1.80863-.457,1.80863-1.18049,0-.55924-0.3445-0.86125-1.29188-1.1024l-1.61915-.39618c-1.63638-.39618-2.46318-1.231-2.46318-2.48844C103.58992,15.70957,105.02763,14.61521,107.13827,14.61521Z" fill="#fff"/><path d="M112.28166,12.33347a1.08081,1.08081,0,1,1,1.076,1.05876A1.06406,1.06406,0,0,1,112.28166,12.33347Zm0.14584,2.38509h1.8603v9.06036h-1.8603V14.71856Z" fill="#fff"/><path d="M122.30087,17.83628a2.00232,2.00232,0,0,0-2.1359-1.67083c-1.42968,0-2.37705,1.19771-2.37705,3.08328,0,1.9292.95541,3.09246,2.39428,3.09246a1.95079,1.95079,0,0,0,2.11868-1.62834h1.7914a3.62162,3.62162,0,0,1-3.9273,3.17859c-2.58375,0-4.2718-1.76614-4.2718-4.64271,0-2.81572,1.68805-4.64157,4.25458-4.64157a3.64183,3.64183,0,0,1,3.9273,3.22912h-1.77418Z" fill="#fff"/></g><path d="M24.665,3.35321a5.326,5.326,0,0,0-3.38091-3.033A10.95611,10.95611,0,0,0,18.24294,0H6.91979A10.95611,10.95611,0,0,0,3.87864.32024a5.326,5.326,0,0,0-3.38091,3.033A9.86307,9.86307,0,0,0,0,6.91972V18.24294a9.86307,9.86307,0,0,0,.49773,3.56651,5.326,5.326,0,0,0,3.38091,3.033,10.95611,10.95611,0,0,0,3.04115.32024H18.24294a10.95611,10.95611,0,0,0,3.04115-.32024,5.326,5.326,0,0,0,3.38091-3.033,9.86283,9.86283,0,0,0,.49766-3.56651V6.91972A9.86283,9.86283,0,0,0,24.665,3.35321Zm-6.3088,13.95341a2.3331,2.3331,0,0,1-.36653.86326,2.19508,2.19508,0,0,1-.68843.63668,2.74433,2.74433,0,0,1-.874.3178,3.3446,3.3446,0,0,1-1.34936.06833,1.87928,1.87928,0,0,1-.9079-0.461,1.95637,1.95637,0,0,1-.09919-2.81,2.18135,2.18135,0,0,1,.81632-0.52465,8.53745,8.53745,0,0,1,1.3841-.35031q0.24406-.0492.48826-0.09847a0.84762,0.84762,0,0,0,.5456-0.27876,0.91272,0.91272,0,0,0,.15151-0.62039l0.00014-5.54523c0-.42409-0.19019-0.53965-0.5952-0.46185-0.28945.05648-6.50617,1.31025-6.50617,1.31025a0.51676,0.51676,0,0,0-.4739.63438l0.00014,8.12518a4.27936,4.27936,0,0,1-.08368.92032,2.33425,2.33425,0,0,1-.36661.86333,2.194,2.194,0,0,1-.68843.63661,2.75352,2.75352,0,0,1-.874.32247,3.34456,3.34456,0,0,1-1.34936.06833,1.88559,1.88559,0,0,1-.9079-0.46558,1.99119,1.99119,0,0,1-.09912-2.81,2.18016,2.18016,0,0,1,.81625-0.52465,8.53944,8.53944,0,0,1,1.3841-.35031q0.24406-.0492.48826-0.09847a0.84778,0.84778,0,0,0,.5456-0.27876,0.91641,0.91641,0,0,0,.165-0.61608V6.4217a1.65067,1.65067,0,0,1,.01737-0.2522,0.7605,0.7605,0,0,1,.25163-0.4856A1.04382,1.04382,0,0,1,9.647,5.47425l0.00287-.00057,7.47881-1.50891c0.06488-.01321.60539-0.10916.66618-0.11447a0.56829,0.56829,0,0,1,.63122.6613l0.00036,11.87033A4.304,4.304,0,0,1,18.35619,17.30661Z" fill="#fff"/></g></g></svg>`;

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
    borderBottomColor: 'rgba(255, 255, 255, 0.45)',
    paddingHorizontal: 24,
    paddingBottom: 14,
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
    marginBottom: 32,
    fontFamily: 'LINESeedJP_400Regular',
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

const ListScreen: React.FC<{ navigation: any; records: ChekiRecord[]; addNewRecord: (record: ChekiRecord) => Promise<void>; deleteRecord: (id: string) => Promise<void>; isPremium: boolean }> = ({ navigation, records, addNewRecord, deleteRecord, isPremium }) => {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const setlists = useAppStore((state) => state.setlists);
  const [fontsLoaded] = useFonts({
    LINESeedJP_400Regular,
    LINESeedJP_700Bold,
    LINESeedJP_800ExtraBold,
  });
  const [selectedRecord, setSelectedRecord] = useState<ChekiRecord | null>(null);
  const [animatingCardId, setAnimatingCardId] = useState<string | null>(null);
  const [closingRecordId, setClosingRecordId] = useState<string | null>(null);
  const [showAfterAnimId, setShowAfterAnimId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'upcoming' | 'past'>('all');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [isGridLayout, setIsGridLayout] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [headerHeight, setHeaderHeight] = useState(0);
  const [isListAnimating, setIsListAnimating] = useState(false);
  const [isNextLiveFlipped, setIsNextLiveFlipped] = useState(false);
  const [todaySongForNextLive, setTodaySongForNextLive] = useState<AppleMusicSong | null>(null);
  const itemAnimations = useRef(new Map<string, Animated.Value>()).current;
  const nextLiveFlipAnim = useRef(new Animated.Value(0)).current;
  const nextLiveFlippedRef = useRef(false);
  const didInitialListAnimation = useRef(false);
  const prevFilterType = useRef(filterType);
  const prevRecordCount = useRef(records.length);
  const renderCountRef = useRef(0);
  
  renderCountRef.current++;

  useEffect(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  useEffect(() => {
    const preloadCollectionImages = async () => {
      try {
        const uris = new Set<string>();
        records.forEach((record) => {
          if (record.imageUrls && Array.isArray(record.imageUrls)) {
            record.imageUrls.forEach((uri) => {
              if (uri && !uri.startsWith('file://')) {
                uris.add(uri);
              }
            });
          }
        });

        if (uris.size === 0) return;

        const assets = Array.from(uris).map((uri) => Asset.fromURI(uri));
        await Promise.all(assets.map((asset) => asset.downloadAsync()));
      } catch (error) {
        // Image preload failed, continue
      }
    };

    preloadCollectionImages();
  }, [records]);

  const screenWidth = getAppWidth();
  const PADDING = Math.min(Math.max(windowWidth * 0.06, 16), 28);
  const cardWidth = screenWidth - PADDING * 2;
  const gridGap = 12;
  const gridHorizontalPadding = 20;
  const gridColumns = 3;
  const gridCardWidth = Math.floor((screenWidth - gridHorizontalPadding * 2 - gridGap * (gridColumns - 1)) / gridColumns);
  const currentCardWidth = isGridLayout ? gridCardWidth : cardWidth;
  const headerMarginTop = insets.top + windowHeight * -0.045;
  const headerButtonSize = Math.min(46, Math.max(40, windowWidth * 0.11));
  const headerButtonRadius = headerButtonSize / 2;
  const listBottomPadding = insets.bottom + windowHeight * 0.15;
  const floatingAddBottom = insets.bottom + 80;
  const isAddLimitReached = !isPremium && records.length >= FREE_TICKET_LIMIT;
  const filterTop = insets.top + windowHeight * 0.10;
  const filterRight = windowWidth * 0.2;
  const emptyImageSize = Math.min(150, windowWidth * 0.38);
  const fallbackHeaderHeight = insets.top + (isSearching ? 104 : 68);
  const headerContentPaddingTop = Math.max(headerHeight + (isSearching ? 18 : 0), fallbackHeaderHeight);

  const handleCardPress = (record: ChekiRecord) => {
    // Close animation stateを先にリセット
    setClosingRecordId(null);
    setAnimatingCardId(record.id);
    // Wait for animation to complete before showing modal
    setTimeout(() => {
      setSelectedRecord(record);
      setTimeout(() => setAnimatingCardId(null), 0);
    }, 200);
  };

  // モーダルを閉じるときのスライドイン制御
  const handleCloseModal = () => {
    if (selectedRecord) {
      const recordId = selectedRecord.id;
      // 先にclosingRecordIdを設定して戻りアニメ対象を記録
      setClosingRecordId(recordId);
      // モーダルを閉じる
      setSelectedRecord(null);
      // Fade out完了後にカードの戻りアニメを開始
      setTimeout(() => {
        setAnimatingCardId(recordId);
      }, 200);
    }
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
  const filteredRecords = useMemo(() => {
    const baseRecords = filterRecords(sortedRecords);
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
  }, [sortedRecords, filterType, normalizedSearchQuery, setlists]);
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
    };
  }, [todaySongForNextLive, nextLiveRecord?.artist]);

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
    const url = todaySongDisplay?.appleMusicUrl?.trim();
    if (!url) return;

    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      Alert.alert('Unable to open', 'Apple Music URL is invalid.');
      return;
    }

    await Linking.openURL(url);
  }, [todaySongDisplay]);

  const getItemAnimation = (id: string) => {
    const existing = itemAnimations.get(id);
    if (existing) return existing;
    const value = new Animated.Value(0);
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
    const recordCountChanged = prevRecordCount.current !== records.length;
    prevFilterType.current = filterType;
    prevRecordCount.current = records.length;

    const shouldAnimate = !didInitialListAnimation.current || (!filterChanged && recordCountChanged);
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
  }, [displayData, itemAnimations, filterType, records.length]);

  if (!fontsLoaded) {
    return <View style={styles.listContainer} />;
  }

  const renderEmptyState = () => (
    <View style={styles.emptyStateContainer}>
      <Image
        source={require('../assets/ticketEmpty.png')}
        style={styles.emptyStateImage}
        contentFit="contain"
        transition={0}
      />
      <Text style={styles.emptyStateSubtitle}>
        {"No Tickets yet, let's change that.\nScan a setlist, craft your stub,\nand keep the memory."}
      </Text>
      <TouchableOpacity style={styles.emptyStateButton} activeOpacity={0.9} onPress={handleAddPress}>
        <Text style={styles.emptyStateButtonText}>Craft Your First Memory</Text>
      </TouchableOpacity>
    </View>
  );

  const renderSearchEmptyState = () => (
    <View style={styles.searchEmptyStateContainer}>
      <MaterialIcons name="sentiment-dissatisfied" size={44} color="#B4B4B4" />
      <Text style={styles.searchEmptyStateText}>この条件のライブ記録は見つかりません</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.listContainer} edges={['left', 'right', 'bottom']}> 
      <BlurView
        tint="light"
        intensity={80}
        style={[styles.glassHeader, { paddingTop: insets.top + 10 }]}
        onLayout={(event) => {
          const nextHeight = Math.ceil(event.nativeEvent.layout.height);
          setHeaderHeight((prev) => (prev === nextHeight ? prev : nextHeight));
        }}
      >
        {isSearching ? (
          <View style={styles.searchingHeaderContainer}>
            <View style={styles.inlineSearchField}>
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="アーティスト、会場、曲名で検索..."
                placeholderTextColor="#8A8A8A"
                style={styles.inlineSearchInput}
                autoFocus={true}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
              />
              {searchQuery.length > 0 ? (
                <TouchableOpacity style={styles.searchClearButton} onPress={handleClearSearch} activeOpacity={0.7}>
                  <Text style={styles.searchClearButtonText}>×</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            <TouchableOpacity onPress={handleCancelSearch} activeOpacity={0.7}>
              <Text style={styles.cancelSearchText}>キャンセル</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.headerContainer}>
            <Text style={styles.title}>Collection</Text>
            <View style={styles.headerActions}>
              <TouchableOpacity style={styles.headerIconButton} activeOpacity={0.7} onPress={handleSearchPress}>
                <HugeiconsIcon icon={Search01Icon} size={24} color="#333333" strokeWidth={2} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.headerIconButton} activeOpacity={0.7} onPress={handleToggleLayoutPress}>
                <HugeiconsIcon
                  icon={isGridLayout ? LeftToRightListDashIcon : LayoutGridIcon}
                  size={24}
                  color="#333333"
                  strokeWidth={2}
                />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </BlurView>
      
      <View style={{ flex: 1 }}>
        {filteredRecords.length === 0 ? (
          <View style={{ paddingTop: headerContentPaddingTop }}>
            {normalizedSearchQuery ? renderSearchEmptyState() : renderEmptyState()}
          </View>
        ) : (
        <FlatList
          key={isGridLayout ? 'collection-grid' : 'collection-list'}
          data={displayData}
          numColumns={isGridLayout ? 3 : 1}
          keyExtractor={(item) => item.id}
          columnWrapperStyle={isGridLayout ? styles.gridColumnWrapper : undefined}
          ListHeaderComponent={
            !isSearching && nextLiveRecord ? (
              <View style={styles.nextLiveSection}>
                <Text style={styles.nextLiveLabel}>{isNextLivePast ? 'LAST LIVE' : 'NEXT LIVE'}</Text>
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
                          activeOpacity={todaySongDisplay?.appleMusicUrl ? 0.8 : 1}
                          onPress={() => {
                            void handleOpenTodaySongLink();
                          }}
                          disabled={!todaySongDisplay?.appleMusicUrl}
                        >
                          <SvgXml
                            xml={APPLE_MUSIC_BADGE_SVG}
                            width={90}
                            height={22}
                          />
                        </TouchableOpacity>
                      </Animated.View>
                    </View>
                  </ImageBackground>
                </View>
              </View>
            ) : null
          }
          renderItem={({ item }) => {
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
          const gridImageUri = recordItem.imageUrls?.[0] ? resolveLocalImageUri(recordItem.imageUrls[0]) : null;

          if (isGridLayout) {
            return (
              <TouchableOpacity
                style={[styles.gridItemShell, { width: currentCardWidth }]}
                onPress={() => handleCardPress(recordItem)}
                onLongPress={() => handleLongPress(recordItem)}
                activeOpacity={0.9}
              >
                <View style={styles.gridJacketButton}>
                  {gridImageUri ? (
                    <Image source={{ uri: gridImageUri }} style={styles.gridJacketImage} contentFit="cover" transition={120} />
                  ) : (
                    <View style={styles.gridJacketFallback}>
                      <MaterialIcons name="photo" size={28} color="#A0A0A0" />
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          }
          
          // アニメーション状態の計算
          const isAnimating = animatingCardId === item.id;
          const isModal = selectedRecord?.id === recordItem.id;
          const isClosing = closingRecordId === recordItem.id;
          const isSlideIn = isClosing && isAnimating;
          const animationDirection: 'out' | 'in' = isSlideIn ? 'in' : 'out';

          // opacityとタップ可否を状態ごとに決定
          let opacity = 0; // デフォルト非表示
          let pointerEvents: 'auto' | 'none' = 'none';
          
          // 1. クローズ対象だがアニメ未開始: 非表示
          if (isClosing && !isAnimating) {
            opacity = 0;
            pointerEvents = 'none';
          }
          // 2. モーダル表示中: 非表示
          else if (isModal) {
            opacity = 0;
            pointerEvents = 'none';
          }
          // 3. スライドアウト中: 非表示
          else if (isAnimating && !isSlideIn) {
            opacity = 0;
            pointerEvents = 'none';
          }
          // 4. スライドイン中: 表示（操作不可）
          else if (isSlideIn && isAnimating) {
            opacity = 1;
            pointerEvents = 'none';
          }
          // 5. アニメ完了直後: 表示（操作可）
          else if (showAfterAnimId === recordItem.id) {
            opacity = 1;
            pointerEvents = 'auto';
          }
          // 6. 通常状態: 表示（操作可）
          else {
            opacity = 1;
            pointerEvents = 'auto';
          }

          // スライドイン完了時に状態をリセット
          const handleCardAnimationEnd = () => {
            if (animationDirection === 'in') {
              setAnimatingCardId(null);
              setClosingRecordId(null);
              setShowAfterAnimId(recordItem.id);
            }
          };
          if (isListAnimating) {
            return (
              <Animated.View
                style={[
                  animatedStyle,
                  {
                    opacity: Animated.multiply(itemAnim, opacity),
                  },
                ]}
              >
                <TouchableOpacity
                  style={{ width: currentCardWidth, marginBottom: 12, alignSelf: isGridLayout ? 'auto' : 'center' }}
                  onPress={() => handleCardPress(recordItem)}
                  onLongPress={() => handleLongPress(recordItem)}
                  activeOpacity={0.9}
                  disabled={pointerEvents === 'none'}
                >
                  <TicketCard
                    record={recordItem}
                    width={currentCardWidth}
                    isAnimating={isAnimating}
                    animationDirection={animationDirection}
                    onAnimationEnd={handleCardAnimationEnd}
                  />
                </TouchableOpacity>
              </Animated.View>
            );
          }

          return (
            <TouchableOpacity
              style={{ width: currentCardWidth, marginBottom: 12, alignSelf: isGridLayout ? 'auto' : 'center', opacity }}
              onPress={() => handleCardPress(recordItem)}
              onLongPress={() => handleLongPress(recordItem)}
              activeOpacity={0.9}
              disabled={pointerEvents === 'none'}
            >
              <TicketCard
                record={recordItem}
                width={currentCardWidth}
                isAnimating={isAnimating}
                animationDirection={animationDirection}
                onAnimationEnd={handleCardAnimationEnd}
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
          removeClippedSubviews={true}
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
              <BlurView intensity={30} tint="light" style={styles.filterDropdown}>
                <TouchableOpacity
                  style={styles.filterDropdownItem}
                  onPress={() => {
                    setFilterType('all');
                    setShowFilterModal(false);
                  }}
                >
                  {filterType === 'all' ? (
                    <Ionicons name="checkmark" size={20} color="#000" />
                  ) : (
                    <View style={{ width: Math.max(18, windowWidth * 0.05) }} />
                  )}
                  <Text style={styles.filterDropdownItemText}>{t('collection.filters.all')}</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.filterDropdownItem}
                  onPress={() => {
                    setFilterType('upcoming');
                    setShowFilterModal(false);
                  }}
                >
                  {filterType === 'upcoming' ? (
                    <Ionicons name="checkmark" size={20} color="#000" />
                  ) : (
                    <View style={{ width: Math.max(18, windowWidth * 0.05) }} />
                  )}
                  <Text style={styles.filterDropdownItemText}>{t('collection.filters.upcoming')}</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.filterDropdownItem}
                  onPress={() => {
                    setFilterType('past');
                    setShowFilterModal(false);
                  }}
                >
                  {filterType === 'past' ? (
                    <Ionicons name="checkmark" size={20} color="#000" />
                  ) : (
                    <View style={{ width: Math.max(18, windowWidth * 0.05) }} />
                  )}
                  <Text style={styles.filterDropdownItemText}>{t('collection.filters.past')}</Text>
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
    </Stack.Navigator>
  );
}


