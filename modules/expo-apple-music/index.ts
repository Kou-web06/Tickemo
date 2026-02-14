import { NativeModulesProxy, EventEmitter, requireNativeModule } from 'expo-modules-core';

const ExpoAppleMusicModule = requireNativeModule('ExpoAppleMusic');

export async function configureMusicKit(developerToken: string): Promise<void> {
  return await ExpoAppleMusicModule.configure(developerToken);
}

export async function authorize(): Promise<boolean> {
  return await ExpoAppleMusicModule.authorize();
}

export async function play(songId: string): Promise<void> {
  return await ExpoAppleMusicModule.play(songId);
}

export async function pause(): Promise<void> {
  return await ExpoAppleMusicModule.pause();
}

export async function stop(): Promise<void> {
  return await ExpoAppleMusicModule.stop();
}

export async function isAuthorized(): Promise<boolean> {
  return await ExpoAppleMusicModule.isAuthorized();
}

export interface ArtistSearchResult {
  id: string;
  name: string;
  imageUrl: string;
}

export async function searchArtists(term: string): Promise<ArtistSearchResult[]> {
  try {
    const jsonString = await ExpoAppleMusicModule.searchArtists(term);
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('Error searching artists:', error);
    return [];
  }
}
