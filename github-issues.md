# GitHub Issues for 地積測量図OCRアプリ

## 🚧 現在の課題

### Issue #1: アプリケーション起動エラーの解決
**Priority**: High
**Labels**: `bug`, `database`

#### 問題
- Supabaseデータベース接続エラーが発生
- アプリケーション起動時にデータベース接続が失敗
- tRPCクエリが正常に動作しない

#### 解決策
1. Supabaseデータベースの状態確認
2. ネットワーク接続の確認
3. 必要に応じてローカル開発用の設定調整

#### 完了条件
- [ ] アプリケーションが正常に起動する
- [ ] データベース接続エラーが解消される
- [ ] tRPCクエリが正常に動作する

---

### Issue #2: 地積測量図専用スキーマの実装
**Priority**: Medium
**Labels**: `enhancement`, `database`

#### 問題
- 現在のPrismaスキーマは基本的なPostモデルのみ
- 地積測量図に特化したデータ構造が未実装

#### 必要なモデル
```prisma
model SurveyMap {
  id                String   @id @default(cuid())
  landNumber        String   // 地番
  location          String   // 所在地
  area              Decimal  // 地積（面積）
  areaUnit          String   @default("㎡")
  surveyDate        DateTime // 測量年月日
  calculationMethod String   // 求積方法
  coordinateSystem  String?  // 座標系番号
  scale            String?   // 縮尺
  orientation      String?   // 方位
  originalFileName  String   // 元ファイル名
  imageUrl         String   // 画像URL
  confidenceScore  Float?   // OCR全体信頼度
  userId           String
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  boundaryPoints   BoundaryPoint[]
  adjacentLands    AdjacentLand[]
  ocrResults       OcrResult[]

  @@index([landNumber])
  @@index([location])
  @@index([surveyDate])
}

model BoundaryPoint {
  id           String    @id @default(cuid())
  surveyMapId  String
  surveyMap    SurveyMap @relation(fields: [surveyMapId], references: [id], onDelete: Cascade)
  pointNumber  String    // 点番号
  xCoordinate  Decimal   // X座標
  yCoordinate  Decimal   // Y座標
  markerType   String?   // 境界標種類
  markerSymbol String?   // 境界標記号
  @@index([surveyMapId])
}

model AdjacentLand {
  id           String    @id @default(cuid())
  surveyMapId  String
  surveyMap    SurveyMap @relation(fields: [surveyMapId], references: [id], onDelete: Cascade)
  landNumber   String    // 隣接地番
  direction    String?   // 方向（北側、南側など）
}

model OcrResult {
  id           String    @id @default(cuid())
  surveyMapId  String
  surveyMap    SurveyMap @relation(fields: [surveyMapId], references: [id], onDelete: Cascade)
  fieldName    String    // 抽出フィールド名
  rawText      String    // OCR生テキスト
  parsedValue  String?   // パース済み値
  confidence   Float     // 信頼度
  boundingBox  Json?     // 座標情報
  provider     String    // OCRプロバイダー
  isManualEdit Boolean   @default(false)
  editedBy     String?
  editedAt     DateTime?
  @@index([surveyMapId])
  @@index([fieldName])
}
```

#### 完了条件
- [ ] 新しいスキーマが実装される
- [ ] マイグレーションが実行される
- [ ] tRPCルーターが更新される

---

### Issue #3: OCR機能の実装
**Priority**: High
**Labels**: `feature`, `ocr`

#### 問題
- OCR機能が未実装
- 画像アップロード機能がない
- データ抽出・解析機能がない

#### 実装内容
1. **画像アップロード機能**
   - ファイル選択UI
   - 画像プレビュー
   - アップロード処理

2. **OCR API統合**
   - Azure Computer Vision API
   - Google Cloud Vision API
   - AWS Textract API

3. **データ抽出・解析**
   - 地番抽出
   - 面積計算
   - 座標情報抽出

#### 完了条件
- [ ] 画像アップロード機能が実装される
- [ ] OCR APIが統合される
- [ ] データ抽出機能が実装される
- [ ] 結果がデータベースに保存される

---

### Issue #4: UI/UX改善
**Priority**: Medium
**Labels**: `enhancement`, `ui`

#### 問題
- 基本的なUIのみ
- ユーザーフレンドリーでない
- レスポンシブデザインが不十分

#### 改善内容
1. **shadcn/ui導入**
   - モダンなUIコンポーネント
   - 一貫したデザインシステム

2. **レスポンシブデザイン**
   - モバイル対応
   - タブレット対応

3. **ユーザビリティ向上**
   - 直感的なナビゲーション
   - エラーハンドリング
   - ローディング状態

#### 完了条件
- [ ] shadcn/uiが導入される
- [ ] レスポンシブデザインが実装される
- [ ] ユーザビリティが向上する

---

### Issue #5: 検索機能の実装
**Priority**: Low
**Labels**: `feature`, `search`

#### 問題
- データ検索機能がない
- フィルタリング機能がない

#### 実装内容
1. **基本検索**
   - 地番検索
   - 所在地検索

2. **高度な検索**
   - 面積範囲検索
   - 測量日検索
   - 複数条件検索

3. **検索結果表示**
   - 一覧表示
   - 詳細表示
   - エクスポート機能

#### 完了条件
- [ ] 基本検索機能が実装される
- [ ] 高度な検索機能が実装される
- [ ] 検索結果表示が実装される

---

## 📋 実装優先順位

### Phase 1: 基盤整備
1. 🔄 アプリケーション起動エラーの解決
2. 📋 地積測量図専用スキーマの実装
3. 📋 OCR機能の実装

### Phase 2: 機能拡張
4. 📋 UI/UX改善
5. 📋 検索機能の実装

### Phase 3: 最適化
6. 📋 パフォーマンス改善
7. 📋 セキュリティ強化

---

## 🎯 マイルストーン

### Milestone 1: MVP完成 (2週間)
- 基本的なOCR機能
- データベース保存
- シンプルなUI

### Milestone 2: 機能拡張 (1ヶ月)
- 高度な検索機能
- 改善されたUI/UX
- エラーハンドリング

### Milestone 3: 本格運用 (2ヶ月)
- パフォーマンス最適化
- セキュリティ強化
- ユーザーフィードバック対応
