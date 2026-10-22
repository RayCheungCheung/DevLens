# DevLens

<p align="center">
  <img src="../assets/lensy.svg" alt="Lensy" width="260" />
</p>

DevLens は、ワークフロー中心の開発者向けブラウザです。

同じ URL をモバイルとデスクトップのフレームで同時にプレビューし、リアルタイムのコンソール/ネットワーク、HTTP インターセプターとリピーター、ライブデザイン編集、リコレポート、AI アシスタント、エディター連携を提供します。

## 主な機能

- 没入型ワークスペーステーマ: タブバー、ナビゲーションバー、サイドバーがテーマ色に調和します。
- デュアルビューポートプレビューとスクロール同期。
- Tab Groups: 名前と色で整理し、ドラッグ、右クリックメニュー、折りたたみに対応します。
- Split View: 既存の 2 つのタブを再読み込みなしで並べて表示します。
- WImH 保護: コンテンツ保護、クリップボード消去、脅威オーバーレイ。
- DevTools 統合: Elements、Console、Network、Application。
- スマート Omnibox: 履歴、ブックマーク、トラフィック候補とインライン補完。
- ワークスペースとプロファイルの分離: Electron パーティションを独立管理します。

## 技術スタック

- Electron 44
- Vite 7
- React 19
- TypeScript（strict）
- Tailwind CSS 4

## はじめに

`outputs/devlens` で次のコマンドを実行します。

| スクリプト | 説明 |
| --- | --- |
| `npm install` | 依存関係をインストール |
| `npm run dev` | Vite と Electron を HMR 付きで起動 |
| `npm run build` | 型チェック後に out/ をビルド |
| `npm run start` | ビルド済みアプリを実行 |
| `npm run typecheck` | tsc --noEmit を実行 |

## ショートカット

| 操作 | ショートカット |
| --- | --- |
| 新しいタブ | `Ctrl+T` |
| タブを閉じる | `Ctrl+W` |
| 再読み込み | `Ctrl+R` |
| ページ内検索 | `Ctrl+F` |
| 設定を開く | `Ctrl+,` |
| プライベートタブ | `Ctrl+Shift+P` |
| Shell DevTools | `F12` |
| Elements | `Ctrl+Shift+I` |
| Console | `Ctrl+Shift+J` |
| Network | `Ctrl+Shift+E` |
| サイドバー | `Ctrl+Shift+B` |
| Ghost モード | `Ctrl+Shift+G` |
| WImH 保護 | `Ctrl+Shift+H` |
| 最近使ったタブ | `Ctrl+Tab` |

## ライセンス

[MIT ライセンス](../../LICENSE)で公開されています。

## コントリビューション

Issue と Pull Request を歓迎します。変更前に `npm run typecheck` を実行してください。

