import React, { useState, useEffect, useCallback } from 'react';
import { Palette, Info, Languages } from 'lucide-react';
import { INITIAL_DATA } from './constants';
import { FigmaLayer } from './types';
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

    // Prefer Parsing text if it looks like CSS, otherwise try HTML (which might contain style attr)
    let textToParse = clipboardText;
    
    // Check if HTML has a style attribute we can extract
    if (clipboardHtml.includes('style="')) {
       const match = clipboardHtml.match(/style="([^"]*)"/);
       if (match && match[1]) {
         textToParse = match[1];
       }
    }

    // Validation:
    // We used to check for ':' or ';', but users might paste raw "linear-gradient(...)"
    // So we perform a looser check.
    const likelyCSS = 
       textToParse.includes(':') || 
       textToParse.includes('gradient') || 
       textToParse.includes('#') || 
       textToParse.includes('rgb');

    if (!likelyCSS) {
      setError(translations[lang].errors.notCss);
      return;
    }

    try {
      const parsed = parseClipboardData(textToParse);
      // We check if we got meaningful data (width/height are defaults if parse fails completely, 
      // but usually we want at least a fill or a corner radius changed?)
      // Actually, parseClipboardData always returns a fallback object.
      if (parsed) {
        setLayerData(parsed);
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
            {error && <span className="text-red-400 text-xs bg-red-900/30 px-2 py-1 rounded border border-red-900/50 animate-pulse">{error}</span>}
          </div>
          
          <PreviewCanvas data={layerData} label={t.previewOverlay} />
          
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
            <span className="text-xs text-gray-600">{t.apiCompatible}</span>
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
