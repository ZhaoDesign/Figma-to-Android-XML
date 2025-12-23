
import React, { useState, useEffect, useCallback } from 'react';
import { Palette, Info, Languages, Sliders, RotateCw, FileCode } from 'lucide-react';
import { INITIAL_DATA } from './constants';
import { FigmaLayer, Gradient } from './types';
import { parseClipboardData } from './services/parser';
import { generateAndroidXML } from './services/androidGenerator';
import { PreviewCanvas } from './components/PreviewCanvas';
import { CodeBlock } from './components/CodeBlock';
import { translations, Language } from './i18n';

const App: React.FC = () => {
  const [lang, setLang] = useState<Language>('en');
  const [layerData, setLayerData] = useState<FigmaLayer>(INITIAL_DATA);
  const [error, setError] = useState<string | null>(null);
  const [xmlOutput, setXmlOutput] = useState('');
  const [sourceType, setSourceType] = useState<'css' | 'svg'>('css');

  const t = translations[lang];

  // Update XML whenever data changes
  useEffect(() => {
    const xml = generateAndroidXML(layerData);
    setXmlOutput(xml);
  }, [layerData]);

  const toggleLanguage = () => {
    setLang(current => current === 'en' ? 'zh' : 'en');
  };

  const handlePaste = useCallback((e: ClipboardEvent) => {
    e.preventDefault();
    setError(null);

    const clipboardText = e.clipboardData?.getData('text/plain') || '';
    const clipboardHtml = e.clipboardData?.getData('text/html') || '';

    // Prioritize SVG detection
    const isSvg = clipboardText.trim().startsWith('<svg') || clipboardText.includes('xmlns="http://www.w3.org/2000/svg"');

    // CSS detection
    let textToParse = clipboardText;
    if (clipboardHtml.includes('style="') && !isSvg) {
       const match = clipboardHtml.match(/style="([^"]*)"/);
       if (match && match[1]) {
         textToParse = match[1];
       }
    }

    const likelyCSS =
       textToParse.includes(':') ||
       textToParse.includes('gradient') ||
       textToParse.includes('#') ||
       textToParse.includes('rgb');

    if (!isSvg && !likelyCSS) {
      setError(translations[lang].errors.notCss);
      return;
    }

    try {
      const parsed = parseClipboardData(isSvg ? clipboardText : textToParse);
      if (parsed) {
        setLayerData(parsed);
        setSourceType(isSvg ? 'svg' : 'css');
      } else {
        setError(translations[lang].errors.parseFail);
      }
    } catch (err) {
      console.error(err);
      setError(translations[lang].errors.generic);
    }
  }, [lang]);

  useEffect(() => {
    document.addEventListener('paste', handlePaste);
    return () => {
      document.removeEventListener('paste', handlePaste);
    };
  }, [handlePaste]);

  // Handle manual gradient rotation update
  const updateGradientAngle = (angle: number) => {
    setLayerData(prev => {
      const newFills = [...prev.fills];
      const gradIndex = newFills.findIndex(f => f.type === 'gradient' && f.visible);
      if (gradIndex !== -1) {
        const grad = newFills[gradIndex].value as Gradient;
        newFills[gradIndex] = {
          ...newFills[gradIndex],
          value: { ...grad, angle: angle }
        };
      }
      return { ...prev, fills: newFills };
    });
  };

  const activeGradient = layerData.fills.find(f => f.type === 'gradient' && f.visible);
  const currentAngle = activeGradient ? (activeGradient.value as Gradient).angle || 0 : 0;

  return (
    <div className="min-h-screen p-6 md:p-12 flex flex-col gap-8 max-w-7xl mx-auto">

      {/* Header */}
      <header className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-purple-900/20">
              <Palette className="text-white" size={20} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">{t.title}</h1>
          </div>

          <button
            onClick={toggleLanguage}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-750 bg-gray-800 hover:bg-gray-700 hover:border-gray-600 transition-all text-sm text-gray-300"
          >
            <Languages size={16} />
            <span className="font-medium">{lang === 'en' ? '中文' : 'English'}</span>
          </button>
        </div>

        <p className="text-gray-400 max-w-2xl leading-relaxed">
          {t.subtitlePre} <kbd className="bg-gray-800 px-1.5 py-0.5 rounded text-gray-300 text-xs font-mono border border-gray-700">{t.subtitleCmd}</kbd>{t.subtitlePost}
        </p>
      </header>

      {/* Main Content */}
      <main className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1">

        {/* Left: Preview */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">{t.visualPreview}</h2>
            {sourceType === 'svg' && <span className="text-xs bg-green-900/40 text-green-400 px-2 py-0.5 rounded border border-green-900/60">SVG Mode Active</span>}
            {error && <span className="text-red-400 text-xs bg-red-900/30 px-2 py-1 rounded border border-red-900/50 animate-pulse">{error}</span>}
          </div>

          <PreviewCanvas data={layerData} label={t.previewOverlay} />

          {/* Manual Controls Panel - Only show warning if NOT in SVG mode */}
          {activeGradient && (
            <div className="bg-gray-850 border border-gray-750 p-4 rounded-lg space-y-3">
               <div className="flex items-center gap-2 text-sm text-gray-300 font-medium">
                  <Sliders size={16} />
                  <span>Properties / 属性调整</span>
               </div>
               <div className="grid grid-cols-[auto_1fr_auto] gap-4 items-center">
                  <div className="flex items-center gap-2 text-gray-400 text-xs">
                    <RotateCw size={14} />
                    <span>Rotation</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="360"
                    value={currentAngle}
                    onChange={(e) => updateGradientAngle(Number(e.target.value))}
                    className="h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500 w-full"
                  />
                  <span className="text-xs font-mono text-gray-400 min-w-[3ch]">{Math.round(currentAngle)}°</span>
               </div>
               {sourceType === 'css' && (
                 <div className="text-xs text-orange-400/80 bg-orange-950/20 p-2 rounded border border-orange-900/30">
                   ⚠️ <b>Use 'Copy as SVG' for precision</b><br/>
                   Figma CSS export omits rotation angles. Switching to SVG copy-paste will auto-detect the perfect angle.
                 </div>
               )}
            </div>
          )}

          <div className="bg-blue-900/20 border border-blue-900/50 p-4 rounded-lg flex gap-3 text-blue-200 text-sm">
             <Info className="shrink-0 mt-0.5" size={16} />
             <div>
                <p className="font-semibold mb-1">{t.supportedFeatures}</p>
                <ul className="list-disc list-inside space-y-1 text-blue-200/70 text-xs">
                  {t.features.map((feature, index) => (
                    <li key={index}>{feature}</li>
                  ))}
                </ul>
             </div>
          </div>
        </div>

        {/* Right: Code */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">{t.generatedXml}</h2>
            <div className="flex gap-2">
                {sourceType === 'svg' && <FileCode size={14} className="text-green-500 mt-0.5" />}
                <span className="text-xs text-gray-600">{t.apiCompatible}</span>
            </div>
          </div>
          <CodeBlock code={xmlOutput} />
        </div>

      </main>

      <footer className="text-center text-gray-600 text-sm pt-8">
        <p>{t.proTip}</p>
      </footer>
    </div>
  );
};

export default App;
