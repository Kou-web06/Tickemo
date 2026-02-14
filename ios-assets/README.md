# iOS アイコンセットの準備ガイド

このフォルダには、アプリの代替アイコン用の画像ファイルを配置します。

## 📁 フォルダ構造

```
ios-assets/
└── Tickemo/
    └── Images.xcassets/
        ├── icon2.appiconset/
        │   ├── Contents.json
        │   ├── icon2-20@2x.png (40x40)
        │   ├── icon2-20@3x.png (60x60)
        │   ├── icon2-29@2x.png (58x58)
        │   ├── icon2-29@3x.png (87x87)
        │   ├── icon2-40@2x.png (80x80)
        │   ├── icon2-40@3x.png (120x120)
        │   ├── icon2-60@2x.png (120x120)
        │   └── icon2-60@3x.png (180x180)
        ├── icon3.appiconset/
        │   └── (同様の構成)
        └── icon4.appiconset/
            └── (同様の構成)
```

## 🖼️ 必要な画像サイズ

各アイコンセットに以下のサイズの画像を配置してください：

| ファイル名 | サイズ | 用途 |
|-----------|--------|------|
| iconX-20@2x.png | 40x40 | 通知アイコン |
| iconX-20@3x.png | 60x60 | 通知アイコン |
| iconX-29@2x.png | 58x58 | 設定アイコン |
| iconX-29@3x.png | 87x87 | 設定アイコン |
| iconX-40@2x.png | 80x80 | Spotlight |
| iconX-40@3x.png | 120x120 | Spotlight |
| iconX-60@2x.png | 120x120 | ホーム画面 (iPhone) |
| iconX-60@3x.png | 180x180 | ホーム画面 (iPhone) |

## 🎨 画像の準備方法

### 方法1: 元の画像をリサイズ

`assets/app-icon/icon2.png` などをリサイズして各サイズを作成：

```bash
# ImageMagickを使用する場合
magick assets/app-icon/icon2.png -resize 40x40 ios-assets/Tickemo/Images.xcassets/icon2.appiconset/icon2-20@2x.png
magick assets/app-icon/icon2.png -resize 60x60 ios-assets/Tickemo/Images.xcassets/icon2.appiconset/icon2-20@3x.png
# ... (他のサイズも同様)
```

### 方法2: オンラインツールを使用

1. https://appicon.co/ などのサイトで元画像（1024x1024推奨）をアップロード
2. 生成されたアイコンをダウンロード
3. 必要なサイズのファイルを該当フォルダにコピー

## 🚀 Macでビルドする際の手順

Windowsでは準備のみを行い、実際のビルドはMacで行います：

1. **プロジェクトをMacに移動**

2. **iOSプロジェクトを生成**
   ```bash
   npx expo prebuild --platform ios
   ```

3. **アイコンセットをコピー**
   ```bash
   cp -r ios-assets/Tickemo/Images.xcassets/icon*.appiconset ios/Tickemo/Images.xcassets/
   ```

4. **ビルド実行**
   ```bash
   npx expo run:ios
   ```

## ⚠️ 注意事項

- すべての画像は **PNG形式** で透過なし
- 画像は **正方形** である必要があります
- **角丸処理は不要**（iOSが自動で適用）
- 各サイズの画像を**正確なピクセル数**で作成してください

## 📝 チェックリスト

- [ ] icon2用の8つの画像を作成・配置
- [ ] icon3用の8つの画像を作成・配置
- [ ] icon4用の8つの画像を作成・配置
- [ ] 各画像が正しいサイズであることを確認
- [ ] Macで`npx expo prebuild`を実行
- [ ] アイコンセットをiosフォルダにコピー
- [ ] ビルドしてテスト
