# 比率・方程式計算機 (Ratio & Linear Calculator)

多段チェーン方程式や未定係数連立方程式を、ガウス消去法およびトポロジカル連鎖代入により自動解決する高機能Web計算機です。
ゲームのクラフト生産レシピ計算、化学・薬品の配合比率計算、多段原価按分、工業プラントバランス計算などに最適化されています。

GitHub Pages および GitHub Actions による自動ビルド・デプロイ環境が標準で組み込まれており、リポジトリにプッシュするだけで即座にWeb公開が可能です。

---

## 🚀 主な機能

- **連立方程式・レシピツリー自動求解**: 
  - ガウスの消去法（LU分解/後退代入）およびトポロジカルソート連鎖解決
  - 「10/2」「25%」「１，０００」「－３．５」などの全角・四則演算式・パーセント・桁区切りカンマの自動正規化
- **Mermaid フローチャート可視化**:
  - 方程式やレシピ木構造を有向グラフとして動的レンダリング
  - SVG / 高解像度 PNG によるワンクリック画像書き出し
- **変数メモ・手動オーバーライド**:
  - 各変数に日本語ラベル（例: `A: 原料A単価`）を記録可能
  - 任意変数の値を固定指定し、他の従属変数を逆算
- **PWA（ホーム画面インストール＆完全オフライン動作）**:
  - Android（Google Chrome）やiOS（Safari）のホーム画面にネイティブアプリ感覚でインストール可能（表示名: **「ライン計算機」**）
  - Service WorkerとWorkboxによる事前キャッシュにより、**機内モードや圏外環境でも全機能が完全に動作**
- **プリセット & 履歴・ブックマーク**:
  - 典型的な配合・ゲーム生産・原価計算プリセットを同梱
  - 独自のカスタムプリセット保存機能（Local Storage永続化）
  - 計算履歴の星付きブックマーク管理・メモ付与

---

## 🛠️ ローカル環境での実行

```bash
# 依存パッケージのインストール
npm install

# 開発サーバー起動（http://localhost:3000）
npm run dev

# プロダクションビルド（distフォルダに出力）
npm run build

# ビルド成果物のローカルプレビュー
npm run preview
```

---

## 🌐 GitHub Pages 公開ガイド

本プロジェクトは `https://<あなたのユーザー名>.github.io/<リポジトリ名>/` の形式で公開できるように事前設計されています。

`vite.config.ts` で `base: './'`（相対パス）が指定されているため、リポジトリ名を自由に変えてもJSやCSS、画像の404エラーが発生しません。

### コード反映（アップロード）手法の比較

手元のプロジェクトをGitHubに反映する方法は主に4通りあります。ご自身の環境や好みに合わせてお選びください。

| 反映手法 | メリット | デメリット | 推奨対象 |
| :--- | :--- | :--- | :--- |
| **A. Git CLI (コマンドライン)**<br>★ **最も推奨** | ・最速で確実に反映<br>・`.github/` などの隠しフォルダが漏れない<br>・今後の更新も `git push` のみで完了 | ・Gitの事前インストールとコマンド入力が必要 | 開発者・コマンド操作ができる方 |
| **B. GitHub Desktop** | ・GUI画面で差分を確認しながら反映<br>・ブラウザログインのみで認証が完了<br>・コマンド入力が不要 | ・GitHub Desktopアプリの事前インストールが必要 | コマンドラインが苦手な方 |
| **C. GitHub CLI (`gh`)** | ・ブラウザを開かずにターミナル1行でリポジトリ作成とプッシュが完了 | ・GitHub CLIの事前インストールと認証が必要 | ターミナルで全て完結させたい方 |
| **D. GitHub Web画面 (アップロード)** | ・追加のツール導入が一切不要 | ・1回のアップロード数制限（約100ファイル）<br>・`.github/` 階層が抜け落ちやすい<br>・以後の更新作業が煩雑 | 緊急時や最小限の確認のみ |

---

### 【手法A】Git CLI による公開手順（推奨ステップ）

#### ステップ 1: GitHubで空のリポジトリを作成
1. [GitHub](https://github.com/) にログインし、右上の「+」アイコン →「New repository」をクリック。
2. **Repository name**（例: `ratio-linear-calculator`）を入力。
3. 公開設定を **Public** に設定（無料プランでのGitHub Pages利用時はPublicを推奨）。
4. **注意:** 「Add a README file」や「.gitignore」のチェックは**外した状態（空のリポジトリ）**で「Create repository」をクリック。

#### ステップ 2: ローカルからGitでプッシュ
プロジェクトルートのターミナルで以下のコマンドを順に実行します。
（`<YOUR_USERNAME>` と `<YOUR_REPO>` はご自身のリポジトリ名に置き換えてください）

```bash
# 1. Gitの初期化
git init

# 2. 全ファイルをステージング
git add .

# 3. 初回コミットを作成
git commit -m "feat: 初回コミット（比率・方程式計算機）"

# 4. メインブランチ名を main に設定
git branch -M main

# 5. リモートリポジトリを登録
git remote add origin https://github.com/<YOUR_USERNAME>/<YOUR_REPO>.git

# 6. リモートへプッシュ
git push -u origin main
```

#### ステップ 3: GitHub Pagesの設定を「GitHub Actions」に切り替え（重要）
1. GitHubのリポジトリ画面を開きます。
2. 上部タブの **Settings**（設定）をクリック。
3. 左メニューの **Pages** を選択。
4. **Build and deployment > Source** のドロップダウンを開き、**`GitHub Actions`** を選択します。
   - ※プロジェクト内の `/.github/workflows/deploy.yml` が自動的に検出されます。

#### ステップ 4: 自動デプロイの確認
1. リポジトリ上部の **Actions** タブをクリック。
2. 「Deploy to GitHub Pages」というワークフローが自動で起動し、約1分で緑色のチェックマーク（Success）になります。
3. 完了後、画面に表示されるURL、または `https://<YOUR_USERNAME>.github.io/<YOUR_REPO>/` にアクセスするとアプリが利用可能です！

---

### 【手法B】GitHub Desktop による公開手順

1. [GitHub Desktop 公式サイト](https://desktop.github.com/) からアプリをダウンロード・インストールし、GitHubアカウントでログインします。
2. メニューバーの **File** → **Add Local Repository...** を選択。
3. 本プロジェクトのフォルダを選択します。
4. 「This directory does not appear to be a Git repository. Would you like to create a repository here?」と表示されたら **create a repository** をクリック。
5. 右上の **Publish repository** をクリックし、リポジトリ名を入力してGitHubへ発行します。
6. 上記「ステップ 3」と同様に、GitHubのブラウザ画面から **Settings > Pages > Source** を **GitHub Actions** に変更してください。

---

## 🔍 トラブルシューティング

### Q1. Actionsでビルドが失敗する（Permission denied 等）
- リポジトリの **Settings** → **Actions** → **General** を開き、**Workflow permissions** が「Read and write permissions」になっていることを確認してください。
- 本リポジトリの `.github/workflows/deploy.yml` 内に `pages: write` / `id-token: write` の権限が既に設定されています。

### Q2. ページを開くと真っ白になる・404になる
- URL末尾にスラッシュ（`/`）がついているか確認してください（例: `https://user.github.io/repo/`）。
- `vite.config.ts` で `base: './'` が指定されているため、アセットの参照パスは自動解決されます。

### Q3. 独自のカスタムドメインで運用したい
- リポジトリの **Settings** → **Pages** → **Custom domain** にドメイン名を入力し、お使いのDNSプロバイダでCNAMEレコードを設定してください。

---

## 📦 技術スタック

- **Framework**: React 19 / TypeScript 5.8
- **Build Tool**: Vite 6.2
- **Styling**: Tailwind CSS v4
- **Diagrams**: Mermaid 12.0
- **Icons**: Lucide React
- **CI/CD**: GitHub Actions (Ubuntu 24.04 / Node.js 20)

---

## 📄 ライセンス

MIT License
