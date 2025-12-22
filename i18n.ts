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
    apiCompatible: "Vector & Shape Support",
    supportedFeatures: "Supported Features:",
    features: [
      "Drop & Inner Shadows (X, Y, Blur, Spread)",
      "Background & Layer Blur (metadata comments)",
      "Linear, Radial, Angular & Diamond Gradients",
      "Fill Layer Blend Modes (Preview support)",
      "Noise & Texture detection",
      "Corner Radius (Uniform & Independent)"
    ],
    proTip: "Pro Tip: Complex shadows and blend modes are approximated using offset layers and comments in VectorDrawables.",
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
    apiCompatible: "支持 Vector 与 Shape",
    supportedFeatures: "支持功能：",
    features: [
      "投影与内阴影（X, Y, 模糊, 扩展）",
      "背景模糊与图层模糊（代码注释提示）",
      "线性、径向、角度与菱形渐变",
      "填充图层混合模式（预览支持）",
      "噪点与纹理检测",
      "圆角设置（支持统一或独立圆角）"
    ],
    proTip: "小贴士：复杂阴影与混合模式通过 VectorDrawable 的偏移层与注释进行拟合。",
    errors: {
      notCss: "剪贴板内容不符合 CSS 格式。请在 Figma 中尝试“右键 > Copy as CSS”。",
      parseFail: "无法解析视觉属性，请检查复制内容。",
      generic: "解析剪贴板数据时发生错误。"
    }
  }
};