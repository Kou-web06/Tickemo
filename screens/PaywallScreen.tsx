import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { Infinity01Icon, CdIcon, HeartAddIcon } from '@hugeicons/core-free-icons';
import { Image as ExpoImage } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { BlurView } from 'expo-blur';
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
const BUTTON_COLOR = '#8B5CF6';
const DASHED_BORDER = '#CCCCCC';
const DEFAULT_LIFETIME_PRICE_VALUE = 480;
const DEFAULT_ORIGINAL_PRICE_VALUE = 980;

export default function PaywallScreen({ navigation }: PaywallScreenProps) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
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
  const benefits = (t('paywall.benefits', { returnObjects: true }) as Array<{ title: string; description: string }>) || [];
  const benefitIcons = [Infinity01Icon, CdIcon, HeartAddIcon] as const;

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

  const showPurchaseSuccessAlert = useCallback(() => {
    Alert.alert(
      t('paywall.alerts.purchaseRecovered', { defaultValue: '購入が完了しました' }),
      '',
      [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ],
      { cancelable: false }
    );
  }, [navigation, t]);

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
      showPurchaseSuccessAlert();
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
            showPurchaseSuccessAlert();
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
  }, [applyCustomerInfoToStore, isPurchasing, lifetimePackage, showPurchaseSuccessAlert, t, waitForPremiumGrant]);

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
      <TouchableOpacity
        style={[styles.restoreFloatingButtonWrap, { top: Math.max(2, insets.top - 16) }]}
        onPress={handleRestore}
        activeOpacity={0.75}
      >
        <BlurView intensity={18} tint="light" style={styles.restoreGlassButton}>
          <Text style={styles.restoreGlassButtonText}>購入を復元</Text>
        </BlurView>
      </TouchableOpacity>

      {/* Close Button */}
      <TouchableOpacity
        style={[styles.closeButton, { top: Math.max(0, insets.top - 18) }]}
        onPress={handleClose}
        activeOpacity={0.6}
      >
        <Feather name="x" size={28} color={TEXT_DARK} />
      </TouchableOpacity>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(220, insets.bottom + 220) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* VIP Pass Image */}
        <ExpoImage
          source={require('../assets/paywallPass.png')}
          style={styles.vipImage}
          contentFit="contain"
          cachePolicy="memory-disk"
        />

        <View style={styles.heroContainer}>
          <View style={styles.heroTitleRow}>
            <Text style={styles.heroTitlePrefix}>{t('paywall.hero.titlePrefix')}</Text>
            <View style={styles.heroPlusPill}>
              <Text style={styles.heroPlusText}>{t('paywall.hero.titlePlus')}</Text>
            </View>
          </View>
          <Text style={styles.heroSubtitle}>{t('paywall.hero.subtitle')}</Text>
        </View>

        <View style={styles.featuresContainer}>
          {benefits.map((item, index) => (
            <BenefitItem
              key={`${item.title}-${index}`}
              icon={benefitIcons[index] ?? Infinity01Icon}
              title={item.title}
              description={item.description}
              iconColor={index === 2 ? '#8B5CF6' : '#1F1F1F'}
            />
          ))}
        </View>

      </ScrollView>

      </View>

      <View style={[styles.bottomIslandWrap, { bottom: Math.max(6, insets.bottom + 2) }]}>
        <View style={styles.bottomIslandPanel}>
          <View style={styles.planCard}>
            <View style={styles.planTextBlock}>
              <Text style={styles.planTitle}>買い切り</Text>
              <Text style={styles.planSubTitle}>リリース記念価格・サブスクなし</Text>
            </View>
            <View style={styles.planPriceBlock}>
              <Text style={styles.planOriginalPrice}>{originalFallbackPrice}</Text>
              <Text style={styles.planCurrentPrice}>{selectedPrice}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.purchaseButton, isPurchasing && styles.purchaseButtonDisabled]}
            onPress={handlePurchase}
            disabled={isPurchasing}
            activeOpacity={0.82}
          >
            <View style={styles.purchaseButtonContent}>
              {isPurchasing ? (
                <ActivityIndicator size="small" color="#FFFFFF" style={styles.purchaseSpinner} />
              ) : null}
              <Text style={styles.purchaseButtonText}>
                {isPurchasing ? t('paywall.ctaProcessing') : '続ける'}
              </Text>
            </View>
          </TouchableOpacity>

          <View style={styles.footerLinks}>
            <TouchableOpacity onPress={() => handleOpenLink('https://traveling-fahrenheit-b9b.notion.site/Tickemo-Terms-of-Use-2f65fd5d3e2d80ba8abcda85615cde4a?pvs=74')}>
              <Text style={styles.footerText}>利用規約</Text>
            </TouchableOpacity>
            <Text style={styles.footerSeparator}>・</Text>
            <TouchableOpacity onPress={() => handleOpenLink('https://traveling-fahrenheit-b9b.notion.site/Tickemo-Privacy-Policy-2f85fd5d3e2d809b912dfc4ec2a2ed6a?pvs=74')}>
              <Text style={styles.footerText}>プライバシーポリシー</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
          </SafeAreaView>
        </Animated.View>
      </View>
  );
}

interface FeatureItemProps {
  icon: any;
  title: string;
  description: string;
  iconColor?: string;
}

function BenefitItem({ icon, title, description, iconColor = '#1F1F1F' }: FeatureItemProps) {
  return (
    <View style={styles.featureItem}>
      <View style={styles.featureIconWrap}>
        <HugeiconsIcon icon={icon} size={22} color={iconColor} strokeWidth={2.0} />
      </View>
      <View style={styles.featureTextBlock}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureDescription}>{description}</Text>
      </View>
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
    position: 'relative',
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
  restoreFloatingButtonWrap: {
    position: 'absolute',
    right: 12,
    zIndex: 20,
  },
  restoreGlassButton: {
    borderRadius: 30,
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.84)',
    backgroundColor: 'rgba(255,255,255,0.58)',
    marginRight: 8,
  },
  restoreGlassButtonText: {
    fontSize: 12,
    color: '#4c4c4c',
    fontFamily: 'LINESeedJP_700Bold',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 0,
    paddingBottom: 220,
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
  heroContainer: {
    paddingHorizontal: 24,
    marginBottom: 18,
  },
  heroTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  heroTitlePrefix: {
    fontSize: 34,
    color: '#151515',
    fontFamily: 'LINESeedJP_800ExtraBold',
    letterSpacing: 0.3,
  },
  heroPlusPill: {
    borderWidth: 1.5,
    borderColor: '#8B5CF6',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F5F3FF',
  },
  heroPlusText: {
    fontSize: 17,
    color: '#5B38B2',
    fontFamily: 'LINESeedJP_700Bold',
  },
  heroSubtitle: {
    marginTop: 10,
    marginBottom: 8,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    color: '#7A7A7A',
    fontFamily: 'LINESeedJP_700Bold',
  },
  featuresContainer: {
    paddingHorizontal: 30,
    marginBottom: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  featureIconWrap: {
    width: 34,
    alignItems: 'center',
    marginTop: 1,
  },
  featureTextBlock: {
    flex: 1,
    marginLeft: 12,
  },
  featureTitle: {
    fontSize: 16,
    color: '#171717',
    fontFamily: 'LINESeedJP_700Bold',
  },
  featureDescription: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 17,
    color: '#7D7D7D',
    fontFamily: 'LINESeedJP_400Regular',
    flex: 1,
  },
  bottomIslandWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 15,
  },
  bottomIslandPanel: {
    borderRadius: 38,
    padding: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.92)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 12,
  },
  planCard: {
    backgroundColor: '#F5F3FF',
    borderWidth: 2,
    borderColor: '#8B5CF6',
    borderRadius: 24,
    paddingVertical: 17,
    paddingHorizontal: 17,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  planTextBlock: {
    flex: 1,
    paddingRight: 10,
  },
  planTitle: {
    fontSize: 15,
    color: '#111111',
    fontFamily: 'LINESeedJP_700Bold',
    marginBottom: 6,
  },
  planSubTitle: {
    fontSize: 10,
    color: '#7A7A7A',
    fontFamily: 'LINESeedJP_400Regular',
  },
  planPriceBlock: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  planOriginalPrice: {
    fontSize: 14,
    color: '#9A9A9A',
    textDecorationLine: 'line-through',
    fontFamily: 'LINESeedJP_700Bold',
    lineHeight: 20,
  },
  planCurrentPrice: {
    fontSize: 20,
    color: '#181817',
    fontFamily: 'LINESeedJP_800ExtraBold',
    lineHeight: 20,
  },
  purchaseButton: {
    backgroundColor: BUTTON_COLOR,
    borderRadius: 999,
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  purchaseButtonDisabled: {
    opacity: 0.7,
  },
  purchaseButtonText: {
    fontSize: 17,
    fontFamily: 'LINESeedJP_700Bold',
    color: '#FFFFFF',
  },
  purchaseButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  purchaseSpinner: {
    marginRight: 8,
  },
  footerLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 2,
    gap: 8,
  },
  footerText: {
    fontSize: 10,
    color: '#9A9A9A',
    fontFamily: 'LINESeedJP_400Regular',
  },
  footerSeparator: {
    fontSize: 10,
    color: '#B0B0B0',
  },
});
