import { DeviceEventEmitter, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';

const REVIEW_REQUESTED_KEY = '@review/hasRequestedReview';
const TICKET_SAVE_COUNT_KEY = '@review/ticketSaveCount';
const REVIEW_TRIGGER_COUNT = 3;
const APP_STORE_REVIEW_URL = 'https://apps.apple.com/app/id6758604980?action=write-review';
export const APP_REVIEW_MODAL_OPEN_EVENT = 'appReview:openPromptModal';
export const APP_REVIEW_MODAL_RESPONSE_EVENT = 'appReview:promptModalResponse';

type ReviewPromptAction = 'review' | 'later';

const openAppStoreReviewPage = async (): Promise<boolean> => {
  try {
    const canOpen = await Linking.canOpenURL(APP_STORE_REVIEW_URL);
    if (!canOpen) return false;
    await Linking.openURL(APP_STORE_REVIEW_URL);
    return true;
  } catch (error) {
    console.warn('[AppReview] Failed to open App Store review page:', error);
    return false;
  }
};

const getNumber = (raw: string | null): number => {
  if (!raw) return 0;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
};

const waitForReviewModalResponse = (): Promise<ReviewPromptAction> =>
  new Promise((resolve) => {
    const subscription = DeviceEventEmitter.addListener(APP_REVIEW_MODAL_RESPONSE_EVENT, (payload?: { action?: ReviewPromptAction }) => {
      subscription.remove();
      resolve(payload?.action === 'review' ? 'review' : 'later');
    });

    DeviceEventEmitter.emit(APP_REVIEW_MODAL_OPEN_EVENT);
  });

const runReviewPromptFlow = async (): Promise<boolean> => {
  const action = await waitForReviewModalResponse();
  if (action === 'review') {
    return requestAppReview();
  }
  return false;
};

export const requestAppReview = async (): Promise<boolean> => {
  try {
    const hasRequestedReview = await AsyncStorage.getItem(REVIEW_REQUESTED_KEY);
    if (hasRequestedReview === '1') {
      return openAppStoreReviewPage();
    }

    const hasAction = StoreReview.hasAction();
    const isAvailable = await StoreReview.isAvailableAsync();

    if (!hasAction || !isAvailable) {
      const opened = await openAppStoreReviewPage();
      if (opened) {
        await AsyncStorage.setItem(REVIEW_REQUESTED_KEY, '1');
      }
      return opened;
    }

    await StoreReview.requestReview();
    await AsyncStorage.setItem(REVIEW_REQUESTED_KEY, '1');
    return true;
  } catch (error) {
    console.warn('[AppReview] Failed to request review:', error);
    const opened = await openAppStoreReviewPage();
    if (opened) {
      await AsyncStorage.setItem(REVIEW_REQUESTED_KEY, '1');
    }
    return opened;
  }
};

export const trackTicketSaveForReview = async (): Promise<void> => {
  try {
    const currentCountRaw = await AsyncStorage.getItem(TICKET_SAVE_COUNT_KEY);
    const nextCount = getNumber(currentCountRaw) + 1;
    await AsyncStorage.setItem(TICKET_SAVE_COUNT_KEY, String(nextCount));

    const hasRequestedReview = await AsyncStorage.getItem(REVIEW_REQUESTED_KEY);
    if (hasRequestedReview === '1') {
      return;
    }

    if (nextCount % REVIEW_TRIGGER_COUNT !== 0) {
      return;
    }

    await runReviewPromptFlow();
  } catch (error) {
    console.warn('[AppReview] Failed to track ticket save:', error);
  }
};
