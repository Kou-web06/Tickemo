import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Alert, useColorScheme, Animated, Easing, Modal, ScrollView, Keyboard, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { SvgXml } from 'react-native-svg';
import LottieView from 'lottie-react-native';
import { Ionicons, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';
import * as ImagePicker from 'expo-image-picker';
import Popover, { PopoverPlacement } from 'react-native-popover-view';
import TextRecognition, { TextRecognitionScript } from '@react-native-ml-kit/text-recognition';
import { useTranslation } from 'react-i18next';
import SongInput from './SongInput';
import type { SetlistItem, SetlistSong, SetlistEncore, SetlistMC } from '../types/setlist';
import * as Crypto from 'expo-crypto';
import { getArtworkUrl, searchAppleMusicSongs } from '../utils/appleMusicApi';

const DEVELOPER_TOKEN = 'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjMyTVlRNk5WOTYifQ.eyJpc3MiOiJRMkxMMkI3OTJWIiwiaWF0IjoxNzY5ODQ5MDA5LCJleHAiOjE3ODU0MDEwMDksImF1ZCI6Imh0dHBzOi8vYXBwbGVpZC5hcHBsZS5jb20iLCJzdWIiOiJtZWRpYS5jb20uYW5vbnltb3VzLlRpY2tlbW8ifQ.ect6vO1q3aC9XJVYCUBVLlTHaVEcZebm0-dVZ3ak6uglI33e1ra3qcwkawXaScFFcLB8sgX5TEcFEj9QGF1Z8A';
const OCR_IMAGE_QUALITY = 0.55;
const MUSIC_MATCH_LIMIT = 5;
const MUSIC_EXCLUDE_KEYWORDS = ['カラオケ', 'karaoke', 'オルゴール', 'instrumental'];
const LIST_MUSIC_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#CCC" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 5H3"/><path d="M11 12H3"/><path d="M11 19H3"/><path d="M21 16V5"/><circle cx="18" cy="16" r="3"/></svg>`;

const OCR_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"><g clip-path="url(#clip0_4418_9579)"><path d="M3.49994 20.4995C4.32994 21.3295 5.66994 21.3295 6.49994 20.4995L19.4999 7.49945C20.3299 6.66945 20.3299 5.32945 19.4999 4.49945C18.6699 3.66945 17.3299 3.66945 16.4999 4.49945L3.49994 17.4995C2.66994 18.3295 2.66994 19.6695 3.49994 20.4995Z" stroke="#737373" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /><path d="M18.01 8.99023L15.01 5.99023" stroke="#737373" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /><path d="M8.5 2.44L10 2L9.56 3.5L10 5L8.5 4.56L7 5L7.44 3.5L7 2L8.5 2.44Z" stroke="#737373" stroke-linecap="round" stroke-linejoin="round" /><path d="M4.5 8.44L6 8L5.56 9.5L6 11L4.5 10.56L3 11L3.44 9.5L3 8L4.5 8.44Z" stroke="#737373" stroke-linecap="round" stroke-linejoin="round" /><path d="M19.5 13.44L21 13L20.56 14.5L21 16L19.5 15.56L18 16L18.44 14.5L18 13L19.5 13.44Z" stroke="#737373" stroke-linecap="round" stroke-linejoin="round" /></g><defs><clipPath id="clip0_4418_9579"><rect width="24" height="24" fill="white"/></clipPath></defs></svg>`;
const CAMERA_ACTION_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13.997 4a2 2 0 0 1 1.76 1.05l.486.9A2 2 0 0 0 18.003 7H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.997a2 2 0 0 0 1.759-1.048l.489-.904A2 2 0 0 1 10.004 4z"/><circle cx="12" cy="13" r="3"/></svg>`;
const GALLERY_ACTION_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"/><path d="M14 2v5a1 1 0 0 0 1 1h5"/><circle cx="10" cy="12" r="2"/><path d="m20 17-1.296-1.296a2.41 2.41 0 0 0-3.408 0L9 22"/></svg>`;
interface SetlistEditorProps {
  artistName?: string; // アーティスト名（検索フィルタ用）
  initialSongs?: SetlistItem[];
  onChange: (songs: SetlistItem[]) => void;
  onDropdownVisibilityChange?: (visible: boolean) => void;
}

export const formatSetlistText = (input: string | string[]): string[] => {
  const blacklist = ['MC', 'SE', 'ENCORE', 'アンコール'];

  const lines = Array.isArray(input)
    ? input.flatMap((line) => String(line ?? '').split(/\r?\n/))
    : String(input ?? '').split(/\r?\n/);

  return lines
    .map((line) => line.replace(/^[\s\u3000]+|[\s\u3000]+$/g, ''))
    .map((line) => line.replace(/^\d+\s*[.．]\s*/, ''))
    .map((line) => line.replace(/^\d+\s+/, ''))
    .map((line) => line.replace(/^en[\s.．\-_:：,、)]*\d*[\s.．\-_:：,、)]*/i, ''))
    .map((line) => line.replace(/^[\s\u3000]+|[\s\u3000]+$/g, ''))
    .filter((line) => {
      const lowerLine = line.toLowerCase();
      return !blacklist.some((word) => lowerLine.includes(word.toLowerCase()));
    })
    .filter((line) => line.length > 0);
};

export default function SetlistEditor({ artistName, initialSongs = [], onChange, onDropdownVisibilityChange }: SetlistEditorProps) {
  const { t } = useTranslation();
  const [songs, setSongs] = useState<SetlistItem[]>(initialSongs);
  const [isExtracting, setIsExtracting] = useState(false);
  const [showSuccessConfetti, setShowSuccessConfetti] = useState(false);
  const [showPopover, setShowPopover] = useState(false);
  const [showOcrReviewModal, setShowOcrReviewModal] = useState(false);
  const [parsedLines, setParsedLines] = useState<string[]>([]);
  const ocrRotateAnim = useRef(new Animated.Value(0)).current;
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';

  const ocrRotate = ocrRotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const handleOcrButtonPress = () => {
    ocrRotateAnim.setValue(0);
    Animated.timing(ocrRotateAnim, {
      toValue: 1,
      duration: 520,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    setShowPopover(true);
  };

  const processImageUri = async (imageUri: string) => {
    setIsExtracting(true);
    try {
      const result = await TextRecognition.recognize(imageUri, TextRecognitionScript.JAPANESE);
      const extractedText = result?.text?.trim() ?? '';
      console.log('[SetlistOCR][MLKit] recognized text:', extractedText);

      if (!extractedText) {
        Alert.alert(t('liveEdit.setlistEditor.alerts.confirm'), t('liveEdit.setlistEditor.alerts.ocrTextEmpty'));
        return;
      }

      const initialLines = formatSetlistText(extractedText);
      if (initialLines.length === 0) {
        Alert.alert(t('liveEdit.setlistEditor.alerts.confirm'), t('liveEdit.setlistEditor.alerts.noSongToAdd'));
        return;
      }

      setParsedLines(initialLines);
      setShowOcrReviewModal(true);
    } catch (error) {
      console.error('[SetlistOCR][MLKit] recognize failed:', error);
      Alert.alert(t('liveEdit.setlistEditor.alerts.error'), t('liveEdit.setlistEditor.alerts.ocrFailed'));
    } finally {
      setIsExtracting(false);
    }
  };

  const handleDeleteLine = (index: number) => {
    setParsedLines((prev) => prev.filter((_, currentIndex) => currentIndex !== index));
  };

  const handleChangeText = (index: number, text: string) => {
    setParsedLines((prev) => prev.map((line, currentIndex) => (currentIndex === index ? text : line)));
  };

  const handleSearchMusic = async () => {
    const normalizedTitles = parsedLines
      .map((line) => line.replace(/^[\s\u3000]+|[\s\u3000]+$/g, ''))
      .filter((line) => line.length > 0);

    if (normalizedTitles.length === 0) {
      Alert.alert(t('liveEdit.setlistEditor.alerts.confirm'), t('liveEdit.setlistEditor.alerts.noSongToAdd'));
      return;
    }

    setIsExtracting(true);
    try {
      await searchAndAddSongs(normalizedTitles);
      setShowOcrReviewModal(false);
      setParsedLines([]);
      setShowSuccessConfetti(true);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleGallery = async () => {
    try {
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

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const imageUri = result.assets[0].uri;
      if (!imageUri) {
        Alert.alert(t('liveEdit.setlistEditor.alerts.error'), t('liveEdit.setlistEditor.alerts.imageDataFailed'));
        return;
      }

      await processImageUri(imageUri);
    } catch (error) {
      Alert.alert(t('liveEdit.setlistEditor.alerts.error'), t('liveEdit.setlistEditor.alerts.imagePickFailed'));
    }
  };

  const handleCamera = async () => {
    try {
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

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const imageUri = result.assets[0].uri;
      if (!imageUri) {
        Alert.alert(t('liveEdit.setlistEditor.alerts.error'), t('liveEdit.setlistEditor.alerts.imageDataFailed'));
        return;
      }

      await processImageUri(imageUri);
    } catch (error) {
      Alert.alert(t('liveEdit.setlistEditor.alerts.error'), t('liveEdit.setlistEditor.alerts.cameraLaunchFailed'));
    }
  };

  const searchAndAddSongs = async (titles: string[]) => {
    const nextSongsResolved = await Promise.all(
      titles.map(async (title) => {
        const trimmedTitle = title.trim();
        if (!trimmedTitle) {
          return null;
        }

        const results = await searchAppleMusicSongs(trimmedTitle, DEVELOPER_TOKEN, MUSIC_MATCH_LIMIT);
        const matched = results.find((song) => {
          const songName = song.attributes?.name ?? '';
          const isExcluded = MUSIC_EXCLUDE_KEYWORDS.some((keyword) =>
            songName.toLowerCase().includes(keyword.toLowerCase())
          );

          return !isExcluded;
        }) ?? null;

        if (!matched) {
          return {
            id: Crypto.randomUUID(),
            type: 'song' as const,
            songId: '',
            songName: trimmedTitle,
            artistName: artistName || '',
            albumName: '',
            artworkUrl: '',
          };
        }

        const artworkUrl = matched.attributes.artwork
          ? getArtworkUrl(matched.attributes.artwork.url, 300)
          : '';

        return {
          id: Crypto.randomUUID(),
          type: 'song' as const,
          songId: matched.id,
          songName: matched.attributes.name || trimmedTitle,
          artistName: matched.attributes.artistName || artistName || '',
          albumName: '',
          artworkUrl,
        };
      })
    );

    const filteredSongs = nextSongsResolved.filter((song): song is NonNullable<typeof song> => Boolean(song));

    if (filteredSongs.length === 0) {
      return;
    }

    const nextSongs: SetlistItem[] = filteredSongs.map((song, index) => ({
      ...song,
      orderIndex: songs.length + index,
    }));

    const updatedSongs = [...songs, ...nextSongs];
    setSongs(updatedSongs);
    onChange(updatedSongs);
  };

  const handleAddSong = (songData: {
    songId: string;
    songName: string;
    artistName: string;
    albumName: string;
    artworkUrl: string;
  }) => {
    const newSong: SetlistSong = {
      id: Crypto.randomUUID(),
      type: 'song',
      songId: songData.songId,
      songName: songData.songName,
      artistName: songData.artistName,
      albumName: songData.albumName,
      artworkUrl: songData.artworkUrl,
      orderIndex: songs.length,
    };

    const updatedSongs = [...songs, newSong];
    setSongs(updatedSongs);
    onChange(updatedSongs);
  };

  const handleRemoveSong = (id: string) => {
    const updatedSongs = songs
      .filter((s) => s.id !== id)
      .map((s, index) => ({ ...s, orderIndex: index }));
    
    setSongs(updatedSongs);
    onChange(updatedSongs);
  };

  const handleReorder = (data: SetlistItem[]) => {
    const reordered = data.map((song, index) => ({
      ...song,
      orderIndex: index,
    }));
    
    setSongs(reordered);
    onChange(reordered);
  };

  const handleAddEncore = () => {
    const newItem: SetlistEncore = {
      id: Crypto.randomUUID(),
      type: 'encore',
      title: 'ENCORE',
      orderIndex: songs.length,
    };

    const updated = [...songs, newItem];
    setSongs(updated);
    onChange(updated);
  };

  const handleAddMC = () => {
    const newItem: SetlistMC = {
      id: Crypto.randomUUID(),
      type: 'mc',
      title: 'MC',
      orderIndex: songs.length,
    };

    const updated = [...songs, newItem];
    setSongs(updated);
    onChange(updated);
  };

  const handleUpdateMcTitle = (id: string, title: string) => {
    const updated = songs.map((item) =>
      item.id === id && item.type === 'mc'
        ? { ...item, title }
        : item
    );
    setSongs(updated);
    onChange(updated);
  };

  const renderSongItem = ({ item, drag, isActive }: RenderItemParams<SetlistItem>) => {
    if (item.type === 'encore') {
      return (
        <ScaleDecorator>
          <View style={[styles.encoreCard, isActive && styles.songCardActive]}>
            <View style={styles.encoreLine} />
            <Text style={styles.encoreText}>{item.title}</Text>
            <View style={styles.encoreLine} />

            <TouchableOpacity
              style={styles.dragHandle}
              onLongPress={drag}
              delayLongPress={80}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MaterialIcons name="drag-handle" size={22} color="#999" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => handleRemoveSong(item.id)}
            >
              <Ionicons name="close-circle" size={22} color="#ff645c" />
            </TouchableOpacity>
          </View>
        </ScaleDecorator>
      );
    }

    if (item.type === 'mc') {
      return (
        <ScaleDecorator>
          <View style={[styles.mcCard, isActive && styles.songCardActive]}>
            <Text style={styles.mcIcon}>🎙️</Text>
            <TextInput
              style={styles.mcInput}
              value={item.title}
              onChangeText={(text) => handleUpdateMcTitle(item.id, text)}
              placeholder="MC"
              placeholderTextColor="#999"
            />

            <TouchableOpacity
              style={styles.dragHandle}
              onLongPress={drag}
              delayLongPress={80}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MaterialIcons name="drag-handle" size={22} color="#999" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => handleRemoveSong(item.id)}
            >
              <Ionicons name="close-circle" size={22} color="#ff645c" />
            </TouchableOpacity>
          </View>
        </ScaleDecorator>
      );
    }

    const songNumber = songs
      .filter((entry) => entry.type === 'song')
      .findIndex((entry) => entry.id === item.id);

    return (
      <ScaleDecorator>
        <View style={[styles.songCard, isActive && styles.songCardActive]}>
          <View style={styles.songNumber}>
            <Text style={styles.songNumberText}>{songNumber + 1}</Text>
          </View>

          {item.artworkUrl && (
            <Image
              source={{ uri: item.artworkUrl }}
              style={styles.artwork}
              contentFit="cover"
            />
          )}

          <View style={styles.songInfo}>
            <Text style={styles.songName} numberOfLines={1}>
              {item.songName}
            </Text>
            {item.artistName && (
              <Text style={styles.artistNameSmall} numberOfLines={1}>
                {item.artistName}
              </Text>
            )}
          </View>

          <TouchableOpacity
            style={styles.dragHandle}
            onLongPress={drag}
            delayLongPress={80}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialIcons name="drag-handle" size={24} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => handleRemoveSong(item.id)}
          >
            <Ionicons name="close-circle" size={24} color="#ff645c" />
          </TouchableOpacity>
        </View>
      </ScaleDecorator>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.inputRow}>
        <View style={styles.inputWrapper}>
          <SongInput
            artistName={artistName}
            onSelectSong={handleAddSong}
            onSelectSpecial={(type) => {
              if (type === 'encore') {
                handleAddEncore();
                return;
              }
              handleAddMC();
            }}
            placeholder={t('liveEdit.setlistEditor.placeholders.songSearch')}
            onDropdownVisibilityChange={onDropdownVisibilityChange}
          />
        </View>

        <Popover
          isVisible={showPopover}
          onRequestClose={() => setShowPopover(false)}
          placement={PopoverPlacement.BOTTOM}
          offset={50}
          arrowSize={{ width: 0, height: 0 }}
          backgroundStyle={styles.popoverBackdropTransparent}
          popoverStyle={[
            styles.popoverContainer,
            isDarkMode ? styles.popoverContainerDark : styles.popoverContainerLight,
          ]}
          from={(
            <TouchableOpacity
              style={styles.ocrButton}
              onPress={handleOcrButtonPress}
              activeOpacity={0.8}
              disabled={isExtracting || showSuccessConfetti}
            >
              {isExtracting ? (
                <ActivityIndicator size="small" color="#555" />
              ) : showSuccessConfetti ? (
                <LottieView
                  source={require('../assets/animations/success confetti.json')}
                  autoPlay
                  loop={false}
                  style={styles.successConfettiLottie}
                  onAnimationFinish={() => setShowSuccessConfetti(false)}
                />
              ) : (
                <Animated.View style={{ transform: [{ rotate: ocrRotate }] }}>
                  <SvgXml xml={OCR_ICON_SVG} width={24} height={24} />
                </Animated.View>
              )}
            </TouchableOpacity>
          )}
        >
          <View style={styles.popoverContent}>
            <Text style={[styles.popoverTitle, isDarkMode && styles.popoverTitleDark]}>
              {t('liveEdit.setlistEditor.popover.bulkRegister')}
            </Text>
            <TouchableOpacity
              style={[styles.popoverActionButton, isDarkMode && styles.popoverActionButtonDark]}
              activeOpacity={0.8}
              onPress={async () => {
                setShowPopover(false);
                await handleCamera();
              }}
            >
              <SvgXml
                xml={CAMERA_ACTION_ICON_SVG.replace(/currentColor/g, isDarkMode ? '#F2F2F2' : '#373737')}
                width={16}
                height={16}
                style={styles.popoverActionIcon}
              />
              <Text style={[styles.popoverActionText, isDarkMode && styles.popoverActionTextDark]}>{t('liveEdit.setlistEditor.popover.takePhoto')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.popoverActionButton, isDarkMode && styles.popoverActionButtonDark]}
              activeOpacity={0.8}
              onPress={async () => {
                setShowPopover(false);
                await handleGallery();
              }}
            >
              <SvgXml
                xml={GALLERY_ACTION_ICON_SVG.replace(/currentColor/g, isDarkMode ? '#F2F2F2' : '#373737')}
                width={16}
                height={16}
                style={styles.popoverActionIcon}
              />
              <Text style={[styles.popoverActionText, isDarkMode && styles.popoverActionTextDark]}>{t('liveEdit.setlistEditor.popover.chooseFromAlbum')}</Text>
            </TouchableOpacity>
          </View>
        </Popover>
      </View>

      {songs.length > 0 && (
        <View style={styles.listContainer}>
          <DraggableFlatList
            data={songs}
            renderItem={renderSongItem}
            keyExtractor={(item) => item.id}
            onDragEnd={({ data }) => handleReorder(data)}
            activationDistance={6}
            autoscrollThreshold={90}
            autoscrollSpeed={240}
            scrollEnabled={true}
            showsVerticalScrollIndicator={true}
            persistentScrollbar={true}
          />
        </View>
      )}

      {songs.length === 0 && (
        <View style={styles.emptyState}>
          <SvgXml xml={LIST_MUSIC_ICON_SVG} width={48} height={48} />
          <Text style={styles.emptyText}>{t('liveEdit.setlistEditor.empty.title')}</Text>
          <Text style={styles.emptySubtext}>{t('liveEdit.setlistEditor.empty.subtitle')}</Text>
        </View>
      )}

      <Modal
        visible={showOcrReviewModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowOcrReviewModal(false)}
      >
        <Pressable style={styles.reviewBackdrop} onPress={Keyboard.dismiss}>
          <View style={[styles.reviewModal, isDarkMode && styles.reviewModalDark]}>
            <Text style={[styles.reviewTitle, isDarkMode && styles.reviewTitleDark]}>{t('liveEdit.setlistEditor.review.title')}</Text>
            <Text style={[styles.reviewNote, isDarkMode && styles.reviewNoteDark]}>
              {t('liveEdit.setlistEditor.review.note')}
            </Text>

            <TouchableOpacity
              style={[styles.keyboardCloseButton, isDarkMode && styles.keyboardCloseButtonDark]}
              onPress={Keyboard.dismiss}
              activeOpacity={0.8}
            >
              <Text style={[styles.keyboardCloseText, isDarkMode && styles.keyboardCloseTextDark]}>
                {t('liveEdit.setlistEditor.review.closeKeyboard')}
              </Text>
            </TouchableOpacity>

            <ScrollView
              style={styles.reviewListContainer}
              contentContainerStyle={styles.reviewListContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {parsedLines.map((line, index) => (
                <View key={`parsed-line-${index}`} style={styles.reviewLineRow}>
                  <TextInput
                    style={[styles.reviewLineInput, isDarkMode && styles.reviewLineInputDark]}
                    value={line}
                    onChangeText={(text) => handleChangeText(index, text)}
                    placeholder={t('liveEdit.setlistEditor.placeholders.ocrDraft')}
                    placeholderTextColor={isDarkMode ? '#9D9D9D' : '#A0A0A0'}
                  />
                  <TouchableOpacity
                    style={styles.reviewLineDeleteButton}
                    onPress={() => handleDeleteLine(index)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close" size={18} color={isDarkMode ? '#E5E5E5' : '#666666'} />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>

            <View style={styles.reviewActions}>
              <TouchableOpacity
                style={[styles.reviewCancelButton, isDarkMode && styles.reviewCancelButtonDark]}
                onPress={() => setShowOcrReviewModal(false)}
                disabled={isExtracting}
              >
                <Text style={[styles.reviewCancelText, isDarkMode && styles.reviewCancelTextDark]}>{t('liveEdit.setlistEditor.review.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.reviewConfirmButton}
                onPress={handleSearchMusic}
                disabled={isExtracting}
              >
                {isExtracting ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.reviewConfirmText}>リストに追加</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 200,
    paddingHorizontal: 14,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    
  },
  inputWrapper: {
    flex: 1,
    marginBottom: 16,
    zIndex: 100,
  },
  ocrButton: {
    marginBottom: 16,
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successConfettiLottie: {
    width: 34,
    height: 34,
  },
  popoverContainer: {
    borderRadius: 25,
    paddingVertical: 10,
    paddingHorizontal: 10,
    overflow: 'hidden',
    borderWidth: 0.1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  popoverContainerLight: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  popoverContainerDark: {
    backgroundColor: 'rgba(28, 28, 28, 0.5)',
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  popoverBackdropTransparent: {
    backgroundColor: 'transparent',
  },
  popoverContent: {
    padding: 8,
    minWidth: 220,
    gap: 8,
  },
  popoverTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#373737',
    marginBottom: 2,
  },
  popoverTitleDark: {
    color: '#F2F2F2',
  },
  popoverGuideText: {
    fontSize: 11,
    color: '#666',
    marginBottom: 4,
  },
  popoverGuideTextDark: {
    color: '#CFCFCF',
  },
  popoverActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: 'transparent',
    borderColor: '#dedede',
    borderWidth: 1,
  },
  popoverActionIcon: {
    marginRight: 8,
  },
  popoverActionButtonDark: {
    backgroundColor: 'transparent',
  },
  popoverActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#222',
  },
  popoverActionTextDark: {
    color: '#F2F2F2',
  },
  listContainer: {
    marginTop: 8,
    minHeight: 460,
  },
  songCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 8,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    gap: 12,
  },
  songCardActive: {
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  songNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  songNumberText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#666',
  },
  artwork: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: '#F0F0F0',
  },
  songInfo: {
    flex: 1,
  },
  songName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
  },
  artistNameSmall: {
    fontSize: 12,
    color: '#666',
  },
  dragHandle: {
    padding: 8,
  },
  removeButton: {
    padding: 4,
  },
  encoreCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginHorizontal: 6,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#EDEDED',
    gap: 12,
  },
  encoreLine: {
    flex: 1,
    borderBottomWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#D0D0D0',
  },
  encoreText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#666',
    letterSpacing: 1.2,
  },
  mcCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginHorizontal: 6,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#EFEFEF',
    gap: 10,
  },
  mcIcon: {
    fontSize: 18,
  },
  mcInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
    paddingVertical: 2,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#999',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 13,
    color: '#BBB',
    marginTop: 4,
  },
  reviewBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  reviewModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 28,
    maxHeight: '74%',
  },
  reviewModalDark: {
    backgroundColor: '#1F1F1F',
  },
  reviewTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#222',
  },
  reviewTitleDark: {
    color: '#F2F2F2',
  },
  reviewNote: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 18,
    color: '#666',
  },
  reviewNoteDark: {
    color: '#C8C8C8',
  },
  keyboardCloseButton: {
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#EFEFEF',
  },
  keyboardCloseButtonDark: {
    backgroundColor: '#2E2E2E',
  },
  keyboardCloseText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#444',
  },
  keyboardCloseTextDark: {
    color: '#E5E5E5',
  },
  reviewListContainer: {
    marginTop: 12,
    minHeight: 220,
    maxHeight: 360,
  },
  reviewListContent: {
    gap: 6,
    paddingVertical: 2,
  },
  reviewLineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E6E6E6',
  },
  reviewLineInput: {
    flex: 1,
    fontSize: 14,
    color: '#222',
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  reviewLineInputDark: {
    color: '#F2F2F2',
  },
  reviewLineDeleteButton: {
    marginLeft: 8,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  reviewActions: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 10,
  },
  reviewCancelButton: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D4D4D4',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  reviewCancelButtonDark: {
    borderColor: '#4A4A4A',
  },
  reviewCancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#444',
  },
  reviewCancelTextDark: {
    color: '#E4E4E4',
  },
  reviewConfirmButton: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  reviewConfirmText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFF',
  },
});
