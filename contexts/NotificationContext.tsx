import React, { createContext, useContext, useRef, useCallback } from 'react';

export interface PendingNotification {
  recordId: string;
  kind: string;
}

interface NotificationContextType {
  pendingNotification: PendingNotification | null;
  setPendingNotification: (notification: PendingNotification | null) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const pendingRef = useRef<PendingNotification | null>(null);

  const setPendingNotification = useCallback((notification: PendingNotification | null) => {
    pendingRef.current = notification;
  }, []);

  const getPendingNotification = useCallback((): PendingNotification | null => {
    const current = pendingRef.current;
    // 読み取り後はクリア
    pendingRef.current = null;
    return current;
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        pendingNotification: pendingRef.current,
        setPendingNotification,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotificationContext = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotificationContext must be used within NotificationProvider');
  }
  return context;
};

// グローバルアクセス用のシングルトン
let globalNotification: PendingNotification | null = null;

export const setGlobalNotification = (notification: PendingNotification | null) => {
  globalNotification = notification;
};

export const getGlobalNotification = (): PendingNotification | null => {
  const current = globalNotification;
  globalNotification = null;
  return current;
};
