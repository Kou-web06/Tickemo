import { useCallback, useEffect, useMemo, useState } from 'react';
import { AdEventType, RewardedAd, RewardedAdEventType, TestIds } from 'react-native-google-mobile-ads';
import { isTestflightMode } from '../utils/appMode';

const getAdUnitId = () => (__DEV__ ? TestIds.REWARDED : 'ca-app-pub-2769977162057386/8581850831');

export const useRewardAd = () => {
  const adsDisabled = isTestflightMode;
  const adUnitId = getAdUnitId();

  const rewarded = useMemo(
    () => {
      if (adsDisabled) return null;
      return RewardedAd.createForAdRequest(adUnitId, {
        requestNonPersonalizedAdsOnly: true,
      });
    },
    [adUnitId, adsDisabled]
  );

  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [earned, setEarned] = useState(false);
  const [isClosed, setIsClosed] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!rewarded) return;
    const unsubscribeLoaded = rewarded.addAdEventListener(RewardedAdEventType.LOADED, () => {
      setIsLoaded(true);
      setIsLoading(false);
      setError(null);
    });

    const unsubscribeError = rewarded.addAdEventListener(AdEventType.ERROR, (payload) => {
      setIsLoaded(false);
      setIsLoading(false);
      setError(payload as Error);
    });

    const unsubscribeEarned = rewarded.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
      setEarned(true);
    });

    const unsubscribeClosed = rewarded.addAdEventListener(AdEventType.CLOSED, () => {
      setIsLoaded(false);
      setIsLoading(false);
      setIsClosed(true);
      // 次回のために再ロード
      rewarded.load();
    });

    // 初回ロード
    setIsLoading(true);
    rewarded.load();

    return () => {
      unsubscribeLoaded();
      unsubscribeError();
      unsubscribeEarned();
      unsubscribeClosed();
    };
  }, [rewarded]);

  const load = useCallback(() => {
    if (adsDisabled) return;
    if (isLoading || isLoaded) return;
    if (!rewarded) return;
    setIsLoading(true);
    rewarded.load();
  }, [adsDisabled, isLoading, isLoaded, rewarded]);

  const show = useCallback(async () => {
    if (adsDisabled) return false;
    if (!isLoaded) return false;
    if (!rewarded) return false;
    try {
      await rewarded.show();
      return true;
    } catch (e) {
      setError(e as Error);
      return false;
    }
  }, [adsDisabled, isLoaded, rewarded]);

  const resetEarned = useCallback(() => setEarned(false), []);
  const resetClosed = useCallback(() => setIsClosed(false), []);

  return {
    isLoaded: adsDisabled ? false : isLoaded,
    isLoading: adsDisabled ? false : isLoading,
    earned: adsDisabled ? false : earned,
    isClosed: adsDisabled ? false : isClosed,
    error: adsDisabled ? null : error,
    load,
    show,
    resetEarned,
    resetClosed,
  };
};