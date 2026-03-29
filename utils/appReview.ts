import { DeviceEventEmitter } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';

const REVIEW_REQUESTED_KEY = '@review/hasRequestedReview';
const TICKET_SAVE_COUNT_KEY = '@review/ticketSaveCount';
const REVIEW_PROMPT_COUNT_KEY = '@review/promptCount';
const REVIEW_TRIGGER_COUNT = 2;
const MAX_REVIEW_PROMPT_COUNT = 5;
export const APP_REVIEW_MODAL_OPEN_EVENT = 'appReview:openPromptModal';
export const APP_REVIEW_MODAL_RESPONSE_EVENT = 'appReview:promptModalResponse';

type ReviewPromptAction = 'review' | 'later';

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
    const hasAction = StoreReview.hasAction();
    const isAvailable = await StoreReview.isAvailableAsync();

    if (!hasAction || !isAvailable) {
      return false;
    }

    await StoreReview.requestReview();
    await AsyncStorage.setItem(REVIEW_REQUESTED_KEY, '1');
    return true;
  } catch (error) {
    console.warn('[AppReview] Failed to request review:', error);
    return false;
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

    const promptedCountRaw = await AsyncStorage.getItem(REVIEW_PROMPT_COUNT_KEY);
    const promptedCount = getNumber(promptedCountRaw);
    if (promptedCount >= MAX_REVIEW_PROMPT_COUNT) {
      return;
    }

    if (nextCount % REVIEW_TRIGGER_COUNT !== 0) {
      return;
    }

    const requested = await runReviewPromptFlow();
    if (!requested) {
      await AsyncStorage.setItem(REVIEW_PROMPT_COUNT_KEY, String(promptedCount + 1));
    }
  } catch (error) {
    console.warn('[AppReview] Failed to track ticket save:', error);
  }
};
