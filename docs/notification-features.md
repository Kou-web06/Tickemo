# 通知機能の実装

## 概要
Tickemoアプリの通知機能を強化し、重複送信を防止するとともに、タイムカプセル通知と年次レポート通知を追加しました。

## 実装した機能

### 1. 通知の重複送信防止

#### 問題点
- `scheduleLiveReminders`が`records`の変更のたびに頻繁に呼ばれ、重複スケジュールが発生する可能性があった
- 同じ日に複数回実行された場合の制御が不十分だった

#### 解決策
1. **ロック機構の導入** ([liveNotifications.ts](../utils/liveNotifications.ts))
   - AsyncStorageに`@notification_schedule_lock`キーを使用
   - 5秒以内の重複実行をブロック
   - 処理完了後にロックを解放

2. **デバウンス処理** ([RecordsContext.tsx](../contexts/RecordsContext.tsx))
   - `useEffect`内で500msのタイムアウトを設定
   - recordsの変更が短時間に連続しても、最後の変更から500ms後に1回だけ実行

3. **スケジュール署名の改善**
   - 日付とレコード内容のハッシュベースで重複スケジュールを検知
   - 同じ内容であれば再スケジュールをスキップ

### 2. タイムカプセル通知

#### 仕様
- **トリガー**: 過去の公演と同じ月日（1年後以降）
- **通知タイトル**: 「ねぇねぇ、去年の今日、何してたか覚えてる？😎」
- **通知本文**: 「{N}年前の今日は「{ライブ名}」だったよ！{アーティスト名}との思い出、振り返ってみよう💫」
- **処理**: タップするとCollection画面の該当ライブ詳細画面（TicketDetail）に遷移

#### 実装詳細
- `getTimeCapsuleTargets()`関数で過去のライブから通知対象を生成
- 来年と再来年の2年分を事前にスケジュール（最大効率化）
- 通知データに`type: 'timecapsule'`, `recordId`, `kind: 'timecapsule'`を含める

### 3. 年次レポート通知

#### 仕様
- **トリガー**: 12月28日 21:00
- **通知タイトル**: 「今年の推し活レポートが届いたよ！私たち、今年も頑張ったね✨」
- **通知本文**: 「{年}年の推し活を振り返ってみよう！素敵な思い出がたくさん詰まっているはず🎉」
- **処理**: タップするとStatistics画面の「年間」タブに遷移し、当年のデータを表示

#### 実装詳細
- `getYearlyReportTargets()`関数で年次レポート通知を生成
- 今年と来年の12月28日をスケジュール
- 通知データに`type: 'yearly_report'`, `kind: 'yearly_report'`を含める

## 通知タイプの整理

### 既存の通知タイプ: `live_reminder`
- `day_before`: ライブ前日 19:00
- `one_hour_before`: ライブ開始1時間前
- `fifteen_minutes_before`: ライブ開始15分前
- `after_show`: ライブ当日 21:00（セットリスト記録促進）

### 新規通知タイプ
- `timecapsule`: 過去のライブの記念日
- `yearly_report`: 年次レポート（12月28日）

## ナビゲーション処理

### App.tsx
通知タップ時のルーティングを実装:
- `timecapsule` → Collection画面（Page 0）
- `yearly_report` → Statistics画面（Page 2）へ自動遷移
- `live_reminder` (after_show) → Collection画面（Page 0）

### CollectionScreen
- `timecapsule`: Detail画面（閲覧モード）に遷移
- `after_show`: Edit画面（メモ入力フォーカス）に遷移

### StatisticsScreen
- `yearly_report`: 「年間」タブを自動選択し、最新年度のデータを表示

## 技術的なポイント

### 通知スケジューリングの最適化
- 最大64件の通知をスケジュール（ライブリマインダー + タイムカプセル + 年次レポート）
- 全ての通知を時系列順にソートして優先順位付け
- 過去の日時はスキップして効率化

### 型安全性
- `trigger`の型エラー回避のため`as any`を使用（Expo Notificationsの型定義の制約）
- `rank`型を`1 | 2 | 3`として厳密に型付け

### エラーハンドリング
- 通知スケジューリングエラーはコンソールログに記録するのみ（ユーザー体験を妨げない）
- ロック解放の失敗時も安全に処理継続

## ファイル変更一覧

| ファイル | 変更内容 |
|---------|---------|
| `utils/liveNotifications.ts` | ロック機構、タイムカプセル/年次レポート通知の実装 |
| `App.tsx` | 通知タップ時の画面遷移ロジック拡張 |
| `screens/StatisticsScreen.tsx` | 年次レポート通知受信時の自動タブ切り替え |
| `screens/CollectionScreen.tsx` | タイムカプセル通知受信時の詳細画面表示 |
| `contexts/RecordsContext.tsx` | デバウンス処理の追加 |

## テスト方法

### 開発時の通知テスト
```typescript
// 通知を即座にスケジュールしてテスト
await Notifications.scheduleNotificationAsync({
  content: {
    title: 'テスト通知',
    body: 'これはテストです',
    data: { type: 'timecapsule', recordId: 'test-id', kind: 'timecapsule' }
  },
  trigger: { seconds: 5 } // 5秒後に通知
});
```

### 確認項目
- [ ] ライブリマインダー通知が重複せずに送信される
- [ ] タイムカプセル通知が過去のライブの記念日に表示される
- [ ] 年次レポート通知が12月28日に表示される
- [ ] 各通知をタップすると正しい画面に遷移する
- [ ] 通知許可が拒否されている場合でもアプリが動作する

## 今後の拡張案
- 通知設定画面での個別通知の有効/無効切り替え
- 通知時刻のカスタマイズ機能
- プッシュ通知のバッジカウント表示
- リッチ通知（画像付き）の対応
