import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { searchAppleMusicSongs, getArtworkUrl, AppleMusicSong } from '../utils/appleMusicApi';

interface SongInputProps {
  artistName?: string; // アーティスト名でフィルタ
  onSelectSong: (song: { songId: string; songName: string; artistName: string; albumName: string; artworkUrl: string }) => void;
  onSelectSpecial?: (type: 'encore' | 'mc') => void;
  placeholder?: string;
  onDropdownVisibilityChange?: (visible: boolean) => void;
}

const DEVELOPER_TOKEN = 'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjMyTVlRNk5WOTYifQ.eyJpc3MiOiJRMkxMMkI3OTJWIiwiaWF0IjoxNzY5ODQ5MDA5LCJleHAiOjE3ODU0MDEwMDksImF1ZCI6Imh0dHBzOi8vYXBwbGVpZC5hcHBsZS5jb20iLCJzdWIiOiJtZWRpYS5jb20uYW5vbnltb3VzLlRpY2tlbW8ifQ.ect6vO1q3aC9XJVYCUBVLlTHaVEcZebm0-dVZ3ak6uglI33e1ra3qcwkawXaScFFcLB8sgX5TEcFEj9QGF1Z8A';

// ひらがな・カタカナをローマ字に変換
const hiraganaToRomaji = (text: string): string => {
  const kanaMap: { [key: string]: string } = {
    'あ': 'a', 'い': 'i', 'う': 'u', 'え': 'e', 'お': 'o',
    'か': 'ka', 'き': 'ki', 'く': 'ku', 'け': 'ke', 'こ': 'ko',
    'さ': 'sa', 'し': 'shi', 'す': 'su', 'せ': 'se', 'そ': 'so',
    'た': 'ta', 'ち': 'chi', 'つ': 'tsu', 'て': 'te', 'と': 'to',
    'な': 'na', 'に': 'ni', 'ぬ': 'nu', 'ね': 'ne', 'の': 'no',
    'は': 'ha', 'ひ': 'hi', 'ふ': 'fu', 'へ': 'he', 'ほ': 'ho',
    'ま': 'ma', 'み': 'mi', 'む': 'mu', 'め': 'me', 'も': 'mo',
    'や': 'ya', 'ゆ': 'yu', 'よ': 'yo',
    'ら': 'ra', 'り': 'ri', 'る': 'ru', 'れ': 're', 'ろ': 'ro',
    'わ': 'wa', 'を': 'wo', 'ん': 'n',
    'が': 'ga', 'ぎ': 'gi', 'ぐ': 'gu', 'げ': 'ge', 'ご': 'go',
    'ざ': 'za', 'じ': 'ji', 'ず': 'zu', 'ぜ': 'ze', 'ぞ': 'zo',
    'だ': 'da', 'ぢ': 'ji', 'づ': 'zu', 'で': 'de', 'ど': 'do',
    'ば': 'ba', 'び': 'bi', 'ぶ': 'bu', 'べ': 'be', 'ぼ': 'bo',
    'ぱ': 'pa', 'ぴ': 'pi', 'ぷ': 'pu', 'ぺ': 'pe', 'ぽ': 'po',
    'きゃ': 'kya', 'きゅ': 'kyu', 'きょ': 'kyo',
    'しゃ': 'sha', 'しゅ': 'shu', 'しょ': 'sho',
    'ちゃ': 'cha', 'ちゅ': 'chu', 'ちょ': 'cho',
    'にゃ': 'nya', 'にゅ': 'nyu', 'にょ': 'nyo',
    'ひゃ': 'hya', 'ひゅ': 'hyu', 'ひょ': 'hyo',
    'みゃ': 'mya', 'みゅ': 'myu', 'みょ': 'myo',
    'りゃ': 'rya', 'りゅ': 'ryu', 'りょ': 'ryo',
    'ぎゃ': 'gya', 'ぎゅ': 'gyu', 'ぎょ': 'gyo',
    'じゃ': 'ja', 'じゅ': 'ju', 'じょ': 'jo',
    'びゃ': 'bya', 'びゅ': 'byu', 'びょ': 'byo',
    'ぴゃ': 'pya', 'ぴゅ': 'pyu', 'ぴょ': 'pyo',
    // カタカナ
    'ア': 'a', 'イ': 'i', 'ウ': 'u', 'エ': 'e', 'オ': 'o',
    'カ': 'ka', 'キ': 'ki', 'ク': 'ku', 'ケ': 'ke', 'コ': 'ko',
    'サ': 'sa', 'シ': 'shi', 'ス': 'su', 'セ': 'se', 'ソ': 'so',
    'タ': 'ta', 'チ': 'chi', 'ツ': 'tsu', 'テ': 'te', 'ト': 'to',
    'ナ': 'na', 'ニ': 'ni', 'ヌ': 'nu', 'ネ': 'ne', 'ノ': 'no',
    'ハ': 'ha', 'ヒ': 'hi', 'フ': 'fu', 'ヘ': 'he', 'ホ': 'ho',
    'マ': 'ma', 'ミ': 'mi', 'ム': 'mu', 'メ': 'me', 'モ': 'mo',
    'ヤ': 'ya', 'ユ': 'yu', 'ヨ': 'yo',
    'ラ': 'ra', 'リ': 'ri', 'ル': 'ru', 'レ': 're', 'ロ': 'ro',
    'ワ': 'wa', 'ヲ': 'wo', 'ン': 'n',
    'ガ': 'ga', 'ギ': 'gi', 'グ': 'gu', 'ゲ': 'ge', 'ゴ': 'go',
    'ザ': 'za', 'ジ': 'ji', 'ズ': 'zu', 'ゼ': 'ze', 'ゾ': 'zo',
    'ダ': 'da', 'ヂ': 'ji', 'ヅ': 'zu', 'デ': 'de', 'ド': 'do',
    'バ': 'ba', 'ビ': 'bi', 'ブ': 'bu', 'ベ': 'be', 'ボ': 'bo',
    'パ': 'pa', 'ピ': 'pi', 'プ': 'pu', 'ペ': 'pe', 'ポ': 'po',
    'キャ': 'kya', 'キュ': 'kyu', 'キョ': 'kyo',
    'シャ': 'sha', 'シュ': 'shu', 'ショ': 'sho',
    'チャ': 'cha', 'チュ': 'chu', 'チョ': 'cho',
    'ニャ': 'nya', 'ニュ': 'nyu', 'ニョ': 'nyo',
    'ヒャ': 'hya', 'ヒュ': 'hyu', 'ヒョ': 'hyo',
    'ミャ': 'mya', 'ミュ': 'myu', 'ミョ': 'myo',
    'リャ': 'rya', 'リュ': 'ryu', 'リョ': 'ryo',
    'ギャ': 'gya', 'ギュ': 'gyu', 'ギョ': 'gyo',
    'ジャ': 'ja', 'ジュ': 'ju', 'ジョ': 'jo',
    'ビャ': 'bya', 'ビュ': 'byu', 'ビョ': 'byo',
    'ピャ': 'pya', 'ピュ': 'pyu', 'ピョ': 'pyo',
  };

  let result = '';
  let i = 0;
  
  while (i < text.length) {
    // 2文字の組み合わせを先にチェック
    const twoChar = text.substring(i, i + 2);
    if (kanaMap[twoChar]) {
      result += kanaMap[twoChar];
      i += 2;
    } else {
      const oneChar = text[i];
      result += kanaMap[oneChar] || oneChar;
      i += 1;
    }
  }
  
  return result;
};

const ENCORE_KEYWORDS = ['アンコール', 'encore', 'en', 'あんこーる'];
const MC_KEYWORDS = ['mc', 'talk', 'トーク', 'しゃべり'];
const CUSTOM_SONG_KEYWORDS = ['未発表曲', '未発表', '新曲', 'オリジナル', 'custom', 'original'];

type SpecialSuggestion = { type: 'encore' | 'mc' | 'custom-song'; label: string; id: string };

const extractCustomSongTitle = (query: string): string => {
  const trimmedQuery = query.trim();
  const matchedKeyword = CUSTOM_SONG_KEYWORDS.find((keyword) =>
    trimmedQuery.toLowerCase().includes(keyword.toLowerCase())
  );

  if (!matchedKeyword) {
    return '';
  }

  const pattern = new RegExp(matchedKeyword, 'i');
  return trimmedQuery.replace(pattern, '').replace(/^[:：\-\s]+/, '').trim();
};

const getSpecialSuggestions = (query: string, t: (key: string) => string) => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [] as SpecialSuggestion[];

  const matchesKeyword = (keywords: string[]) =>
    keywords.some((keyword) => normalized.includes(keyword.toLowerCase()));

  const results: SpecialSuggestion[] = [];

  if (matchesKeyword(ENCORE_KEYWORDS)) {
    results.push({
      type: 'encore',
      label: t('liveEdit.songInput.special.encore'),
      id: 'special-encore',
    });
  }

  if (matchesKeyword(MC_KEYWORDS)) {
    results.push({
      type: 'mc',
      label: t('liveEdit.songInput.special.mc'),
      id: 'special-mc',
    });
  }

  if (matchesKeyword(CUSTOM_SONG_KEYWORDS)) {
    results.push({
      type: 'custom-song',
      label: t('liveEdit.songInput.special.customSong'),
      id: 'special-custom-song',
    });
  }

  return results;
};

export default function SongInput({ artistName, onSelectSong, onSelectSpecial, placeholder, onDropdownVisibilityChange }: SongInputProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<AppleMusicSong[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showCustomSongInput, setShowCustomSongInput] = useState(false);
  const [customSongTitle, setCustomSongTitle] = useState('');

  useEffect(() => {
    const searchSongs = async () => {
      const specialSuggestions = getSpecialSuggestions(query, t);
      if (query.trim().length < 2 && specialSuggestions.length === 0) {
        setSuggestions([]);
        setShowDropdown(false);
        onDropdownVisibilityChange?.(false);
        return;
      }

      setLoading(true);
      setShowDropdown(true);
      onDropdownVisibilityChange?.(true);

      // ひらがな・カタカナが含まれている場合、ローマ字変換も試す
      const romajiQuery = hiraganaToRomaji(query.trim());
      const searchTerms: string[] = [];
      
      // 入力フリーワードのみで検索
      searchTerms.push(query.trim());
      
      // ローマ字変換が元と異なる場合、ローマ字クエリも追加
      if (romajiQuery !== query.trim()) {
        searchTerms.push(romajiQuery);
      }
      
      // 複数の検索クエリで検索し、結果を統合（重複削除）
      const allResults: AppleMusicSong[] = [];
      const seenIds = new Set<string>();
      
      for (const searchTerm of searchTerms) {
        const results = await searchAppleMusicSongs(searchTerm, DEVELOPER_TOKEN, 10);
        for (const result of results) {
          if (!seenIds.has(result.id)) {
            seenIds.add(result.id);
            allResults.push(result);
          }
        }
      }
      
      setSuggestions(allResults.slice(0, 10)); // 最大10件に制限
      setLoading(false);
    };

    const timer = setTimeout(searchSongs, 300);
    return () => clearTimeout(timer);
  }, [query, t]);

  const specialSuggestions = getSpecialSuggestions(query, t);

  const clearInputAndDropdown = () => {
    setQuery('');
    setSuggestions([]);
    setShowDropdown(false);
    setShowCustomSongInput(false);
    setCustomSongTitle('');
    onDropdownVisibilityChange?.(false);
  };

  const handleAddCustomSong = () => {
    const songName = customSongTitle.trim();
    if (!songName) {
      Alert.alert(t('liveEdit.songInput.alerts.enterTitleTitle'), t('liveEdit.songInput.alerts.enterTitleMessage'));
      return;
    }

    onSelectSong({
      songId: '',
      songName,
      artistName: artistName || '',
      albumName: '',
      artworkUrl: '',
    });

    clearInputAndDropdown();
  };

  const handleSelectSong = (song: AppleMusicSong) => {
    const artworkUrl = song.attributes.artwork 
      ? getArtworkUrl(song.attributes.artwork.url, 300) 
      : '';

    onSelectSong({
      songId: song.id,
      songName: song.attributes.name,
      artistName: song.attributes.artistName,
      albumName: '', // Apple Music APIのsongsエンドポイントにはalbum名が直接含まれていない
      artworkUrl,
    });
    clearInputAndDropdown();
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <Ionicons name="search" size={20} color="#999" />
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          placeholder={placeholder ?? t('liveEdit.songInput.placeholders.default')}
          placeholderTextColor="#CCCCCC"
          autoCorrect={false}
          blurOnSubmit={false}
        />
        {loading && <ActivityIndicator size="small" color="#D6007A" />}
      </View>

      {showDropdown && (specialSuggestions.length > 0 || suggestions.length > 0 || showCustomSongInput) && (
        <View 
          style={styles.dropdown}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
        >
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="always"
            showsVerticalScrollIndicator={true}
            nestedScrollEnabled={true}
            bounces={true}
            scrollEventThrottle={16}
          >
            {specialSuggestions.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.specialSuggestionItem}
                onPress={() => {
                  if (item.type === 'custom-song') {
                    setShowCustomSongInput(true);
                    setCustomSongTitle(extractCustomSongTitle(query));
                    return;
                  }

                  onSelectSpecial?.(item.type);
                  clearInputAndDropdown();
                }}
              >
                <Text style={styles.specialSuggestionText}>{item.label}</Text>
                <Ionicons name="add-circle-outline" size={22} color="#D6007A" />
              </TouchableOpacity>
            ))}
            {showCustomSongInput && (
              <View style={styles.customSongContainer}>
                <Text style={styles.customSongLabel}>{t('liveEdit.songInput.customTitleLabel')}</Text>
                <View style={styles.customSongInputRow}>
                  <TextInput
                    style={styles.customSongInput}
                    value={customSongTitle}
                    onChangeText={setCustomSongTitle}
                    placeholder={t('liveEdit.songInput.placeholders.customTitle')}
                    placeholderTextColor="#A5A5A5"
                    autoCorrect={false}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity style={styles.customSongAddButton} onPress={handleAddCustomSong}>
                    <Text style={styles.customSongAddButtonText}>{t('liveEdit.songInput.addButton')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            {suggestions.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.suggestionItem}
                onPress={() => handleSelectSong(item)}
              >
                {item.attributes.artwork && (
                  <Image
                    source={{ uri: getArtworkUrl(item.attributes.artwork.url, 60) }}
                    style={styles.artwork}
                    contentFit="cover"
                  />
                )}
                <View style={styles.songInfo}>
                  <Text style={styles.songName} numberOfLines={1}>
                    {item.attributes.name}
                  </Text>
                  <Text style={styles.artistName} numberOfLines={1}>
                    {item.attributes.artistName}
                  </Text>
                </View>
                <Ionicons name="add-circle-outline" size={24} color="#D6007A" />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 100,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#000',
  },
  dropdown: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    maxHeight: 300,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 1000,
    overflow: 'hidden',
  },
  scrollView: {
    maxHeight: 300,
  },
  scrollContent: {
    paddingBottom: 8,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
    gap: 12,
  },
  specialSuggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
    justifyContent: 'space-between',
  },
  specialSuggestionText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#444',
  },
  customSongContainer: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
    gap: 8,
  },
  customSongLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#666',
  },
  customSongInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  customSongInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: '#111',
    backgroundColor: '#FFF',
  },
  customSongAddButton: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#111',
  },
  customSongAddButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF',
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
  artistName: {
    fontSize: 13,
    color: '#666',
  },
});
