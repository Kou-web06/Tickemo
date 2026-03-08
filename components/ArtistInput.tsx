import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Keyboard,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import { searchAppleMusicArtists, getArtworkUrl } from '../utils/appleMusicApi';
import { useTranslation } from 'react-i18next';

// Apple Music Developer Token
const APPLE_MUSIC_DEVELOPER_TOKEN = 'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjMyTVlRNk5WOTYifQ.eyJpc3MiOiJRMkxMMkI3OTJWIiwiaWF0IjoxNzY5ODQ5MDA5LCJleHAiOjE3ODU0MDEwMDksImF1ZCI6Imh0dHBzOi8vYXBwbGVpZC5hcHBsZS5jb20iLCJzdWIiOiJtZWRpYS5jb20uYW5vbnltb3VzLlRpY2tlbW8ifQ.ect6vO1q3aC9XJVYCUBVLlTHaVEcZebm0-dVZ3ak6uglI33e1ra3qcwkawXaScFFcLB8sgX5TEcFEj9QGF1Z8A';

interface ArtistSearchResult {
  id: string;
  name: string;
  imageUrl: string;
}

interface ArtistInputProps {
  value: string;
  imageUrl?: string;
  onChange: (name: string, imageUrl?: string) => void;
  placeholder?: string;
  onDropdownVisibilityChange?: (isVisible: boolean) => void;
}

export default function ArtistInput({ value, imageUrl, onChange, placeholder, onDropdownVisibilityChange }: ArtistInputProps) {
  const { t } = useTranslation();
  const resolvedPlaceholder = placeholder ?? t('artistInput.placeholder');
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState<ArtistSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedArtist, setSelectedArtist] = useState<ArtistSearchResult | null>(
    value ? { id: '', name: value, imageUrl: imageUrl || '' } : null
  );
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Notify parent when dropdown visibility changes
  useEffect(() => {
    onDropdownVisibilityChange?.(showDropdown);
  }, [showDropdown, onDropdownVisibilityChange]);

  // Update selectedArtist when value or imageUrl props change
  useEffect(() => {
    if (value) {
      setSelectedArtist({ id: '', name: value, imageUrl: imageUrl || '' });
    } else {
      setSelectedArtist(null);
    }
  }, [value, imageUrl]);

  // Apple Music API search for artists
  const searchArtists = async (term: string): Promise<ArtistSearchResult[]> => {
    try {
      const artists = await searchAppleMusicArtists(term, APPLE_MUSIC_DEVELOPER_TOKEN, 10);
      
      return artists.map((artist) => ({
        id: artist.id,
        name: artist.attributes.name,
        imageUrl: artist.attributes.artwork 
          ? getArtworkUrl(artist.attributes.artwork.url, 300)
          : '',
      }));
    } catch (error) {
      console.error('Artist search error:', error);
      return [];
    }
  };

  // Debounced search
  useEffect(() => {
    if (searchTerm.trim().length === 0) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    setIsSearching(true);

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(async () => {
      try {
        const results = await searchArtists(searchTerm);
        setSuggestions(results);
        setShowDropdown(results.length > 0);
      } catch (error) {
        console.error('Search error:', error);
        setSuggestions([]);
        setShowDropdown(false);
      } finally {
        setIsSearching(false);
      }
    }, 500);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [searchTerm]);

  const handleSelectArtist = (artist: ArtistSearchResult) => {
    setSelectedArtist(artist);
    setSearchTerm('');
    setSuggestions([]);
    setShowDropdown(false);
    onChange(artist.name, artist.imageUrl);
    Keyboard.dismiss();
  };

  const handleClearSelection = () => {
    setSelectedArtist(null);
    onChange('', '');
  };

  // State C: 選択後（確定状態）
  if (selectedArtist) {
    return (
      <View style={styles.selectedChip}>
        {selectedArtist.imageUrl ? (
          <Image
            source={{ uri: selectedArtist.imageUrl }}
            style={styles.selectedImage}
            contentFit="cover"
          />
        ) : (
          <View style={[styles.selectedImage, styles.placeholderImage]}>
            <Ionicons name="person" size={24} color="#999" />
          </View>
        )}
        <Text style={styles.selectedName} numberOfLines={1}>
          {selectedArtist.name}
        </Text>
        <TouchableOpacity
          onPress={handleClearSelection}
          style={styles.clearButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close-circle" size={24} color="#999" />
        </TouchableOpacity>
      </View>
    );
  }

  // State A & B: 入力前 / 入力中
  return (
    <View style={styles.container}>
      <View style={styles.inputContainer}>
        <View style={styles.inputBlur}>
          <View style={styles.searchRow}>
            <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
            <TextInput
              style={styles.input}
              value={searchTerm}
              onChangeText={setSearchTerm}
              placeholder={resolvedPlaceholder}
              placeholderTextColor="#CCCCCC"
              autoCapitalize="words"
              autoCorrect={false}
            />
            {isSearching && (
              <ActivityIndicator size="small" color="#999" style={styles.loader} />
            )}
          </View>
        </View>
      </View>

      {/* State B: ドロップダウン */}
      {showDropdown && suggestions.length > 0 && (
        <View style={styles.dropdown}>
          <ScrollView
            style={styles.dropdownScroll}
            contentContainerStyle={{ flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled={true}
            scrollEnabled={true}
            showsVerticalScrollIndicator={true}
            bounces={false}
          >
            {suggestions.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.suggestionItem}
                onPress={() => handleSelectArtist(item)}
                activeOpacity={0.7}
              >
                {item.imageUrl ? (
                  <Image
                    source={{ uri: item.imageUrl }}
                    style={styles.suggestionImage}
                    contentFit="cover"
                  />
                ) : (
                  <View style={[styles.suggestionImage, styles.placeholderImage]}>
                    <Ionicons name="person" size={20} color="#999" />
                  </View>
                )}
                <Text style={styles.suggestionName} numberOfLines={1}>
                  {item.name}
                </Text>
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
    zIndex: 1000,
  },
  inputContainer: {
    borderRadius: 25,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  inputBlur: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#000',
  },
  loader: {
    marginLeft: 8,
  },
  dropdown: {
    position: 'absolute',
    top: 54,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    maxHeight: 300,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1001,
  },
  dropdownScroll: {
    maxHeight: 300,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  suggestionImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
  },
  placeholderImage: {
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  suggestionName: {
    flex: 1,
    fontSize: 16,
    color: '#000',
    fontWeight: '500',
  },
  selectedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 25,
    paddingVertical: 8,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  selectedImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  selectedName: {
    flex: 1,
    fontSize: 16,
    color: '#000',
    fontWeight: '600',
  },
  clearButton: {
    marginLeft: 8,
  },
});
