import { useEffect, useRef, useState, useCallback } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

const getProjectId = () => {
  return Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
};

interface NotificationData {
  type?: string;
  recordId?: string;
  kind?: string;
}

export const usePushNotifications = (onNotificationTap?: (data: NotificationData) => void) => {
  const [expoPushToken, setExpoPushToken] = useState<string>('');
  const [permissionStatus, setPermissionStatus] = useState<Notifications.PermissionStatus | null>(null);
  const isRegistering = useRef(false);

  useEffect(() => {
    const registerForPushNotifications = async () => {
      if (isRegistering.current) return;
      isRegistering.current = true;

      try {
        if (!Device.isDevice) {
          console.log('[PushNotifications] Physical device required for push notifications');
          return;
        }

        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
          });
        }

        const permission = await Notifications.getPermissionsAsync();
        let status = permission.status;
        if (status !== 'granted') {
          const request = await Notifications.requestPermissionsAsync();
          status = request.status;
        }

        setPermissionStatus(status);
        if (status !== 'granted') return;

        const projectId = getProjectId();
        const tokenResponse = projectId
          ? await Notifications.getExpoPushTokenAsync({ projectId })
          : await Notifications.getExpoPushTokenAsync();

        setExpoPushToken(tokenResponse.data);
      } catch (error) {
        console.log('[PushNotifications] Failed to register:', error);
      } finally {
        isRegistering.current = false;
      }
    };

    registerForPushNotifications();
  }, []);

  useEffect(() => {
    if (!onNotificationTap) return;

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as NotificationData;
      onNotificationTap(data);
    });

    return () => subscription.remove();
  }, [onNotificationTap]);

  return {
    expoPushToken,
    permissionStatus,
  };
};
