import React, { useMemo, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, Animated, TouchableOpacity } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Line, Circle, Text as SvgText } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width - 40;

interface HeatmapSlideProps {
  records: Array<{ date: string; [key: string]: any }>;
}

// 月の略称
const MONTH_LABELS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

// グラフの生成データ（年単位）
const generatePulseData = (records: Array<{ date: string }>, year: number) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth(); // 0-11
  
  // 現在の日付より前の記録のみをフィルタ
  const pastRecords = records.filter((record) => {
    const recordDate = new Date(record.date.replace(/\./g, '-'));
    recordDate.setHours(0, 0, 0, 0);
    return recordDate < today;
  });
  
  // 記録の日付をカウント
  const recordCountMap: { [key: string]: number } = {};
  pastRecords.forEach((record) => {
    const dateStr = record.date;
    if (dateStr) {
      const normalizedDate = dateStr.replace(/\./g, '-');
      recordCountMap[normalizedDate] = (recordCountMap[normalizedDate] || 0) + 1;
    }
  });

  // 現在年度の場合は現在月まで、過去年度は12ヶ月すべて
  const maxMonth = year === currentYear ? currentMonth + 1 : 12;
  const months: Array<{ count: number; monthIndex: number }> = [];
  
  for (let month = 0; month < maxMonth; month++) {
    const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;

    let count = 0;
    Object.keys(recordCountMap).forEach((dateKey) => {
      if (dateKey.startsWith(monthStr)) {
        count += recordCountMap[dateKey];
      }
    });

    months.push({ count, monthIndex: month });
  }

  return months;
};

// ベジェ曲線のコントロールポイント計算（シャープ）
const getSmoothPath = (points: Array<{ x: number; y: number }>) => {
  if (points.length === 0) return '';
  
  let path = `M ${points[0].x},${points[0].y}`;
  
  for (let i = 0; i < points.length - 1; i++) {
    const current = points[i];
    const next = points[i + 1];
    // コントロールポイントを各点により近づけてシャープに
    const tension = 0.3; // 0に近いほどシャープ、1に近いほど滑らか
    const controlX1 = current.x + (next.x - current.x) * tension;
    const controlX2 = next.x - (next.x - current.x) * tension;
    
    path += ` C ${controlX1},${current.y} ${controlX2},${next.y} ${next.x},${next.y}`;
  }
  
  return path;
};

export default function HeatmapSlide({ records }: HeatmapSlideProps) {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  
  const pulseData = useMemo(() => generatePulseData(records, selectedYear), [records, selectedYear]);
  
  // 現在年度かどうか
  const isCurrentYear = selectedYear === currentYear;
  
  // 利用可能な年のリストを取得
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    records.forEach((record) => {
      const dateStr = record.date;
      if (dateStr) {
        const parsed = new Date(dateStr.replace(/\./g, '-'));
        if (!isNaN(parsed.getTime())) {
          years.add(parsed.getFullYear());
        }
      }
    });
    return Array.from(years).sort((a, b) => a - b); // 昇順でソート
  }, [records]);

  // 最小年と最大年を取得（現在年も必ず含める）
  const minYear = availableYears.length > 0 ? availableYears[0] : currentYear;
  const maxYear = availableYears.length > 0 ? Math.max(availableYears[availableYears.length - 1], currentYear) : currentYear;

  // 前の年/次の年があるかチェック（最小値より大きい/最大値より小さい）
  const hasPrevYear = selectedYear > minYear;
  const hasNextYear = selectedYear < maxYear;
  
  const handlePrevYear = () => {
    if (hasPrevYear) {
      const prevYear = availableYears.reverse().find((y) => y < selectedYear) || minYear;
      setSelectedYear(prevYear);
    }
  };
  
  const handleNextYear = () => {
    if (hasNextYear) {
      const nextYear = availableYears.find((y) => y > selectedYear) || maxYear;
      setSelectedYear(nextYear);
    }
  };
  
  // 点滅アニメーション（呼吸効果）
  const dotOpacity = React.useRef(new Animated.Value(1)).current;
  const dotScale = React.useRef(new Animated.Value(1)).current;
  
  useEffect(() => {
    const animation = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(dotOpacity, {
            toValue: 0.4,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(dotOpacity, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(dotScale, {
            toValue: 1.3,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(dotScale, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]),
      ])
    );
    animation.start();
    
    return () => animation.stop();
  }, [dotOpacity, dotScale]);

  // SVGグラフのパラメータ
  const SVG_WIDTH = CARD_WIDTH - 46;
  const SVG_HEIGHT = 160;
  const GRAPH_PADDING_TOP = 20;
  const GRAPH_PADDING_BOTTOM = 30;
  const GRAPH_PADDING_HORIZONTAL = 20;
  const GRAPH_WIDTH = SVG_WIDTH - GRAPH_PADDING_HORIZONTAL * 2;
  const GRAPH_HEIGHT = SVG_HEIGHT - GRAPH_PADDING_TOP - GRAPH_PADDING_BOTTOM;

  // グラフのポイント生成
  const maxCount = Math.max(...pulseData.map((d) => d.count), 6); // 最小値6でスケール調整
  const points: { x: number; y: number }[] = [];

  pulseData.forEach((data, index) => {
    const x = GRAPH_PADDING_HORIZONTAL + (index / (pulseData.length - 1 || 1)) * GRAPH_WIDTH;
    const y = GRAPH_PADDING_TOP + GRAPH_HEIGHT - (data.count / maxCount) * GRAPH_HEIGHT;
    points.push({ x, y });
  });

  // ベジェ曲線パス
  const smoothPath = getSmoothPath(points);
  
  // エリアチャート用のパス（塗りつぶし用）
  const areaPath = smoothPath 
    ? `${smoothPath} L ${points[points.length - 1].x},${GRAPH_PADDING_TOP + GRAPH_HEIGHT} L ${points[0].x},${GRAPH_PADDING_TOP + GRAPH_HEIGHT} Z`
    : '';
  
  // 最後のポイント（現在地）
  const lastPoint = points[points.length - 1];

  // 未使用の変数を削除

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <TouchableOpacity
            onPress={handlePrevYear}
            disabled={!hasPrevYear}
            style={styles.yearButton}
          >
            <Ionicons
              name="chevron-back"
              size={20}
              color={hasPrevYear ? '#666666' : '#DDDDDD'}
            />
          </TouchableOpacity>
          <View style={styles.titleContainer}>
            <Text style={styles.title}>{selectedYear}</Text>
            <Text style={styles.subtitle}>年間ライブ記録</Text>
          </View>
          <TouchableOpacity
            onPress={handleNextYear}
            disabled={!hasNextYear}
            style={styles.yearButton}
          >
            <Ionicons
              name="chevron-forward"
              size={20}
              color={hasNextYear ? '#666666' : '#DDDDDD'}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* グラフ */}
      <View style={styles.graphContainer}>
        <Svg width={SVG_WIDTH} height={SVG_HEIGHT}>
          <Defs>
            {/* グラデーション（上から下：60%→10%） */}
            <LinearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#ff0099" stopOpacity="0.5" />
              <Stop offset="100%" stopColor="#ff0099" stopOpacity="0.05" />
            </LinearGradient>
          </Defs>

          {/* 横線グリッド（Y軸補助線） */}
          {[0, 0.33, 0.66, 1].map((ratio, index) => {
            const y = GRAPH_PADDING_TOP + GRAPH_HEIGHT * ratio;
            return (
              <Line
                key={`grid-${index}`}
                x1={GRAPH_PADDING_HORIZONTAL}
                y1={y}
                x2={SVG_WIDTH - GRAPH_PADDING_HORIZONTAL}
                y2={y}
                stroke="#F0F0F0"
                strokeWidth="1"
              />
            );
          })}

          {/* エリアチャート（塗りつぶし） */}
          {areaPath && (
            <Path
              d={areaPath}
              fill="url(#areaGradient)"
            />
          )}

          {/* 曲線（ストローク） */}
          {smoothPath && (
            <Path
              d={smoothPath}
              fill="none"
              stroke="#ff0099"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* データポイントとX軸ラベル */}
          {points.map((point, index) => (
            <React.Fragment key={`label-${index}`}>
              {/* X軸ラベル（月） */}
              <SvgText
                x={point.x}
                y={SVG_HEIGHT - 10}
                fontSize="10"
                fill="#999999"
                textAnchor="middle"
                fontWeight="500"
              >
                {MONTH_LABELS[pulseData[index].monthIndex]}
              </SvgText>
            </React.Fragment>
          ))}

          {/* Y軸の数値ラベル */}
          {[0, 0.33, 0.66, 1].map((ratio, index) => {
            const y = GRAPH_PADDING_TOP + GRAPH_HEIGHT * ratio;
            const value = Math.round(maxCount * (1 - ratio));
            return (
              <SvgText
                key={`y-label-${index}`}
                x={GRAPH_PADDING_HORIZONTAL - 8}
                y={y + 4}
                fontSize="9"
                fill="#CCCCCC"
                textAnchor="end"
              >
                {value}
              </SvgText>
            );
          })}

          {/* 現在地の固定ドット */}
          {lastPoint && (
            <Circle
              cx={lastPoint.x}
              cy={lastPoint.y}
              r="3"
              fill="#ff0099"
            />
          )}
        </Svg>
        
        {/* 点滅ドット（呼吸効果） - 現在年度のみ表示 */}
        {lastPoint && isCurrentYear && (
          <>
            {/* 外側の拡散リング */}
            <Animated.View
              style={[
                styles.pulseRing,
                {
                  left: lastPoint.x - 10,
                  top: lastPoint.y - 10,
                  opacity: dotOpacity.interpolate({
                    inputRange: [0.4, 1],
                    outputRange: [0, 0.3],
                  }),
                  transform: [{ scale: dotScale }],
                },
              ]}
            />
            {/* 中心ドット */}
            <Animated.View
              style={[
                styles.pulseDot,
                {
                  left: lastPoint.x - 7,
                  top: lastPoint.y - 7,
                  opacity: dotOpacity,
                },
              ]}
            />
          </>
        )}
      </View>

      {/* 統計情報 */}
      <View style={styles.stats}>
        <Text style={styles.statsText}>
          {selectedYear}年は <Text style={styles.statsValue}>{pulseData.reduce((sum, d) => sum + d.count, 0)}</Text> 回参戦
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 3,
    shadowColor: '#d2d2d2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 8,
    height: 300,
  },
  header: {
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleContainer: {
    alignItems: 'center',
    flex: 1,
  },
  yearButton: {
    padding: 4,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 11,
    fontWeight: '500',
    color: '#8E8E93',
  },
  graphContainer: {
    marginBottom: 12,
    alignItems: 'center',
    position: 'relative',
  },
  pulseDot: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#ff0099',
  },
  pulseRing: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ff0099',
  },
  stats: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E8E8E8',
    marginTop: 8,
  },
  statsText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666666',
    textAlign: 'center',
  },
  statsValue: {
    fontWeight: '700',
    color: '#000000',
  },
});
