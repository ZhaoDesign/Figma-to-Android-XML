# Figma to Android XML Converter

这是一个免费的开发者工具，用于将 Figma 样式直接转换为 Android XML Drawable 代码。

## 🚀 部署状态
如果您的 Action 配置正确，推送到 GitHub 后，请去 **Actions** 标签页查看部署进度。

## 🚀 如何运行（免费模式）

本项目是标准的 React 应用，不能直接双击 `index.html` 运行。请选择以下任意一种方式：

### 方法 1：本地运行（推荐开发使用）
如果你已安装 [Node.js](https://nodejs.org/)：

1. 打开终端（命令行）进入项目目录
2. 安装依赖：
   ```bash
   npm install
   ```
3. 启动本地服务器：
   ```bash
   npm run dev
   ```
4. 浏览器访问显示的链接（通常是 `http://localhost:5173`）

### 方法 2：部署到 GitHub Pages（免费）
如果你使用的是**公开 (Public)** 仓库：
1. 确保 `.github/workflows/deploy.yml` 文件存在。
2. 将代码推送到 GitHub。
3. 在 GitHub 仓库点击 **Actions** 标签，查看 "Deploy to GitHub Pages" 是否变成绿色 ✅。
4. 完成后，在 `Settings > Pages` 中获取访问链接。

### 方法 3：部署到 Vercel (支持私有仓库免费)
如果你使用的是**私有 (Private)** 仓库，GitHub Pages 需要付费，但你可以使用 Vercel：
1. 注册 [Vercel.com](https://vercel.com) (免费)。
2. 点击 "Add New Project"。
3. 导入你的 GitHub 仓库。
4. Vercel 会自动识别 Vite 项目并部署，无需任何配置，完全免费。

## ✨ 功能
- 解析 Figma CSS (Copy as CSS)
- 生成 `<gradient>` (线性与径向)
- 生成 `<layer-list>` (多层背景)
- 生成 `<corners>` (圆角)
- 生成 `<solid>` (纯色填充)
- 支持中英文切换

## 🛠️ 技术栈
- React
- TypeScript
- Tailwind CSS
- Vite
