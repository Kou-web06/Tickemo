import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Platform,
  Alert,
  Modal,
  KeyboardAvoidingView,
  ActivityIndicator,
  Animated,
  Easing,
  Keyboard,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { SvgXml } from 'react-native-svg';
import { Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { Add01Icon, MagicWand04Icon, AlertCircleIcon, Delete01Icon } from '@hugeicons/core-free-icons';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';
import * as Crypto from 'expo-crypto';
import LottieView from 'lottie-react-native';
import TextRecognition, { TextRecognitionScript } from '@react-native-ml-kit/text-recognition';
import { theme } from '../theme';
import DateInputField from '../components/DateInputField';
import ArtistInput from '../components/ArtistInput';
import SetlistInputWithTags from '../components/SetlistInputWithTags';
import { useResolvedImageUris } from '../hooks/useResolvedImageUri';
import type { SetlistItem } from '../types/setlist';
import { useTranslation } from 'react-i18next';
import { LIVE_TYPE_KEYS, LIVE_TYPE_ICON_MAP, normalizeLiveType, type LiveTypeKey } from '../utils/liveType';
import { formatSetlistText } from '../components/SetlistEditor';
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';

interface LiveInfo {
  name: string;
  artists: string[];
  artist?: string;
  artistImageUrls?: string[];
  liveType?: string;
  artistImageUrl?: string;
  date: Date;
  venue: string;
  seat?: string;
  ticketPrice?: number;
  startTime: string;
  endTime: string;
  imageUrls?: string[];
  qrCode?: string;
  memo?: string;
  detail?: string;
  setlistSongs?: SetlistItem[];
}

interface Props {
  initialData: LiveInfo | null;
  onSave: (info: LiveInfo) => Promise<void>;
  onCancel: () => void;
  focusMemo?: boolean;
  successHoldDuration?: number;
}

const LIVE_TYPES = LIVE_TYPE_KEYS;
const OCR_IMAGE_QUALITY = 0.55;

interface OcrReviewItem {
  id: string;
  text: string;
  isSuspicious: boolean;
}

interface PerformanceFormItem {
  id: string;
  artistName: string;
  setlist: string;
  artistImageUrl: string;
}

interface ParsedSetlistLine {
  kind: 'song' | 'mc' | 'encore';
  text: string;
}

const OCR_DROP_LINE_PATTERNS = [
  /^(set\s*list|setlist|セットリスト)\s*[:：-]?\s*$/i,
  /^(date|open|start|door|time|venue|place|ticket|price)\s*[:：].*$/i,
  /^\d{1,2}:\d{2}(\s*[-~]\s*\d{1,2}:\d{2})?$/,
  /^[-=_.~]{3,}$/,
];

const OCR_REVIEW_DUMMY_ITEMS: OcrReviewItem[] = [
  { id: 'dummy-1', text: 'SE. Intro', isSuspicious: false },
  { id: 'dummy-2', text: '!!!!!', isSuspicious: true },
  { id: 'dummy-3', text: 'Moonlight Drive', isSuspicious: false },
  { id: 'dummy-4', text: '???', isSuspicious: true },
];

const SETLIST_TAG_LINE_PATTERN = /^---\s*(.+?)\s*---$/;

const parseSetlistLine = (line: string): ParsedSetlistLine | null => {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const tagMatch = trimmed.match(SETLIST_TAG_LINE_PATTERN);
  const normalizedRaw = (tagMatch ? tagMatch[1] : trimmed).trim();
  const normalized = normalizedRaw.toLowerCase();

  if (normalized === 'encore' || normalized === 'アンコール') {
    return { kind: 'encore', text: 'ENCORE' };
  }

  if (normalized === 'mc' || normalized === 'se' || normalized.startsWith('mc ') || normalized.startsWith('se ')) {
    const label = normalizedRaw.toUpperCase();
    return { kind: 'mc', text: label || 'MC' };
  }

  return { kind: 'song', text: trimmed };
};

const parseSetlistTextToItems = (text: string, artistName: string): SetlistItem[] => {
  const lines = text.split(/\r?\n/).map((line) => parseSetlistLine(line)).filter((line): line is ParsedSetlistLine => Boolean(line));

  return lines.map((line, index) => {
    if (line.kind === 'encore') {
      return {
        id: Crypto.randomUUID(),
        type: 'encore' as const,
        title: 'ENCORE',
        orderIndex: index,
      };
    }

    if (line.kind === 'mc') {
      return {
        id: Crypto.randomUUID(),
        type: 'mc' as const,
        title: line.text,
        orderIndex: index,
      };
    }

    return {
      id: Crypto.randomUUID(),
      type: 'song' as const,
      songId: '',
      songName: line.text,
      artistName: artistName || '',
      albumName: '',
      artworkUrl: '',
      orderIndex: index,
    };
  });
};

const normalizeNumericText = (value: string) =>
  value
    .replace(/[０-９]/g, (digit) => String(digit.charCodeAt(0) - 0xfee0))
    .replace(/[^0-9]/g, '');

const parseTicketPrice = (value: string): number | undefined => {
  const digits = normalizeNumericText(value);
  if (!digits) return undefined;
  const parsed = Number(digits);
  if (!Number.isFinite(parsed)) return undefined;
  return parsed;
};

const sanitizeTicketPrice = (value: unknown): number | undefined => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === 'string') {
    const parsed = parseTicketPrice(value);
    return parsed;
  }

  return undefined;
};

const toTicketPriceText = (value: unknown): string => {
  const sanitized = sanitizeTicketPrice(value);
  return sanitized == null ? '' : String(sanitized);
};

const formatTicketPriceInput = (value: string) => {
  const parsed = parseTicketPrice(value);
  return parsed == null ? '' : parsed.toLocaleString();
};

const ADD_PHOTO_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"><g clip-path="url(#clip0_4418_9255)"><path d="M9 10C10.1046 10 11 9.10457 11 8C11 6.89543 10.1046 6 9 6C7.89543 6 7 6.89543 7 8C7 9.10457 7.89543 10 9 10Z" stroke="#8c8c8c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /><path d="M13 2H9C4 2 2 4 2 9V15C2 20 4 22 9 22H15C20 22 22 20 22 15V10" stroke="#8c8c8c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /><path d="M15.75 5H21.25" stroke="#8c8c8c" stroke-width="2" stroke-linecap="round" /><path d="M18.5 7.75V2.25" stroke="#8c8c8c" stroke-width="2" stroke-linecap="round" /><path d="M2.67004 18.9496L7.60004 15.6396C8.39004 15.1096 9.53004 15.1696 10.24 15.7796L10.57 16.0696C11.35 16.7396 12.61 16.7396 13.39 16.0696L17.55 12.4996C18.33 11.8296 19.59 11.8296 20.37 12.4996L22 13.8996" stroke="#8c8c8c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></g><defs><clipPath id="clip0_4418_9255"><rect width="24" height="24" fill="white"/></clipPath></defs></svg>`;

function TimePickerModal({
  visible,
  title,
  selectedTime,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  selectedTime: string;
  onSelect: (time: string) => void;
  onClose: () => void;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const timeOptionHeight = 48;
  const timeOptions: string[] = [];
  for (let hour = 0; hour < 24; hour++) {
    timeOptions.push(`${String(hour).padStart(2, '0')}:00`);
    timeOptions.push(`${String(hour).padStart(2, '0')}:30`);
  }

  useEffect(() => {
    if (!visible) return;
    const index = Math.max(0, timeOptions.indexOf(selectedTime));
    const targetOffset = index * timeOptionHeight;
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: targetOffset, animated: false });
    }, 50);
    return () => clearTimeout(timer);
  }, [visible]);

  const { t } = useTranslation();

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.timePickerOverlay}>
        <View style={styles.timeModalContent}>
          <View style={styles.timeModalHeader}>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.timeModalCancel}>{t('liveEdit.timePicker.cancel')}</Text>
            </TouchableOpacity>
            <Text style={styles.timeModalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.timeModalDone}>{t('liveEdit.timePicker.done')}</Text>
            </TouchableOpacity>
          </View>
          <ScrollView ref={scrollRef} style={styles.timeOptionsScroll}>
            {timeOptions.map((time) => (
              <TouchableOpacity
                key={time}
                style={[styles.timeOption, selectedTime === time && styles.timeOptionSelected]}
                onPress={() => {
                  onSelect(time);
                  onClose();
                }}
              >
                <Text style={[styles.timeOptionText, selectedTime === time && styles.timeOptionTextSelected]}>{time}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default function LiveEditScreen({ initialData, onSave, onCancel, focusMemo = false, successHoldDuration = 1500 }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const liveTypeLabels = useMemo(() => t('liveEdit.liveTypes', { returnObjects: true }) as string[], [t]);
  const memoPrompts = useMemo(() => t('liveEdit.memoPrompts', { returnObjects: true }) as string[], [t]);
  const randomPlaceholder = useMemo(
    () => memoPrompts[Math.floor(Math.random() * memoPrompts.length)] || '',
    [memoPrompts]
  );

  const parseTime = (timeStr?: string, defaultTime = '18:00'): string => {
    if (!timeStr || typeof timeStr !== 'string') return defaultTime;
    const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return defaultTime;
    const hour = parseInt(match[1], 10);
    const minute = parseInt(match[2], 10);
    if (hour >= 0 && hour < 24 && (minute === 0 || minute === 30)) {
      return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    }
    return defaultTime;
  };

  const createPerformanceId = () => `pf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const initialSetlistText = (initialData?.setlistSongs || [])
    .map((item) => {
      if (item.type === 'song') return item.songName;
      if (item.type === 'mc') return `--- ${item.title} ---`;
      if (item.type === 'encore') return `--- ${item.title} ---`;
      return '';
    })
    .filter((line) => Boolean(line))
    .join('\n');

  const [name, setName] = useState(initialData?.name || '');
  const [artists, setArtists] = useState<string[]>(
    initialData?.artists && initialData.artists.length > 0
      ? initialData.artists
      : initialData?.artist
        ? [initialData.artist]
        : ['']
  );
  const [artistImageUrls, setArtistImageUrls] = useState<string[]>(
    initialData?.artists && initialData.artists.length > 0
      ? initialData.artists.map((_, index) => initialData?.artistImageUrls?.[index] ?? (index === 0 ? initialData?.artistImageUrl || '' : ''))
      : [initialData?.artistImageUrl || '']
  );
  const [liveType, setLiveType] = useState<LiveTypeKey>(normalizeLiveType(initialData?.liveType));
  const [artistImageUrl, setArtistImageUrl] = useState(initialData?.artistImageUrl || '');
  const [date, setDate] = useState(initialData?.date || new Date());
  const [venue, setVenue] = useState(initialData?.venue || '');
  const [seat, setSeat] = useState(initialData?.seat || '');
  const [ticketPriceText, setTicketPriceText] = useState(toTicketPriceText(initialData?.ticketPrice));
  const [startTime, setStartTime] = useState(parseTime(initialData?.startTime, '18:00'));
  const [endTime, setEndTime] = useState(parseTime(initialData?.endTime, '20:00'));
  const [qrCode, setQrCode] = useState(initialData?.qrCode || '');
  const [memo, setMemo] = useState(initialData?.memo || '');
  const [detail, setDetail] = useState(initialData?.detail || '');
  const [setlistText, setSetlistText] = useState(initialSetlistText);
  const [performances, setPerformances] = useState<PerformanceFormItem[]>(() => {
    const initialArtists = initialData?.artists && initialData.artists.length > 0
      ? initialData.artists
      : initialData?.artist
        ? [initialData.artist]
        : [''];

    return initialArtists.map((artistName, index) => ({
      id: createPerformanceId(),
      artistName,
      setlist: index === 0 ? initialSetlistText : '',
      artistImageUrl: initialData?.artistImageUrls?.[index] ?? (index === 0 ? initialData?.artistImageUrl || '' : ''),
    }));
  });

  const resolvedInitialImages = useResolvedImageUris(initialData?.imageUrls);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [showStartTimeModal, setShowStartTimeModal] = useState(false);
  const [showEndTimeModal, setShowEndTimeModal] = useState(false);
  const [showLiveTypeModal, setShowLiveTypeModal] = useState(false);
  const [artistDropdownVisibility, setArtistDropdownVisibility] = useState<Record<string, boolean>>({});
  const [isExtractingSetlist, setIsExtractingSetlist] = useState(false);
  const [showSetlistSourceModal, setShowSetlistSourceModal] = useState(false);
  const [showSetlistReviewModal, setShowSetlistReviewModal] = useState(false);
  const [ocrDraftText, setOcrDraftText] = useState('');
  const [ocrReviewItems, setOcrReviewItems] = useState<OcrReviewItem[]>(OCR_REVIEW_DUMMY_ITEMS);
  const [setlistSourceAnchor, setSetlistSourceAnchor] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [showSuccess, setShowSuccess] = useState(false);
  const [successOverlayKey, setSuccessOverlayKey] = useState(0);
  const isMultiArtistLive = liveType === 'two-man' || liveType === 'festival';

  const memoInputRef = useRef<TextInput>(null);
  const setlistOcrTriggerRef = useRef<any>(null);
  const ocrSpinAnim = useRef(new Animated.Value(0)).current;
  const sourceModalPopAnim = useRef(new Animated.Value(0)).current;
  const successCloseTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasHandledSuccessClose = useRef(false);
  const hasSuccessMinHoldElapsed = useRef(false);
  const hasSuccessAnimationFinished = useRef(false);
  const hasStartedSuccessSequence = useRef(false);
  const onCancelRef = useRef(onCancel);
  const isSubmittingRef = useRef(false);
  const hasUserEditedImages = useRef(false);
  const { width: windowWidth } = useWindowDimensions();
  const ocrSpinRotate = ocrSpinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const initialDataSignature = useMemo(() => {
    if (!initialData) return 'none';
    return JSON.stringify({
      name: initialData.name ?? '',
      artists: initialData.artists ?? (initialData.artist ? [initialData.artist] : ['']),
      liveType: initialData.liveType ?? '',
      date: initialData.date ? new Date(initialData.date).toISOString() : '',
      venue: initialData.venue ?? '',
      seat: initialData.seat ?? '',
      ticketPrice: sanitizeTicketPrice(initialData.ticketPrice) ?? null,
      startTime: initialData.startTime ?? '',
      endTime: initialData.endTime ?? '',
      memo: initialData.memo ?? '',
      detail: initialData.detail ?? '',
      qrCode: initialData.qrCode ?? '',
      setlistSongs: initialData.setlistSongs ?? [],
      imageUrls: initialData.imageUrls ?? [],
    });
  }, [initialData]);

  const finalizeSuccessAndClose = useCallback(() => {
    if (hasHandledSuccessClose.current) return;
    hasHandledSuccessClose.current = true;
    if (successCloseTimeout.current) clearTimeout(successCloseTimeout.current);
    setShowSuccess(false);
    onCancelRef.current();
  }, []);

  useEffect(() => {
    onCancelRef.current = onCancel;
  }, [onCancel]);

  useEffect(() => {
    if (!showSuccess) {
      hasStartedSuccessSequence.current = false;
      return;
    }

    // Avoid resetting state on rerenders while the overlay is visible.
    if (hasStartedSuccessSequence.current) return;
    hasStartedSuccessSequence.current = true;

    hasHandledSuccessClose.current = false;
    hasSuccessMinHoldElapsed.current = false;
    hasSuccessAnimationFinished.current = false;
    if (successCloseTimeout.current) clearTimeout(successCloseTimeout.current);
    successCloseTimeout.current = setTimeout(() => {
      hasSuccessMinHoldElapsed.current = true;
      if (hasSuccessAnimationFinished.current) {
        finalizeSuccessAndClose();
      }
    }, successHoldDuration);
  }, [showSuccess, successHoldDuration, finalizeSuccessAndClose]);

  useEffect(() => {
    return () => {
      if (successCloseTimeout.current) clearTimeout(successCloseTimeout.current);
    };
  }, []);

  useEffect(() => {
    if (!focusMemo) return;
    const timer = setTimeout(() => memoInputRef.current?.focus(), 300);
    return () => clearTimeout(timer);
  }, [focusMemo]);

  useEffect(() => {
    hasUserEditedImages.current = false;
  }, [initialDataSignature]);

  useEffect(() => {
    const nextInitialSetlistText = (initialData?.setlistSongs || [])
      .map((item) => {
        if (item.type === 'song') return item.songName;
        if (item.type === 'mc') return `--- ${item.title} ---`;
        if (item.type === 'encore') return `--- ${item.title} ---`;
        return '';
      })
      .filter((line) => Boolean(line))
      .join('\n');

    const nextArtists =
      initialData?.artists && initialData.artists.length > 0
        ? initialData.artists
        : initialData?.artist
          ? [initialData.artist]
          : [''];

    const nextArtistImageUrls =
      initialData?.artists && initialData.artists.length > 0
        ? initialData.artists.map(
            (_, index) => initialData?.artistImageUrls?.[index] ?? (index === 0 ? initialData?.artistImageUrl || '' : '')
          )
        : [initialData?.artistImageUrl || ''];

    setName(initialData?.name || '');
    setArtists(nextArtists);
    setArtistImageUrls(nextArtistImageUrls);
    setLiveType(normalizeLiveType(initialData?.liveType));
    setArtistImageUrl(initialData?.artistImageUrl || '');
    setDate(initialData?.date ? new Date(initialData.date) : new Date());
    setVenue(initialData?.venue || '');
    setSeat(initialData?.seat || '');
    setTicketPriceText(toTicketPriceText(initialData?.ticketPrice));
    setStartTime(parseTime(initialData?.startTime, '18:00'));
    setEndTime(parseTime(initialData?.endTime, '20:00'));
    setQrCode(initialData?.qrCode || '');
    setMemo(initialData?.memo || '');
    setDetail(initialData?.detail || '');
    setSetlistText(nextInitialSetlistText);
    setArtistDropdownVisibility({});
    setPerformances(
      nextArtists.map((artistName, index) => ({
        id: createPerformanceId(),
        artistName,
        setlist: index === 0 ? nextInitialSetlistText : '',
        artistImageUrl: nextArtistImageUrls[index] || '',
      }))
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDataSignature]);

  useEffect(() => {
    if (!isMultiArtistLive) return;
    setPerformances((prev) => {
      if (prev.length > 0 && prev.some((entry) => entry.artistName.trim() || entry.setlist.trim())) {
        return prev;
      }
      const firstArtist = artists.find((name) => name.trim().length > 0) ?? '';
      const firstSetlist = setlistText.trim();
      const firstArtistImageUrl = artistImageUrls[0] ?? artistImageUrl ?? '';
      return [{ id: createPerformanceId(), artistName: firstArtist, setlist: firstSetlist, artistImageUrl: firstArtistImageUrl }];
    });
  }, [isMultiArtistLive, artists, setlistText, artistImageUrls, artistImageUrl]);

  useEffect(() => {
    if (!showSetlistSourceModal) return;
    sourceModalPopAnim.setValue(0);
    Animated.spring(sourceModalPopAnim, {
      toValue: 1,
      friction: 9,
      tension: 120,
      useNativeDriver: true,
    }).start();
  }, [showSetlistSourceModal, sourceModalPopAnim]);

  useEffect(() => {
    if (!initialData || hasUserEditedImages.current) return;
    if (!initialData.imageUrls || initialData.imageUrls.length === 0) {
      setImageUrls((prev) => (prev.length > 0 ? [] : prev));
      return;
    }
    if (resolvedInitialImages && resolvedInitialImages.length > 0) {
      setImageUrls((prev) => {
        if (prev.length === resolvedInitialImages.length && prev.every((v, i) => v === resolvedInitialImages[i])) {
          return prev;
        }
        return resolvedInitialImages;
      });
    }
  }, [resolvedInitialImages, initialDataSignature, initialData]);

  const handleArtistChange = (index: number, value: string, imageUrl?: string) => {
    setArtists((prev) => prev.map((artist, currentIndex) => (currentIndex === index ? value : artist)));
    setArtistImageUrls((prev) => {
      const next = [...prev];
      while (next.length < artists.length) next.push('');
      next[index] = imageUrl || '';
      return next;
    });
  };

  const handleArtistDropdownVisibilityChange = useCallback((key: string, visible: boolean) => {
    setArtistDropdownVisibility((prev) => {
      if (prev[key] === visible) return prev;
      return { ...prev, [key]: visible };
    });
  }, []);

  const primaryArtist = useMemo(
    () => artists.find((artistName) => artistName.trim().length > 0) ?? '',
    [artists]
  );

  const isStreamingLive = liveType === 'streaming';
  const isEditMode = Boolean(initialData);
  const hasArtistValue = isMultiArtistLive
    ? performances.some((entry) => entry.artistName.trim().length > 0)
    : artists.some((artistName) => artistName.trim().length > 0);
  const hasDictionaryRegistered = isMultiArtistLive
    ? performances.every((entry) => {
        const hasArtistName = entry.artistName.trim().length > 0;
        if (!hasArtistName) return false;
        return (entry.artistImageUrl || '').trim().length > 0;
      })
    : artists.every((artistName, index) => {
        const hasArtistName = artistName.trim().length > 0;
        if (!hasArtistName) return false;
        return (artistImageUrls[index] || '').trim().length > 0;
      });
  const isFormValid =
    name.trim().length > 0 &&
    hasArtistValue &&
    hasDictionaryRegistered &&
    venue.trim().length > 0 &&
    Boolean(date);

  const renderLabel = (label: string, required = false) => (
    <View style={styles.inputLabelRow}>
      <Text style={styles.inputLabel}>{label}</Text>
      {required ? <Text style={styles.requiredLabel}>＊</Text> : null}
    </View>
  );

  const handleSuccessAnimationFinish = useCallback(() => {
    hasSuccessAnimationFinished.current = true;
    if (!hasSuccessMinHoldElapsed.current) return;
    finalizeSuccessAndClose();
  }, [finalizeSuccessAndClose]);

  const resolvePickedImageUri = async (asset: ImagePicker.ImagePickerAsset): Promise<string> => {
    if (asset.uri.startsWith('file://')) return asset.uri;
    if (asset.assetId) {
      try {
        const info = await MediaLibrary.getAssetInfoAsync(asset.assetId);
        if (info.localUri) return info.localUri;
      } catch (error) {
        console.log('[LiveEditScreen] Failed to resolve asset localUri:', error);
      }
    }
    if (asset.base64 && FileSystem.cacheDirectory) {
      const extensionMatch = asset.uri.match(/\.([a-zA-Z0-9]+)(\?|$)/);
      const extension = extensionMatch?.[1] || (asset.mimeType?.includes('png') ? 'png' : 'jpg');
      const targetPath = `${FileSystem.cacheDirectory}tickemo-pick-${Date.now()}.${extension}`;
      try {
        await FileSystem.writeAsStringAsync(targetPath, asset.base64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        return targetPath;
      } catch (error) {
        console.log('[LiveEditScreen] Failed to write base64 image:', error);
      }
    }
    return asset.uri;
  };

  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('liveEdit.alerts.permissionRequiredTitle'), t('liveEdit.alerts.photoPermissionRequired'));
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        allowsMultipleSelection: false,
        aspect: [1, 1],
        base64: false,
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const resolvedUri = await resolvePickedImageUri(result.assets[0]);
        if (!resolvedUri) {
          Alert.alert(t('liveEdit.alerts.error'), t('liveEdit.alerts.imageLoadFailed'));
          return;
        }
        hasUserEditedImages.current = true;
        setImageUrls([resolvedUri]);
      }
    } catch (error) {
      console.log('[LiveEditScreen] Image pick failed:', error);
      Alert.alert(t('liveEdit.alerts.error'), t('liveEdit.alerts.imagePickFailed'));
    }
  };

  const handleRemoveImage = () => {
    hasUserEditedImages.current = true;
    setImageUrls([]);
  };

  const spinOcrIcon = () => {
    ocrSpinAnim.setValue(0);
    Animated.timing(ocrSpinAnim, {
      toValue: 1,
      duration: 250,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start();
  };

  const isSuspiciousSetlistText = (value: string) => {
    const trimmed = value.trim();
    if (trimmed.length === 0) return true;
    if (trimmed.length < 2) return true;

    const hasReadableChars = /[A-Za-z\u3040-\u30FF\u4E00-\u9FFF]/.test(trimmed);
    const symbolChars = trimmed.match(/[^A-Za-z0-9\u3040-\u30FF\u4E00-\u9FFF\s]/g)?.length ?? 0;
    const symbolRatio = symbolChars / Math.max(trimmed.length, 1);
    const repeatedCharOnly = /^([\W_\u3000\s]|\d)\1+$/.test(trimmed);
    const looksLikeMetaLine = /^(open|start|door|time|venue|ticket|price|date)\b/i.test(trimmed);

    if (!hasReadableChars) return true;
    if (symbolRatio > 0.35) return true;
    if (repeatedCharOnly) return true;
    if (looksLikeMetaLine) return true;

    return false;
  };

  const normalizeOcrLine = (line: string) => {
    let next = line.trim();

    // Remove common setlist indexes like "1.", "01)", "M1:", "①".
    next = next.replace(/^\s*[①-⑳]\s*/, '');
    next = next.replace(/^\s*(?:m|mc)?\s*0*\d{1,3}\s*[.)\]】\-:：]\s*/i, '');
    next = next.replace(/^\s*#?\d{1,3}\s+(?=\S)/, '');
    next = next.replace(/^\s*[-*・●]\s*/, '');

    return next.trim();
  };

  const normalizeAndFilterOcrLines = (lines: string[]) => {
    const seen = new Set<string>();
    const cleaned: string[] = [];

    lines.forEach((raw) => {
      const normalized = normalizeOcrLine(raw);
      if (!normalized) return;
      if (OCR_DROP_LINE_PATTERNS.some((pattern) => pattern.test(normalized))) return;

      const dedupeKey = normalized.toLowerCase();
      if (seen.has(dedupeKey)) return;
      seen.add(dedupeKey);
      cleaned.push(normalized);
    });

    return cleaned;
  };

  const buildReviewItemsFromLines = (lines: string[]): OcrReviewItem[] => {
    return lines.map((line, index) => ({
      id: `ocr-${Date.now()}-${index}`,
      text: line,
      isSuspicious: isSuspiciousSetlistText(line),
    }));
  };

  const processSetlistImage = async (imageUri: string) => {
    setIsExtractingSetlist(true);
    try {
      const result = await TextRecognition.recognize(imageUri, TextRecognitionScript.JAPANESE);
      const extractedText = result?.text?.trim() ?? '';
      const lines = normalizeAndFilterOcrLines(formatSetlistText(extractedText));

      if (lines.length === 0) {
        Alert.alert(t('liveEdit.alerts.error'), t('liveEdit.setlistEditor.alerts.noSongToAdd'));
        return null;
      }
      return lines;
    } catch (error) {
      console.log('[LiveEditScreen] OCR failed:', error);
      Alert.alert(t('liveEdit.alerts.error'), t('liveEdit.setlistEditor.alerts.ocrFailed'));
      return null;
    } finally {
      setIsExtractingSetlist(false);
    }
  };

  const handleSetlistOcrFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('liveEdit.setlistEditor.alerts.permissionRequired'), t('liveEdit.setlistEditor.alerts.photoLibraryRequired'));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: OCR_IMAGE_QUALITY,
    });

    if (result.canceled || !result.assets?.[0]?.uri) return;
    const lines = await processSetlistImage(result.assets[0].uri);
    if (!lines) return;
    const items = buildReviewItemsFromLines(lines);
    setOcrReviewItems(items.length > 0 ? items : OCR_REVIEW_DUMMY_ITEMS);
    setOcrDraftText(lines.join('\n'));
    setShowSetlistReviewModal(true);
  };

  const handleSetlistOcrFromCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('liveEdit.setlistEditor.alerts.permissionRequired'), t('liveEdit.setlistEditor.alerts.cameraRequired'));
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: OCR_IMAGE_QUALITY,
    });

    if (result.canceled || !result.assets?.[0]?.uri) return;
    const lines = await processSetlistImage(result.assets[0].uri);
    if (!lines) return;
    const items = buildReviewItemsFromLines(lines);
    setOcrReviewItems(items.length > 0 ? items : OCR_REVIEW_DUMMY_ITEMS);
    setOcrDraftText(lines.join('\n'));
    setShowSetlistReviewModal(true);
  };

  const handleSetlistOcrPress = () => {
    if (isExtractingSetlist) return;
    spinOcrIcon();
    const triggerNode = setlistOcrTriggerRef.current;
    if (triggerNode?.measureInWindow) {
      triggerNode.measureInWindow((x: number, y: number, width: number, height: number) => {
        setSetlistSourceAnchor({ x, y, width, height });
        setShowSetlistSourceModal(true);
      });
      return;
    }
    setSetlistSourceAnchor({ x: Math.max(windowWidth - 60, 0), y: 210, width: 24, height: 24 });
    setShowSetlistSourceModal(true);
  };

  const handleConfirmOcrDraft = () => {
    const lines = formatSetlistText(ocrReviewItems.map((item) => item.text).join('\n'));
    if (lines.length === 0) {
      Alert.alert(t('liveEdit.alerts.error'), t('liveEdit.setlistEditor.alerts.noSongToAdd'));
      return;
    }

    setSetlistText((prev) => {
      const currentLines = formatSetlistText(prev);
      const merged = [...currentLines, ...lines];
      return merged.join('\n');
    });

    setShowSetlistReviewModal(false);
    setOcrDraftText('');
    setOcrReviewItems(OCR_REVIEW_DUMMY_ITEMS);
  };

  const handleCancelOcrReview = () => {
    setShowSetlistReviewModal(false);
    setOcrDraftText('');
    setOcrReviewItems(OCR_REVIEW_DUMMY_ITEMS);
  };

  const handleReviewItemChange = (id: string, nextText: string) => {
    setOcrReviewItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              text: nextText,
              isSuspicious: isSuspiciousSetlistText(nextText),
            }
          : item
      )
    );
  };

  const handleDeleteReviewItem = (id: string) => {
    setOcrReviewItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleAddPerformance = () => {
    setPerformances((prev) => [
      ...prev,
      { id: createPerformanceId(), artistName: '', setlist: '', artistImageUrl: '' },
    ]);
  };

  const handleChangePerformance = (id: string, key: 'artistName' | 'setlist' | 'artistImageUrl', value: string) => {
    setPerformances((prev) =>
      prev.map((entry) => (entry.id === id ? { ...entry, [key]: value } : entry))
    );
  };

  const handlePerformanceArtistChange = (id: string, value: string, imageUrl?: string) => {
    setPerformances((prev) =>
      prev.map((entry) =>
        entry.id === id
          ? {
              ...entry,
              artistName: value,
              artistImageUrl: imageUrl || '',
            }
          : entry
      )
    );
  };

  const handleDeletePerformance = (id: string) => {
    setPerformances((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((entry) => entry.id !== id);
    });
  };

  if (showSetlistReviewModal) {
    return (
      <KeyboardAvoidingView style={styles.ocrReviewScreen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <StatusBar barStyle="dark-content" />

        <View style={[styles.ocrReviewHeader, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity style={styles.ocrReviewCloseButton} onPress={handleCancelOcrReview}>
            <Ionicons name="close" size={24} color="#7A7A7A" />
          </TouchableOpacity>
          <Text style={styles.ocrReviewHeaderTitle}>読み取った結果の確認</Text>
          <View style={styles.ocrReviewHeaderSpacer} />
        </View>

        <View style={styles.ocrReviewSummaryWrap}>
          <Text style={styles.ocrReviewSummaryTitle}>{`${ocrReviewItems.length}曲を読み取りました`}</Text>
          <Text style={styles.ocrReviewSummarySub}>タップで編集</Text>
        </View>

        <DraggableFlatList
          data={ocrReviewItems}
          keyExtractor={(item) => item.id}
          onDragEnd={({ data }) => setOcrReviewItems(data)}
          activationDistance={12}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 250 }}
          renderItem={({ item, getIndex, drag, isActive }: RenderItemParams<OcrReviewItem>) => {
            const rawIndex = getIndex?.();
            const fallbackIndex = ocrReviewItems.findIndex((row) => row.id === item.id);
            const safeIndex = Number.isFinite(rawIndex as number) ? (rawIndex as number) : fallbackIndex;
            const displayIndex = safeIndex >= 0 ? safeIndex + 1 : 1;

            return (
              <ScaleDecorator>
                <View
                  style={[
                    styles.ocrReviewCard,
                    item.isSuspicious && styles.ocrReviewCardSuspicious,
                    isActive && styles.ocrReviewCardActive,
                  ]}
                >
                  <Text style={styles.ocrReviewIndex}>{String(displayIndex).padStart(2, '0')}</Text>
                <TextInput
                  style={[styles.ocrReviewInput, item.isSuspicious && styles.ocrReviewInputSuspicious]}
                  value={item.text}
                  onChangeText={(value) => handleReviewItemChange(item.id, value)}
                  placeholder="曲名を入力"
                  placeholderTextColor="#BDBDBD"
                />
                {item.isSuspicious ? (
                  <HugeiconsIcon icon={AlertCircleIcon} size={18} color="#FF3B30" strokeWidth={1.9} />
                ) : null}
                <TouchableOpacity onLongPress={drag} delayLongPress={120} style={styles.ocrReviewDragHandle}>
                  <MaterialIcons name="drag-indicator" size={20} color="#CCCCCC" style={styles.ocrReviewDragIcon} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleDeleteReviewItem(item.id)}
                  style={[styles.ocrReviewDeleteButton, item.isSuspicious && styles.ocrReviewDeleteButtonSuspicious]}
                >
                  <HugeiconsIcon icon={Delete01Icon} size={18} color={item.isSuspicious ? '#FF3B30' : '#A9A9A9'} strokeWidth={1.9} />
                </TouchableOpacity>
                </View>
              </ScaleDecorator>
            );
          }}
        />

        <View style={[styles.ocrReviewBottomCtaWrap, { paddingBottom: Math.max(14, insets.bottom + 6) }]}>
          <TouchableOpacity style={styles.ocrReviewBottomCta} onPress={handleConfirmOcrDraft}>
            <Text style={styles.ocrReviewBottomCtaText}>この内容で追加</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  const handleSave = async () => {
    if (!isFormValid || isSubmittingRef.current) return;

    const validArtistEntries = isMultiArtistLive
      ? performances
          .map((entry) => ({ artistName: entry.artistName.trim(), artistImageUrl: (entry.artistImageUrl || '').trim() }))
          .filter((entry) => entry.artistName !== '')
      : artists
          .map((artistName, index) => ({
            artistName: artistName.trim(),
            artistImageUrl: (artistImageUrls[index] ?? '').trim(),
          }))
          .filter((entry) => entry.artistName !== '');

    const filteredArtists = validArtistEntries.map((entry) => entry.artistName);
    const filteredArtistImageUrls = validArtistEntries.map((entry) => entry.artistImageUrl);
    const primaryArtistImageUrl = filteredArtistImageUrls[0] || '';

    const nextSetlistSongs: SetlistItem[] = isMultiArtistLive
      ? performances.flatMap((entry) => parseSetlistTextToItems(entry.setlist, entry.artistName.trim() || primaryArtist || ''))
      : parseSetlistTextToItems(setlistText, primaryArtist || '');

    const parsedTicketPrice = parseTicketPrice(ticketPriceText);

    isSubmittingRef.current = true;
    try {
      await onSave({
        name,
        artists: filteredArtists,
        artist: filteredArtists[0] || '',
        artistImageUrls: filteredArtistImageUrls,
        liveType,
        artistImageUrl: primaryArtistImageUrl || artistImageUrl,
        date,
        venue,
        seat: seat || '',
        ticketPrice: parsedTicketPrice,
        startTime: startTime || '18:00',
        endTime: endTime || '20:00',
        imageUrls,
        qrCode: qrCode || '',
        memo: memo || '',
        detail: detail || '',
        setlistSongs: nextSetlistSongs,
      });

      setSuccessOverlayKey((prev) => prev + 1);
      setShowSuccess(true);
    } catch {
      isSubmittingRef.current = false;
    }
  };

  const handleClosePress = () => {
    Alert.alert(
      t('liveEdit.alerts.discardConfirmTitle'),
      t('liveEdit.alerts.discardConfirmMessage'),
      [
        { text: t('liveEdit.alerts.continueEditing'), style: 'cancel' },
        { text: t('liveEdit.alerts.discard'), style: 'destructive', onPress: onCancel },
      ],
      { cancelable: true }
    );
  };

  // TimePickerModal はファイルトップレベルで定義済み

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle="dark-content" />

      <BlurView tint="light" intensity={80} style={styles.header}>
        <TouchableOpacity onPress={handleClosePress} style={styles.headerCloseButton}>
          <Ionicons name="close" size={28} color="#B7B7B7" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{initialData ? 'Edit live record' : 'Add live record'}</Text>
        <View style={styles.headerSpacer} />
      </BlurView>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        scrollEnabled={!Object.values(artistDropdownVisibility).some(Boolean)}
      >
        <View style={styles.sectionBlock}>
          {!isMultiArtistLive && (
            <>
              {renderLabel('アーティスト名', true)}
              {artists.map((artistName, index) => (
                <View key={`artist-${index}`} style={[styles.artistFieldContainer, { zIndex: 1000 - index }]}>
                  <ArtistInput
                    value={artistName}
                    imageUrl={artistImageUrls[index] || ''}
                    onChange={(value, imageUrl) => handleArtistChange(index, value, imageUrl)}
                    placeholder={t('liveEdit.placeholders.artistSearch')}
                    onDropdownVisibilityChange={(visible) => handleArtistDropdownVisibilityChange(`artist-${index}`, visible)}
                  />
                </View>
              ))}
            </>
          )}

          {renderLabel('イベント名', true)}
          <TextInput
            style={styles.baseInput}
            value={name}
            onChangeText={setName}
            placeholder={t('liveEdit.placeholders.liveName')}
            placeholderTextColor="#CCCCCC"
          />

          {renderLabel('イベントの種類')}
          <TouchableOpacity style={styles.liveTypeSelector} activeOpacity={0.8} onPress={() => setShowLiveTypeModal(true)}>
            <MaterialCommunityIcons
              name={LIVE_TYPE_ICON_MAP[liveType] as keyof typeof MaterialCommunityIcons.glyphMap}
              size={18}
              color="#9A9A9A"
              style={styles.liveTypeLeftIcon}
            />
            <Text style={styles.liveTypeSelectedText}>
              {liveTypeLabels[LIVE_TYPES.indexOf(liveType)] ?? liveType}
            </Text>
            <MaterialIcons name="unfold-more" size={22} color="#9A9A9A" style={styles.liveTypeRightIcon} />
          </TouchableOpacity>
        </View>

        <View style={styles.sectionBlock}>
          {renderLabel('日付', true)}
          <DateInputField value={date} onChange={setDate} />

          <View style={styles.timeRowWrap}>
            <View style={styles.timeColumn}>
              <Text style={styles.inputLabel}>開場</Text>
              <TouchableOpacity style={styles.baseInput} onPress={() => setShowStartTimeModal(true)}>
                <Text style={styles.timeText}>{startTime || '16:00'}</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.timeArrow}>{'------------->'}</Text>
            <View style={styles.timeColumn}>
              <Text style={styles.inputLabel}>開演</Text>
              <TouchableOpacity style={styles.baseInput} onPress={() => setShowEndTimeModal(true)}>
                <Text style={styles.timeText}>{endTime || '18:00'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.sectionBlock}>
          {renderLabel('会場', true)}
          <TextInput
            style={styles.baseInput}
            value={venue}
            onChangeText={setVenue}
            placeholder={isStreamingLive ? t('liveEdit.placeholders.platform') : t('liveEdit.placeholders.venue')}
            placeholderTextColor="#CCCCCC"
          />

          <Text style={styles.inputLabel}>座席</Text>
          <TextInput
            style={styles.baseInput}
            value={seat}
            onChangeText={setSeat}
            placeholder={isStreamingLive ? t('liveEdit.placeholders.watchEnvironment') : t('liveEdit.placeholders.seat')}
            placeholderTextColor="#CCCCCC"
          />

          <Text style={styles.inputLabel}>料金</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <TextInput
              style={[styles.baseInput, { flex: 1, textAlign: 'right', marginBottom: 0 }]}
              value={formatTicketPriceInput(ticketPriceText)}
              onChangeText={(text) => {
                setTicketPriceText(normalizeNumericText(text));
              }}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor="#CCCCCC"
            />
            <Text style={{ fontSize: 16, color: '#555555', marginLeft: 8, marginBottom: 12 }}>円</Text>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            {[3000, 5000, 8000, 10000, 15000].map((preset) => (
              <TouchableOpacity
                key={preset}
                onPress={() => setTicketPriceText(String(preset))}
                style={[
                  { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#DDDDDD', backgroundColor: '#FFFFFF' },
                  ticketPriceText === String(preset) && { backgroundColor: '#222222', borderColor: '#222222' },
                ]}
              >
                <Text style={[
                  { fontSize: 14, color: '#444444' },
                  ticketPriceText === String(preset) && { color: '#FFFFFF', fontWeight: '600' },
                ]}>
                  {preset.toLocaleString()}円
                </Text>
              </TouchableOpacity>
            ))}
          </View>

        </View>

        {isMultiArtistLive ? (
          <>
            {performances.map((performance, index) => (
              <View key={performance.id} style={styles.performanceBlock}>
                <View style={styles.performanceHeaderRow}>
                  <Text style={styles.performanceTitle}>{`Artist ${index + 1}`}</Text>
                  {performances.length > 1 ? (
                    <TouchableOpacity onPress={() => handleDeletePerformance(performance.id)} style={styles.performanceDeleteButton}>
                      <HugeiconsIcon icon={Delete01Icon} size={18} color="#999999" strokeWidth={1.9} />
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.performanceDeletePlaceholder} />
                  )}
                </View>

                {renderLabel('アーティスト名', true)}
                <ArtistInput
                  value={performance.artistName}
                  imageUrl={performance.artistImageUrl}
                  onChange={(value, imageUrl) => handlePerformanceArtistChange(performance.id, value, imageUrl)}
                  placeholder={t('liveEdit.placeholders.artistSearch')}
                  onDropdownVisibilityChange={(visible) => handleArtistDropdownVisibilityChange(`performance-${performance.id}`, visible)}
                />

                <View style={styles.performanceSetlistWrap}>
                  <SetlistInputWithTags
                    title="セットリスト"
                    value={performance.setlist}
                    onChangeText={(value) => handleChangePerformance(performance.id, 'setlist', value)}
                    placeholder={t('liveEdit.setlistEditor.placeholders.lineByLineInput')}
                    minHeight={150}
                  />
                </View>
              </View>
            ))}

            <TouchableOpacity style={styles.addPerformanceButton} onPress={handleAddPerformance} activeOpacity={0.85}>
              <Text style={styles.addPerformanceButtonText}>+ 別のアーティストを追加</Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.sectionBlock}>
            <SetlistInputWithTags
              title="セットリスト"
              value={setlistText}
              onChangeText={setSetlistText}
              placeholder={t('liveEdit.setlistEditor.placeholders.lineByLineInput')}
              minHeight={150}
              headerRight={
                <TouchableOpacity ref={setlistOcrTriggerRef} onPress={handleSetlistOcrPress} disabled={isExtractingSetlist}>
                  {isExtractingSetlist ? (
                    <ActivityIndicator size="small" color="#8315B1" />
                  ) : (
                    <Animated.View style={{ transform: [{ rotate: ocrSpinRotate }] }}>
                      <HugeiconsIcon icon={MagicWand04Icon} size={20} color="#9A9A9A" strokeWidth={2.0} />
                    </Animated.View>
                  )}
                </TouchableOpacity>
              }
            />
          </View>
        )}

        <View style={styles.sectionBlock}>
          <Text style={styles.inputLabel}>感想</Text>
          <TextInput
            ref={memoInputRef}
            style={[styles.baseInput, styles.multilineMemo]}
            value={memo}
            onChangeText={setMemo}
            placeholder={randomPlaceholder}
            placeholderTextColor="#CCCCCC"
            multiline
            scrollEnabled
            textAlignVertical="top"
          />

          <Text style={styles.inputLabel}>URL</Text>
          <TextInput
            style={styles.baseInput}
            value={qrCode}
            onChangeText={setQrCode}
            placeholder={t('liveEdit.placeholders.qrCode')}
            placeholderTextColor="#CCCCCC"
            autoCapitalize="none"
            keyboardType="url"
          />

          <Text style={styles.inputLabel}>カバーアート</Text>
          {imageUrls.length > 0 ? (
            <View style={styles.jacketContainer}>
              <Image source={{ uri: imageUrls[0] }} style={styles.jacketImage} contentFit="cover" />
              <TouchableOpacity style={styles.jacketRemoveButton} onPress={handleRemoveImage}>
                <Ionicons name="close-circle" size={28} color="#ff4444" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.emptyJacketContainer} onPress={handlePickImage} activeOpacity={0.7}>
              <View style={styles.emptyJacketContent}>
                <HugeiconsIcon icon={Add01Icon} size={30} color="#A3A3A3" strokeWidth={3.0} />
              </View>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      <View style={styles.bottomCtaWrap}>
        <TouchableOpacity
          style={[styles.bottomCta, !isFormValid && styles.bottomCtaDisabled]}
          onPress={handleSave}
          disabled={!isFormValid}
        >
          <Text style={styles.bottomCtaText}>{isEditMode ? 'Save' : 'Add New Live'}</Text>
        </TouchableOpacity>
      </View>

      <TimePickerModal
        visible={showStartTimeModal}
        title={t('liveEdit.timePicker.startTitle')}
        selectedTime={startTime}
        onSelect={setStartTime}
        onClose={() => setShowStartTimeModal(false)}
      />
      <TimePickerModal
        visible={showEndTimeModal}
        title={t('liveEdit.timePicker.endTitle')}
        selectedTime={endTime}
        onSelect={setEndTime}
        onClose={() => setShowEndTimeModal(false)}
      />

      <Modal visible={showLiveTypeModal} transparent animationType="none" onRequestClose={() => setShowLiveTypeModal(false)}>
        <TouchableOpacity style={styles.liveTypePickerOverlay} activeOpacity={1} onPress={() => setShowLiveTypeModal(false)}>
          <View style={styles.liveTypePickerContent}>
            <Text style={styles.liveTypePickerTitle}>イベントの種類</Text>
            <ScrollView style={styles.liveTypePickerScroll}>
              {LIVE_TYPES.map((type, index) => {
                const selected = liveType === type;
                return (
                  <TouchableOpacity
                    key={type}
                    style={[styles.liveTypePickerItem, selected && styles.liveTypePickerItemSelected]}
                    onPress={() => {
                      setLiveType(normalizeLiveType(type));
                      setShowLiveTypeModal(false);
                    }}
                  >
                    <MaterialCommunityIcons
                      name={LIVE_TYPE_ICON_MAP[type] as keyof typeof MaterialCommunityIcons.glyphMap}
                      size={16}
                      color={selected ? '#8315B1' : '#808080'}
                    />
                    <Text style={[styles.liveTypePickerItemText, selected && styles.liveTypePickerItemTextSelected]}>
                      {liveTypeLabels[index] ?? type}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={showSetlistSourceModal}
        transparent
        animationType="none"
        onRequestClose={() => setShowSetlistSourceModal(false)}
      >
        <View style={styles.setlistOcrSourceOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={() => setShowSetlistSourceModal(false)} />
          <Animated.View
            style={[
              styles.setlistOcrSourceCard,
              {
                left: Math.min(Math.max(12, setlistSourceAnchor.x + setlistSourceAnchor.width - 250), Math.max(12, windowWidth - 262)),
                top: setlistSourceAnchor.y + setlistSourceAnchor.height + 50,
                opacity: sourceModalPopAnim,
                transform: [
                  {
                    translateY: sourceModalPopAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-10, 0],
                    }),
                  },
                  {
                    scale: sourceModalPopAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.96, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <Text style={styles.setlistOcrSourceTitle}>まとめて登録（β版）</Text>

            <TouchableOpacity
              style={styles.setlistOcrSourceButton}
              onPress={() => {
                setShowSetlistSourceModal(false);
                void handleSetlistOcrFromCamera();
              }}
            >
              <MaterialIcons name="photo-camera" size={18} color="#7D7D7D" />
              <Text style={styles.setlistOcrSourceButtonText}>{t('liveEdit.setlistEditor.popover.takePhoto')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.setlistOcrSourceButton}
              onPress={() => {
                setShowSetlistSourceModal(false);
                void handleSetlistOcrFromGallery();
              }}
            >
              <MaterialIcons name="photo-library" size={18} color="#7D7D7D" />
              <Text style={styles.setlistOcrSourceButtonText}>{t('liveEdit.setlistEditor.popover.chooseFromAlbum')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.setlistOcrSourceCancelButton} onPress={() => setShowSetlistSourceModal(false)}>
              <Text style={styles.setlistOcrSourceCancelText}>{t('liveEdit.setlistEditor.review.cancel')}</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>

      {showSuccess && (
        <View style={styles.checkedOverlay} pointerEvents="none">
          <LottieView
            key={successOverlayKey}
            source={require('../assets/animations/Success.json')}
            autoPlay
            loop={false}
            speed={1.5}
            onAnimationFinish={handleSuccessAnimationFinish}
            style={styles.checkedAnimation}
          />
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 20,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: 'rgba(248, 248, 248, 0.52)',
    overflow: 'hidden',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.45)',
  },
  headerCloseButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3F3F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#2F2F2F',
  },
  headerSpacer: {
    width: 48,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 120,
  },
  sectionBlock: {
    backgroundColor: '#F7F7F7',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  performanceBlock: {
    backgroundColor: '#F7F7F7',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  performanceHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  performanceTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#444444',
  },
  performanceDeleteButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: '#EFEFEF',
  },
  performanceDeletePlaceholder: {
    width: 32,
    height: 32,
  },
  performanceSetlistWrap: {
    marginTop: 20,
  },
  addPerformanceButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#A226D9',
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
    opacity: 0.6,
  },
  addPerformanceButtonText: {
    color: '#A226D9',
    fontSize: 15,
    fontWeight: '800',
  },
  inputLabel: {
    color: '#808080',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
    marginTop: 4,
  },
  inputLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  requiredLabel: {
    color: '#A226D9',
    fontSize: 8,
    fontWeight: '800',
    marginBottom: 4,
  },
  baseInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAEAEA',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#222222',
    marginBottom: 12,
  },
  liveTypeSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAEAEA',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  liveTypeLeftIcon: {
    marginRight: 10,
  },
  liveTypeSelectedText: {
    flex: 1,
    fontSize: 16,
    color: '#222222',
    fontWeight: '600',
  },
  liveTypeRightIcon: {
    marginLeft: 8,
  },
  liveTypePickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  liveTypePickerContent: {
    width: '78%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    padding: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
    elevation: 10,
  },
  liveTypePickerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#808080',
    marginBottom: 10,
  },
  liveTypePickerScroll: {
    maxHeight: 250,
  },
  liveTypePickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  liveTypePickerItemSelected: {
    backgroundColor: '#F6EBFB',
  },
  liveTypePickerItemText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#444444',
  },
  liveTypePickerItemTextSelected: {
    color: '#8315B1',
  },
  artistFieldContainer: {
    marginBottom: 10,
  },
  timeRowWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 4,
    marginBottom: 4,
  },
  timeColumn: {
    flex: 1,
  },
  timeArrow: {
    color: '#707070',
    fontSize: 13,
    marginHorizontal: 8,
    marginBottom: 22,
  },
  timeText: {
    fontSize: 16,
    color: '#222222',
  },
  multilineMemo: {
    minHeight: 90,
    maxHeight: 240,
    paddingTop: 12,
  },
  jacketContainer: {
    width: 86,
    height: 86,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#F7F7F7',
  },
  jacketImage: {
    width: '100%',
    height: '100%',
  },
  jacketRemoveButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
  },
  emptyJacketContainer: {
    width: 86,
    height: 86,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#A3A3A3',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyJacketContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomCtaWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 22,
  },
  bottomCta: {
    backgroundColor: '#A226D9',
    borderRadius: 30,
    paddingVertical: 16,
    alignItems: 'center',
  },
  bottomCtaDisabled: {
    opacity: 0.4,
  },
  bottomCtaText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  timePickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timeModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    width: '82%',
    maxWidth: 360,
    paddingTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 10,
  },
  timeOptionsScroll: {
    maxHeight: 220,
  },
  timeModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  timeModalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  timeModalCancel: {
    fontSize: 14,
    color: '#999999',
  },
  timeModalDone: {
    fontSize: 14,
    fontWeight: '600',
    color: '#D6007A',
  },
  timeOption: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  timeOptionSelected: {
    backgroundColor: '#FFF0F7',
  },
  timeOptionText: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
  },
  timeOptionTextSelected: {
    color: '#D6007A',
    fontWeight: '600',
  },
  checkedOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    zIndex: 9999,
  },
  checkedAnimation: {
    width: 300,
    height: 300,
  },
  setlistOcrSourceOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  setlistOcrSourceCard: {
    position: 'absolute',
    width: 250,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 10,
  },
  setlistOcrSourceTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#2F2F2F',
    marginBottom: 12,
  },
  setlistOcrSourceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    backgroundColor: '#F6F6F6',
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 8,
  },
  setlistOcrSourceButtonText: {
    fontSize: 14,
    color: '#3B3B3B',
    fontWeight: '700',
  },
  setlistOcrSourceCancelButton: {
    marginTop: 4,
    alignItems: 'center',
    paddingVertical: 10,
  },
  setlistOcrSourceCancelText: {
    color: '#8A8A8A',
    fontSize: 14,
    fontWeight: '700',
  },
  setlistReviewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  setlistReviewCard: {
    width: '100%',
    maxWidth: 390,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 10,
  },
  setlistReviewTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#2F2F2F',
  },
  setlistReviewNote: {
    marginTop: 6,
    marginBottom: 12,
    fontSize: 12,
    color: '#7A7A7A',
    lineHeight: 18,
  },
  setlistReviewInput: {
    minHeight: 220,
    maxHeight: 320,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E6E6E6',
    backgroundColor: '#FAFAFA',
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    color: '#222222',
  },
  setlistReviewKeyboardButton: {
    alignSelf: 'flex-end',
    marginTop: 8,
    marginBottom: 4,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  setlistReviewKeyboardButtonText: {
    fontSize: 12,
    color: '#8A8A8A',
    fontWeight: '700',
  },
  setlistReviewButtonRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  setlistReviewButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setlistReviewCancelButton: {
    backgroundColor: '#EFEFEF',
  },
  setlistReviewConfirmButton: {
    backgroundColor: '#8315B1',
  },
  setlistReviewCancelText: {
    fontSize: 14,
    color: '#646464',
    fontWeight: '700',
  },
  setlistReviewConfirmText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  ocrReviewScreen: {
    flex: 1,
    backgroundColor: '#F8F8F8',
  },
  ocrReviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: '#F8F8F8',
  },
  ocrReviewCloseButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F0F0',
  },
  ocrReviewHeaderTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#333333',
  },
  ocrReviewHeaderSpacer: {
    width: 42,
  },
  ocrReviewSummaryWrap: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  ocrReviewSummaryTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#333333',
  },
  ocrReviewSummarySub: {
    marginTop: 6,
    fontSize: 14,
    color: '#888888',
    fontWeight: '600',
  },
  ocrReviewScroll: {
    flex: 1,
  },
  ocrReviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
    marginHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  ocrReviewCardSuspicious: {
    backgroundColor: '#FFF3F2',
    borderWidth: 1,
    borderColor: '#FFD5D1',
  },
  ocrReviewCardActive: {
    opacity: 0.95,
  },
  ocrReviewIndex: {
    width: 30,
    fontSize: 14,
    color: '#888888',
    fontWeight: '700',
  },
  ocrReviewInput: {
    flex: 1,
    fontSize: 16,
    color: '#333333',
    paddingVertical: 0,
    marginRight: 8,
  },
  ocrReviewInputSuspicious: {
    color: '#FF3B30',
  },
  ocrReviewDragIcon: {
    marginLeft: 0,
    marginRight: 0,
  },
  ocrReviewDragHandle: {
    marginLeft: 8,
    marginRight: 2,
    padding: 2,
  },
  ocrReviewDeleteButton: {
    marginLeft: 4,
    padding: 4,
  },
  ocrReviewDeleteButtonSuspicious: {
    backgroundColor: '#FFE7E4',
    borderRadius: 8,
  },
  ocrReviewBottomCtaWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#F8F8F8',
    paddingTop: 8,
  },
  ocrReviewBottomCta: {
    backgroundColor: '#A226D9',
    borderRadius: 30,
    paddingVertical: 16,
    marginHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ocrReviewBottomCtaText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
});
