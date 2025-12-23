
export type Language = 'en' | 'zh';

export const translations = {
  en: {
    title: "Figma to Android XML",
    subtitlePre: "Select a layer in Figma. Right Click → ",
    subtitleCmd: "Copy as SVG",
    subtitlePost: " (Recommended for gradients) or CSS. Paste here.",
    visualPreview: "Visual Preview",
    previewOverlay: "Preview",
    generatedXml: "Generated XML",
    apiCompatible: "Vector & Shape Support",
    supportedFeatures: "Supported Features:",
    features: [
      "SVG Parsing (Perfect Gradients!)",
      "Drop & Inner Shadows (X, Y, Blur, Spread)",
      "Background & Layer Blur",
      "Linear, Radial, Angular & Diamond Gradients",
      "Fill Layer Blend Modes",
      "Corner Radius (Uniform & Independent)"
    ],
    proTip: "Pro Tip: Use 'Copy as SVG' for complex radial gradients to get exact rotation and scale automatically.",
    errors: {
      notCss: "Content not recognized. Please use Figma 'Copy as SVG' (Recommended) or 'Copy as CSS'.",
      parseFail: "Failed to parse visual properties.",
      generic: "Error parsing clipboard data."
    }
  },
  zh: {
    title: "Figma 转 Android XML",
    subtitlePre: "在 Figma 选中图层。右键 → ",
    subtitleCmd: "Copy as SVG (复制为 SVG)",
    subtitlePost: "（推荐，支持旋转渐变）或 CSS。粘贴到此处。",
    visualPreview: "视觉预览",
    previewOverlay: "预览",
    generatedXml: "生成的 XML",
    apiCompatible: "支持 Vector 与 Shape",
    supportedFeatures: "支持功能：",
    features: [
      "SVG 解析（完美还原旋转渐变！）",
      "投影与内阴影（X, Y, 模糊, 扩展）",
      "背景模糊与图层模糊",
      "线性、径向、角度与菱形渐变",
      "填充图层混合模式",
      "圆角设置（支持统一或独立圆角）"
    ],
    proTip: "强烈建议：对于旋转的径向渐变，请使用 'Copy as SVG'，可自动识别精确角度和比例。",
    errors: {
      notCss: "无法识别内容。请尝试在 Figma 中 'Copy as SVG' (推荐) 或 'Copy as CSS'。",
      parseFail: "无法解析视觉属性，请检查复制内容。",
      generic: "解析剪贴板数据时发生错误。"
    }
  }
};
