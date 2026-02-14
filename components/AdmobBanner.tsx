import React from 'react';
import { StyleSheet, View } from 'react-native';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
import { isProductionMode } from '../utils/appMode';

const PROD_BANNER_ID = 'ca-app-pub-2769977162057386/6279873128';
const TEST_BANNER_ID = 'ca-app-pub-3940256099942544/2934735716';

const getBannerAdUnitId = () => (isProductionMode ? PROD_BANNER_ID : TEST_BANNER_ID);

export function AdmobBanner() {
  const adUnitId = getBannerAdUnitId();

  return (
    <View style={styles.container} pointerEvents="auto">
      <BannerAd
        unitId={adUnitId}
        size={BannerAdSize.BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: true }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
  },
});
