
# Figma to Android XML Converter

这是一个免费的开发者工具，用于将 Figma 样式直接转换为 Android XML Drawable 代码。

## 🚀 部署状态
如果您的 Action 配置正确，推送到 GitHub 后，请去 **Actions** 标签页查看部署进度。

## 🧠 技术原理与渲染模型

### 为什么 CSS/XML 很难还原 Figma 渐变？
Figma 使用 **3x3 仿射变换矩阵 (Affine Matrix)** 来描述渐变，这允许渐变发生旋转、非等比缩放（压扁的椭圆）甚至切变。而 CSS 和 Android XML 原生仅支持简单的 **参数化模型**（如圆心、半径、角度）。

### 本项目的解决方案
为了实现 **100% 像素级还原**，本项目采用了 **"Matrix Re-projection" (矩阵重映射)** 技术：

1.  **Web 预览**：
   *   通过解析 `gradientTransform` 矩阵，提取精确的 `scale` 和 `rotate` 参数。
   *   使用 CSS Transforms (`rotate`, `scale`) 作用于渐变容器，模拟 Figma 的矩阵变换。
   *   *Pro Tip: 对于极度复杂的渐变，解析器优先尝试读取 SVG 数据以获取原始矩阵。*

2.  **Android XML 生成**：
   *   **线性渐变**：计算起点和终点的绝对坐标。
   *   **径向/扫描渐变**：Android 原生 `<gradient>` 不支持椭圆或旋转。我们利用 `VectorDrawable` 的 `<group>` 嵌套机制：
      *   外层 `<group>` 处理 **位移 (Translate)**。
      *   中层 `<group>` 处理 **旋转 (Rotate)**。
      *   内层 `<group>` 处理 **缩放 (Scale)**（实现椭圆效果）。
      *   最内层才是标准的 `<gradient>`。

这种架构确保了即使是 **旋转的压扁椭圆渐变** 或 **非中心点的扫描渐变**，也能在 Android 上完美呈现。

---

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
- **高保真解析**：支持 Figma SVG 矩阵解析
- **Android Vector**：通过 Group Transform 完美还原旋转/椭圆渐变
- **多图层混合**：支持 Solid, Linear, Radial, Angular, Diamond
- **特效支持**：Shadows (Drop/Inner), Blur, Corners
- **多语言**：支持中英文切换

## 🛠️ 技术栈
- React 19
- TypeScript
- Tailwind CSS
- Vite
