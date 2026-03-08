import { Dimensions } from 'react-native';

export const APP_MAX_WIDTH = 390;

export const getAppWidth = () => Math.min(Dimensions.get('window').width, APP_MAX_WIDTH);
