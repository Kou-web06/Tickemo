/**
 * SetlistItem型定義（曲/アンコール/MC）
 */
export type SetlistItem = SetlistSong | SetlistEncore | SetlistMC;

export interface SetlistSong {
  id: string; // UUID for local/DB
  type: 'song';
  songId?: string; // Apple Music song ID
  songName: string;
  artistName?: string;
  albumName?: string;
  artworkUrl?: string;
  orderIndex: number;
}

export interface SetlistEncore {
  id: string;
  type: 'encore';
  title: 'ENCORE';
  orderIndex: number;
}

export interface SetlistMC {
  id: string;
  type: 'mc';
  title: string;
  note?: string;
  orderIndex: number;
}
