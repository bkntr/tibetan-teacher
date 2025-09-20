import React, { useState } from 'react';
import { ClipboardIcon, ClipboardCheckIcon } from './icons';

interface ResultCardProps {
    icon: React.ReactNode;
    title: string;
    text: string | null;
    isLoading: boolean;
    contentClassName?: string;
}

// A simple component to render markdown-like text
const MarkdownRenderer: React.FC<{ text: string }> = ({ text }) => {
    const elements: React.ReactNode[] = [];
    let listItems: React.ReactNode[] = [];

    const flushList = () => {
        if (listItems.length > 0) {
            elements.push(<ul key={`ul-${elements.length}`} className="list-disc list-inside space-y-1 my-2 pl-2">{listItems}</ul>);
            listItems = [];
        }
    };

    // Parses inline elements like **bold** text
    const parseInline = (line: string): React.ReactNode => {
        const parts = line.split(/(\*\*.*?\*\*)/g).filter(part => part);
        return parts.map((part, index) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={index}>{part.slice(2, -2)}</strong>;
            }
            return part;
        });
    };

    text.split('\n').forEach((line, index) => {
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith('### ')) {
            flushList();
            elements.push(<h3 key={index} className="text-xl font-semibold mt-4 mb-2">{parseInline(trimmedLine.substring(4))}</h3>);
        } else if (trimmedLine.startsWith('* ')) {
            listItems.push(<li key={index}>{parseInline(trimmedLine.substring(2))}</li>);
        } else if (trimmedLine === '---') {
            flushList();
            elements.push(<hr key={index} className="my-4 border-slate-300 dark:border-slate-600" />);
        } else if (trimmedLine === '') {
            flushList();
        } else {
            flushList();
            elements.push(<p key={index} className="my-1">{parseInline(trimmedLine)}</p>);
        }
    });

    flushList(); // Flush any remaining list items

    return <>{elements}</>;
};


const ResultCard: React.FC<ResultCardProps> = ({ icon, title, text, isLoading, contentClassName = '' }) => {
    const [isCopied, setIsCopied] = useState(false);

    const handleCopy = () => {
        if (!text || isLoading) return;
        navigator.clipboard.writeText(text);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000); // Reset after 2 seconds
    };
    
    const SkeletonLoader = () => (
        <div className="space-y-3 animate-pulse">
            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4"></div>
            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-full"></div>
            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-5/6"></div>
        </div>
    );

    if (!text) {
      contentClassName = ''
    }

    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-md p-6 h-full flex flex-col">
            <div className="flex items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                    <div className="text-indigo-500">{icon}</div>
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">{title}</h3>
                </div>
                {text && !isLoading && (
                    <button 
                        onClick={handleCopy}
                        className="p-1.5 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300 transition-colors"
                        aria-label="Copy to clipboard"
                    >
                        {isCopied ? (
                            <ClipboardCheckIcon className="w-5 h-5 text-green-500" />
                        ) : (
                            <ClipboardIcon className="w-5 h-5" />
                        )}
                    </button>
                )}
            </div>
            <div className={`text-slate-600 dark:text-slate-300 font-sans min-h-[72px] flex-grow ${contentClassName}`}>
                {isLoading ? (
                    <SkeletonLoader />
                ) : text ? (
                    <MarkdownRenderer text={text} />
                ) : (
                    <span className="text-slate-400 dark:text-slate-500">Result will appear here...</span>
                )}
            </div>
        </div>
    );
};

export default ResultCard;