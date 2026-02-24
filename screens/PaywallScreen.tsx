import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  DeviceEventEmitter,
  Dimensions,
  Easing,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image as ExpoImage } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import Purchases, { type PurchasesPackage } from 'react-native-purchases';
import { getPremiumStatusFromCustomerInfo } from '../lib/revenuecat';
import { useAppStore } from '../store/useAppStore';

interface PaywallScreenProps {
  navigation: any;
}

type PlanKey = 'monthly' | 'annual' | 'lifetime';

const BASE_BG = '#141414';
const CARD_BG = '#1A1A1A';
const TEXT_MAIN = '#FFFFFF';
const TEXT_SUB = '#C6C6C6';
const GRADIENT_COLORS = ['#93EF84', '#8C7AF1'] as const;
const DRAG_HANDLE_HEIGHT = 28;

const DEFAULT_PRICES: Record<PlanKey, string> = {
  monthly: '￥250',
  annual: '￥2,000',
  lifetime: '￥3,800',
};

const FEATURES = [
  '無制限のチケット登録',
  '広告なしでストレスフリー',
  'シェアチケットの追加編集',
  '今後の新機能もすべて解放',
];

export default function PaywallScreen({ navigation }: PaywallScreenProps) {
  const setRevenueCatState = useAppStore((state) => state.setRevenueCatState);
  const { height: screenHeight, width: screenWidth } = Dimensions.get('window');
  const sheetHeight = useMemo(() => Math.round(screenHeight * 0.93), [screenHeight]);

  const [selectedPlan, setSelectedPlan] = useState<PlanKey>('annual');
  const priceMap = DEFAULT_PRICES;
  const [packagesMap, setPackagesMap] = useState<Partial<Record<PlanKey, PurchasesPackage>>>({});

  const sheetTranslateY = useRef(new Animated.Value(sheetHeight)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const badgeScale = useRef(new Animated.Value(1)).current;
  const badgeTranslateY = useRef(new Animated.Value(0)).current;
  const badgeOpacity = useRef(new Animated.Value(1)).current;
  const ctaShimmerProgress = useRef(new Animated.Value(0)).current;
  const borderRotation = useRef(new Animated.Value(0)).current;
  const borderLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const ctaShimmerLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const isClosingRef = useRef(false);

  const borderRotate = useMemo(
    () =>
      borderRotation.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
      }),
    [borderRotation]
  );

  const ctaShimmerTranslateX = useMemo(
    () =>
      ctaShimmerProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [-screenWidth, screenWidth],
      }),
    [ctaShimmerProgress, screenWidth]
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
    borderLoopRef.current?.stop();
    borderRotation.setValue(0);

    const loop = Animated.loop(
      Animated.timing(borderRotation, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    borderLoopRef.current = loop;
    loop.start();

    return () => {
      borderLoopRef.current?.stop();
    };
  }, [borderRotation, selectedPlan]);

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
    badgeScale.setValue(0);
    badgeTranslateY.setValue(10);
    badgeOpacity.setValue(0);

    Animated.parallel([
      Animated.spring(badgeScale, {
        toValue: 1,
        friction: 6,
        tension: 120,
        useNativeDriver: true,
      }),
      Animated.spring(badgeTranslateY, {
        toValue: 0,
        friction: 7,
        tension: 110,
        useNativeDriver: true,
      }),
      Animated.timing(badgeOpacity, {
        toValue: 1,
        duration: 160,
        useNativeDriver: true,
      }),
    ]).start();
  }, [badgeOpacity, badgeScale, badgeTranslateY]);

  useEffect(() => {
    let isMounted = true;

    const loadOfferings = async () => {
      try {
        const offerings = await Purchases.getOfferings();
        const availablePackages = offerings.current?.availablePackages ?? [];

        const nextPackageMap: Partial<Record<PlanKey, PurchasesPackage>> = {};

        availablePackages.forEach((pkg) => {
          const packageType = String(pkg.packageType ?? '').toUpperCase();
          const identifier = String(pkg.identifier ?? '').toLowerCase();
          const productId = String(pkg.product?.identifier ?? '').toLowerCase();
          const joined = `${identifier} ${productId}`;

          if (packageType === 'MONTHLY' || joined.includes('month')) {
            nextPackageMap.monthly = pkg;
            return;
          }

          if (packageType === 'ANNUAL' || packageType === 'YEARLY' || joined.includes('year')) {
            nextPackageMap.annual = pkg;
            return;
          }

          if (packageType === 'LIFETIME' || joined.includes('life') || joined.includes('one_time')) {
            nextPackageMap.lifetime = pkg;
          }
        });

        if (!isMounted) {
          return;
        }

        setPackagesMap(nextPackageMap);
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
        Alert.alert('購入を復元しました', '', [
          {
            text: 'OK',
            onPress: closeSheet,
          },
        ], { cancelable: false });
        return;
      }

      Alert.alert('購入の復元に失敗しました', '', [
        {
          text: 'OK',
          onPress: closeSheet,
        },
      ], { cancelable: false });
    } catch (error) {
      console.warn('[Paywall] Restore failed:', error);

      Alert.alert('購入の復元に失敗しました', '', [
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

  const handleSubscribe = useCallback(async () => {
    const selectedPackage = packagesMap[selectedPlan];
    if (!selectedPackage) {
      return;
    }

    try {
      await Purchases.purchasePackage(selectedPackage);
      const customerInfo = await Purchases.getCustomerInfo();
      const { isPremium, membershipType, activeEntitlementIds } = getPremiumStatusFromCustomerInfo(customerInfo);
      setRevenueCatState({
        isPremium,
        membershipType,
        activeEntitlementIds,
        revenueCatInitialized: true,
      });
      closeSheet();
    } catch (error: any) {
      if (error?.userCancelled) {
        return;
      }
      console.warn('[Paywall] Purchase failed:', error);
    }
  }, [closeSheet, packagesMap, selectedPlan, setRevenueCatState]);

  const renderPlanCard = (
    key: PlanKey,
    title: string,
    price: string,
    description: string,
    showBadge?: boolean,
    badgeText?: string
  ) => {
    const isSelected = selectedPlan === key;
    const cardContent = (
      <View style={styles.planCardSurface}>
        <Text style={styles.planTitle}>{title}</Text>
        <Text style={styles.planPrice}>{price}</Text>
        <Text style={styles.planDescription}>{description}</Text>
      </View>
    );

    return (
      <TouchableOpacity key={key} activeOpacity={0.9} style={styles.planCardWrap} onPress={() => setSelectedPlan(key)}>
        {showBadge ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.badgeContainer,
              {
                opacity: badgeOpacity,
                transform: [{ scale: badgeScale }, { translateY: badgeTranslateY }],
              },
            ]}
          >
            <LinearGradient colors={GRADIENT_COLORS} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.badge}>
              <Text style={styles.badgeText}>{badgeText ?? '33% OFF'}</Text>
            </LinearGradient>
          </Animated.View>
        ) : null}

        {isSelected ? (
          <View style={styles.planCardFrame}>
            <Animated.View
              pointerEvents="none"
              style={[styles.planCardAnimatedBorder, { transform: [{ rotate: borderRotate }] }]}
            >
              <LinearGradient
                colors={GRADIENT_COLORS}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={styles.planCardAnimatedGradient}
              />
            </Animated.View>
            {cardContent}
          </View>
        ) : (
          <View style={[styles.planCardFrame, styles.planCardFrameInactive]}>{cardContent}</View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.modalRoot}>
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]} />

      <Animated.View
        style={[styles.sheet, { height: sheetHeight, transform: [{ translateY: sheetTranslateY }] }]}
      >
        <SafeAreaView style={styles.container} edges={['bottom']}>
          <View style={styles.dragHandleArea} {...panResponder.panHandlers}>
            <View style={styles.dragIndicator} />
          </View>

          <View style={styles.body}>
            <View style={styles.heroWrap}>
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

            <View style={styles.content}>
              <ExpoImage
                source={require('../assets/paywall/Plus.logo.png')}
                style={styles.logo}
                contentFit="contain"
              />

              <Text style={styles.unlockText}>すべての機能をアンロックする</Text>

              <View style={styles.featureList}>
                {FEATURES.map((feature) => (
                  <View style={styles.featureItem} key={feature}>
                    <Ionicons name="checkmark-circle-outline" size={18} color={TEXT_MAIN} />
                    <Text style={styles.featureText}>{feature}</Text>
                  </View>
                ))}
              </View>

              <Text style={styles.planLabel}>プランを選択</Text>

              <View style={styles.planRow}>
                {renderPlanCard('monthly', '月額プラン', priceMap.monthly, 'お試しに最適')}
                {renderPlanCard('annual', '年額プラン', priceMap.annual, '1ヶ月あたり166円', true, '33% OFF')}
                {renderPlanCard('lifetime', '買い切り', priceMap.lifetime, '初期会員限定', true, 'リリース記念価格')}
              </View>

              <TouchableOpacity style={styles.ctaButtonWrap} activeOpacity={0.9} onPress={handleSubscribe}>
                <LinearGradient
                  colors={GRADIENT_COLORS}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={styles.ctaButton}
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
                  <Text style={styles.ctaText}>Plus を始める</Text>
                </LinearGradient>
              </TouchableOpacity>

              <Text style={styles.noticeText}>サブスクリプションは自動的に更新されます。いつでもキャンセルできます。</Text>

              <View style={styles.footerLinks}>
                <TouchableOpacity onPress={handleRestore}>
                  <Text style={styles.footerLinkText}>購入を復元</Text>
                </TouchableOpacity>
                <Text style={styles.footerSeparator}>｜</Text>
                <TouchableOpacity onPress={() => handleOpenLink('https://traveling-fahrenheit-b9b.notion.site/Tickemo-Terms-of-Use-2f65fd5d3e2d80ba8abcda85615cde4a?pvs=74')}>
                  <Text style={styles.footerLinkText}>利用規約</Text>
                </TouchableOpacity>
                <Text style={styles.footerSeparator}>｜</Text>
                <TouchableOpacity onPress={() => handleOpenLink('https://traveling-fahrenheit-b9b.notion.site/Tickemo-Privacy-Policy-2f85fd5d3e2d809b912dfc4ec2a2ed6a?pvs=74')}>
                  <Text style={styles.footerLinkText}>プライバシーポリシー</Text>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'stretch',
    marginBottom: 20,
    gap: 8,
  },
  planCardWrap: {
    flex: 1,
    position: 'relative',
  },
  planCardFrame: {
    borderRadius: 14,
    aspectRatio: 0.86,
    minHeight: 120,
    overflow: 'hidden',
  },
  planCardFrameInactive: {
    backgroundColor: BASE_BG,
  },
  planCardAnimatedBorder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planCardAnimatedGradient: {
    width: '170%',
    height: '170%',
    borderRadius: 999,
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
  badgeContainer: {
    position: 'absolute',
    top: -14,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 3,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  badgeText: {
    color: '#141414',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  ctaButtonWrap: {
    marginTop: 10,
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
  noticeText: {
    marginTop: 14,
    color: TEXT_SUB,
    fontSize: 10,
    textAlign: 'center',
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
