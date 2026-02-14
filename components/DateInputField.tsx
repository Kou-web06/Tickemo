import React, { useState } from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { theme } from '../theme';

interface DateInputFieldProps {
  value: Date | null;
  onChange: (date: Date) => void;
  label?: string;
}

export default function DateInputField({
  value,
  onChange,
  label,
}: DateInputFieldProps) {
  const [isPickerVisible, setIsPickerVisible] = useState(false);

  const handleConfirm = (selectedDate: Date) => {
    onChange(selectedDate);
    setIsPickerVisible(false);
  };

  const handleCancel = () => {
    setIsPickerVisible(false);
  };

  const formatDate = (date: Date | null): string => {
    if (!date) return '日付を選択';
    try {
      // yyyy.MM.dd (EEE) フォーマット - 日本語の曜日
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      
      // 曜日を日本語で取得
      const daysJa = ['日', '月', '火', '水', '木', '金', '土'];
      const dayOfWeek = daysJa[date.getDay()];
      
      return `${year}.${month}.${day} (${dayOfWeek})`;
    } catch {
      return '日付を選択';
    }
  };

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}

      <TouchableOpacity
        style={styles.triggerButton}
        onPress={() => setIsPickerVisible(true)}
      >
        <Feather name="calendar" size={20} color="#888888" />
        <Text
          style={[
            styles.dateText,
            !value && styles.placeholderText,
          ]}
        >
          {formatDate(value)}
        </Text>
      </TouchableOpacity>

      <DateTimePickerModal
        isVisible={isPickerVisible}
        mode="date"
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        display={Platform.OS === 'ios' ? 'inline' : 'default'}
        isDarkModeEnabled={false}
        locale={Platform.OS === 'ios' ? 'ja_JP' : undefined}
        date={value || new Date()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#999999',
    marginBottom: 8,
    marginLeft: 4,
  },
  triggerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  dateText: {
    flex: 1,
    fontSize: 16,
    color: '#000000',
    fontWeight: '500',
  },
  placeholderText: {
    color: '#BBBBBB',
    fontWeight: '400',
  },
});
