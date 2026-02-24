import type { MembershipType } from '../store/useAppStore';

const MEMBERSHIP_LABELS: Record<MembershipType, string> = {
  free: '無料会員',
  plus: 'Plus会員',
  lifetime: '生涯Plus会員',
};

export const getMembershipLabel = (membershipType: MembershipType): string => {
  return MEMBERSHIP_LABELS[membershipType] ?? MEMBERSHIP_LABELS.free;
};

export const getMembershipActionLabel = (membershipType: MembershipType): string => {
  return membershipType === 'lifetime' ? 'アプリを共有' : 'プランを見る';
};
