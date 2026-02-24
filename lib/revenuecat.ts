import { Platform } from 'react-native';
import Constants from 'expo-constants';
import Purchases, { LOG_LEVEL, type CustomerInfo } from 'react-native-purchases';
import type { MembershipType } from '../store/useAppStore';

export const TICKEMO_PLUS_ENTITLEMENT_ID = 'Tickemo Plus';

type RevenueCatExtra = {
  revenueCatAppleApiKey?: string;
};

const resolveAppleApiKey = () => {
  const fromEnv = process.env.EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY;
  if (fromEnv && fromEnv.trim().length > 0) {
    return fromEnv;
  }

  const fromExtra = (Constants.expoConfig?.extra as RevenueCatExtra | undefined)?.revenueCatAppleApiKey;
  if (fromExtra && fromExtra.trim().length > 0) {
    return fromExtra;
  }

  return null;
};

export const getPremiumStatusFromCustomerInfo = (customerInfo: CustomerInfo) => {
  const activeEntitlements = customerInfo.entitlements.active ?? {};
  const activeEntitlementIds = Object.keys(activeEntitlements);
  const isPremium = activeEntitlementIds.length > 0;
  const activeEntitlement =
    activeEntitlements[TICKEMO_PLUS_ENTITLEMENT_ID] ??
    (activeEntitlementIds.length > 0 ? activeEntitlements[activeEntitlementIds[0]] : undefined);
  const productIdentifier = activeEntitlement?.productIdentifier?.toLowerCase() ?? '';

  let membershipType: MembershipType = 'free';
  if (isPremium) {
    const isLifetime =
      productIdentifier.includes('lifetime') ||
      productIdentifier.includes('permanent') ||
      productIdentifier.includes('buyout') ||
      productIdentifier.includes('one_time') ||
      productIdentifier.includes('onetime');

    membershipType = isLifetime ? 'lifetime' : 'plus';
  }

  return {
    isPremium,
    membershipType,
    activeEntitlementIds,
  };
};

export const initializeRevenueCat = async () => {
  if (Platform.OS !== 'ios') {
    return {
      initialized: false,
      customerInfo: null as CustomerInfo | null,
      reason: 'RevenueCat Apple key is configured only for iOS.',
    };
  }

  const apiKey = resolveAppleApiKey();
  if (!apiKey) {
    return {
      initialized: false,
      customerInfo: null as CustomerInfo | null,
      reason: 'RevenueCat API key is missing.',
    };
  }

  if (__DEV__) {
    Purchases.setLogLevel(LOG_LEVEL.DEBUG);
  }

  Purchases.configure({ apiKey });

  const customerInfo = await Purchases.getCustomerInfo();

  return {
    initialized: true,
    customerInfo,
    reason: null as string | null,
  };
};
