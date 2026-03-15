import React, { useEffect, useMemo, useState } from 'react';
import {
  DeviceEventEmitter,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { Cancel01Icon, HeartAddIcon, InLoveIcon, StarIcon, SurpriseIcon } from '@hugeicons/core-free-icons';
import { useTranslation } from 'react-i18next';
import { APP_REVIEW_MODAL_OPEN_EVENT, APP_REVIEW_MODAL_RESPONSE_EVENT } from '../utils/appReview';

type PromptStep = 'first' | 'second';

const AppReviewPromptModal: React.FC = () => {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState<PromptStep>('first');
  const [rating, setRating] = useState(0);

  useEffect(() => {
    const openSubscription = DeviceEventEmitter.addListener(APP_REVIEW_MODAL_OPEN_EVENT, () => {
      setStep('first');
      setRating(0);
      setVisible(true);
    });

    return () => {
      openSubscription.remove();
    };
  }, []);

  const closeWithAction = (action: 'review' | 'later') => {
    setVisible(false);
    setStep('first');
    setRating(0);
    DeviceEventEmitter.emit(APP_REVIEW_MODAL_RESPONSE_EVENT, { action });
  };

  const firstTitle = useMemo(() => t('appReview.prompts.first.cardTitle'), [t]);
  const firstSubtitle = useMemo(() => t('appReview.prompts.first.cardSubtitle'), [t]);
  const secondTitle = useMemo(() => t('appReview.prompts.second.cardTitle'), [t]);
  const secondSubtitle = useMemo(
    () => (rating <= 2 ? t('appReview.prompts.second.title') : t('appReview.prompts.second.cardSubtitle')),
    [rating, t]
  );

  const handleStarPress = (value: number) => {
    setRating(value);
    setStep('second');
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      statusBarTranslucent
      onRequestClose={() => {
        closeWithAction('later');
      }}
    >
      <View style={styles.overlay}>
        <View style={styles.backdrop} />
        <View style={styles.modalShell}>
          <View style={styles.topBadgeWrap}>
            <View style={styles.topBadgeCircle}>
              <HugeiconsIcon
                icon={step === 'first' ? HeartAddIcon : rating <= 2 ? SurpriseIcon : InLoveIcon}
                size={28}
                color={step === 'first' ? '#FF4E8A' : rating <= 2 ? '#F59E0B' : '#FF4E8A'}
                strokeWidth={2.1}
              />
            </View>
          </View>

          <BlurView intensity={30} tint="light" style={styles.modalCard}>
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.closeButton}
              onPress={() => closeWithAction('later')}
            >
              <HugeiconsIcon icon={Cancel01Icon} size={20} color="#9AB0C6" strokeWidth={2.1} />
            </TouchableOpacity>

            {step === 'first' ? (
              <>
                <Text style={styles.title}>{firstTitle}</Text>
                <Text style={styles.subtitle}>{firstSubtitle}</Text>

                <View style={styles.starRow}>
                  {[1, 2, 3, 4, 5].map((value) => (
                    <TouchableOpacity
                      key={value}
                      activeOpacity={0.85}
                      style={styles.starButton}
                      onPress={() => handleStarPress(value)}
                    >
                      <HugeiconsIcon
                        icon={StarIcon}
                        size={34}
                        color={value <= rating ? '#FFC93D' : '#E2E7ED'}
                        fill={value <= rating ? '#FFC93D' : 'transparent'}
                        strokeWidth={2.1}
                      />
                    </TouchableOpacity>
                  ))}
                </View>

                <TouchableOpacity activeOpacity={0.85} onPress={() => closeWithAction('later')}>
                  <Text style={styles.laterText}>{t('appReview.prompts.first.skip')}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.title}>{secondTitle}</Text>
                <Text style={styles.subtitle}>{secondSubtitle}</Text>

                <TouchableOpacity
                  activeOpacity={0.88}
                  style={styles.primaryButton}
                  onPress={() => closeWithAction('review')}
                >
                  <Text style={styles.primaryButtonText}>{t('appReview.prompts.second.writeReview')}</Text>
                </TouchableOpacity>

                <TouchableOpacity activeOpacity={0.85} onPress={() => closeWithAction('later')}>
                  <Text style={styles.laterText}>{t('appReview.prompts.second.later')}</Text>
                </TouchableOpacity>
              </>
            )}
          </BlurView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(45, 45, 45, 0.24)',
  },
  modalShell: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
  },
  topBadgeWrap: {
    position: 'absolute',
    top: -30,
    zIndex: 3,
  },
  topBadgeCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCard: {
    width: '100%',
    borderRadius: 18,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 18,
    overflow: 'hidden',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.88)',
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  title: {
    marginTop: 20,
    fontSize: 25,
    lineHeight: 42,
    fontWeight: '800',
    color: '#1D242B',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 24,
    fontWeight: '600',
    color: '#404E5B',
    textAlign: 'center',
    marginBottom: 20,
  },
  starRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  starButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    width: '70%',
    height: 45,
    borderRadius: 25,
    backgroundColor: '#8F17C8',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    marginBottom: 14,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  laterText: {
    color: '#9CA9B6',
    fontSize: 14,
    fontWeight: '700',
    textDecorationLine: 'underline',
    marginBottom: 4,
  },
});

export default AppReviewPromptModal;
