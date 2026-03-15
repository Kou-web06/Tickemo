import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import Purchases, { type PurchasesPackage } from 'react-native-purchases';
import { getPremiumStatusFromCustomerInfo } from '../lib/revenuecat';
import { useAppStore } from '../store/useAppStore';
import { useTranslation } from 'react-i18next';
import { useFonts, LINESeedJP_400Regular, LINESeedJP_700Bold, LINESeedJP_800ExtraBold } from '@expo-google-fonts/line-seed-jp';

interface PaywallScreenProps {
  navigation: any;
}

const BG_COLOR = '#F8F8F8';
const TEXT_DARK = '#333333';
const TEXT_MEDIUM = '#555555';
const TEXT_LIGHT = '#888888';
const TEXT_VERY_LIGHT = '#AAAAAA';
const BUTTON_COLOR = '#A226D9';
const DASHED_BORDER = '#CCCCCC';
const DEFAULT_LIFETIME_PRICE_VALUE = 480;
const DEFAULT_ORIGINAL_PRICE_VALUE = 980;

export default function PaywallScreen({ navigation }: PaywallScreenProps) {
  const { t, i18n } = useTranslation();
  const setRevenueCatState = useAppStore((state) => state.setRevenueCatState);
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();
  const [fontsLoaded] = useFonts({
    LINESeedJP_400Regular,
    LINESeedJP_700Bold,
    LINESeedJP_800ExtraBold,
  });

  const [lifetimePackage, setLifetimePackage] = useState<PurchasesPackage | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);

  const languageCode = (i18n.resolvedLanguage || i18n.language || 'ja').split('-')[0];
  const sheetHeightValue = screenHeight * 0.95;
  const patternSize = Math.max(screenWidth * 1.35, 500);
  const patternRadius = patternSize / 2;
  const patternStroke = Math.max(screenWidth * 0.08, 48);

  const sheetTranslateY = useRef(new Animated.Value(screenHeight)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  const formatFallbackPrice = useCallback(
    (value: number) => {
      if (languageCode === 'en') {
        return `$${value.toLocaleString('en-US')}`;
      }
      return `￥${value.toLocaleString('ja-JP')}`;
    },
    [languageCode]
  );

  const lifetimeFallbackPrice = formatFallbackPrice(DEFAULT_LIFETIME_PRICE_VALUE);
  const originalFallbackPrice = formatFallbackPrice(DEFAULT_ORIGINAL_PRICE_VALUE);
  const features = (t('paywall.featureList', { returnObjects: true }) as string[]) || [
    '無制限のチケット登録',
    'シェアカード全種類を解放',
    '今後の新機能もすべて無料',
  ];

  useEffect(() => {
    // Animate in
    Animated.parallel([
      Animated.timing(sheetTranslateY, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
  }, [backdropOpacity, sheetTranslateY]);

  useEffect(() => {
    let isMounted = true;

    const loadOfferings = async () => {
      try {
        const offerings = await Purchases.getOfferings();
        const availablePackages = offerings.current?.availablePackages ?? [];

        const resolvedLifetimePackage =
          availablePackages.find((pkg) => {
            const packageType = String(pkg.packageType ?? '').toUpperCase();
            const identifier = String(pkg.identifier ?? '').toLowerCase();
            const productId = String(pkg.product?.identifier ?? '').toLowerCase();
            const joined = `${identifier} ${productId}`;

            return (
              packageType === 'LIFETIME' ||
              joined.includes('lifetime') ||
              joined.includes('permanent') ||
              joined.includes('buyout') ||
              joined.includes('one_time') ||
              joined.includes('onetime')
            );
          }) ?? null;

        if (!isMounted) {
          return;
        }

        setLifetimePackage(resolvedLifetimePackage);
      } catch (error) {
        console.warn('[Paywall] Failed to load offerings:', error);
      }
    };

    loadOfferings();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleRestore = useCallback(async () => {
    try {
      const customerInfo = await Purchases.restorePurchases();
      const { isPremium, membershipType, activeEntitlementIds } = getPremiumStatusFromCustomerInfo(customerInfo);
      setRevenueCatState({
        isPremium,
        membershipType,
        activeEntitlementIds,
        revenueCatInitialized: true,
      });

      if (isPremium) {
        Alert.alert(t('paywall.alerts.restoreSuccess'), '', [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ], { cancelable: false });
        return;
      }

      Alert.alert(t('paywall.alerts.restoreFailed'), '', [
        {
          text: 'OK',
        },
      ], { cancelable: false });
    } catch (error) {
      console.warn('[Paywall] Restore failed:', error);
      Alert.alert(t('paywall.alerts.restoreFailed'));
    }
  }, [navigation, setRevenueCatState, t]);

  const handleOpenLink = useCallback(async (url: string) => {
    try {
      await WebBrowser.openBrowserAsync(url, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FORM_SHEET,
      });
    } catch (error) {
      console.warn('[Paywall] Open URL failed:', error);
    }
  }, []);

  const applyCustomerInfoToStore = useCallback((customerInfo: Awaited<ReturnType<typeof Purchases.getCustomerInfo>>) => {
    const status = getPremiumStatusFromCustomerInfo(customerInfo);
    setRevenueCatState({
      isPremium: status.isPremium,
      membershipType: status.membershipType,
      activeEntitlementIds: status.activeEntitlementIds,
      revenueCatInitialized: true,
    });
    return status;
  }, [setRevenueCatState]);

  const sleep = useCallback((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)), []);

  const waitForPremiumGrant = useCallback(async (attempts = 8, intervalMs = 900) => {
    for (let i = 0; i < attempts; i += 1) {
      const customerInfo = await Purchases.getCustomerInfo();
      const status = applyCustomerInfoToStore(customerInfo);
      if (status.isPremium) {
        return true;
      }
      await sleep(intervalMs);
    }
    return false;
  }, [applyCustomerInfoToStore, sleep]);

  const handlePurchase = useCallback(async () => {
    if (isPurchasing) {
      return;
    }

    if (!lifetimePackage) {
      Alert.alert(t('paywall.alerts.purchaseUnavailable'));
      return;
    }

    setIsPurchasing(true);

    try {
      await Purchases.purchasePackage(lifetimePackage);
      const customerInfo = await Purchases.getCustomerInfo();
      const status = applyCustomerInfoToStore(customerInfo);
      if (!status.isPremium) {
        const recovered = await waitForPremiumGrant();
        if (!recovered) {
          Alert.alert(t('paywall.alerts.purchasePendingTitle'), t('paywall.alerts.purchasePendingMessage'));
          return;
        }
      }
      navigation.goBack();
    } catch (error: any) {
      if (error?.userCancelled) {
        return;
      }

      const backendCode = Number(error?.userInfo?.rc_backend_error_code ?? -1);
      const readableErrorCode = String(error?.userInfo?.readable_error_code ?? '').toUpperCase();
      const isInvalidReceipt = backendCode === 7712 || readableErrorCode === 'INVALID_RECEIPT';

      if (isInvalidReceipt) {
        try {
          await Purchases.syncPurchases();
          const recovered = await waitForPremiumGrant();

          if (recovered) {
            Alert.alert(t('paywall.alerts.purchaseRecovered'), '', [
              {
                text: 'OK',
                onPress: () => navigation.goBack(),
              },
            ], { cancelable: false });
            return;
          }

          Alert.alert(t('paywall.alerts.purchasePendingTitle'), t('paywall.alerts.purchasePendingMessage'));
          return;
        } catch (syncError) {
          console.warn('[Paywall] syncPurchases after INVALID_RECEIPT failed:', syncError);
        }
      }

      console.warn('[Paywall] Purchase failed:', error);
      Alert.alert(t('paywall.alerts.purchaseFailed'));
    } finally {
      setIsPurchasing(false);
    }
  }, [applyCustomerInfoToStore, isPurchasing, lifetimePackage, navigation, t, waitForPremiumGrant]);

  const handleClose = useCallback(() => {
    Animated.parallel([
      Animated.timing(sheetTranslateY, {
        toValue: screenHeight,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      navigation.goBack();
    });
  }, [backdropOpacity, navigation, screenHeight, sheetTranslateY]);

  const selectedPrice = languageCode === 'en'
    ? formatFallbackPrice(Number(lifetimePackage?.product?.price ?? DEFAULT_LIFETIME_PRICE_VALUE))
    : (lifetimePackage?.product?.priceString ?? lifetimeFallbackPrice);

  if (!fontsLoaded) {
    return null;
  }

  return (
      <View style={styles.root}>
        {/* Backdrop */}
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]} />

        {/* Modal Sheet */}
        <Animated.View
          style={[
            styles.sheet,
            {
              height: sheetHeightValue,
              transform: [{ translateY: sheetTranslateY }],
            },
          ]}
        >
          <SafeAreaView style={styles.sheetContent} edges={['bottom']}>
      <View style={styles.patternContainer} pointerEvents="none">
        <View
          style={[
            styles.patternRing,
            {
              width: patternSize * 0.90,
              height: patternSize * 0.90,
              borderRadius: patternRadius,
              borderWidth: patternStroke,
              top: -patternSize * 0.56,
              right: -patternSize * 0.54,
            },
          ]}
        />
        <View
          style={[
            styles.patternRing,
            {
              width: patternSize,
              height: patternSize,
              borderRadius: patternRadius,
              borderWidth: patternStroke,
              top: -patternSize * 0.37,
              right: -patternSize * 0.80
            },
          ]}
        />
      </View>

      <View style={styles.foregroundContent}>
      {/* Close Button */}
      <TouchableOpacity
        style={styles.closeButton}
        onPress={handleClose}
        activeOpacity={0.6}
      >
        <Feather name="x" size={28} color={TEXT_DARK} />
      </TouchableOpacity>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* VIP Pass Image */}
        <ExpoImage
          source={require('../assets/paywallPass.png')}
          style={styles.vipImage}
          contentFit="contain"
          cachePolicy="memory-disk"
        />

        {/* Title */}
        <Text style={styles.title}>Plusにアップグレード</Text>

        {/* Features List */}
        <View style={styles.featuresContainer}>
          <FeatureItem
            icon="gift"
            text="無制限のチケット登録"
          />
          <FeatureItem
            icon="disc"
            text="シェアカード全種類を解放"
          />
          <FeatureItem
            icon="zap"
            text="今後の新機能もすべて無料"
          />
        </View>

        {/* Price Box */}
        <View style={styles.priceBox}>
          <Text style={styles.priceLabel}>リリース記念価格</Text>
          <Text style={styles.priceLabel}>買い切り・サブスクなし</Text>
          <Text style={styles.currentPrice}>{selectedPrice}</Text>
          <View style={styles.originalPriceWrap}>
            <Text style={styles.originalPrice}>{originalFallbackPrice}</Text>
            <ExpoImage
              source={require('../assets/scribble1.png')}
              style={styles.originalPriceScribble}
              contentFit="contain"
            />
          </View>
        </View>

        {/* Purchase Button */}
        <TouchableOpacity
          style={[styles.purchaseButton, isPurchasing && styles.purchaseButtonDisabled]}
          onPress={handlePurchase}
          disabled={isPurchasing}
          activeOpacity={0.8}
        >
          <Text style={styles.purchaseButtonText}>
            {isPurchasing ? t('paywall.ctaProcessing') : 'Upgrade to Plus'}
          </Text>
        </TouchableOpacity>

        {/* Footer Links */}
        <View style={styles.footerLinks}>
          <TouchableOpacity onPress={handleRestore}>
            <Text style={styles.footerText}>購入を復元</Text>
          </TouchableOpacity>
          <Text style={styles.footerSeparator}>・</Text>
          <TouchableOpacity onPress={() => handleOpenLink('https://traveling-fahrenheit-b9b.notion.site/Tickemo-Terms-of-Use-2f65fd5d3e2d80ba8abcda85615cde4a?pvs=74')}>
            <Text style={styles.footerText}>利用規約</Text>
          </TouchableOpacity>
          <Text style={styles.footerSeparator}>・</Text>
          <TouchableOpacity onPress={() => handleOpenLink('https://traveling-fahrenheit-b9b.notion.site/Tickemo-Privacy-Policy-2f85fd5d3e2d809b912dfc4ec2a2ed6a?pvs=74')}>
            <Text style={styles.footerText}>プライバシーポリシー</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      </View>
          </SafeAreaView>
        </Animated.View>
      </View>
  );
}

interface FeatureItemProps {
  icon: React.ComponentProps<typeof Feather>['name'];
  text: string;
}

function FeatureItem({ icon, text }: FeatureItemProps) {
  return (
    <View style={styles.featureItem}>
      <Feather name={icon} size={24} color={TEXT_MEDIUM} style={styles.featureIcon} />
      <Text style={styles.featureText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: BG_COLOR,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  sheetContent: {
    flex: 1,
    backgroundColor: BG_COLOR,
    overflow: 'hidden',
  },
  foregroundContent: {
    flex: 1,
    zIndex: 1,
  },
  patternContainer: {
    position: 'absolute',
    top: 0,
    right: 0,
    zIndex: -1,
    width: '100%',
    height: '100%',
  },
  patternRing: {
    position: 'absolute',
    borderColor: 'rgba(230, 230, 230, 0.52)',
    backgroundColor: 'transparent',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    left: 16,
    zIndex: 10,
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 0,
    paddingBottom: 40,
  },
  vipImage: {
    width: '100%',
    height: 300,
    marginTop: 0,
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontFamily: 'LINESeedJP_800ExtraBold',
    color: TEXT_DARK,
    textAlign: 'center',
    marginBottom: 32,
  },
  featuresContainer: {
    paddingHorizontal: 45,
    marginBottom: 18,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  featureIcon: {
    marginRight: 16,
  },
  featureText: {
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_MEDIUM,
    flex: 1,
  },
  priceBox: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: DASHED_BORDER,
    borderRadius: 20,
    paddingVertical: 24,
    marginHorizontal: 24,
    marginTop: 16,
    alignItems: 'center',
  },
  priceLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: TEXT_MEDIUM,
    textAlign: 'center',
    marginBottom: 8,
  },
  currentPrice: {
    fontSize: 38,
    fontWeight: '900',
    color: TEXT_DARK,
    textAlign: 'center',
  },
  originalPrice: {
    fontSize: 24,
    fontWeight: 'bold',
    color: TEXT_LIGHT,
    textAlign: 'center',
    marginTop: 4,
  },
  originalPriceWrap: {
    marginTop: 2,
    minWidth: 110,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  originalPriceScribble: {
    position: 'absolute',
    width: 100,
    height: 38,
    top: 0,
    opacity: 0.9,
    zIndex: 2,
  },
  purchaseButton: {
    backgroundColor: BUTTON_COLOR,
    borderRadius: 30,
    paddingVertical: 18,
    marginHorizontal: 24,
    marginTop: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  purchaseButtonDisabled: {
    opacity: 0.7,
  },
  purchaseButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  footerLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 40,
    gap: 8,
  },
  footerText: {
    fontSize: 12,
    color: TEXT_VERY_LIGHT,
  },
  footerSeparator: {
    fontSize: 12,
    color: TEXT_VERY_LIGHT,
  },
});
