import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  DeviceEventEmitter,
  Easing,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image as ExpoImage } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import Purchases, { type PurchasesPackage } from 'react-native-purchases';
import { getPremiumStatusFromCustomerInfo } from '../lib/revenuecat';
import { useAppStore } from '../store/useAppStore';
import { useTranslation } from 'react-i18next';

interface PaywallScreenProps {
  navigation: any;
}

const BASE_BG = '#141414';
const CARD_BG = '#1A1A1A';
const TEXT_MAIN = '#FFFFFF';
const TEXT_SUB = '#C6C6C6';
const GRADIENT_COLORS = ['#93EF84', '#8C7AF1'] as const;
const DRAG_HANDLE_HEIGHT = 28;
const IPAD_MAX_SHEET_HEIGHT = 980;
const DEFAULT_LIFETIME_PRICE_VALUE = 480;

export default function PaywallScreen({ navigation }: PaywallScreenProps) {
  const { t, i18n } = useTranslation();
  const setRevenueCatState = useAppStore((state) => state.setRevenueCatState);
  const insets = useSafeAreaInsets();
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();
  const isIpad = Platform.OS === 'ios' && Platform.isPad;
  const sheetWidth = useMemo(() => {
    if (!isIpad) return screenWidth;
    return Math.min(screenWidth * 0.82, 700);
  }, [isIpad, screenWidth]);
  const sheetHeight = useMemo(() => {
    const sheetRatio = isIpad ? 0.94 : 0.93;
    const calculatedHeight = Math.round(screenHeight * sheetRatio);
    return isIpad ? Math.min(calculatedHeight, IPAD_MAX_SHEET_HEIGHT) : calculatedHeight;
  }, [isIpad, screenHeight]);
  const dragHandleHeight = Math.max(24, Math.min(34, sheetHeight * 0.036));
  const heroHeight = Math.max(260, Math.min(380, sheetHeight * 0.38));
  const contentOverlap = Math.round(heroHeight * 0.49);
  const contentHorizontalPadding = Math.max(18, Math.min(32, sheetWidth * 0.055));
  const logoWidth = Math.max(190, Math.min(270, sheetWidth * 0.46));
  const logoHeight = Math.max(52, Math.min(74, logoWidth * 0.28));
  const unlockFontSize = Math.max(15, Math.min(20, sheetWidth * 0.03));
  const featureTextSize = Math.max(13, Math.min(16, sheetWidth * 0.024));
  const planTitleSize = Math.max(13, Math.min(16, sheetWidth * 0.024));
  const planPriceSize = Math.max(18, Math.min(22, sheetWidth * 0.033));
  const planDescriptionSize = Math.max(10, Math.min(12, sheetWidth * 0.018));
  const planCardMinHeight = Math.max(94, Math.min(120, sheetHeight * 0.13));
  const ctaMinHeight = Math.max(54, Math.min(66, sheetHeight * 0.075));
  const ctaFontSize = Math.max(17, Math.min(21, sheetWidth * 0.032));
  const footerMarginTop = isIpad
    ? Math.max(6, Math.min(12, sheetHeight * 0.012))
    : Math.max(14, Math.min(24, sheetHeight * 0.022));
  const contentBottomPadding = Math.max(16, insets.bottom + 8);

  const [lifetimePackage, setLifetimePackage] = useState<PurchasesPackage | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const languageCode = useMemo(() => (i18n.resolvedLanguage || i18n.language || 'ja').split('-')[0], [i18n.language, i18n.resolvedLanguage]);
  const formatFallbackPrice = useCallback(
    (value: number) => {
      if (languageCode === 'en') {
        return `$${value.toLocaleString('en-US')}`;
      }
      return `￥${value.toLocaleString('ja-JP')}`;
    },
    [languageCode]
  );
  const lifetimeFallbackPrice = useMemo(
    () => formatFallbackPrice(DEFAULT_LIFETIME_PRICE_VALUE),
    [formatFallbackPrice]
  );
  const features = useMemo(() => t('paywall.featureList', { returnObjects: true }) as string[], [t]);

  const sheetTranslateY = useRef(new Animated.Value(sheetHeight)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const ctaShimmerProgress = useRef(new Animated.Value(0)).current;
  const ctaShimmerLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const isClosingRef = useRef(false);

  const ctaShimmerTranslateX = useMemo(
    () =>
      ctaShimmerProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [-sheetWidth, sheetWidth],
      }),
    [ctaShimmerProgress, sheetWidth]
  );

  const closeSheet = useCallback(() => {
    if (isClosingRef.current) {
      return;
    }
    isClosingRef.current = true;

    Animated.parallel([
      Animated.timing(sheetTranslateY, {
        toValue: sheetHeight,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 140,
        useNativeDriver: true,
      }),
    ]).start(() => {
      navigation.goBack();
    });
  }, [backdropOpacity, navigation, sheetHeight, sheetTranslateY]);

  useEffect(() => {
    sheetTranslateY.setValue(sheetHeight);
    backdropOpacity.setValue(0);

    Animated.parallel([
      Animated.timing(sheetTranslateY, {
        toValue: 0,
        duration: 260,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [backdropOpacity, sheetHeight, sheetTranslateY]);

  useEffect(() => {
    return () => {
      DeviceEventEmitter.emit('app:bannerVisibility', true);
    };
  }, []);

  useEffect(() => {
    ctaShimmerLoopRef.current?.stop();
    ctaShimmerProgress.setValue(0);

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(ctaShimmerProgress, {
          toValue: 1,
          duration: 600,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.delay(1800),
        Animated.timing(ctaShimmerProgress, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );

    ctaShimmerLoopRef.current = loop;
    loop.start();

    return () => {
      ctaShimmerLoopRef.current?.stop();
    };
  }, [ctaShimmerProgress]);

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

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dy) > Math.abs(gestureState.dx) && gestureState.dy > 4,
        onPanResponderMove: (_, gestureState) => {
          if (gestureState.dy > 0) {
            sheetTranslateY.setValue(gestureState.dy);
            backdropOpacity.setValue(Math.max(0, 1 - gestureState.dy / sheetHeight));
          }
        },
        onPanResponderRelease: (_, gestureState) => {
          const shouldClose = gestureState.dy > 70 || gestureState.vy > 0.75;
          if (shouldClose) {
            closeSheet();
            return;
          }

          Animated.parallel([
            Animated.spring(sheetTranslateY, {
              toValue: 0,
              friction: 8,
              tension: 120,
              useNativeDriver: true,
            }),
            Animated.timing(backdropOpacity, {
              toValue: 1,
              duration: 120,
              useNativeDriver: true,
            }),
          ]).start();
        },
      }),
    [backdropOpacity, closeSheet, sheetHeight, sheetTranslateY]
  );

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
            onPress: closeSheet,
          },
        ], { cancelable: false });
        return;
      }

      Alert.alert(t('paywall.alerts.restoreFailed'), '', [
        {
          text: 'OK',
          onPress: closeSheet,
        },
      ], { cancelable: false });
    } catch (error) {
      console.warn('[Paywall] Restore failed:', error);

      Alert.alert(t('paywall.alerts.restoreFailed'), '', [
        {
          text: 'OK',
          onPress: closeSheet,
        },
      ], { cancelable: false });
    }
  }, [closeSheet, setRevenueCatState]);

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
      closeSheet();
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
                onPress: closeSheet,
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
  }, [applyCustomerInfoToStore, closeSheet, isPurchasing, lifetimePackage, t, waitForPremiumGrant]);

  const selectedPrice = lifetimePackage?.product?.priceString ?? lifetimeFallbackPrice;

  return (
    <View style={styles.modalRoot}>
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]} />

      <Animated.View
        style={[
          styles.sheet,
          {
            width: sheetWidth,
            height: sheetHeight,
            transform: [{ translateY: sheetTranslateY }],
            borderTopLeftRadius: Math.max(24, Math.min(34, sheetWidth * 0.045)),
            borderTopRightRadius: Math.max(24, Math.min(34, sheetWidth * 0.045)),
            alignSelf: 'center',
          },
        ]}
      >
        <SafeAreaView style={styles.container} edges={['bottom']}>
          <View style={[styles.dragHandleArea, { height: dragHandleHeight }]} {...panResponder.panHandlers}>
            <View style={styles.dragIndicator} />
          </View>

          <View style={styles.body}>
            <View style={[styles.heroWrap, { height: heroHeight }]}>
              <ExpoImage
                source={require('../assets/paywall/paywallBackground.png')}
                style={styles.heroImage}
                contentFit="cover"
              />
              <LinearGradient
                colors={['transparent', 'transparent', BASE_BG]}
                locations={[0, 0.5, 1]}
                style={styles.heroFade}
              />
            </View>

            <View
              style={[
                styles.content,
                {
                  marginTop: -contentOverlap,
                  paddingHorizontal: contentHorizontalPadding,
                  paddingBottom: contentBottomPadding,
                },
              ]}
            >
              <ExpoImage
                source={require('../assets/paywall/Plus.logo.png')}
                style={[styles.logo, { width: logoWidth, height: logoHeight }]}
                contentFit="contain"
              />

              <Text style={[styles.unlockText, { fontSize: unlockFontSize, marginBottom: Math.max(18, Math.min(30, sheetHeight * 0.03)) }]}>{t('paywall.unlockAll')}</Text>

              <View style={[styles.featureList, { marginBottom: Math.max(24, Math.min(42, sheetHeight * 0.045)), gap: Math.max(8, Math.min(12, sheetHeight * 0.012)) }]}>
                {features.map((feature) => (
                  <View style={styles.featureItem} key={feature}>
                    <Ionicons name="checkmark-circle-outline" size={18} color={TEXT_MAIN} />
                    <Text style={[styles.featureText, { fontSize: featureTextSize }]}>{feature}</Text>
                  </View>
                ))}
              </View>

              <Text style={styles.planLabel}>{t('paywall.selectPlan')}</Text>

              <View style={[styles.planRow, { marginBottom: Math.max(18, Math.min(26, sheetHeight * 0.028)) }]}>
                <View style={[styles.planCardFrame, { minHeight: planCardMinHeight, borderRadius: Math.max(14, Math.min(18, sheetWidth * 0.03)) }]}>
                  <LinearGradient
                    colors={GRADIENT_COLORS}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    style={styles.planCardBorder}
                  />
                  <View style={[styles.planCardSurface, { paddingVertical: Math.max(14, Math.min(20, sheetHeight * 0.022)) }]}>
                    <Text style={[styles.planTitle, { fontSize: planTitleSize }]}>{t('paywall.plans.lifetimeTitle')}</Text>
                    <Text style={[styles.planPrice, { fontSize: planPriceSize }]}>{selectedPrice}</Text>
                    <Text style={[styles.planDescription, { fontSize: planDescriptionSize }]}>{t('paywall.plans.lifetimeDesc')}</Text>
                  </View>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.ctaButtonWrap, isPurchasing && styles.ctaButtonWrapDisabled]}
                activeOpacity={0.9}
                onPress={handlePurchase}
                disabled={isPurchasing}
              >
                <LinearGradient
                  colors={GRADIENT_COLORS}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={[styles.ctaButton, { minHeight: ctaMinHeight }]}
                >
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      styles.ctaShimmer,
                      {
                        transform: [{ translateX: ctaShimmerTranslateX }, { rotate: '20deg' }],
                      },
                    ]}
                  />
                  <Text style={[styles.ctaText, { fontSize: ctaFontSize }]}>
                    {isPurchasing ? t('paywall.ctaProcessing') : t('paywall.ctaLifetime')}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>

              <View style={[styles.footerLinks, { marginTop: footerMarginTop }]}>
                <TouchableOpacity onPress={handleRestore}>
                  <Text style={styles.footerLinkText}>{t('paywall.restore')}</Text>
                </TouchableOpacity>
                <Text style={styles.footerSeparator}>｜</Text>
                <TouchableOpacity onPress={() => handleOpenLink('https://traveling-fahrenheit-b9b.notion.site/Tickemo-Terms-of-Use-2f65fd5d3e2d80ba8abcda85615cde4a?pvs=74')}>
                  <Text style={styles.footerLinkText}>{t('paywall.terms')}</Text>
                </TouchableOpacity>
                <Text style={styles.footerSeparator}>｜</Text>
                <TouchableOpacity onPress={() => handleOpenLink('https://traveling-fahrenheit-b9b.notion.site/Tickemo-Privacy-Policy-2f85fd5d3e2d809b912dfc4ec2a2ed6a?pvs=74')}>
                  <Text style={styles.footerLinkText}>{t('paywall.privacy')}</Text>
                </TouchableOpacity>
              </View>

            </View>
          </View>
        </SafeAreaView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    width: '100%',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: 'hidden',
    backgroundColor: BASE_BG,
  },
  container: {
    flex: 1,
    backgroundColor: BASE_BG,
  },
  dragHandleArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: DRAG_HANDLE_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
    elevation: 20,
  },
  dragIndicator: {
    width: 64,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#b5b5be',
  },
  body: {
    flex: 1,
  },
  heroWrap: {
    width: '100%',
    height: 350,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
    opacity: 0.8,
  },
  heroFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '100%',
  },
  content: {
    flex: 1,
    marginTop: -170,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  logo: {
    width: 230,
    height: 64,
    marginBottom: 2,
    marginLeft: -8,
  },
  unlockText: {
    color: TEXT_MAIN,
    fontSize: 16,
    fontWeight: '800',
    marginLeft: 8,
    marginBottom: 25,
  },
  featureList: {
    marginBottom: 38,
    gap: 8,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureText: {
    color: TEXT_MAIN,
    fontSize: 14,
    fontWeight: '700',
  },
  planLabel: {
    color: TEXT_SUB,
    fontSize: 12,
    marginBottom: 12,
    fontWeight: '600',
  },
  planRow: {
    flexDirection: 'column',
    alignItems: 'stretch',
    marginBottom: 20,
  },
  planCardFrame: {
    borderRadius: 14,
    minHeight: 96,
    overflow: 'hidden',
    padding: 1,
  },
  planCardBorder: {
    ...StyleSheet.absoluteFillObject,
  },
  planCardSurface: {
    backgroundColor: CARD_BG,
    borderRadius: 12,
    margin: 3,
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  planTitle: {
    color: TEXT_MAIN,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  planPrice: {
    color: TEXT_MAIN,
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: 8,
  },
  planDescription: {
    color: TEXT_SUB,
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 2,
  },
  ctaButtonWrap: {
    marginTop: 10,
  },
  ctaButtonWrapDisabled: {
    opacity: 0.85,
  },
  ctaButton: {
    borderRadius: 999,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  ctaShimmer: {
    position: 'absolute',
    top: -12,
    bottom: -12,
    width: 58,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  ctaText: {
    color: '#111111',
    fontSize: 18,
    fontWeight: '800',
  },
  footerLinks: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerLinkText: {
    color: TEXT_SUB,
    fontSize: 11,
    fontWeight: '600',
  },
  footerSeparator: {
    color: TEXT_SUB,
    fontSize: 11,
    marginHorizontal: 10,
  },
});
