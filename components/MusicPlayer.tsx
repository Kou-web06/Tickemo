import React, { useRef, useImperativeHandle, forwardRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

interface MusicPlayerProps {
  developerToken: string;
  onReady?: (isReady: boolean) => void;
}

export interface MusicPlayerRef {
  play: (songId: string) => void;
  pause: () => void;
  stop: () => void;
  isReady: () => boolean;
}

const MusicPlayer = forwardRef<MusicPlayerRef, MusicPlayerProps>(({ developerToken, onReady }, ref) => {
  const webViewRef = useRef<WebView>(null);
  const isReadyRef = useRef(false);

  useImperativeHandle(ref, () => ({
    play: (songId: string) => {
      if (!isReadyRef.current) {
        console.error('[MusicPlayer] Not ready yet');
        return;
      }
      
      const musicKitSongId = `song/${songId}`;
      const script = `
        (function() {
          try {
            if (!window.musicKitInstance) {
              window.ReactNativeWebView?.postMessage(JSON.stringify({
                type: 'PLAY_ERROR',
                error: 'MusicKit not initialized'
              }));
              return;
            }
            
            const playAudio = async () => {
              try {
                if (!window.musicKitInstance.isAuthorized) {
                  await window.musicKitInstance.authorize();
                }
                
                await window.musicKitInstance.setQueue({ songs: ['${musicKitSongId}'] });
                await window.musicKitInstance.play();
                
                window.ReactNativeWebView?.postMessage(JSON.stringify({
                  type: 'PLAYING',
                  songId: '${musicKitSongId}'
                }));
              } catch (error) {
                window.ReactNativeWebView?.postMessage(JSON.stringify({
                  type: 'PLAY_ERROR',
                  error: error.message
                }));
              }
            };
            
            playAudio();
          } catch (e) {
            window.ReactNativeWebView?.postMessage(JSON.stringify({
              type: 'PLAY_ERROR',
              error: e.message
            }));
          }
        })();
      `;
      webViewRef.current?.injectJavaScript(script);
    },
    pause: () => {
      const script = `
        if (window.musicKitInstance) window.musicKitInstance.pause();
      `;
      webViewRef.current?.injectJavaScript(script);
    },
    stop: () => {
      const script = `
        if (window.musicKitInstance) window.musicKitInstance.stop();
      `;
      webViewRef.current?.injectJavaScript(script);
    },
    isReady: () => isReadyRef.current,
  }));

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <script src="https://js-cdn.music.apple.com/musickit/v3/musickit.js"></script>
      </head>
      <body>
        <script>
          let isConfigured = false;
          const DEVELOPER_TOKEN = '${developerToken}';
          
          function initializeMusicKit() {
            if (isConfigured) {
              return;
            }
            
            if (!window.MusicKit) {
              setTimeout(initializeMusicKit, 100);
              return;
            }
            
            try {
              MusicKit.configure({
                developerToken: DEVELOPER_TOKEN,
                app: { name: 'Tickemo', build: '1.0.0' }
              });
              
              window.musicKitInstance = MusicKit.getInstance();
              isConfigured = true;
              
              console.log('[MusicKit] Initialized successfully');
              
              window.ReactNativeWebView?.postMessage(JSON.stringify({
                type: 'MUSICKIT_READY'
              }));
            } catch (e) {
              console.error('[MusicKit] Config error:', e.message);
              window.ReactNativeWebView?.postMessage(JSON.stringify({
                type: 'MUSICKIT_ERROR',
                error: e.message
              }));
            }
          }
          
          document.addEventListener('musickitloaded', initializeMusicKit);
          setTimeout(initializeMusicKit, 500);
        </script>
      </body>
    </html>
  `;

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ html: htmlContent }}
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        onMessage={(event) => {
          try {
            const message = JSON.parse(event.nativeEvent.data);
            
            if (message.type === 'MUSICKIT_READY') {
              isReadyRef.current = true;
              if (onReady) onReady(true);
            } else if (message.type === 'PLAY_ERROR') {
              console.error('[MusicPlayer] Play error:', message.error);
            } else if (message.type === 'MUSICKIT_ERROR') {
              console.error('[MusicPlayer] MusicKit error:', message.error);
            }
          } catch (e) {
            console.warn('[MusicPlayer] Message error:', e);
          }
        }}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    width: 0,
    height: 0,
    overflow: 'hidden',
    position: 'absolute',
  },
  webview: {
    width: 0,
    height: 0,
    opacity: 0,
  },
});

export default MusicPlayer;
