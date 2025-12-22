export type Language = 'en' | 'zh';

export const translations = {
  en: {
    title: "Figma to Android XML",
    subtitlePre: "Copy a layer in Figma (Right Click → Copy as CSS), click anywhere on this page, and press",
    subtitleCmd: "Cmd+V",
    subtitlePost: ". Instantly generate production-ready Android XML drawables.",
    visualPreview: "Visual Preview",
    previewOverlay: "Preview",
    generatedXml: "Generated XML",
    apiCompatible: "API 21+ Compatible",
    supportedFeatures: "Supported Features:",
    features: [
      "Linear & Radial Gradients (mapped to Android angles)",
      "Multi-layer gradients (using <layer-list>)",
      "Corner Radius (Uniform & Independent)",
      "Solid Fills & Basic Opacity"
    ],
    proTip: "Pro Tip: For best results, ensure Figma gradients use standard angles (0, 45, 90, etc.).",
    errors: {
      notCss: "Clipboard content doesn't look like CSS. In Figma, try Right Click > Copy as CSS.",
      parseFail: "Failed to parse visual properties.",
      generic: "Error parsing clipboard data."
    }
  },
  zh: {
    title: "Figma 转 Android XML",
    subtitlePre: "在 Figma 选中图层（右键 → Copy as CSS），点击本页任意处，按下",
    subtitleCmd: "Cmd+V",
    subtitlePost: "。即刻生成可直接使用的 Android XML Drawable。",
    visualPreview: "视觉预览",
    previewOverlay: "预览",
    generatedXml: "生成的 XML",
    apiCompatible: "兼容 API 21+",
    supportedFeatures: "支持功能：",
    features: [
      "线性与径向渐变（自动映射 Android 角度）",
      "多层渐变（自动转换为 <layer-list>）",
      "圆角设置（支持统一或独立圆角）",
      "纯色填充与基础不透明度"
    ],
    proTip: "小贴士：为获最佳效果，请尽量在 Figma 中使用标准渐变角度（0、45、90 等）。",
    errors: {
      notCss: "剪贴板内容不符合 CSS 格式。请在 Figma 中尝试“右键 > Copy as CSS”。",
      parseFail: "无法解析视觉属性，请检查复制内容。",
      generic: "解析剪贴板数据时发生错误。"
    }
  }
};
