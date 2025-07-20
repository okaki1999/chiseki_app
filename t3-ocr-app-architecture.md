# 地積測量図OCRアプリ - T3 Stack構成設計

## 🏗️ アーキテクチャ概要

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   フロントエンド   │────│   バックエンド     │────│   データベース    │
│   Next.js 15     │    │   tRPC + Next.js  │    │   PostgreSQL    │
│   Tailwind CSS   │    │   Prisma          │    │   (Docker)      │
│   React Hook Form│    │   Zod validation  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                        │                        │
         │              ┌──────────────────┐               │
         └──────────────│   OCR Services   │───────────────┘
                        │   (未実装)        │
                        │   Azure CV API   │
                        │   Google Vision  │
                        │   AWS Textract   │
                        └──────────────────┘
```

## 📁 現在のプロジェクト構成

```
chiseki-ocr-app/
├── prisma/
│   ├── schema.prisma           # データベーススキーマ（基本Postモデルのみ）
│   └── migrations/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── _components/
│   │   │   └── post.tsx        # 基本的なPostコンポーネント
│   │   ├── api/
│   │   │   └── trpc/
│   │   │       └── [trpc]/
│   │   │           └── route.ts # tRPC handler
│   │   ├── layout.tsx          # ルートレイアウト
│   │   └── page.tsx            # ホームページ
│   ├── server/
│   │   ├── api/
│   │   │   ├── routers/
│   │   │   │   └── post.ts     # 基本的なPost CRUD
│   │   │   └── root.ts         # tRPC root
│   │   └── db.ts               # Prisma client
│   ├── trpc/
│   │   ├── query-client.ts     # tRPC query client
│   │   ├── react.tsx           # tRPC React provider
│   │   └── server.ts           # tRPC server
│   ├── env.js                  # 環境変数設定
│   └── styles/
│       └── globals.css         # グローバルスタイル
├── start-database.sh           # PostgreSQL起動スクリプト
└── package.json
```

## 🗄️ 現在のデータベース設計 (Prisma Schema)

```prisma
// prisma/schema.prisma
generator client {
    provider = "prisma-client-js"
}

datasource db {
    provider = "postgresql"
    url      = env("DATABASE_URL")
}

model Post {
    id        Int      @id @default(autoincrement())
    name      String
    createdAt DateTime @default(now())
    updatedAt DateTime @updatedAt

    @@index([name])
}
```

## 🚧 実装状況

### ✅ 完了済み
- [x] T3 Stack基本セットアップ
- [x] Next.js 15 + App Router
- [x] tRPC設定
- [x] Prisma + PostgreSQL
- [x] 基本的なPost CRUD
- [x] データベース接続

### 🔄 進行中
- [ ] 環境変数設定（.envファイル作成）

### 📋 未実装
- [ ] 地積測量図専用スキーマ
- [ ] OCR機能
- [ ] 画像アップロード
- [ ] 検索機能
- [ ] UI/UX改善

## 🎯 次のステップ

### 1. 環境変数設定
```bash
# .env ファイル作成
DATABASE_URL="postgresql://postgres:password@localhost:5432/postgres"
NODE_ENV="development"
```

### 2. 地積測量図スキーマ実装
```prisma
// 拡張予定のスキーマ
model SurveyMap {
  id                String   @id @default(cuid())
  landNumber        String   // 地番
  location          String   // 所在地
  area              Decimal  // 地積（面積）
  // ... その他のフィールド
}
```

### 3. OCR機能実装
- Azure Computer Vision API統合
- 画像アップロード機能
- データ抽出・解析

### 4. UI/UX改善
- shadcn/ui導入
- レスポンシブデザイン
- ユーザーフレンドリーなインターフェース

## 💡 現在の課題と解決策

### 課題1: 環境変数未設定
**解決策**: `.env` ファイルを作成し、`DATABASE_URL` を設定

### 課題2: 基本的なスキーマのみ
**解決策**: 地積測量図専用のスキーマに拡張

### 課題3: OCR機能未実装
**解決策**: 段階的にOCR機能を実装

**現在のプロジェクトは基本的なT3 Stackのセットアップが完了しており、地積測量図OCRアプリの基盤として機能しています。**
