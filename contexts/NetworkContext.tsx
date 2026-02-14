import React, { createContext, useContext, useEffect, useState } from 'react';
// import NetInfo from '@react-native-community/netinfo';

interface NetworkContextType {
  isOnline: boolean;
  isConnected: boolean;
  hasInternetReach: boolean;
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

export const NetworkProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  // 一時的に常にオンラインとして動作（開発ビルド再構築まで）
  const [isOnline] = useState(true);
  const [isConnected] = useState(true);
  const [hasInternetReach] = useState(true);

  // useEffect(() => {
  //   const unsubscribe = NetInfo.addEventListener((state) => {
  //     console.log('ネットワーク状態:', state);
  //     setIsOnline(state.isConnected ?? false);
  //     setIsConnected(state.isConnected ?? false);
  //     setHasInternetReach(state.isInternetReachable ?? false);
  //   });

  //   // 初期状態を取得
  //   NetInfo.fetch().then((state) => {
  //     setIsOnline(state.isConnected ?? false);
  //     setIsConnected(state.isConnected ?? false);
  //     setHasInternetReach(state.isInternetReachable ?? false);
  //   });

  //   return () => {
  //     unsubscribe();
  //   };
  // }, []);

  return (
    <NetworkContext.Provider
      value={{
        isOnline,
        isConnected,
        hasInternetReach,
      }}
    >
      {children}
    </NetworkContext.Provider>
  );
};

/**
 * ネットワーク状態を取得するフック
 * @returns { isOnline, isConnected, hasInternetReach }
 */
export const useNetwork = (): NetworkContextType => {
  const context = useContext(NetworkContext);
  if (context === undefined) {
    throw new Error('useNetwork must be used within NetworkProvider');
  }
  return context;
};
