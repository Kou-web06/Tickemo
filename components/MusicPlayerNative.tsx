import React, { useRef, useImperativeHandle, forwardRef, useEffect } from 'react';
import * as AppleMusic from 'expo-apple-music';

interface MusicPlayerProps {
  developerToken: string;
  onReady?: (isReady: boolean) => void;
}

export interface MusicPlayerRef {
  play: (songId: string) => Promise<void>;
  pause: () => Promise<void>;
  stop: () => Promise<void>;
  isReady: () => boolean;
}

const MusicPlayer = forwardRef<MusicPlayerRef, MusicPlayerProps>(({ developerToken, onReady }, ref) => {
  const isReadyRef = useRef(false);

  useEffect(() => {
    const init = async () => {
      try {
        await AppleMusic.configureMusicKit(developerToken);
        isReadyRef.current = true;
        if (onReady) onReady(true);
      } catch (error) {
        console.error('[MusicPlayer] Init error:', error);
      }
    };
    
    init();
  }, [developerToken, onReady]);

  useImperativeHandle(ref, () => ({
    play: async (songId: string) => {
      if (!isReadyRef.current) {
        console.error('[MusicPlayer] Not ready yet');
        return;
      }
      
      try {
        const authorized = await AppleMusic.isAuthorized();
        if (!authorized) {
          const success = await AppleMusic.authorize();
          if (!success) {
            console.error('[MusicPlayer] Authorization failed');
            return;
          }
        }
        
        await AppleMusic.play(songId);
      } catch (error) {
        console.error('[MusicPlayer] Play error:', error);
      }
    },
    pause: async () => {
      try {
        await AppleMusic.pause();
      } catch (error) {
        console.error('[MusicPlayer] Pause error:', error);
      }
    },
    stop: async () => {
      try {
        await AppleMusic.stop();
      } catch (error) {
        console.error('[MusicPlayer] Stop error:', error);
      }
    },
    isReady: () => isReadyRef.current,
  }));

  return null;
});

export default MusicPlayer;
