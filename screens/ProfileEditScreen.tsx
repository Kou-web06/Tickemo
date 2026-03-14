import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { BlurView } from 'expo-blur';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppStore } from '../store/useAppStore';
import { normalizeStoredImageUri, resolveLocalImageUri } from '../lib/imageUpload';
import { pushImageToCloud } from '../lib/icloudImageSync';
import { useTranslation } from 'react-i18next';

export default function ProfileEditScreen({ navigation }: any) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [joinedAt, setJoinedAt] = useState('');
  const [firstLaunchAt, setFirstLaunchAt] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [displayNameError, setDisplayNameError] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const userProfile = useAppStore((state) => state.userProfile);

  useEffect(() => {
    loadProfile();
  }, []);

  const resolvedAvatarUri = useMemo(() => resolveLocalImageUri(avatarUrl), [avatarUrl]);

  useEffect(() => {
    if (resolvedAvatarUri) {
      ExpoImage.prefetch(resolvedAvatarUri, 'memory-disk').catch(() => {});
    }
  }, [resolvedAvatarUri]);

  const loadProfile = async () => {
    try {
      setIsLoading(true);
      const display = userProfile?.name || 'User';
      const rawUsername = userProfile?.username || 'user';
      const avatar = userProfile?.avatarUri || '';
      const storedFirstLaunch = await AsyncStorage.getItem('@has_launched');
      const firstLaunchValue = storedFirstLaunch && !Number.isNaN(Date.parse(storedFirstLaunch))
        ? storedFirstLaunch
        : '';
      const joined = userProfile?.joinedAt || firstLaunchValue || '';

      setDisplayName(display);
      setUsername(rawUsername.startsWith('@') ? rawUsername.slice(1) : rawUsername);
      const normalizedAvatar = normalizeStoredImageUri(avatar) || avatar;
      setAvatarUrl(normalizedAvatar);
      setJoinedAt(joined);
      setFirstLaunchAt(firstLaunchValue);
    } catch (error) {
      console.log('Failed to load profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    const trimmedName = displayName.trim();
    const normalizedUsername = username.trim().replace(/^@+/, '');

    if (!trimmedName) {
      Alert.alert(t('profileEdit.alerts.inputError'), t('profileEdit.alerts.displayNameRequired'));
      return;
    }

    if (trimmedName.length > 8) {
      setDisplayNameError(t('profileEdit.alerts.displayNameTooLong'));
      return;
    }

    if (!normalizedUsername) {
      Alert.alert(t('profileEdit.alerts.inputError'), t('profileEdit.alerts.usernameRequired'));
      return;
    }

    try {
      setIsSaving(true);
      setDisplayNameError('');
      setUsernameError('');

      // プロフィール画像をiCloudに同期
      if (avatarUrl && avatarUrl.startsWith('Tickemo/profile/')) {
        try {
          await pushImageToCloud(avatarUrl);
          console.log('[ProfileEdit] Pushed avatar to iCloud');
        } catch (error) {
          console.log('[ProfileEdit] Failed to push avatar:', error);
        }
      }

      const storedAvatarUri = normalizeStoredImageUri(avatarUrl) || avatarUrl;
      useAppStore.getState().setProfile({
        name: trimmedName,
        username: normalizedUsername,
        avatarUri: storedAvatarUri || undefined,
        joinedAt: joinedAt || firstLaunchAt || new Date().toISOString(),
      });
      navigation.goBack();
    } catch (error) {
      console.log('Failed to update profile:', error);
      Alert.alert(
        t('profileEdit.alerts.error'),
        t('profileEdit.alerts.updateFailed', {
          message: (error as Error).message || t('profileEdit.alerts.unknownError'),
        })
      );
    } finally {
      setIsSaving(false);
    }
  };

  const initials = useMemo(() => {
    const base = displayName || username || 'U';
    return base
      .split(' ')
      .map((part) => part.trim()[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }, [displayName, username]);

  const handlePickAvatar = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('profileEdit.alerts.error'), t('profileEdit.alerts.permissionRequired'));
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9,
      });

      if (!result.canceled) {
        const sourceUri = result.assets[0].uri;
        const baseDir = FileSystem.documentDirectory;
        
        if (!baseDir) {
          console.warn('[ProfileEdit] FileSystem not available');
          Alert.alert(t('profileEdit.alerts.error'), t('profileEdit.alerts.fsUnavailable'));
          return;
        }

        // 相対パスで保存: Tickemo/profile/avatar-{timestamp}.jpg
        const dir = `${baseDir}Tickemo/profile/`;
        await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
        const filename = `avatar-${Date.now()}.jpg`;
        const targetUri = `${dir}${filename}`;
        await FileSystem.copyAsync({ from: sourceUri, to: targetUri });
        
        // 相対パスで保存
        const relativePath = `Tickemo/profile/${filename}`;
        setAvatarUrl(relativePath);
      }
    } catch (error) {
      console.log('[ProfileEdit] Failed to pick avatar:', error);
      Alert.alert(
        t('profileEdit.alerts.error'),
        t('profileEdit.alerts.imageSaveFailed', {
          message: (error as Error).message || t('profileEdit.alerts.unknownError'),
        })
      );
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <BlurView tint="light" intensity={80} style={[styles.glassHeader, { paddingTop: Math.max(insets.top, 12) }]}>
        <View style={styles.header}> 
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={26} color="#000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('profileEdit.title')}</Text>
          <TouchableOpacity
            style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <Text style={styles.saveButtonText}>{t('profileEdit.save')}</Text>
            )}
          </TouchableOpacity>
        </View>
      </BlurView>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.profileCard}>
          <View style={styles.avatarWrap}>
            {resolvedAvatarUri ? (
              <ExpoImage
                source={{ uri: resolvedAvatarUri }}
                style={styles.avatarImage}
                contentFit="cover"
                cachePolicy="memory-disk"
                priority="high"
                transition={0}
              />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitials}>{initials || 'U'}</Text>
              </View>
            )}
            <TouchableOpacity
              style={styles.avatarEditButton}
              onPress={handlePickAvatar}
            >
              <Feather name="edit-2" size={14} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          <View style={styles.profileMeta}>
            <Text style={styles.profileLabel}>{t('profileEdit.joined')}</Text>
            <Text style={styles.profileValue}>{joinedAt ? new Date(joinedAt).toLocaleDateString() : '-'}</Text>
          </View>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.sectionLabel}>{t('profileEdit.displayName')}</Text>
          <TextInput
            style={styles.input}
            value={displayName}
            onChangeText={(value) => {
              setDisplayName(value);
              if (value.trim().length > 8) {
                setDisplayNameError(t('profileEdit.alerts.displayNameTooLong'));
              } else if (displayNameError) {
                setDisplayNameError('');
              }
            }}
            placeholder={t('profileEdit.displayNamePlaceholder')}
            placeholderTextColor="#B8B8B8"
          />
          {!!displayNameError && <Text style={styles.errorText}>{displayNameError}</Text>}

          <Text style={styles.sectionLabel}>{t('profileEdit.username')}</Text>
          <View style={styles.usernameRow}>
            <Text style={styles.usernamePrefix}>@</Text>
            <TextInput
              style={styles.usernameInput}
              value={username}
              onChangeText={(value) => {
                setUsername(value);
                if (usernameError) {
                  setUsernameError('');
                }
              }}
              placeholder={t('profileEdit.usernamePlaceholder')}
              placeholderTextColor="#B8B8B8"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          {!!usernameError && <Text style={styles.errorText}>{usernameError}</Text>}
          <Text style={styles.helpText}>{t('profileEdit.helpText')}</Text>
        </View>

        {isLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator color="#000" />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F8F8',
  },
  glassHeader: {
    backgroundColor: 'rgba(248, 248, 248, 0.62)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.45)',
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
  },
  saveButton: {
    paddingHorizontal: 16,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8315B1',
    minWidth: 70,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  profileCard: {
    marginTop: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#d2d2d2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 6,
  },
  avatarWrap: {
    width: 72,
    height: 72,
    borderRadius: 71,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 72,
    height: 72,
    borderRadius: 71,
  },
  avatarFallback: {
    width: 72,
    height: 72,
    borderRadius: 71,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1F1F1F',
  },
  avatarInitials: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
  },
  avatarEditButton: {
    position: 'absolute',
    right: -6,
    bottom: -6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  profileMeta: {
    alignItems: 'flex-end',
  },
  profileLabel: {
    fontSize: 11,
    color: '#9A9A9A',
    fontWeight: '600',
    marginBottom: 6,
  },
  profileValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111111',
  },
  formCard: {
    marginTop: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    shadowColor: '#d2d2d2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 6,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9A9A9A',
    marginBottom: 10,
    marginTop: 8,
  },
  input: {
    height: 44,
    borderRadius: 14,
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 14,
    fontSize: 14,
    color: '#111111',
  },
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: 14,
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 14,
  },
  usernamePrefix: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111111',
    marginRight: 6,
  },
  usernameInput: {
    flex: 1,
    fontSize: 14,
    color: '#111111',
  },
  helpText: {
    marginTop: 10,
    fontSize: 11,
    color: '#9A9A9A',
  },
  errorText: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '700',
    color: '#E53935',
  },
  loadingOverlay: {
    marginTop: 24,
    alignItems: 'center',
  },
});
