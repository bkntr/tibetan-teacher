import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import remarkBreaks from 'remark-breaks';
import { ClipboardIcon, ClipboardCheckIcon, PencilIcon, CheckIcon } from './icons';

interface ResultCardProps {
    icon: React.ReactNode;
    title: string;
    subtitle?: string;
    text: string | null;
    isLoading: boolean;
    contentClassName?: string;
    highlightRange?: { start: number; length: number } | null;
    isEditable?: boolean;
    isEditing?: boolean;
    onToggleEdit?: () => void;
    onTextChange?: (newText: string) => void;
}

const ResultCard: React.FC<ResultCardProps> = ({ 
    icon, 
    title, 
    subtitle, 
    text, 
    isLoading, 
    contentClassName = '', 
    highlightRange,
    isEditable = false,
    isEditing = false,
    onToggleEdit,
    onTextChange,
}) => {
    const [isCopied, setIsCopied] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-resize textarea height based on content
    useEffect(() => {
        if (isEditing && textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [text, isEditing]);

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

    let processedText = text;
    if (text && highlightRange) {
        const { start, length } = highlightRange;
        const end = start + length;
        if (start >= 0 && end <= text.length) {
            const prefix = text.substring(0, start);
            const highlighted = text.substring(start, end);
            const suffix = text.substring(end);
            processedText = `${prefix}<mark class="bg-yellow-300 dark:bg-yellow-500/70 px-1 rounded">${highlighted}</mark>${suffix}`;
        }
    }

    if (!text && !isEditing) {
      contentClassName = ''
    }

    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-md p-6 h-full flex flex-col">
            <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                    <div className="text-indigo-500">{icon}</div>
                    <div className="flex flex-col justify-center min-h-10">
                        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 leading-tight">{title}</h3>
                        {subtitle && (
                            <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {isEditable && (
                        <button
                            onClick={onToggleEdit}
                            className="p-1.5 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300 transition-colors flex-shrink-0"
                            aria-label={isEditing ? 'Save changes' : 'Edit transcription'}
                        >
                            {isEditing ? <CheckIcon className="w-5 h-5 text-green-500" /> : <PencilIcon className="w-5 h-5" />}
                        </button>
                    )}
                    {text && !isLoading && !isEditing && (
                        <button 
                            onClick={handleCopy}
                            className="p-1.5 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300 transition-colors flex-shrink-0"
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
            </div>
            <div 
                data-content-area="true"
                className={`text-slate-600 dark:text-slate-300 font-sans min-h-[72px] flex-grow prose dark:prose-invert prose-p:my-1 prose-h3:my-2 prose-ul:my-2 max-w-none ${contentClassName}`}
            >
                {isLoading ? (
                    <SkeletonLoader />
                ) : isEditing ? (
                    <textarea
                        ref={textareaRef}
                        value={text || ''}
                        onChange={(e) => onTextChange?.(e.target.value)}
                        className={`w-full bg-slate-50 dark:bg-slate-700/50 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none overflow-hidden ${contentClassName}`}
                        rows={3}
                        aria-label="Editable transcription text"
                    />
                ) : text ? (
                    <ReactMarkdown
                        rehypePlugins={[rehypeRaw]}
                        remarkPlugins={[remarkGfm, remarkBreaks]}
                        components={{
                            h3: ({node, ...props}) => <h3 className="text-xl font-semibold mt-4 mb-2" data-char-offset={(node as any).position?.start.offset} {...props} />,
                            ol: ({node, ...props}) => <ol className="list-decimal list-outside pl-5 my-2" data-char-offset={(node as any).position?.start.offset} {...props} />,
                            ul: ({node, ...props}) => <ul className="list-disc list-outside pl-5 my-2" data-char-offset={(node as any).position?.start.offset} {...props} />,
                            li: ({node, ...props}) => <li data-char-offset={(node as any).position?.start.offset} {...props} />,
                            p: ({node, ...props}) => <p className="my-1" data-char-offset={(node as any).position?.start.offset} {...props} />,
                            hr: ({node, ...props}) => <hr className="my-4 border-slate-300 dark:border-slate-600" {...props} />,
                            table: ({node, ...props}) => <table className="w-full my-4 text-sm border-collapse border border-slate-300 dark:border-slate-600" {...props} />,
                            thead: ({node, ...props}) => <thead className="bg-slate-50 dark:bg-slate-700/50" {...props} />,
                            th: ({node, ...props}) => <th className="border border-slate-300 dark:border-slate-600 font-semibold p-2 text-slate-900 dark:text-slate-200 text-left" {...props} />,
                            td: ({node, ...props}) => <td className="border border-slate-300 dark:border-slate-600 p-2" {...props} />,
                        }}
                    >
                        {processedText || ''}
                    </ReactMarkdown>
                ) : (
                    <span className="text-slate-400 dark:text-slate-500">Result will appear here...</span>
                )}
            </div>
        </div>
    );
};

export default React.memo(ResultCard);