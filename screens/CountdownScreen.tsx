import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, Modal, Animated, Easing, Pressable, Linking, Share, Alert, TextInput, ScrollView, Image as RNImage, ActivityIndicator, Platform, useWindowDimensions } from 'react-native';
import Svg, { Path, SvgXml, SvgUri } from 'react-native-svg';
import QRCode from 'react-native-qrcode-svg';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { Anton_400Regular } from '@expo-google-fonts/anton';
import * as Crypto from 'expo-crypto';
import TextTicker from 'react-native-text-ticker';
import Reanimated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { theme } from '../theme';
import LiveEditScreen from './LiveEditScreen';
import SettingsScreen from './SettingsScreen';
import ProfileEditScreen from './ProfileEditScreen';
import PaywallScreen from './PaywallScreen';
import { useRecords, ChekiRecord } from '../contexts/RecordsContext';
import ShareImageGenerator from '../components/ShareImageGenerator';
import TodaySong from '../components/TodaySong';
import { TicketDetail } from '../components/TicketDetail';
import { useAppStore } from '../store/useAppStore';
import { buildLiveAlbumName, uploadMultipleImages, uploadImage, deleteImage, normalizeStoredImageUri, resolveLocalImageUri, getTickemoRootDir } from '../lib/imageUpload';
import { saveSetlist, getSetlist } from '../lib/setlistDb';
import type { SetlistItem } from '../types/setlist';
import { isTestflightMode } from '../utils/appMode';
import { NO_IMAGE_URI, useResolvedImageUri } from '../hooks/useResolvedImageUri';
import { useTranslation } from 'react-i18next';
import { LIVE_TYPE_ICON_MAP, normalizeLiveType, getLiveTypeLabel } from '../utils/liveType';

const Stack = createNativeStackNavigator();
const FREE_TICKET_LIMIT = 3;

// Apple Music Developer Token (JWT)
const APPLE_MUSIC_DEVELOPER_TOKEN = 'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjMyTVlRNk5WOTYifQ.eyJpc3MiOiJRMkxMMkI3OTJWIiwiaWF0IjoxNzY5ODQ5MDA5LCJleHAiOjE3ODU0MDEwMDksImF1ZCI6Imh0dHBzOi8vYXBwbGVpZC5hcHBsZS5jb20iLCJzdWIiOiJtZWRpYS5jb20uYW5vbnltb3VzLlRpY2tlbW8ifQ.ect6vO1q3aC9XJVYCUBVLlTHaVEcZebm0-dVZ3ak6uglI33e1ra3qcwkawXaScFFcLB8sgX5TEcFEj9QGF1Z8A';

const EMPTY_TICKET_SVG = `
<svg width="280" height="561" viewBox="0 0 280 561" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M87.5057 299V297.722L92.3068 292.466C92.8703 291.85 93.3343 291.315 93.6989 290.861C94.0634 290.402 94.3333 289.971 94.5085 289.568C94.6884 289.161 94.7784 288.735 94.7784 288.29C94.7784 287.778 94.6553 287.336 94.4091 286.962C94.1676 286.588 93.8362 286.299 93.4148 286.095C92.9934 285.892 92.5199 285.79 91.9943 285.79C91.4356 285.79 90.9479 285.906 90.5312 286.138C90.1193 286.365 89.7997 286.685 89.5724 287.097C89.3499 287.509 89.2386 287.991 89.2386 288.545H87.5625C87.5625 287.693 87.759 286.945 88.152 286.301C88.545 285.657 89.08 285.155 89.7571 284.795C90.4389 284.436 91.2036 284.256 92.0511 284.256C92.9034 284.256 93.6586 284.436 94.3168 284.795C94.9749 285.155 95.491 285.641 95.8651 286.251C96.2391 286.862 96.4261 287.542 96.4261 288.29C96.4261 288.825 96.3291 289.348 96.1349 289.859C95.9455 290.366 95.6141 290.932 95.1406 291.557C94.6719 292.177 94.0208 292.935 93.1875 293.83L89.9205 297.324V297.438H96.6818V299H87.5057ZM104.359 299.199C103.289 299.199 102.378 298.908 101.625 298.325C100.872 297.738 100.297 296.888 99.8991 295.776C99.5014 294.658 99.3026 293.309 99.3026 291.727C99.3026 290.155 99.5014 288.813 99.8991 287.7C100.302 286.583 100.879 285.731 101.632 285.143C102.39 284.552 103.299 284.256 104.359 284.256C105.42 284.256 106.327 284.552 107.08 285.143C107.837 285.731 108.415 286.583 108.812 287.7C109.215 288.813 109.416 290.155 109.416 291.727C109.416 293.309 109.217 294.658 108.82 295.776C108.422 296.888 107.847 297.738 107.094 298.325C106.341 298.908 105.429 299.199 104.359 299.199ZM104.359 297.636C105.42 297.636 106.244 297.125 106.831 296.102C107.418 295.08 107.712 293.621 107.712 291.727C107.712 290.468 107.577 289.395 107.307 288.51C107.042 287.625 106.658 286.95 106.156 286.486C105.659 286.022 105.06 285.79 104.359 285.79C103.308 285.79 102.487 286.308 101.895 287.345C101.303 288.377 101.007 289.838 101.007 291.727C101.007 292.987 101.14 294.057 101.405 294.938C101.67 295.818 102.051 296.488 102.548 296.947C103.05 297.407 103.654 297.636 104.359 297.636ZM112.115 299V297.722L116.916 292.466C117.48 291.85 117.944 291.315 118.308 290.861C118.673 290.402 118.943 289.971 119.118 289.568C119.298 289.161 119.388 288.735 119.388 288.29C119.388 287.778 119.265 287.336 119.018 286.962C118.777 286.588 118.446 286.299 118.024 286.095C117.603 285.892 117.129 285.79 116.604 285.79C116.045 285.79 115.557 285.906 115.141 286.138C114.729 286.365 114.409 286.685 114.182 287.097C113.959 287.509 113.848 287.991 113.848 288.545H112.172C112.172 287.693 112.368 286.945 112.761 286.301C113.154 285.657 113.689 285.155 114.366 284.795C115.048 284.436 115.813 284.256 116.661 284.256C117.513 284.256 118.268 284.436 118.926 284.795C119.584 285.155 120.1 285.641 120.474 286.251C120.848 286.862 121.036 287.542 121.036 288.29C121.036 288.825 120.938 289.348 120.744 289.859C120.555 290.366 120.223 290.932 119.75 291.557C119.281 292.177 118.63 292.935 117.797 293.83L114.53 297.324V297.438H121.291V299H112.115ZM128.77 299.199C127.937 299.199 127.186 299.033 126.518 298.702C125.851 298.37 125.316 297.916 124.913 297.338C124.511 296.76 124.291 296.102 124.253 295.364H125.957C126.024 296.022 126.322 296.566 126.852 296.997C127.387 297.423 128.027 297.636 128.77 297.636C129.366 297.636 129.897 297.497 130.361 297.217C130.83 296.938 131.196 296.554 131.462 296.067C131.732 295.574 131.866 295.018 131.866 294.398C131.866 293.763 131.727 293.197 131.447 292.7C131.173 292.198 130.794 291.803 130.311 291.514C129.828 291.225 129.277 291.079 128.656 291.074C128.211 291.069 127.754 291.138 127.286 291.28C126.817 291.417 126.431 291.595 126.128 291.812L124.48 291.614L125.361 284.455H132.918V286.017H126.838L126.327 290.307H126.412C126.71 290.07 127.084 289.874 127.534 289.717C127.984 289.561 128.453 289.483 128.94 289.483C129.83 289.483 130.624 289.696 131.32 290.122C132.02 290.544 132.57 291.121 132.967 291.855C133.37 292.589 133.571 293.427 133.571 294.369C133.571 295.297 133.363 296.126 132.946 296.855C132.534 297.58 131.966 298.152 131.241 298.574C130.517 298.991 129.693 299.199 128.77 299.199ZM137.096 299.114C136.745 299.114 136.444 298.988 136.194 298.737C135.943 298.486 135.817 298.186 135.817 297.835C135.817 297.485 135.943 297.184 136.194 296.933C136.444 296.682 136.745 296.557 137.096 296.557C137.446 296.557 137.747 296.682 137.998 296.933C138.248 297.184 138.374 297.485 138.374 297.835C138.374 298.067 138.315 298.28 138.196 298.474C138.083 298.669 137.929 298.825 137.735 298.943C137.545 299.057 137.332 299.114 137.096 299.114ZM144.729 284.455V299H142.967V286.301H142.882L139.331 288.659V286.869L142.967 284.455H144.729ZM148.912 299V297.722L153.713 292.466C154.277 291.85 154.741 291.315 155.105 290.861C155.47 290.402 155.74 289.971 155.915 289.568C156.095 289.161 156.185 288.735 156.185 288.29C156.185 287.778 156.062 287.336 155.815 286.962C155.574 286.588 155.242 286.299 154.821 286.095C154.4 285.892 153.926 285.79 153.401 285.79C152.842 285.79 152.354 285.906 151.938 286.138C151.526 286.365 151.206 286.685 150.979 287.097C150.756 287.509 150.645 287.991 150.645 288.545H148.969C148.969 287.693 149.165 286.945 149.558 286.301C149.951 285.657 150.486 285.155 151.163 284.795C151.845 284.436 152.61 284.256 153.457 284.256C154.31 284.256 155.065 284.436 155.723 284.795C156.381 285.155 156.897 285.641 157.271 286.251C157.645 286.862 157.832 287.542 157.832 288.29C157.832 288.825 157.735 289.348 157.541 289.859C157.352 290.366 157.02 290.932 156.547 291.557C156.078 292.177 155.427 292.935 154.594 293.83L151.327 297.324V297.438H158.088V299H148.912ZM162.271 299.114C161.921 299.114 161.62 298.988 161.369 298.737C161.118 298.486 160.993 298.186 160.993 297.835C160.993 297.485 161.118 297.184 161.369 296.933C161.62 296.682 161.921 296.557 162.271 296.557C162.622 296.557 162.922 296.682 163.173 296.933C163.424 297.184 163.55 297.485 163.55 297.835C163.55 298.067 163.491 298.28 163.372 298.474C163.259 298.669 163.105 298.825 162.911 298.943C162.721 299.057 162.508 299.114 162.271 299.114ZM166.529 299V297.722L171.33 292.466C171.894 291.85 172.358 291.315 172.722 290.861C173.087 290.402 173.357 289.971 173.532 289.568C173.712 289.161 173.802 288.735 173.802 288.29C173.802 287.778 173.679 287.336 173.433 286.962C173.191 286.588 172.86 286.299 172.438 286.095C172.017 285.892 171.543 285.79 171.018 285.79C170.459 285.79 169.971 285.906 169.555 286.138C169.143 286.365 168.823 286.685 168.596 287.097C168.373 287.509 168.262 287.991 168.262 288.545H166.586C166.586 287.693 166.782 286.945 167.175 286.301C167.568 285.657 168.103 285.155 168.781 284.795C169.462 284.436 170.227 284.256 171.075 284.256C171.927 284.256 172.682 284.436 173.34 284.795C173.998 285.155 174.514 285.641 174.888 286.251C175.263 286.862 175.45 287.542 175.45 288.29C175.45 288.825 175.353 289.348 175.158 289.859C174.969 290.366 174.638 290.932 174.164 291.557C173.695 292.177 173.044 292.935 172.211 293.83L168.944 297.324V297.438H175.705V299H166.529ZM183.184 299.199C182.351 299.199 181.6 299.033 180.933 298.702C180.265 298.37 179.73 297.916 179.327 297.338C178.925 296.76 178.705 296.102 178.667 295.364H180.371C180.438 296.022 180.736 296.566 181.266 296.997C181.801 297.423 182.441 297.636 183.184 297.636C183.781 297.636 184.311 297.497 184.775 297.217C185.244 296.938 185.611 296.554 185.876 296.067C186.146 295.574 186.281 295.018 186.281 294.398C186.281 293.763 186.141 293.197 185.862 292.7C185.587 292.198 185.208 291.803 184.725 291.514C184.242 291.225 183.691 291.079 183.07 291.074C182.625 291.069 182.168 291.138 181.7 291.28C181.231 291.417 180.845 291.595 180.542 291.812L178.894 291.614L179.775 284.455H187.332V286.017H181.252L180.741 290.307H180.826C181.124 290.07 181.498 289.874 181.948 289.717C182.398 289.561 182.867 289.483 183.354 289.483C184.245 289.483 185.038 289.696 185.734 290.122C186.434 290.544 186.984 291.121 187.381 291.855C187.784 292.589 187.985 293.427 187.985 294.369C187.985 295.297 187.777 296.126 187.36 296.855C186.948 297.58 186.38 298.152 185.656 298.574C184.931 298.991 184.107 299.199 183.184 299.199Z" fill="black"/>
<path d="M51.1136 263V245.545H57.2159C58.4318 245.545 59.4347 245.756 60.2244 246.176C61.0142 246.591 61.6023 247.151 61.9886 247.855C62.375 248.554 62.5682 249.33 62.5682 250.182C62.5682 250.932 62.4347 251.551 62.1676 252.04C61.9063 252.528 61.5597 252.915 61.1278 253.199C60.7017 253.483 60.2386 253.693 59.7386 253.83V254C60.2727 254.034 60.8097 254.222 61.3494 254.562C61.8892 254.903 62.3409 255.392 62.7045 256.028C63.0682 256.665 63.25 257.443 63.25 258.364C63.25 259.239 63.0511 260.026 62.6534 260.724C62.2557 261.423 61.6278 261.977 60.7699 262.386C59.9119 262.795 58.7955 263 57.4205 263H51.1136ZM53.2273 261.125H57.4205C58.8011 261.125 59.7813 260.858 60.3608 260.324C60.946 259.784 61.2386 259.131 61.2386 258.364C61.2386 257.773 61.0881 257.227 60.7869 256.727C60.4858 256.222 60.0568 255.818 59.5 255.517C58.9432 255.21 58.2841 255.057 57.5227 255.057H53.2273V261.125ZM53.2273 253.216H57.1477C57.7841 253.216 58.358 253.091 58.8693 252.841C59.3864 252.591 59.7955 252.239 60.0966 251.784C60.4034 251.33 60.5568 250.795 60.5568 250.182C60.5568 249.415 60.2898 248.764 59.7557 248.23C59.2216 247.69 58.375 247.42 57.2159 247.42H53.2273V253.216ZM67.4389 263H65.223L71.6321 245.545H73.8139L80.223 263H78.0071L72.7912 248.307H72.6548L67.4389 263ZM68.2571 256.182H77.1889V258.057H68.2571V256.182ZM82.9418 263V245.545H89.044C90.2599 245.545 91.2628 245.756 92.0526 246.176C92.8423 246.591 93.4304 247.151 93.8168 247.855C94.2031 248.554 94.3963 249.33 94.3963 250.182C94.3963 250.932 94.2628 251.551 93.9957 252.04C93.7344 252.528 93.3878 252.915 92.956 253.199C92.5298 253.483 92.0668 253.693 91.5668 253.83V254C92.1009 254.034 92.6378 254.222 93.1776 254.562C93.7173 254.903 94.169 255.392 94.5327 256.028C94.8963 256.665 95.0781 257.443 95.0781 258.364C95.0781 259.239 94.8793 260.026 94.4815 260.724C94.0838 261.423 93.456 261.977 92.598 262.386C91.7401 262.795 90.6236 263 89.2486 263H82.9418ZM85.0554 261.125H89.2486C90.6293 261.125 91.6094 260.858 92.1889 260.324C92.7741 259.784 93.0668 259.131 93.0668 258.364C93.0668 257.773 92.9162 257.227 92.6151 256.727C92.3139 256.222 91.8849 255.818 91.3281 255.517C90.7713 255.21 90.1122 255.057 89.3509 255.057H85.0554V261.125ZM85.0554 253.216H88.9759C89.6122 253.216 90.1861 253.091 90.6974 252.841C91.2145 252.591 91.6236 252.239 91.9247 251.784C92.2315 251.33 92.3849 250.795 92.3849 250.182C92.3849 249.415 92.1179 248.764 91.5838 248.23C91.0497 247.69 90.2031 247.42 89.044 247.42H85.0554V253.216ZM98.5511 263V245.545H109.085V247.42H100.665V253.318H108.54V255.193H100.665V261.125H109.222V263H98.5511ZM112.895 263V245.545H115.009V261.125H123.122V263H112.895ZM134.884 255.125V263H132.872V249.909H134.815V251.955H134.986C135.293 251.29 135.759 250.756 136.384 250.352C137.009 249.943 137.815 249.739 138.804 249.739C139.69 249.739 140.466 249.92 141.131 250.284C141.795 250.642 142.313 251.188 142.682 251.92C143.051 252.648 143.236 253.568 143.236 254.682V263H141.224V254.818C141.224 253.79 140.957 252.989 140.423 252.415C139.889 251.835 139.156 251.545 138.224 251.545C137.582 251.545 137.009 251.685 136.503 251.963C136.003 252.241 135.608 252.648 135.318 253.182C135.028 253.716 134.884 254.364 134.884 255.125ZM152.229 263.273C151.048 263.273 150.011 262.991 149.119 262.429C148.232 261.866 147.539 261.08 147.039 260.068C146.545 259.057 146.298 257.875 146.298 256.523C146.298 255.159 146.545 253.969 147.039 252.952C147.539 251.935 148.232 251.145 149.119 250.582C150.011 250.02 151.048 249.739 152.229 249.739C153.411 249.739 154.445 250.02 155.332 250.582C156.224 251.145 156.917 251.935 157.411 252.952C157.911 253.969 158.161 255.159 158.161 256.523C158.161 257.875 157.911 259.057 157.411 260.068C156.917 261.08 156.224 261.866 155.332 262.429C154.445 262.991 153.411 263.273 152.229 263.273ZM152.229 261.466C153.127 261.466 153.866 261.236 154.445 260.776C155.025 260.315 155.454 259.71 155.732 258.96C156.011 258.21 156.15 257.398 156.15 256.523C156.15 255.648 156.011 254.832 155.732 254.077C155.454 253.321 155.025 252.71 154.445 252.244C153.866 251.778 153.127 251.545 152.229 251.545C151.332 251.545 150.593 251.778 150.013 252.244C149.434 252.71 149.005 253.321 148.727 254.077C148.448 254.832 148.309 255.648 148.309 256.523C148.309 257.398 148.448 258.21 148.727 258.96C149.005 259.71 149.434 260.315 150.013 260.776C150.593 261.236 151.332 261.466 152.229 261.466ZM167.3 247.42V245.545H180.391V247.42H174.902V263H172.788V247.42H167.3ZM197.653 254.273C197.653 256.114 197.321 257.705 196.656 259.045C195.991 260.386 195.08 261.42 193.92 262.148C192.761 262.875 191.438 263.239 189.949 263.239C188.46 263.239 187.136 262.875 185.977 262.148C184.818 261.42 183.906 260.386 183.241 259.045C182.577 257.705 182.244 256.114 182.244 254.273C182.244 252.432 182.577 250.841 183.241 249.5C183.906 248.159 184.818 247.125 185.977 246.398C187.136 245.67 188.46 245.307 189.949 245.307C191.438 245.307 192.761 245.67 193.92 246.398C195.08 247.125 195.991 248.159 196.656 249.5C197.321 250.841 197.653 252.432 197.653 254.273ZM195.608 254.273C195.608 252.761 195.355 251.486 194.849 250.446C194.349 249.406 193.67 248.619 192.812 248.085C191.96 247.551 191.006 247.284 189.949 247.284C188.892 247.284 187.935 247.551 187.077 248.085C186.224 248.619 185.545 249.406 185.04 250.446C184.54 251.486 184.29 252.761 184.29 254.273C184.29 255.784 184.54 257.06 185.04 258.099C185.545 259.139 186.224 259.926 187.077 260.46C187.935 260.994 188.892 261.261 189.949 261.261C191.006 261.261 191.96 260.994 192.812 260.46C193.67 259.926 194.349 259.139 194.849 258.099C195.355 257.06 195.608 255.784 195.608 254.273ZM199.526 247.42V245.545H212.617V247.42H207.129V263H205.015V247.42H199.526ZM215.879 263V245.545H217.993V253.318H227.3V245.545H229.413V263H227.3V255.193H217.993V263H215.879Z" fill="black"/>
<path d="M279.118 201.1C275.555 201.681 272.834 204.772 272.834 208.5C272.834 212.228 275.555 215.319 279.118 215.9L279.118 531.006C278.95 531.004 278.782 531 278.613 531C259.927 531 244.767 544.319 244.64 560.791L33.9746 560.791C33.8473 544.319 18.6859 531 0 531L0 215.991C0.110743 215.996 0.222045 216 0.333984 216C4.47612 216 7.83398 212.642 7.83398 208.5C7.83398 204.358 4.47612 201 0.333984 201C0.222045 201 0.110743 201.004 0 201.009L0 30C18.4716 29.9996 33.5006 16.9848 33.9658 0.774414L33.9766 0L244.637 0C244.637 16.5684 259.848 29.9998 278.613 30C278.782 30 278.95 29.9963 279.118 29.9941L279.118 201.1ZM27.834 208.5C27.834 204.358 24.4761 201 20.334 201C16.1921 201 12.834 204.358 12.834 208.5C12.834 212.642 16.1921 216 20.334 216C24.4761 216 27.834 212.642 27.834 208.5ZM47.834 208.5C47.834 204.358 44.4761 201 40.334 201C36.1921 201 32.834 204.358 32.834 208.5C32.834 212.642 36.1921 216 40.334 216C44.4761 216 47.834 212.642 47.834 208.5ZM67.834 208.5C67.834 204.358 64.4761 201 60.334 201C56.1921 201 52.834 204.358 52.834 208.5C52.834 212.642 56.1921 216 60.334 216C64.4761 216 67.834 212.642 67.834 208.5ZM87.834 208.5C87.834 204.358 84.4761 201 80.334 201C76.1921 201 72.834 204.358 72.834 208.5C72.834 212.642 76.1921 216 80.334 216C84.4761 216 87.834 212.642 87.834 208.5ZM107.834 208.5C107.834 204.358 104.476 201 100.334 201C96.1921 201 92.834 204.358 92.834 208.5C92.834 212.642 96.1921 216 100.334 216C104.476 216 107.834 212.642 107.834 208.5ZM127.834 208.5C127.834 204.358 124.476 201 120.334 201C116.192 201 112.834 204.358 112.834 208.5C112.834 212.642 116.192 216 120.334 216C124.476 216 127.834 212.642 127.834 208.5ZM147.834 208.5C147.834 204.358 144.476 201 140.334 201C136.192 201 132.834 204.358 132.834 208.5C132.834 212.642 136.192 216 140.334 216C144.476 216 147.834 212.642 147.834 208.5ZM167.834 208.5C167.834 204.358 164.476 201 160.334 201C156.192 201 152.834 204.358 152.834 208.5C152.834 212.642 156.192 216 160.334 216C164.476 216 167.834 212.642 167.834 208.5ZM187.834 208.5C187.834 204.358 184.476 201 180.334 201C176.192 201 172.834 204.358 172.834 208.5C172.834 212.642 176.192 216 180.334 216C184.476 216 187.834 212.642 187.834 208.5ZM207.834 208.5C207.834 204.358 204.476 201 200.334 201C196.192 201 192.834 204.358 192.834 208.5C192.834 212.642 196.192 216 200.334 216C204.476 216 207.834 212.642 207.834 208.5ZM227.834 208.5C227.834 204.358 224.476 201 220.334 201C216.192 201 212.834 204.358 212.834 208.5C212.834 212.642 216.192 216 220.334 216C224.476 216 227.834 212.642 227.834 208.5ZM247.834 208.5C247.834 204.358 244.476 201 240.334 201C236.192 201 232.834 204.358 232.834 208.5C232.834 212.642 236.192 216 240.334 216C244.476 216 247.834 212.642 247.834 208.5ZM267.834 208.5C267.834 204.358 264.476 201 260.334 201C256.192 201 252.834 204.358 252.834 208.5C252.834 212.642 256.192 216 260.334 216C264.476 216 267.834 212.642 267.834 208.5Z" fill="#FFFFFF"/>
</svg>
`;

const EXCHANGE_ICON_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
<g clip-path="url(#clip0_4418_3483)">
<path d="M5.52979 15.9804C5.69979 17.7704 6.63978 18.5004 8.68978 18.5004H11.4198C13.6998 18.5004 14.6098 17.5904 14.6098 15.3104V12.5804C14.6098 10.3104 13.6998 9.40039 11.4198 9.40039H8.68978C6.61978 9.40039 5.67979 10.1504 5.52979 12.0004" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
<path d="M18.4999 8.68V11.41C18.4999 13.69 17.5899 14.6 15.3099 14.6H14.5999V12.58C14.5999 10.31 13.6899 9.4 11.4099 9.4H9.3999V8.68C9.3999 6.4 10.3099 5.5 12.5899 5.5H15.3199C17.5899 5.5 18.4999 6.41 18.4999 8.68Z" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
<path d="M22 15C22 18.87 18.87 22 15 22L16.05 20.25" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
<path d="M2 9C2 5.13 5.13 2 9 2L7.95 3.75" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
</g>
<defs>
<clipPath id="clip0_4418_3483">
<rect width="24" height="24" fill="white"/>
</clipPath>
</defs>
</svg>
`;

interface LiveInfo {
  name: string;
  artists: string[];
  artist?: string;
  artistImageUrls?: string[];
  liveType?: string;
  artistImageUrl?: string;
  date: Date;
  venue: string;
  seat?: string;
  startTime: string;
  endTime: string;
  imageUrl?: string;
  imageUrls?: string[];
  qrCode?: string;
  memo?: string;
  detail?: string;
  setlistSongs?: SetlistItem[];
}

function CountdownMain({ navigation }: any) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { records, addRecord, updateRecord } = useRecords();
  const isPremium = useAppStore((state) => state.isPremium);
  const pointingSvgUri = RNImage.resolveAssetSource(require('../assets/pointing.svg')).uri;
  const emptyTicketWidth = Math.min(windowWidth * 0.78, 360);
  const emptyTicketHeight = emptyTicketWidth * (470 / 280);
  const pointIconSize = Math.min(windowWidth * 0.3, 120);
  const [showEditScreen, setShowEditScreen] = useState(false);
  const [isLoading, setIsLoading] = useState(false); // ローディング状態
  const [resolvedImageUrls, setResolvedImageUrls] = useState<string[]>([]);
  const [isJacketMoved, setIsJacketMoved] = useState(false);
  const [showShareImage, setShowShareImage] = useState(false);
  const [detailRecord, setDetailRecord] = useState<ChekiRecord | null>(null);
  const [isAccordionOpen, setIsAccordionOpen] = useState(false);
  const [selectedLiveId, setSelectedLiveId] = useState<string | null>(null);
  const [setlistSongs, setSetlistSongs] = useState<SetlistItem[]>([]);
  const [currentBackground, setCurrentBackground] = useState<string | null>(null);
  const [previousBackground, setPreviousBackground] = useState<string | null>(null);
  const backgroundFade = useRef(new Animated.Value(1)).current;
  const jacketAnimX = useRef(new Animated.Value(0)).current;
  const jacketAnimRotate = useRef(new Animated.Value(0)).current;
  const accordionHeight = useSharedValue(0);
  const accordionOpacity = useSharedValue(0);
  const accordionTranslateY = useSharedValue(-12);
  const [countdown, setCountdown] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });
  const [liveStatus, setLiveStatus] = useState<'before' | 'during' | 'after'>('before');
  const [showEmptyAfterEnd, setShowEmptyAfterEnd] = useState(false);
  const [isCreatingNewLive, setIsCreatingNewLive] = useState(false);

  const parseRecordDate = (value?: string) => {
    if (!value) return null;
    const parts = value.split(/[.-]/).map((part) => Number(part));
    if (parts.length === 3 && parts.every((part) => !Number.isNaN(part))) {
      const [year, month, day] = parts;
      if (!year || !month || !day) return null;
      return new Date(year, month - 1, day, 12, 0, 0, 0);
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
  };

  // 日付で新しい順にソート（最新のライブが先頭）
  const toTime = (record: ChekiRecord) => {
    if (!record?.date) return 0;
    const parsed = parseRecordDate(record.date);
    const time = parsed ? parsed.getTime() : 0;
    return Number.isNaN(time) ? 0 : time;
  };
  const sortedRecords = [...records].sort((a, b) => toTime(b) - toTime(a));

  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatShortDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    const parsed = parseRecordDate(dateStr);
    if (!parsed) return dateStr;
    return `${parsed.getMonth() + 1}/${parsed.getDate()}`;
  };

  const futureLives = useMemo(() => {
    const now = new Date();
    const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return sortedRecords
      .map((record) => ({
        record,
        date: parseRecordDate(record.date),
      }))
      .filter(({ date }) => Boolean(date))
      .filter(({ date }) => {
        const liveDate = date as Date;
        const liveDateOnly = new Date(liveDate.getFullYear(), liveDate.getMonth(), liveDate.getDate());
        return liveDateOnly.getTime() >= todayDate.getTime();
      })
      .sort((a, b) => (a.date as Date).getTime() - (b.date as Date).getTime())
      .map(({ record }) => record);
  }, [sortedRecords]);

  useEffect(() => {
    if (selectedLiveId && !futureLives.some((record) => record.id === selectedLiveId)) {
      setSelectedLiveId(null);
    }
  }, [selectedLiveId, futureLives]);

  const selectedRecord = useMemo(
    () => futureLives.find((record) => record.id === selectedLiveId) ?? null,
    [futureLives, selectedLiveId]
  );

  useEffect(() => {
    if (!selectedLiveId && futureLives.length > 0) {
      setSelectedLiveId(futureLives[0].id);
    }
  }, [futureLives, selectedLiveId]);

  const nextRecord = selectedRecord ?? futureLives[0] ?? null;
  const accordionMaxHeight = Math.min(futureLives.length * 66 + 24, windowHeight * 0.5);

  // 編集画面を開く際にnextRecord.imageUrlsを相対パス→file://パスに変換
  useEffect(() => {
    if (!nextRecord || !nextRecord.id || isCreatingNewLive || !showEditScreen) {
      setResolvedImageUrls([]);
      return;
    }
    const resolved = (nextRecord.imageUrls || []).map((url: string) => resolveLocalImageUri(url));
    setResolvedImageUrls(resolved);
  }, [showEditScreen, nextRecord?.id, isCreatingNewLive]);

  useEffect(() => {
    const targetHeight = isAccordionOpen ? accordionMaxHeight : 0;
    const targetOpacity = isAccordionOpen ? 1 : 0;
    const targetTranslateY = isAccordionOpen ? 0 : -12;
    accordionHeight.value = withSpring(targetHeight, { damping: 15, stiffness: 90, mass: 1 });
    accordionOpacity.value = withSpring(targetOpacity, { damping: 15, stiffness: 90, mass: 1 });
    accordionTranslateY.value = withSpring(targetTranslateY, { damping: 15, stiffness: 90, mass: 1 });
  }, [accordionHeight, accordionMaxHeight, accordionOpacity, isAccordionOpen]);

  const accordionStyle = useAnimatedStyle(() => ({
    height: accordionHeight.value,
    opacity: accordionOpacity.value,
    transform: [{ translateY: accordionTranslateY.value }],
  }));

  const coverUri = useResolvedImageUri(nextRecord?.imageUrls?.[0], nextRecord?.imageAssetIds?.[0]);
  const backgroundUri = nextRecord ? (coverUri ?? NO_IMAGE_URI) : null;

  useEffect(() => {
    if (!backgroundUri) {
      setCurrentBackground(null);
      setPreviousBackground(null);
      return;
    }

    if (backgroundUri === currentBackground) {
      return;
    }

    setPreviousBackground(currentBackground);
    setCurrentBackground(backgroundUri);
    backgroundFade.setValue(0);
    Animated.timing(backgroundFade, {
      toValue: 1,
      duration: 620,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setPreviousBackground(null);
    });
  }, [backgroundUri, currentBackground, backgroundFade]);

  useEffect(() => {
    const preloadCountdownImages = async () => {
      try {
        const uris = new Set<string>();
        records.forEach((record) => {
          if (record.imageUrls && Array.isArray(record.imageUrls)) {
            record.imageUrls.forEach((uri) => {
              if (uri && !uri.startsWith('file://')) {
                uris.add(uri);
              }
            });
          }
        });

        if (uris.size === 0) return;

        const assets = Array.from(uris).map((uri) => Asset.fromURI(uri));
        await Promise.all(assets.map((asset) => asset.downloadAsync()));
      } catch (error) {
        console.log('Failed to preload countdown images:', error);
      }
    };

    preloadCountdownImages();
  }, [records]);

  useEffect(() => {
    if (!nextRecord || !nextRecord.date || typeof nextRecord.date !== 'string') return;
    // 新しいレコード評価時に終了後の空画面フラグをリセット
    setShowEmptyAfterEnd(false);
    
    const liveDate = parseRecordDate(nextRecord.date);
    if (!liveDate) return;

    const startTime = nextRecord.startTime || '18:00';
    const endTime = nextRecord.endTime || '20:00';
    
    // 開始時刻と終了時刻を設定
    const parseTime = (value: string, fallback: string) => {
      const target = value || fallback;
      const [h, m] = target.split(':').map(Number);
      if (Number.isNaN(h) || Number.isNaN(m)) {
        const [fh, fm] = fallback.split(':').map(Number);
        return { hour: fh, min: fm };
      }
      return { hour: h, min: m };
    };

    const { hour: startHour, min: startMin } = parseTime(startTime, '18:00');
    const { hour: endHour, min: endMin } = parseTime(endTime, '20:00');
    
    const liveStartDateTime = new Date(liveDate);
    liveStartDateTime.setHours(startHour, startMin, 0, 0);
    
    const liveEndDateTime = new Date(liveDate);
    liveEndDateTime.setHours(endHour, endMin, 0, 0);
    if (liveEndDateTime.getTime() < liveStartDateTime.getTime()) {
      liveEndDateTime.setDate(liveEndDateTime.getDate() + 1);
    }
    
    const tick = () => {
      const now = new Date();
      const nowMs = now.getTime();

      // 終了時刻を過ぎた場合
      if (nowMs >= liveEndDateTime.getTime()) {
        setLiveStatus('after');
        setCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      // 開始時刻を過ぎた場合
      if (nowMs >= liveStartDateTime.getTime()) {
        setLiveStatus('during');
        setCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      // 開始前：カウントダウン表示
      setLiveStatus('before');
      const diff = Math.max(0, liveStartDateTime.getTime() - nowMs);
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setCountdown({ days, hours, minutes, seconds });
    };

    tick();
    const timer = setInterval(tick, 1000);

    return () => clearInterval(timer);
  }, [nextRecord]);

  // 編集画面を開く際にセットリストを読み込む
  useEffect(() => {
    const loadSetlist = async () => {
      if (showEditScreen && !isCreatingNewLive && nextRecord) {
        try {
          const songs = await getSetlist(nextRecord.id);
          setSetlistSongs(songs);
        } catch (error) {
          console.error('[CountdownScreen] セットリスト読み込みエラー:', error);
          setSetlistSongs([]);
        }
      } else {
        // 新規作成時はクリア
        setSetlistSongs([]);
      }
    };
    loadSetlist();
  }, [showEditScreen, isCreatingNewLive, nextRecord]);

  const handleJacketTap = () => {
    const toX = isJacketMoved ? 0 : -130;
    const toRotate = isJacketMoved ? 0 : -3;
    
    Animated.parallel([
      Animated.spring(jacketAnimX, {
        toValue: toX,
        useNativeDriver: true,
        tension: 50,
        friction: 7,
      }),
      Animated.spring(jacketAnimRotate, {
        toValue: toRotate,
        useNativeDriver: true,
        tension: 50,
        friction: 7,
      }),
    ]).start();
    
    setIsJacketMoved(!isJacketMoved);
  };

  const handleSelectLive = (record: ChekiRecord) => {
    setSelectedLiveId(record.id);
    setIsAccordionOpen(false);
  };

  const handleSharePress = () => {
    if (!nextRecord) return;
    setShowShareImage(true);
  };

  const handleShareModalClose = useCallback(() => {
    setShowShareImage(false);
  }, []);

  const handleCardPress = (record: ChekiRecord) => {
    setDetailRecord(record);
  };

  const handleCloseDetailModal = () => {
    setDetailRecord(null);
  };

  const handleAddLivePress = () => {
    if (!isPremium && records.length >= FREE_TICKET_LIMIT) {
      navigation.navigate('Paywall');
      return;
    }
    setIsCreatingNewLive(true);
    setShowEditScreen(true);
  };

  const dedupeImageEntries = (
    urls: string[],
    assetIds: Array<string | null>
  ): { urls: string[]; assetIds: Array<string | null> } => {
    const seen = new Set<string>();
    const nextUrls: string[] = [];
    const nextAssetIds: Array<string | null> = [];

    urls.forEach((url, index) => {
      const key = normalizeStoredImageUri(url) || url;
      if (seen.has(key)) return;
      seen.add(key);
      nextUrls.push(url);
      nextAssetIds.push(assetIds[index] ?? null);
    });

    return { urls: nextUrls, assetIds: nextAssetIds };
  };

  const handleSaveLiveInfo = async (info: LiveInfo) => {
    try {
      // console.log('[CountdownScreen] 保存開始:', info);
      
      // ローディング表示開始
      setIsLoading(true);
      
      const userId = 'local-user';
      const filteredArtists = (Array.isArray(info.artists) ? info.artists : [info.artist || nextRecord?.artist || ''])
        .map((artistName) => artistName.trim())
        .filter((artistName) => artistName !== '');
      const filteredArtistImageUrls = (Array.isArray(info.artistImageUrls) ? info.artistImageUrls : [info.artistImageUrl || nextRecord?.artistImageUrl || ''])
        .map((imageUrl) => imageUrl.trim())
        .slice(0, Math.max(filteredArtists.length, 0));

      // console.log('[CountdownScreen] ユーザーID:', userId);

      // ジャケット画像（1枚のみ）を保存
      let uploadedImageUrls: string[] = [];
      let uploadedImageAssetIds: Array<string | null> = [];

      // レコードIDの決定
      const liveId = (!nextRecord || isCreatingNewLive)
        ? Crypto.randomUUID()
        : nextRecord.id;

      if (info.imageUrls && info.imageUrls.length > 0) {
        const rawUri = info.imageUrls[0]; // 先頭の1枚のみ対象
        if (rawUri) {
          const normalizedUri = normalizeStoredImageUri(rawUri) || rawUri;
          
          if (normalizedUri.startsWith('file://')) {
            // 新規選択画像をユニーク名で保存
            const newBaseName = `cover-${Date.now()}`;
            const uploaded = await uploadImage(normalizedUri, userId, liveId, newBaseName);
            if (uploaded) {
              // 古い画像の削除（既存レコード更新時）
              if (!isCreatingNewLive && nextRecord?.imageUrls?.[0]) {
                 try {
                   await deleteImage(nextRecord.imageUrls[0]);
                 } catch (e) {
                   console.warn('[CountdownScreen] Old image delete failed:', e);
                 }
              }

              uploadedImageUrls = [uploaded];
              uploadedImageAssetIds = [null];
            }
          } else {
             // 既存のURL（例: 編集時に変更なし）
             uploadedImageUrls = [normalizedUri];
             // 既存のassetIdを引き継ぎ（元々0番目にあった場合などを考慮）
             const originalIndex = (nextRecord?.imageUrls || []).indexOf(rawUri);
             const originalAssetId = originalIndex !== -1 ? (nextRecord?.imageAssetIds?.[originalIndex] ?? null) : null;
             uploadedImageAssetIds = [originalAssetId];
          }
        }
      }
      
      // アップロード完了待ち（念のため）
      if (uploadedImageUrls.length > 0 && uploadedImageUrls[0].startsWith('file://')) {
          await new Promise(resolve => setTimeout(resolve, 500));
      }

      if (!nextRecord || isCreatingNewLive) {
        // 新規作成の場合
        // console.log('[CountdownScreen] 新規レコード作成');
        const newRecord: ChekiRecord = {
          id: Crypto.randomUUID(),
          user_id: userId,
          artists: filteredArtists,
          artist: filteredArtists[0] || '',
          artistImageUrls: filteredArtistImageUrls,
          artistImageUrl: filteredArtistImageUrls[0] || info.artistImageUrl || '',
          liveName: info.name,
          liveType: normalizeLiveType(info.liveType),
          date: formatDate(info.date),
          venue: info.venue,
          seat: info.seat || '',
          startTime: info.startTime || '',
          endTime: info.endTime || '',
          imageUrls: uploadedImageUrls,
          imageAssetIds: uploadedImageAssetIds,
          memo: info.memo || '',
          detail: info.detail || '',
          qrCode: info.qrCode || '',
          createdAt: new Date().toISOString(),
        };
        // console.log('[CountdownScreen] addRecord 呼び出し');
        await addRecord(newRecord);
        
        // セットリストを保存
        if (info.setlistSongs && info.setlistSongs.length > 0) {
          await saveSetlist(newRecord.id, info.setlistSongs);
        }
        // console.log('[CountdownScreen] addRecord 完了');
      } else {
        // 既存レコードの更新
        // console.log('[CountdownScreen] レコード更新開始');
        // console.log('[CountdownScreen] nextRecord.id:', nextRecord.id);
        // console.log('[CountdownScreen] uploadedImageUrls:', uploadedImageUrls);
        
        // 新しくアップロードされた画像があるかを確認（file:// で始まらないもの = アップロード済みURL）
        const newlyUploadedImages = uploadedImageUrls.filter((uri: string) => !uri.startsWith('file://'));
        
        // 古い画像をStorageから削除（新しいアップロードがある場合のみ）
        if (newlyUploadedImages.length > 0 && nextRecord.imageUrls?.length) {
          // console.log('[CountdownScreen] 古い画像を削除中');
          for (const oldImageUrl of nextRecord.imageUrls) {
            try {
              await deleteImage(oldImageUrl);
            } catch (error) {
              // console.warn('[CountdownScreen] 画像削除エラー:', error);
              // 削除失敗しても続行
            }
          }
          // console.log('[CountdownScreen] 古い画像削除完了');
        }
        
        const updatedRecord: ChekiRecord = {
          ...nextRecord,
          user_id: userId,
          artists: filteredArtists,
          artist: filteredArtists[0] || '',
          artistImageUrls: filteredArtistImageUrls,
          artistImageUrl: filteredArtistImageUrls[0] || info.artistImageUrl || nextRecord.artistImageUrl || '',
          liveName: info.name,
          liveType: normalizeLiveType(info.liveType || nextRecord.liveType),
          date: formatDate(info.date),
          venue: info.venue,
          seat: info.seat || nextRecord.seat || '',
          startTime: info.startTime || nextRecord.startTime || '',
          endTime: info.endTime || nextRecord.endTime || '',
          imageUrls: uploadedImageUrls.length > 0 ? uploadedImageUrls : (nextRecord.imageUrls || []),
          imageAssetIds: uploadedImageUrls.length > 0 ? uploadedImageAssetIds : (nextRecord.imageAssetIds || []),
          memo: info.memo || nextRecord.memo,
          detail: info.detail || nextRecord.detail,
          qrCode: info.qrCode || nextRecord.qrCode,
          createdAt: nextRecord.createdAt || new Date().toISOString(),
        };
        // console.log('[CountdownScreen] updateRecord 呼び出し前のデータ:', updatedRecord);
        await updateRecord(nextRecord.id, updatedRecord);
        
        // セットリストを保存（既存を削除して新規挿入）
        if (info.setlistSongs) {
          try {
            await saveSetlist(nextRecord.id, info.setlistSongs);
            console.log('[CountdownScreen] setlist 保存完了');
          } catch (setlistError) {
            console.error('[CountdownScreen] setlist保存エラー（スキップ）:', setlistError);
            // セットリストの保存に失敗してもレコードは更新済みなので続行
          }
        }
        // console.log('[CountdownScreen] updateRecord 完了');
      }
      // console.log('[CountdownScreen] 保存成功、画面を閉じます');
      
      // ローディングを先に非表示にしてから画面を閉じる
      setIsLoading(false);
    } catch (error) {
      console.error('[CountdownScreen] ライブ情報保存エラー:', error);
      setIsLoading(false);
      Alert.alert(t('countdown.alerts.error'), t('countdown.alerts.saveFailed'));
      throw error;
    }
  };

  const renderEmptyState = () => (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View
        style={[styles.gradient, { backgroundColor: '#000' }]}
      >
        <View style={[styles.emptyContainer, { paddingTop: insets.top + windowHeight * 0.08 }]}> 
          <Text style={styles.emptyTitle}>{t('countdown.emptyTitle')}</Text>
          <Text style={[styles.emptySubtitle, { marginBottom: windowHeight * 0.095 }]}>{t('countdown.emptySubtitle')}</Text>

          <TouchableOpacity
            style={[styles.emptyTicketWrapper, { width: emptyTicketWidth, marginTop: windowHeight * 0.025 }]}
            activeOpacity={0.9}
            onPress={handleAddLivePress}
          >
            <View style={[styles.pointingWrapper, { top: -emptyTicketHeight * 0.19, right: emptyTicketWidth * 0.09 }]}>
              <SvgUri uri={pointingSvgUri} width={pointIconSize} height={pointIconSize} />
            </View>

            <SvgXml xml={EMPTY_TICKET_SVG} width={emptyTicketWidth} height={emptyTicketHeight} />

            <View style={[styles.ticketPlus, { top: emptyTicketHeight * 0.10 }]}>
              <Text style={[styles.ticketPlusText, { fontSize: emptyTicketWidth * 0.34 }]}>＋</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderCountdown = () => {
    if (!nextRecord) return null;
    const record = nextRecord;
    const cardWidthByWidth = windowWidth * 0.72;
    const cardWidthByHeight = (windowHeight * 0.44) * (280 / 529);
    const cardWidth = Math.max(230, Math.min(cardWidthByWidth, cardWidthByHeight));
    const cardHeight = cardWidth * (529 / 280);
    const baseScale = cardWidth / 280;
    const qrSize = 120 * baseScale;
    const jacketSize = 130 * baseScale;
    const liveTypeLabels = t('liveEdit.liveTypes', { returnObjects: true }) as string[];
    const liveType = normalizeLiveType(record.liveType);
    const liveTypeLabel = getLiveTypeLabel(record.liveType, liveTypeLabels);
    const liveTypeIcon = LIVE_TYPE_ICON_MAP[liveType];

    const headerTop = insets.top + windowHeight * 0.008;
    const accordionTop = insets.top + windowHeight * 0.080;
    const countdownTop = insets.top + windowHeight * 0.10;
    const todaySongTop = insets.top + windowHeight * 0.21;
    const ticketHostTop = todaySongTop + Math.min(Math.max(windowHeight * 0.18, 125), 190) + 12;

    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        {/* Dynamic Blur Background */}
        {currentBackground ? (
          <>
            {previousBackground ? (
              <Animated.View
                style={[styles.backgroundImage, { opacity: Animated.subtract(1, backgroundFade) }]}
              >
                <Image
                  source={{ uri: previousBackground }}
                  style={styles.backgroundImage}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  transition={320}
                />
              </Animated.View>
            ) : null}
            <Animated.View style={[styles.backgroundImage, { opacity: backgroundFade }]}>
              <Image
                source={{ uri: currentBackground }}
                style={styles.backgroundImage}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={320}
              />
            </Animated.View>
            <BlurView intensity={50} tint="dark" style={styles.blurOverlay} />
          </>
        ) : (
          <View style={[styles.gradient, { backgroundColor: '#000' }]} />
        )}

        {/* ヘッダー */}
        <View style={[styles.headerContainer, { top: headerTop, left: '8%', right: '6%' }]}>
          <Text style={[styles.headerTitle, { fontSize: Math.min(windowWidth * 0.09, 35) }]}>{t('countdown.headerTitle')}</Text>
          <BlurView intensity={24} tint="dark" style={styles.headerButtons}>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={handleSharePress}
            >
              <Svg width={24} height={24} viewBox="0 0 24 24" fill="#fff">
                <Path
                  d="M12 22.75C6.07 22.75 1.25 17.93 1.25 12C1.25 6.07 6.07 1.25 12 1.25C12.41 1.25 12.75 1.59 12.75 2C12.75 2.41 12.41 2.75 12 2.75C6.9 2.75 2.75 6.9 2.75 12C2.75 17.1 6.9 21.25 12 21.25C17.1 21.25 21.25 17.1 21.25 12C21.25 11.59 21.59 11.25 22 11.25C22.41 11.25 22.75 11.59 22.75 12C22.75 17.93 17.93 22.75 12 22.75Z"
                  fill="white"
                />
                <Path
                  d="M12.9999 11.7502C12.8099 11.7502 12.6199 11.6802 12.4699 11.5302C12.1799 11.2402 12.1799 10.7602 12.4699 10.4702L20.6699 2.27023C20.9599 1.98023 21.4399 1.98023 21.7299 2.27023C22.0199 2.56023 22.0199 3.04023 21.7299 3.33023L13.5299 11.5302C13.3799 11.6802 13.1899 11.7502 12.9999 11.7502Z"
                  fill="white"
                />
                <Path
                  d="M22 7.58C21.59 7.58 21.25 7.24 21.25 6.83V2.75H17.17C16.76 2.75 16.42 2.41 16.42 2C16.42 1.59 16.76 1.25 17.17 1.25H22C22.41 1.25 22.75 1.59 22.75 2V6.83C22.75 7.24 22.41 7.58 22 7.58Z"
                  fill="white"
                />
              </Svg>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => setIsAccordionOpen((prev) => !prev)}
            >
              <SvgXml xml={EXCHANGE_ICON_SVG} width={27} height={27} />
            </TouchableOpacity>
          </BlurView>
        </View>

        {isAccordionOpen && (
          <Pressable
            style={styles.accordionBackdrop}
            onPress={() => setIsAccordionOpen(false)}
          />
        )}

        <Reanimated.View
          pointerEvents={isAccordionOpen ? 'auto' : 'none'}
          style={[styles.accordionContainer, accordionStyle, { top: accordionTop, left: windowWidth * 0.05, right: windowWidth * 0.05 }]}
        >
          <View style={styles.accordionCard}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.accordionList}
            >
              {futureLives.length === 0 ? (
                <Text style={styles.accordionEmpty}>{t('countdown.noUpcomingLive')}</Text>
              ) : (
                futureLives.map((record) => {
                  const isSelected = record.id === nextRecord?.id;
                  return (
                    <TouchableOpacity
                      key={record.id}
                      activeOpacity={0.85}
                      onPress={() => handleSelectLive(record)}
                    >
                      <BlurView
                        intensity={20}
                        tint="dark"
                        style={[
                          styles.accordionItem,
                          isSelected && styles.accordionItemSelected,
                        ]}
                      >
                        <View style={styles.accordionItemContent}>
                          <Text style={[styles.accordionDate, { width: Math.min(windowWidth * 0.13, 52) }]}>{formatShortDate(record.date)}</Text>
                          <View style={styles.accordionTextBlock}>
                            <Text style={styles.accordionArtist} numberOfLines={1}>
                              {record.artist || '-'}
                            </Text>
                            <Text style={styles.accordionTitle} numberOfLines={1}>
                              {record.liveName || '-'}
                            </Text>
                          </View>
                          {isSelected && (
                            <View
                              style={[
                                styles.accordionCheck,
                                {
                                  width: Math.min(windowWidth * 0.06, 24),
                                  height: Math.min(windowWidth * 0.06, 24),
                                  borderRadius: Math.min(windowWidth * 0.03, 12),
                                },
                              ]}
                            >
                              <Ionicons name="checkmark" size={16} color={theme.colors.accent.primary} />
                            </View>
                          )}
                        </View>
                      </BlurView>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </View>
        </Reanimated.View>

        {/* カウントダウン */}
        <View style={[styles.countdownDisplayContainer, { top: countdownTop }]}> 
          {liveStatus === 'during' ? (
            <Text style={styles.enjoyText}>{t('countdown.duringText')}</Text>
          ) : liveStatus === 'after' ? (
            <Text style={styles.enjoyText}>{t('countdown.afterText')}</Text>
          ) : (
            <View style={styles.countdownRow}>
              <View style={styles.countdownNumber}>
                <Text style={[styles.countdownValue, { fontSize: Math.min(windowWidth * 0.16, 60), lineHeight: Math.min(windowWidth * 0.19, 72) }]}>{countdown.days}</Text>
                <Text style={styles.countdownLabel}>D</Text>
              </View>
              <Text style={styles.countdownSeparator}>:</Text>
              <View style={styles.countdownNumber}>
                <Text style={[styles.countdownValue, { fontSize: Math.min(windowWidth * 0.16, 60), lineHeight: Math.min(windowWidth * 0.19, 72) }]}>{countdown.hours.toString().padStart(2, '0')}</Text>
                <Text style={styles.countdownLabel}>H</Text>
              </View>
              <Text style={styles.countdownSeparator}>:</Text>
              <View style={styles.countdownNumber}>
                <Text style={[styles.countdownValue, { fontSize: Math.min(windowWidth * 0.16, 60), lineHeight: Math.min(windowWidth * 0.19, 72) }]}>{countdown.minutes.toString().padStart(2, '0')}</Text>
                <Text style={styles.countdownLabel}>M</Text>
              </View>
              <Text style={styles.countdownSeparator}>:</Text>
              <View style={styles.countdownNumber}>
                <Text style={[styles.countdownValue, { fontSize: Math.min(windowWidth * 0.16, 60), lineHeight: Math.min(windowWidth * 0.19, 72) }]}>{countdown.seconds.toString().padStart(2, '0')}</Text>
                <Text style={styles.countdownLabel}>S</Text>
              </View>
            </View>
          )}
        </View>

        {/* 今日の1曲 */}
        {nextRecord?.artist && (
          <View style={{ position: 'absolute', top: todaySongTop, left: 0, right: 0 }}>
            <TodaySong 
              artistName={nextRecord.artist} 
              developerToken={APPLE_MUSIC_DEVELOPER_TOKEN}
            />
          </View>
        )}

        {/* 下部チケット表示（旧SVG） */}
        <View
          style={[
            styles.ticketHost,
            {
              top: ticketHostTop,
              bottom: insets.bottom + windowHeight * 0.02,
            },
          ]}
        >
          <View style={{ alignItems: 'center', marginBottom: Math.max(windowHeight * 0.02, 10) }}>
            <TouchableOpacity activeOpacity={0.92} onPress={() => handleCardPress(record)}>
              <View style={[styles.ticketCard, { width: cardWidth, height: cardHeight }]}>
                <SvgXml xml={EMPTY_TICKET_SVG} width={cardWidth} height={cardHeight} />

                <View
                  style={[
                    styles.ticketContent,
                    {
                      top: -15 * baseScale,
                      bottom: 20 * baseScale,
                      paddingHorizontal: 20 * baseScale,
                    },
                  ]}
                  pointerEvents="box-none"
                >
                  <View
                    style={[
                      styles.qrBlock,
                      {
                        top: 40 * baseScale,
                        left: cardWidth / 2 - qrSize / 2,
                      },
                    ]}
                  >
                    {record.qrCode ? (
                      <QRCode value={record.qrCode} size={qrSize} color="#000" backgroundColor="#fff" />
                    ) : (
                      <Image
                        source={require('../assets/no-qr.png')}
                        style={{ width: qrSize, height: qrSize }}
                        contentFit="contain"
                        cachePolicy="memory-disk"
                        transition={0}
                      />
                    )}
                    <Text style={[styles.qrText, { marginTop: 8 * baseScale }]}>
                      {record.qrCode ? 'M3M0RY-N3V3R-D13' : 'NO DATA'}
                    </Text>
                  </View>

                  <Pressable onPress={handleJacketTap}>
                    <Animated.View
                      style={[
                        styles.jacketShadow,
                        {
                          top: 40 * baseScale,
                          left: -72 * baseScale,
                          width: jacketSize,
                          height: jacketSize,
                          transform: [
                            { translateX: jacketAnimX },
                            {
                              rotate: jacketAnimRotate.interpolate({
                                inputRange: [-8, 0],
                                outputRange: ['-8deg', '0deg'],
                              }),
                            },
                          ],
                        },
                      ]}
                    >
                      <View style={[styles.jacketContainer, { width: jacketSize, height: jacketSize, borderRadius: 10 * baseScale }]}>
                        <Image
                          source={{ uri: coverUri ?? NO_IMAGE_URI }}
                          style={styles.jacketImage}
                          contentFit="cover"
                          cachePolicy="memory-disk"
                          transition={0}
                        />
                      </View>
                    </Animated.View>
                  </Pressable>

                  <View style={[styles.infoBlock, { top: 250 * baseScale }]}> 
                    {(record.liveName || '-').length >= 8 ? (
                      <View style={[styles.ticketTitleWrapper, { left: 35 * baseScale, width: 220 * baseScale, height: 32 * baseScale }]}> 
                        <TextTicker
                          style={[styles.ticketTitleText, { fontSize: 20 * baseScale }]}
                          duration={(record.liveName || '-').length * 300}
                          loop
                          bounce={false}
                          repeatSpacer={50}
                          marqueeDelay={1000}
                        >
                          {record.liveName || '-'}
                        </TextTicker>
                      </View>
                    ) : (
                      <Text
                        style={[
                          styles.ticketTitle,
                          {
                            left: 35 * baseScale,
                            fontSize: (record.liveName || '').length >= 12 ? 12 * baseScale : 24 * baseScale,
                          },
                        ]}
                      >
                        {record.liveName || '-'}
                      </Text>
                    )}

                    <View style={[styles.ticketArtistRow, { top: 40 * baseScale, left: 35 * baseScale, gap: 8 * baseScale }]}> 
                      <Text style={[styles.ticketArtist, { fontSize: 12 * baseScale }]} numberOfLines={1}>
                        {record.artist || '-'}
                      </Text>
                      <View style={styles.ticketLiveTypeRow}>
                        <MaterialCommunityIcons name={liveTypeIcon as any} size={12 * baseScale} color="#6A6A6A" />
                        <Text style={[styles.ticketLiveType, { fontSize: 11 * baseScale }]}>{liveTypeLabel}</Text>
                      </View>
                    </View>

                    <View style={[styles.info, { top: 30 * baseScale, left: -20 * baseScale, flexDirection: 'column', gap: 6 * baseScale, marginTop: 50 * baseScale }]}> 
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={[styles.infoLabel, { width: 100 * baseScale, textAlign: 'right', fontSize: 18 * baseScale }]}>DATE</Text>
                        <Text style={[styles.infoValue, { flex: 1, textAlign: 'left', fontSize: 18 * baseScale }]}>
                          {record.date || '-'}
                        </Text>
                      </View>

                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={[styles.infoLabel, { width: 100 * baseScale, textAlign: 'right', fontSize: 18 * baseScale }]}>START</Text>
                        <Text style={[styles.infoValue, { flex: 1, textAlign: 'left', fontSize: 18 * baseScale }]}>{record.startTime || '18:00'}</Text>
                      </View>

                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={[styles.infoLabel, { width: 100 * baseScale, textAlign: 'right', fontSize: 18 * baseScale }]}>SEAT</Text>
                        <Text style={[styles.infoValue, { flex: 1, textAlign: 'left', fontSize: 18 * baseScale }]}>{record.seat || '-'}</Text>
                      </View>

                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={[styles.infoLabel, { width: 100 * baseScale, textAlign: 'right', fontSize: 18 * baseScale }]}>VENUE</Text>
                        <Text
                          style={[
                            styles.infoValue,
                            {
                              flex: 1,
                              textAlign: 'left',
                              fontSize: (record.venue || '').length > 8 ? 14 * baseScale : 16 * baseScale,
                            },
                          ]}
                        >
                          {record.venue || '-'}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <>
      {!nextRecord ? renderEmptyState() : (liveStatus === 'after' && showEmptyAfterEnd) ? renderEmptyState() : renderCountdown()}

      <Modal
        visible={showEditScreen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowEditScreen(false)}
      >
        <LiveEditScreen
          initialData={!isCreatingNewLive && nextRecord ? {
            name: nextRecord.liveName,
            artists: nextRecord.artists && nextRecord.artists.length > 0 ? nextRecord.artists : [nextRecord.artist || ''],
            artist: nextRecord.artist,
            artistImageUrls: nextRecord.artistImageUrls,
            liveType: nextRecord.liveType,
            artistImageUrl: nextRecord.artistImageUrl,
            date: parseRecordDate(nextRecord.date) || new Date(),
            venue: nextRecord.venue || '',
            seat: nextRecord.seat || '',
            startTime: nextRecord.startTime || '18:00',
            endTime: nextRecord.endTime || '20:00',
            imageUrls: resolvedImageUrls.length > 0 ? resolvedImageUrls : nextRecord.imageUrls,
            qrCode: nextRecord.qrCode,
            memo: nextRecord.memo,
            detail: nextRecord.detail,
            setlistSongs: setlistSongs,
          } : null}
          onSave={handleSaveLiveInfo}
          onCancel={() => { setShowEditScreen(false); setIsCreatingNewLive(false); }}
        />
      </Modal>

      {nextRecord && (
        <ShareImageGenerator
          record={nextRecord}
          visible={showShareImage}
          onClose={handleShareModalClose}
        />
      )}

      {detailRecord && (
        <Modal
          animationType="fade"
          transparent={true}
          visible={true}
          onRequestClose={handleCloseDetailModal}
        >
          <View style={styles.modalOverlay}>
            <TicketDetail record={detailRecord} onBack={handleCloseDetailModal} />
          </View>
        </Modal>
      )}
    </>
  );
}

export default function CountdownScreen() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        gestureEnabled: false,
        fullScreenGestureEnabled: false,
        contentStyle: {
          backgroundColor: theme.colors.background.primary,
        },
      }}
    >
      <Stack.Screen name="CountdownMain" component={CountdownMain} />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          animation: 'slide_from_right',
          presentation: 'card',
          gestureEnabled: false,
          fullScreenGestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="ProfileEdit"
        component={ProfileEditScreen}
        options={{
          animation: 'slide_from_right',
          presentation: 'card',
          gestureEnabled: false,
          fullScreenGestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="Paywall"
        component={PaywallScreen}
        options={{
          animation: 'fade',
          presentation: 'transparentModal',
          contentStyle: {
            backgroundColor: 'transparent',
          },
          gestureEnabled: false,
          fullScreenGestureEnabled: false,
        }}
      />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  backgroundImage: {
    ...StyleSheet.absoluteFillObject,
    // Slight overscan prevents thin edge gaps on some large iPhone renders.
    left: -2,
    right: -2,
    top: -2,
    bottom: -2,
  },
  blurOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  vignetteOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  headerContainer: {
    position: 'absolute',
    left: '10%',
    right: '6%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  headerTitle: {
    fontSize: 35,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: 2,
    paddingTop: 4,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 35,
    overflow: 'hidden',
    paddingHorizontal: 6,
    paddingVertical: 4,
    shadowColor: '#323232',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  headerButton: {
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  accordionBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    zIndex: 15,
  },
  accordionContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    overflow: 'hidden',
  },
  accordionCard: {
    borderRadius: 18,
    backgroundColor: '#141414',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 12,
  },
  accordionList: {
    padding: 12,
    gap: 10,
  },
  accordionItem: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  accordionItemSelected: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
  },
  accordionItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 12,
  },
  accordionDate: {
    width: 48,
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  accordionTextBlock: {
    flex: 1,
  },
  accordionArtist: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.7)',
  },
  accordionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 2,
  },
  accordionCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  accordionEmpty: {
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    paddingVertical: 16,
    fontSize: 13,
  },
  countdownDisplayContainer: {
    width: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdownRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  countdownNumber: {
    alignItems: 'center',
    overflow: 'hidden',
  },
  countdownValue: {
    fontSize: 60,
    fontWeight: '900',
    fontFamily: 'Anton_400Regular',
    color: '#FFF',
    fontVariant: ['tabular-nums'],
    lineHeight: 72,
    letterSpacing: 1,
  },
  countdownLabel: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 1,
    fontWeight: '800',
  },
  countdownSeparator: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#FFF',
    marginHorizontal: 8,
    lineHeight: 60,
  },
  enjoyText: {
    fontSize: 45,
    fontWeight: '900',
    fontFamily: 'Anton_400Regular',
    color: '#FFF',
    textAlign: 'center',
    letterSpacing: 0.9,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  ticketHost: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 0,
  },
  ticketCard: {
    position: 'relative',
    backgroundColor: 'transparent',
  },
  ticketContent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingHorizontal: 0,
    gap: 12,
  },
  qrBlock: {
    position: 'absolute',
    top: 0,
    left: 0,
    alignItems: 'center',
    marginBottom: 24,
    paddingVertical: 12,
  },
  qrText: {
    marginTop: 8,
    fontSize: 8,
    fontWeight: '600',
    color: '#000',
    letterSpacing: 1,
  },
  jacketShadow: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 0,
    height: 0,
    shadowColor: '#000',
    shadowOffset: { width: 8, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  jacketContainer: {
    width: 0,
    height: 0,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  jacketImage: {
    width: '100%',
    height: '100%',
  },
  infoBlock: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  ticketTitle: {
    position: 'absolute',
    top: 0,
    left: 0,
    fontSize: 24,
    fontWeight: '900',
    color: '#000',
    textAlign: 'center',
    marginBottom: 5,
  },
  ticketTitleWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '80%',
    height: 32,
  },
  ticketTitleText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#000',
  },
  ticketArtistRow: {
    position: 'absolute',
    top: 0,
    left: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  ticketArtist: {
    fontSize: 12,
    fontWeight: '600',
    color: '#555',
  },
  ticketLiveTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  ticketLiveType: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6A6A6A',
  },
  info: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  infoLabel: {
    width: 70,
    fontSize: 16,
    fontWeight: '700',
    color: '#888',
    textAlign: 'left',
    marginRight: 12,
  },
  infoValue: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    color: '#000',
    textAlign: 'right',
  },
  ticketContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  ticketPlaceholder: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  placeholderSubtext: {
    fontSize: 16,
    color: '#666',
    marginTop: 8,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 32,
    paddingTop: 0,
  },
  emptyTitle: {
    fontSize: 42,
    lineHeight: 54,
    fontWeight: '900',
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 16,
  },
  emptySubtitle: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    marginBottom: 80,
  },
  emptyTicketWrapper: {
    marginTop: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointingWrapper: {
    position: 'absolute',
    top: 0,
    right: 0,
    zIndex: 2,
  },
  ticketPlus: {
    position: 'absolute',
    top: 140,
    zIndex: 1,
  },
  ticketPlusText: {
    fontSize: 96,
    fontWeight: '600',
    color: '#7d7d7d',
  },
  setupButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  setupButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 16,
    gap: 12,
    borderRadius: 35,
  },
  setupButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
  },
  featureButtonsContainer: {
    position: 'absolute',
    top: '28%',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    paddingHorizontal: 20,
    zIndex: 100,
  },
  featureButton: {
    position: 'relative',
    width: 110,
    height: 140,
    alignItems: 'center',
  },
  featureButtonIcon: {
    width: 110,
    height: 110,
  },
  featureButtonLabel: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFF',
    textAlign: 'center',
  },
  checklistContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  checklistHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 12,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
  },
  checklistHeaderButton: {
    padding: 8,
    width: 44,
  },
  checklistHeaderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1C1C1E',
  },
  checklistScroll: {
    flex: 1,
  },
  checklistScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
  },
  checklistProgressCard: {
    marginTop: 16,
    marginHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 24,
    elevation: 6,
    gap: 10,
  },
  checklistProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  checklistProgressLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
    letterSpacing: 0.2,
  },
  checklistProgressValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#007AFF',
  },
  checklistProgressBarTrack: {
    width: '100%',
    height: 10,
    borderRadius: 8,
    backgroundColor: '#E5E6EB',
    overflow: 'hidden',
  },
  checklistProgressBarFill: {
    height: '100%',
    borderRadius: 8,
    backgroundColor: '#007AFF',
  },
  checklistProgressSub: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '500',
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 24,
    elevation: 6,
  },
  checklistCheckbox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: '#D1D1D6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  checklistItemText: {
    fontSize: 16,
    color: '#1C1C1E',
  },
  checklistItemTextChecked: {
    color: '#AEAEB2',
  },
  checklistAddContainer: {
    marginTop: 12,
  },
  checklistInput: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 16,
    color: '#1C1C1E',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 18,
    elevation: 5,
  },
});
