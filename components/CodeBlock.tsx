import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface Props {
  code: string;
}

export const CodeBlock: React.FC<Props> = ({ code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group rounded-xl overflow-hidden border border-gray-750 bg-gray-850 h-full min-h-[400px] flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 bg-gray-950 border-b border-gray-750">
        <span className="text-sm font-mono text-gray-400">drawable/background.xml</span>
        <button 
          onClick={handleCopy}
          className="p-1.5 rounded-md hover:bg-gray-800 transition-colors text-gray-400 hover:text-white"
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
        </button>
      </div>
      <pre className="p-4 overflow-auto text-sm font-mono text-blue-100 flex-1">
        <code>{code}</code>
      </pre>
    </div>
  );
};
