# Elevator Game - Deployment Guide

このプロジェクトは React (Vite) + Node.js (Express & Socket.io) で構成されています。
以下の手順に従うことで、**Render**, **Railway**, などのクラウドホスティングサービスへ、独自のURL（HTTPS通信）を持ったWebアプリケーションとして常時稼働させることができます。

## 1. 構成概要
- フロントエンド(React)側のコードは `npm run build` によりビルドされ、`/client/dist` フォルダに出力されます。
- バックエンド(Node.js)側のコードは起動時に `/client/dist` を静的サイトとして返すよう設定されています。
- `/api` のパスは Node.js の内部APIとして処理されます。
- このリポジトリ直下の `package.json` があり、`npm run build` だけで両方のビルドが走るよう一元管理されています。

---

## 2. GitHubへのプッシュ
ホスティングサービスの多くはGitHub連携を使用するため、まずはGitHubにソースをアップロードします。

1. GitHub (https://github.com/) にアクセスし、新しい空のリポジトリを作成します。
2. 開発環境のターミナルでこのフォルダ (`elevator-game`) を開き、以下のコマンドを実行します。

```bash
# Gitの初期化と全ファイルのコミット
git init
git add .
git commit -m "first commit"

# リモートリポジトリの設定（※YOUR_USERNAME と YOUR_REPO_NAME を変更してください）
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git

# GitHubへプッシュ
git push -u origin main
```

---

## 3. Renderでのデプロイ手順 (おすすめ)
Renderは無料でWebサービスを常時立ち上げるのに向いているプラットフォームです。（ただし無料枠はアクセスが無いとスリープします）

1. [Render (https://render.com/)](https://render.com/) にアクセスしてログインします。
2. **Dashboard** から `New +` ボタンを押し、**Web Service** を選択します。
3. `Build and deploy from a Git repository` を選び、先ほど作成したGitHubリポジトリを連携・選択します。
4. 設定画面で以下のように構成します：
   - **Name**: お好みの名前 (例: `elevator-game`)
   - **Region**: どこでも可 (東京やシンガポールがあれば優先)
   - **Branch**: `main`
   - **Root Directory**: （空欄のまま）
   - **Environment**: `Node`
   - **Build Command**: `npm run build`
   - **Start Command**: `npm run start`
   - **Instance Type**: `Free` またはお好みのプラン
5. `Create Web Service` ボタンを押します。
6. 数分待つとビルドが完了し、`https://elevator-game-xxxxx.onrender.com` のようなURLが発行され、誰でもアクセスできるようになります！

---

## 4. Railwayでのデプロイ手順 (代替案)
Railwayも同様に簡単にGitHubからデプロイできる強力なプラットフォームです。

1. [Railway (https://railway.app/)](https://railway.app/) にアクセスしてログインします。
2. **New Project** をクリックし、`Deploy from GitHub repo` を選択します。
3. 先ほど作成したGitHubのリポジトリを選択し、`Deploy Now` を押します。
4. 自動的にビルド・デプロイが開始されます。
5. デプロイされているコンポーネントをクリックし、**Settings** タブの **Domains** セクションから `Generate Domain` (または Custom Domain) を押してURLを発行します。

---

## 5. APIの動作確認
デプロイしたURLの末尾に `/api/health` をつけてアクセスしてみてください。
例: `https://your-app-domain.com/api/health`

画面に `"Elevator Game API is running!"` のようなJSONレスポンスが表示されていれば、Node.jsバックエンドが正常に稼働しています。
