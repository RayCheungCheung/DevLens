# DevLens

<p align="center">
  <img src="../assets/lensy.svg" alt="Lensy" width="260" />
</p>

DevLens 是一款以工作流為中心的原生開發者瀏覽器。

它能在行動版與桌面版兩個視口中同時預覽同一個網址，並提供即時 Console 與網路流、HTTP 攔截與重放、即時設計修改、偵察報告、AI 助理，以及一鍵移交到編輯器的功能。

## 核心功能

- 沉浸式工作區主題：Tab 列、導覽列與側邊欄融入目前主題色。
- 雙視口預覽：同一頁面同時顯示在 Mobile 與 Desktop 框架中，支援捲動同步。
- Tab Groups：以名稱與顏色整理分頁，支援拖曳、右鍵選單、摺疊與還原。
- Split View：將兩個既有分頁左右或上下並列顯示，不需重新載入頁面。
- WImH 極端防護：內容保護、剪貼簿清洗、威脅覆蓋層與異常輸入偵測。
- DevTools 整合：Elements、Console、Network、Application 與偵察報告。
- 智慧 Omnibox：網址、搜尋、指令、歷史/書籤/流量建議與內聯補全。
- Workspace 與 Profile 隔離：獨立 Electron partition、儲存空間、歷史與分頁。

## 技術堆疊

- Electron 44
- Vite 7
- React 19
- TypeScript（strict 模式）
- Tailwind CSS 4

## 快速開始

請在 `outputs/devlens` 目錄執行下列指令：

| 指令 | 說明 |
| --- | --- |
| `npm install` | 安裝相依套件 |
| `npm run dev` | 啟動 Vite dev server、Electron 與 HMR |
| `npm run build` | 先執行型別檢查，再建置 out/ |
| `npm run start` | 執行已建置的 out/ 應用 |
| `npm run typecheck` | 對 main、preload 與 renderer 執行 tsc --noEmit |

## 鍵盤快捷鍵

| 操作 | 快捷鍵 |
| --- | --- |
| 新增分頁 | `Ctrl+T` |
| 關閉分頁 | `Ctrl+W` |
| 重新載入頁面 | `Ctrl+R` |
| 頁面內搜尋 | `Ctrl+F` |
| 開啟設定 | `Ctrl+,` |
| 新增私密分頁 | `Ctrl+Shift+P` |
| 開啟 Shell DevTools | `F12` |
| 開啟 Elements 面板 | `Ctrl+Shift+I` |
| 開啟 Console 面板 | `Ctrl+Shift+J` |
| 開啟 Network 面板 | `Ctrl+Shift+E` |
| 切換側邊欄 | `Ctrl+Shift+B` |
| 切換 Ghost 模式 | `Ctrl+Shift+G` |
| 切換 WImH 防護 | `Ctrl+Shift+H` |
| 切換到最近使用的分頁 | `Ctrl+Tab` |

## 授權條款

本專案採用 [MIT License](../../LICENSE) 授權。

## 參與貢獻

歡迎提交 issue 與 pull request。請維持 TypeScript strict 模式，並在提交前執行 `npm run typecheck` 與相關驗證腳本。

