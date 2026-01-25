import { StyleSheet, View, Text, ScrollView, TouchableOpacity, SectionList } from 'react-native';
import { Feather } from '@expo/vector-icons';

interface SettingItem {
  id: string;
  icon: string;
  label: string;
  value?: string;
  hasArrow?: boolean;
}

interface SettingSection {
  title: string;
  data: SettingItem[];
}

const SETTINGS_DATA: SettingSection[] = [
  {
    title: '表示設定',
    data: [
      {
        id: 'theme',
        icon: 'sun',
        label: 'テーマ',
        value: 'ライト',
        hasArrow: true,
      },
      {
        id: 'card-theme',
        icon: 'square',
        label: 'チェキ背景テーマ',
        value: '白',
        hasArrow: true,
      },
    ],
  },
  {
    title: 'データ管理',
    data: [
      {
        id: 'save-location',
        icon: 'save',
        label: '画像の保存先',
        value: 'アプリ内のみ',
        hasArrow: true,
      },
      {
        id: 'export',
        icon: 'download',
        label: 'データをエクスポート',
        hasArrow: true,
      },
    ],
  },
  {
    title: 'アプリについて',
    data: [
      {
        id: 'version',
        icon: 'info',
        label: 'バージョン',
        value: 'v1.0.0',
        hasArrow: false,
      },
      {
        id: 'feedback',
        icon: 'mail',
        label: '開発者にフィードバックを送る',
        hasArrow: true,
      },
      {
        id: 'license',
        icon: 'file-text',
        label: 'ライセンス',
        hasArrow: true,
      },
    ],
  },
];

interface SettingRowProps {
  item: SettingItem;
}

const SettingRow: React.FC<SettingRowProps> = ({ item }) => {
  return (
    <TouchableOpacity style={styles.rowContainer} activeOpacity={0.7}>
      <View style={styles.leftContent}>
        <Feather name={item.icon as any} size={20} color="#007AFF" style={styles.icon} />
        <Text style={styles.label}>{item.label}</Text>
      </View>
      <View style={styles.rightContent}>
        {item.value && <Text style={styles.value}>{item.value}</Text>}
        {item.hasArrow && (
          <Feather name="chevron-right" size={18} color="#C7C7CC" style={styles.chevron} />
        )}
      </View>
    </TouchableOpacity>
  );
};

interface SectionHeaderProps {
  title: string;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({ title }) => (
  <Text style={styles.sectionHeader}>{title}</Text>
);

interface SeparatorProps {
  leadingInset?: boolean;
}

const Separator: React.FC<SeparatorProps> = ({ leadingInset = true }) => (
  <View style={[styles.separator, leadingInset && styles.separatorInset]} />
);

export const SettingsScreen: React.FC = () => {
  return (
    <View style={styles.container}>
      <SectionList
        sections={SETTINGS_DATA}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <SettingRow item={item} />}
        renderSectionHeader={({ section: { title } }) => <SectionHeader title={title} />}
        ItemSeparatorComponent={({ leadingItem }) =>
          leadingItem ? <Separator leadingInset={true} /> : null
        }
        SectionSeparatorComponent={() => <View style={styles.sectionSeparator} />}
        scrollEnabled={false}
        contentContainerStyle={styles.contentContainer}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  contentContainer: {
    paddingVertical: 20,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  rowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  leftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  icon: {
    marginRight: 12,
    width: 20,
  },
  label: {
    fontSize: 16,
    color: '#000',
    fontWeight: '400',
  },
  rightContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  value: {
    fontSize: 16,
    color: '#8E8E93',
    marginRight: 8,
  },
  chevron: {
    marginLeft: 4,
  },
  separator: {
    height: 1,
    backgroundColor: '#E5E5EA',
  },
  separatorInset: {
    marginLeft: 16 + 20 + 12,
  },
  sectionSeparator: {
    height: 12,
  },
});
