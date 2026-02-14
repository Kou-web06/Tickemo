import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ChekiRecord } from '../types/record';
import type { SetlistItem } from '../types/setlist';

export interface UserProfile {
  name: string;
  username: string;
  avatarUri?: string;
  joinedAt: string;
}

interface AppState {
  lives: ChekiRecord[];
  setlists: Record<string, SetlistItem[]>;
  userProfile: UserProfile | null;
  hasOnboarded: boolean;
  hasHydrated: boolean;
  setHasHydrated: (hasHydrated: boolean) => void;
  addLive: (live: ChekiRecord) => void;
  updateLive: (id: string, live: Partial<ChekiRecord>) => void;
  deleteLive: (id: string) => void;
  clearLives: () => void;
  setSetlist: (liveId: string, items: SetlistItem[]) => void;
  clearSetlist: (liveId: string) => void;
  setProfile: (profile: UserProfile) => void;
  clearAll: () => void;
  importData: (data: { lives: ChekiRecord[]; setlists: Record<string, SetlistItem[]>; userProfile: UserProfile | null; hasOnboarded: boolean }) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      lives: [],
      setlists: {},
      userProfile: null,
      hasOnboarded: false,
      hasHydrated: false,
      setHasHydrated: (hasHydrated) => set(() => ({ hasHydrated })),
      addLive: (live) =>
        set((state) => ({
          lives: [live, ...state.lives],
        })),
      updateLive: (id, live) =>
        set((state) => ({
          lives: state.lives.map((item) => (item.id === id ? { ...item, ...live } : item)),
        })),
      deleteLive: (id) =>
        set((state) => {
          const nextSetlists = { ...state.setlists };
          delete nextSetlists[id];
          return {
            lives: state.lives.filter((item) => item.id !== id),
            setlists: nextSetlists,
          };
        }),
      clearLives: () =>
        set(() => ({
          lives: [],
          setlists: {},
        })),
      setSetlist: (liveId, items) =>
        set((state) => ({
          setlists: { ...state.setlists, [liveId]: items },
        })),
      clearSetlist: (liveId) =>
        set((state) => {
          const next = { ...state.setlists };
          delete next[liveId];
          return { setlists: next };
        }),
      setProfile: (profile) =>
        set(() => ({
          userProfile: profile,
          hasOnboarded: true,
        })),
      clearAll: () =>
        set(() => ({
          lives: [],
          setlists: {},
          userProfile: null,
          hasOnboarded: false,
        })),
      importData: (data) =>
        set(() => ({
          lives: data.lives ?? [],
          setlists: data.setlists ?? {},
          userProfile: data.userProfile ?? null,
          hasOnboarded: data.hasOnboarded ?? false,
        })),
    }),
    {
      name: 'tickemo-store',
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.log('[useAppStore] Hydration error:', error);
          return;
        }
        state?.setHasHydrated(true);
      },
    }
  )
);
