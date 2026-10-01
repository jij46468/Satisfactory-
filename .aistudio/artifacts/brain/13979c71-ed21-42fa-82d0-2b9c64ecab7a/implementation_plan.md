# GitHub App ワークフロー権限付与による解決計画書（改訂版）

## 1. 方針の変更と概要
- **変更前**: `.github/workflows/deploy.yml` を一時退避してワークフローを含めずにプッシュする方式
- **変更後**: **`.github/workflows/deploy.yml` をリポジトリ内に保持したまま、GitHub側で「AI Studio GitHub App」に Workflows 権限を再承認・付与して正規プッシュを成功させる方式**

---

## 2. 権限付与（Re-authorize）の手順詳細

GitHubがワークフローファイルの作成・編集をブロックするのは、GitHub Appsに対して `Workflows`（ワークフロー読み取り・書き込み権限）がデフォルトで制限されているためです。以下のいずれかの手順で権限を付与・再承認します。

### 手順 A: AI Studio GitHub App の再承認（推奨）
1. [GitHub](https://github.com/) にログイン。
2. 右上のプロフィールアイコンをクリック → **Settings（設定）** を開く。
3. 左サイドバーの **Applications**（または **Integrations > Applications**）をクリック。
4. **Authorized GitHub Apps**（承認済みGitHubアプリ）または **Installed GitHub Apps** タブを選択。
5. リスト内の **「AI Studio」**（または Google AI Studio）を探し、**Configure** またはアプリ名をクリック。
6. 「Permissions」項目で **Workflows: Read and write** が要求されている場合、**「Accept / Re-authorize」**（再承認）をクリックして許可します。
7. ※もし一覧から「Revoke（承認取り消し）」した上で、AI Studio側のGitHubエクスポート画面から再度「Connect to GitHub」を行うと、最新の権限（Workflows含む）を要求する承認ポップアップが再表示され、確実に権限が付与されます。

### 手順 B: リポジトリ側のActions権限の確認
1. 対象のGitHubリポジトリを開く。
2. 上部 **Settings** → 左メニュー **Actions** → **General** を開く。
3. **Workflow permissions** セクションで **「Read and write permissions」** にチェックが入っていることを確認します。

---

## 3. 実装・整備タスク

### タスク 1: ワークフロー定義の維持と完全性チェック
- `/.github/workflows/deploy.yml` は移動・削除せず、GitHub Pages自動デプロイ用の完全な設定として維持します。
- `vite.config.ts` の `base: './'` 相対パス設定と連携し、プッシュ成功と同時にActionsが自動実行される状態を保ちます。

### タスク 2: `README.md` の改訂
- AI Studioからプッシュする際の「Insufficient permissions to push workflow files」エラーの解決手順（上記の手順A・B）をトラブルシューティングに追加。
- 権限再承認後のスムーズなプッシュ完了フローを明記。

### タスク 3: アプリ内「GitHub Pages 公開ガイド」UI（`GitHubPagesModal`）の改訂
- モーダル内の「3. 設定のコツ & FAQ」に、本エラー画面の画像/解説と「GitHub側でのWorkflows権限再承認手順（リンク付き）」を分かりやすく追記。
- ユーザーがGitHubの設定ページ（`https://github.com/settings/applications`）へ直接アクセスできる補助リンクを提供。

### タスク 4: ビルドと動作検証
- `compile_applet` および `lint_applet` による検証。

---

## 4. 検証項目
- [ ] `.github/workflows/deploy.yml` が健全な状態で存在していること
- [ ] `README.md` にGitHub Appの権限再承認手順が正確に記載されていること
- [ ] アプリ内モーダルから権限付与手順とGitHub設定への直リンクが利用できること
- [ ] アプリ全体のビルドが正常に通ること
