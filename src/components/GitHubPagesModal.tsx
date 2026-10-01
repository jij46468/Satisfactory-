import React, { useState } from 'react';
import {
  X,
  Globe,
  Copy,
  Check,
  ExternalLink,
  Terminal,
  Settings,
  ShieldCheck,
  Laptop,
  HelpCircle,
  Sparkles,
} from 'lucide-react';

interface GitHubPagesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GitHubPagesModal: React.FC<GitHubPagesModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'steps' | 'methods' | 'faq'>('steps');
  const [username, setUsername] = useState('username');
  const [repoName, setRepoName] = useState('ratio-linear-calculator');
  const [copiedType, setCopiedType] = useState<string | null>(null);

  if (!isOpen) return null;

  const cleanUser = username.trim() || 'username';
  const cleanRepo = repoName.trim() || 'ratio-linear-calculator';
  const targetUrl = `https://${cleanUser}.github.io/${cleanRepo}/`;
  const remoteUrl = `https://github.com/${cleanUser}/${cleanRepo}.git`;

  const gitCliCommands = `# 1. Gitリポジトリ初期化
git init

# 2. 全ファイルをステージングしてコミット
git add .
git commit -m "feat: 初回コミット（比率・方程式計算機 & GitHub Pages自動デプロイ設定）"

# 3. メインブランチを main に設定
git branch -M main

# 4. リモートリポジトリを登録
git remote add origin ${remoteUrl}

# 5. GitHubへプッシュ
git push -u origin main`;

  const ghCliCommand = `gh repo create ${cleanRepo} --public --source=. --remote=origin --push`;

  const handleCopy = (text: string, type: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-xs transition-opacity animate-in fade-in select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="w-full sm:max-w-2xl bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in slide-in-from-bottom-4 duration-200">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-sky-950/50">
              <Globe className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                GitHub Pages 公開ガイド
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold">
                  CI/CD設定済み
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                リポジトリ名とユーザー名を入力すると、あなた専用のプッシュ手順とURLを自動生成します
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            aria-label="閉じる"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Dynamic User & Repo config banner */}
        <div className="p-3.5 bg-slate-950/70 border-b border-slate-800 shrink-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                GitHub ユーザー名 (または Organization 名)
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="例: rezun2512"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-sky-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                リポジトリ名
              </label>
              <input
                type="text"
                value={repoName}
                onChange={(e) => setRepoName(e.target.value)}
                placeholder="例: ratio-linear-calculator"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-sky-500 font-mono"
              />
            </div>
          </div>

          {/* Generated URL bar */}
          <div className="mt-2.5 flex items-center justify-between gap-2 p-2 rounded-lg bg-sky-950/30 border border-sky-800/40">
            <div className="flex items-center gap-1.5 overflow-hidden">
              <span className="text-[10px] text-sky-400 font-semibold uppercase tracking-wider shrink-0">
                公開後URL:
              </span>
              <span className="text-xs text-sky-200 font-mono truncate select-all">
                {targetUrl}
              </span>
            </div>
            <button
              type="button"
              onClick={() => handleCopy(targetUrl, 'url')}
              className="px-2 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-medium flex items-center gap-1 transition-all shrink-0 cursor-pointer"
            >
              {copiedType === 'url' ? (
                <>
                  <Check className="w-3 h-3 text-emerald-200" />
                  コピー完了
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  URLコピー
                </>
              )}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-4 border-b border-slate-800 flex gap-2 shrink-0 bg-slate-900/50">
          <button
            type="button"
            onClick={() => setActiveTab('steps')}
            className={`py-2.5 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'steps'
                ? 'border-sky-500 text-sky-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            1. 公開ステップ (推奨フロー)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('methods')}
            className={`py-2.5 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'methods'
                ? 'border-sky-500 text-sky-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Laptop className="w-3.5 h-3.5" />
            2. 反映方法の比較（4種）
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('faq')}
            className={`py-2.5 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'faq'
                ? 'border-sky-500 text-sky-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            3. 設定のコツ & FAQ
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs text-slate-300">
          {activeTab === 'steps' && (
            <div className="space-y-4">
              {/* Step 1 */}
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 text-[11px] font-bold flex items-center justify-center border border-sky-500/30">
                    1
                  </span>
                  <h3 className="font-bold text-white text-xs">
                    GitHubで空のリポジトリを作成する
                  </h3>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed pl-7">
                  GitHub右上の「＋」→「New repository」からリポジトリ名「<span className="text-sky-300 font-mono">{cleanRepo}</span>」で作成します。
                  <strong className="text-amber-300">※「Add a README file」等のチェックは外して空の状態で作成してください。</strong>
                </p>
              </div>

              {/* Step 2 */}
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 text-[11px] font-bold flex items-center justify-center border border-sky-500/30">
                      2
                    </span>
                    <h3 className="font-bold text-white text-xs">
                      ターミナルでプッシュを実行
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(gitCliCommands, 'git-commands')}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] flex items-center gap-1 border border-slate-700 cursor-pointer transition-colors"
                  >
                    {copiedType === 'git-commands' ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        コマンドコピー済
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        全コマンドをコピー
                      </>
                    )}
                  </button>
                </div>
                <div className="pl-7">
                  <pre className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-mono text-emerald-300 overflow-x-auto select-all leading-relaxed">
                    {gitCliCommands}
                  </pre>
                </div>
              </div>

              {/* Step 3 */}
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-amber-500/30 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-[11px] font-bold flex items-center justify-center border border-amber-500/30">
                    3
                  </span>
                  <h3 className="font-bold text-amber-300 text-xs flex items-center gap-1.5">
                    <Settings className="w-3.5 h-3.5 text-amber-400" />
                    GitHub Pagesのソースを「GitHub Actions」に切り替え（重要）
                  </h3>
                </div>
                <div className="pl-7 space-y-1.5 text-[11px] text-slate-300 leading-relaxed">
                  <p>
                    プッシュ後、GitHubリポジトリの <strong>Settings（設定）</strong> → 左メニュー <strong>Pages</strong> を開きます。
                  </p>
                  <p className="p-2 rounded bg-amber-950/30 border border-amber-800/40 text-amber-200">
                    <strong>Build and deployment &gt; Source</strong> を、デフォルトの「Deploy from a branch」から <strong className="text-white underline">「GitHub Actions」</strong> に変更してください。
                  </p>
                  <p className="text-slate-400">
                    ※リポジトリ内の <code className="text-slate-200 bg-slate-800 px-1 py-0.5 rounded">.github/workflows/deploy.yml</code> が自動認識され、プッシュのたびに自動ビルド＆公開されます。
                  </p>
                </div>
              </div>

              {/* Step 4 */}
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 text-[11px] font-bold flex items-center justify-center border border-emerald-500/30">
                    4
                  </span>
                  <h3 className="font-bold text-white text-xs">
                    自動デプロイ完了とアクセス確認
                  </h3>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed pl-7">
                  リポジトリの <strong>Actions</strong> タブで「Deploy to GitHub Pages」が緑色のチェック（成功）になったら完了です！
                  <br />
                  <a
                    href={targetUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-sky-400 hover:text-sky-300 underline font-mono mt-1"
                  >
                    {targetUrl}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </p>
              </div>
            </div>
          )}

          {activeTab === 'methods' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-400">
                GitHubへコードをアップロード・同期する主な4つの手法です。環境やお好みに合わせて選択してください。
              </p>

              {/* Method A */}
              <div className="p-3 rounded-xl bg-slate-950/70 border border-sky-500/40 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sky-300 flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5" />
                    A. Git CLI (コマンドライン) 【推奨】
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300">最速・確実</span>
                </div>
                <p className="text-[11px] text-slate-300">
                  <strong>メリット:</strong> 最短手順。隠しファイル（<code>.github/workflows</code>）が絶対に欠落しない。今後の機能追加やバグ修正も <code>git push</code> 1行で自動更新。
                </p>
                <p className="text-[11px] text-slate-400">
                  <strong>デメリット:</strong> ターミナル操作とGitインストールが必要。
                </p>
              </div>

              {/* Method B */}
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-indigo-300 flex items-center gap-1.5">
                    <Laptop className="w-3.5 h-3.5" />
                    B. GitHub Desktop (公式GUIアプリ)
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300">GUIで視覚的</span>
                </div>
                <p className="text-[11px] text-slate-300">
                  <strong>メリット:</strong> コマンド不要。ボタンクリックとブラウザログインだけでGitHubへの認証・作成・プッシュが可能。変更差分も見やすい。
                </p>
                <p className="text-[11px] text-slate-400">
                  <strong>デメリット:</strong> GitHub DesktopアプリをPCにインストールする必要がある。
                </p>
              </div>

              {/* Method C */}
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-purple-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    C. GitHub CLI (<code>gh</code> コマンド)
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300">1行で完了</span>
                </div>
                <p className="text-[11px] text-slate-300">
                  <strong>メリット:</strong> ブラウザを開かずに <code>{ghCliCommand}</code> を叩くだけでリポジトリ作成からプッシュまで自動完了。
                </p>
                <p className="text-[11px] text-slate-400">
                  <strong>デメリット:</strong> <code>gh</code> コマンドの事前導入とログイン認証が必要。
                </p>
              </div>

              {/* Method D */}
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-300 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5" />
                    D. GitHub Web画面 (ドラッグ＆ドロップ)
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">インストール不要</span>
                </div>
                <p className="text-[11px] text-slate-300">
                  <strong>メリット:</strong> PCにGitやアプリを入れなくてもブラウザ単体でファイルをアップロード可能。
                </p>
                <p className="text-[11px] text-rose-400/90">
                  <strong>デメリット:</strong> 1度にアップロードできるファイル数制限（約100個）あり。<code>.github/</code> のような隠し階層がスキップされやすく、CIデプロイ設定が漏れやすい。以後の更新も手動で非推奨。
                </p>
              </div>
            </div>
          )}

          {activeTab === 'faq' && (
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1">
                <h4 className="font-bold text-sky-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  Q. サブディレクトリ（username.github.io/repo/）でJSやCSSが404になりませんか？
                </h4>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  <strong>完全に解決済みです。</strong> <code>vite.config.ts</code> にて <code>base: './'</code>（相対パスビルド）を設定しているため、リポジトリ名が何であっても、ルート配置でもサブディレクトリ配置でも、アセットのリンク切れは一切発生しません。
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1">
                <h4 className="font-bold text-sky-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  Q. Actionsで「Permission to github-pages denied」というエラーが出たら？
                </h4>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  リポジトリの <strong>Settings &gt; Actions &gt; General &gt; Workflow permissions</strong> で、「Read and write permissions」が選択されていることをご確認ください。なお、本設定ワークフロー（<code>deploy.yml</code>）内には適切なトークン権限（<code>pages: write</code>, <code>id-token: write</code>）が既に定義されています。
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1">
                <h4 className="font-bold text-sky-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  Q. リポジトリを更新したときはどうすればいいですか？
                </h4>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  手元で編集後、通常通り <code>git add . && git commit -m "update" && git push</code> するだけで、GitHub Actionsが自動で再ビルドして数分で本番Webサイトが更新されます。
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-500">
            プロジェクトルートの <code className="text-slate-400">README.md</code> にも全手順が記録されています
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
