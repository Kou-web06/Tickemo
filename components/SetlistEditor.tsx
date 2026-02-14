import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import SongInput from './SongInput';
import type { SetlistItem, SetlistSong, SetlistEncore, SetlistMC } from '../types/setlist';
import * as Crypto from 'expo-crypto';

interface SetlistEditorProps {
  artistName?: string; // アーティスト名（検索フィルタ用）
  initialSongs?: SetlistItem[];
  onChange: (songs: SetlistItem[]) => void;
  onDropdownVisibilityChange?: (visible: boolean) => void;
}

export default function SetlistEditor({ artistName, initialSongs = [], onChange, onDropdownVisibilityChange }: SetlistEditorProps) {
  const [songs, setSongs] = useState<SetlistItem[]>(initialSongs);

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
          <TouchableOpacity
            onLongPress={drag}
            disabled={isActive}
            style={[styles.encoreCard, isActive && styles.songCardActive]}
          >
            <View style={styles.encoreLine} />
            <Text style={styles.encoreText}>{item.title}</Text>
            <View style={styles.encoreLine} />

            <TouchableOpacity
              style={styles.dragHandle}
              onPressIn={drag}
            >
              <MaterialIcons name="drag-handle" size={22} color="#999" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => handleRemoveSong(item.id)}
            >
              <Ionicons name="close-circle" size={22} color="#ff645c" />
            </TouchableOpacity>
          </TouchableOpacity>
        </ScaleDecorator>
      );
    }

    if (item.type === 'mc') {
      return (
        <ScaleDecorator>
          <TouchableOpacity
            onLongPress={drag}
            disabled={isActive}
            style={[styles.mcCard, isActive && styles.songCardActive]}
          >
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
              onPressIn={drag}
            >
              <MaterialIcons name="drag-handle" size={22} color="#999" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => handleRemoveSong(item.id)}
            >
              <Ionicons name="close-circle" size={22} color="#ff645c" />
            </TouchableOpacity>
          </TouchableOpacity>
        </ScaleDecorator>
      );
    }

    const songNumber = songs
      .filter((entry) => entry.type === 'song')
      .findIndex((entry) => entry.id === item.id);

    return (
      <ScaleDecorator>
        <TouchableOpacity
          onLongPress={drag}
          disabled={isActive}
          style={[styles.songCard, isActive && styles.songCardActive]}
        >
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
            onPressIn={drag}
          >
            <MaterialIcons name="drag-handle" size={24} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => handleRemoveSong(item.id)}
          >
            <Ionicons name="close-circle" size={24} color="#ff645c" />
          </TouchableOpacity>
        </TouchableOpacity>
      </ScaleDecorator>
    );
  };

  return (
    <View style={styles.container}>
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
          placeholder="曲名を検索"
          onDropdownVisibilityChange={onDropdownVisibilityChange}
        />
      </View>

      {songs.length > 0 && (
        <View style={styles.listContainer}>
          <GestureHandlerRootView>
            <DraggableFlatList
              data={songs}
              renderItem={renderSongItem}
              keyExtractor={(item) => item.id}
              onDragEnd={({ data }) => handleReorder(data)}
              scrollEnabled={false}
            />
          </GestureHandlerRootView>
        </View>
      )}

      {songs.length === 0 && (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="playlist-music" size={48} color="#CCC" />
          <Text style={styles.emptyText}>曲を追加してセットリストを作成</Text>
          <Text style={styles.emptySubtext}>曲名を入力して検索してください</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 200,
  },
  inputWrapper: {
    marginBottom: 16,
    zIndex: 100,
  },
  listContainer: {
    marginTop: 8,
  },
  songCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
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
    padding: 4,
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
});
