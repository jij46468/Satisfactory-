# Androidホーム画面インストール（PWA化）＆完全オフライン対応 実装計画書

## 1. 概要と目標
Android上のGoogle Chrome（および各種ブラウザ）から**「ホーム画面に追加」「アプリをインストール」**を行えるよう、PWA（Progressive Web App）標準規格に完全準拠させます。

- **アプリアイコン短縮名**: **「ライン計算機」**（ユーザー指定）
- **UI内インストールボタン**: 不要（Google Chrome標準のインストール機能・アドレスバー/メニューからインストール可能にする）
- **オフライン動作**: **完全オフライン対応**（一度アクセスすれば圏外・機内モードでもすべての計算・Mermaidフロー表示・プリセット・履歴機能が動作）

---

## 2. 実施手順

### ステップ 1: パッケージ導入
- `vite-plugin-pwa` を devDependency としてインストール。
- TypeScript型定義（`vite-plugin-pwa/client`）を `tsconfig.json` に設定。

### ステップ 2: PWAアプリアイコンの作成（`public/`）
Android / ChromiumのPWAインストール基準を満たすため、以下のアイコン資産を生成・配置します：
- `public/icon.svg`: 高解像度ベクターアイコン（計算機・数式・レイヤーをモチーフにしたモダンなデザイン）
- `public/pwa-192x192.png`: 標準解像度（192x192, purpose: "any"）
- `public/pwa-512x512.png`: 高解像度スプラッシュ画面用（512x512, purpose: "any"）
- `public/pwa-maskable-512x512.png`: Androidアダプティブアイコン用（安全マージン確保済み, purpose: "maskable"）
- `public/apple-touch-icon.png`: iOSホーム画面用（180x180）
- `public/favicon.ico`: ブラウザファビコン

### ステップ 3: `vite.config.ts` に `VitePWA` プラグインの設定
- Web App Manifestの設定:
  - `name`: `比率・方程式計算機 (Ratio & Linear Calculator)`
  - `short_name`: `ライン計算機`
  - `start_url`: `./`
  - `scope`: `./`
  - `display`: `standalone`
  - `theme_color`: `#0f172a`
  - `background_color`: `#020617`
  - `icons`: 192px / 512px / 512px maskable
- Workboxのオフラインキャッシュ戦略:
  - `globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}']`
  - 全アセットを事前キャッシュ（Precache）し、圏外でも100%オフライン動作を保証。
  - `devOptions.enabled: true` により開発環境でもService Worker動作を検証可能。

### ステップ 4: `index.html` およびメタ情報の整備
- `<meta name="theme-color" content="#0f172a" />`
- `<meta name="mobile-web-app-capable" content="yes" />`
- `<meta name="apple-mobile-web-app-capable" content="yes" />`
- `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />`
- `<meta name="apple-mobile-web-app-title" content="ライン計算機" />`
- `<link rel="apple-touch-icon" href="./apple-touch-icon.png" />`
- `<link rel="icon" type="image/svg+xml" href="./icon.svg" />`

### ステップ 5: Service Workerの自動登録（`src/main.tsx`）
- `virtual:pwa-register` によるサービスワーカー自動登録スクリプトの追加。

---

## 3. 検証項目
- [ ] Google ChromeのPWAインストール基準（Manifest + Service Worker + 192px/512pxアイコン + HTTPS/Localhost）をすべて満たしていること
- [ ] ホーム画面追加時の短縮名が「ライン計算機」となっていること
- [ ] 端末がオフライン（機内モード）でもアプリが読み込まれ、方程式計算やフローチャート描画が正常に機能すること
- [ ] `compile_applet` および `lint_applet` がエラーなくパスすること
