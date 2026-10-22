# DevLens

<p align="center">
  <img src="../assets/lensy.svg" alt="Lensy" width="260" />
</p>

DevLens 是一款面向工作流的原生开发者浏览器。

它可以在移动端和桌面端两个视口中同时预览同一个网址，并提供实时控制台与网络流、HTTP 拦截与重放、实时设计修改、侦察报告、AI 助手，以及一键跳转到编辑器的能力。

## 核心功能

- 沉浸式工作区主题：Tab 列、导航栏与侧边栏融入当前主题色。
- 双视口预览：同一页面同时在 Mobile 与 Desktop 框架中呈现，支持滚动同步。
- Tab Groups：按名称与颜色整理分页，支持拖拽、右键菜单、折叠与恢复。
- Split View：把两个已有分页并排或上下显示，无需重新加载页面。
- WImH 极端防护：内容保护、剪贴板清洗、威胁覆盖层与异常输入检测。
- DevTools 集成：Elements、Console、Network、Application 与侦察报告。
- 智能 Omnibox：地址、搜索、命令、历史/书签/流量建议与内联补全。
- Workspace 与 Profile 隔离：独立 Electron partition、存储、历史和分页。

## 技术栈

- Electron 44
- Vite 7
- React 19
- TypeScript（strict 模式）
- Tailwind CSS 4

## 快速开始

从 `outputs/devlens` 目录运行以下命令：

| 脚本 | 说明 |
| --- | --- |
| `npm install` | 安装依赖 |
| `npm run dev` | 启动 Vite dev server 与 Electron 并启用 HMR |
| `npm run build` | 先执行类型检查，再构建 out/ |
| `npm run start` | 运行已构建的 out/ 应用 |
| `npm run typecheck` | 对 main、preload 和 renderer 执行 tsc --noEmit |

## 快捷键

| 操作 | 快捷键 |
| --- | --- |
| 新建分页 | `Ctrl+T` |
| 关闭分页 | `Ctrl+W` |
| 重新加载页面 | `Ctrl+R` |
| 页面内查找 | `Ctrl+F` |
| 打开设置 | `Ctrl+,` |
| 新建私密分页 | `Ctrl+Shift+P` |
| 打开 Shell DevTools | `F12` |
| 打开 Elements 面板 | `Ctrl+Shift+I` |
| 打开 Console 面板 | `Ctrl+Shift+J` |
| 打开 Network 面板 | `Ctrl+Shift+E` |
| 切换侧边栏 | `Ctrl+Shift+B` |
| 切换 Ghost 模式 | `Ctrl+Shift+G` |
| 切换 WImH 防护 | `Ctrl+Shift+H` |
| 切换到最近使用的分页 | `Ctrl+Tab` |

## 许可证

本项目基于 [MIT License](../../LICENSE) 发布。

## 参与贡献

欢迎提交 issue 与 pull request。请保持 TypeScript strict 模式，并在提交前运行 `npm run typecheck` 与相关的验证脚本。

