
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { AppState } from './types';
import { transcribeImage, formatTranscription, translateTranscription, getExplanationForSelection } from './services/geminiService';
import ResultCard from './components/ResultCard';
import Spinner from './components/Spinner';
import { SparklesIcon, XCircleIcon, CheckCircleIcon, DocumentTextIcon, LanguageIcon, UploadIcon, XIcon, ResetIcon } from './components/icons';

type ImageStatus = 'pending' | 'transcribing' | 'success' | 'error';
type SelectionRange = { start: number; length: number };

interface ImageFile {
  id: string;
  file: File;
  url: string;
  status: ImageStatus;
  transcription?: string;
  error?: string;
}

const App: React.FC = () => {
  const [images, setImages] = useState<ImageFile[]>([]);
  const [transcription, setTranscription] = useState<string | null>(null);
  const [translation, setTranslation] = useState<string | null>(null);
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [error, setError] = useState<string | null>(null);

  const [selectedText, setSelectedText] = useState<string | null>(null);
  const [selectionRange, setSelectionRange] = useState<SelectionRange | null>(null);
  const [explainedRange, setExplainedRange] = useState<SelectionRange | null>(null);
  const [selectionTranslation, setSelectionTranslation] = useState<string | null>(null);
  const [isTranslatingSelection, setIsTranslatingSelection] = useState<boolean>(false);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [buttonPosition, setButtonPosition] = useState<{ top: number; left: number } | null>(null);
  const [useCustomBudget, setUseCustomBudget] = useState<boolean>(false);
  const [thinkingBudget, setThinkingBudget] = useState<number>(50);
  
  const [isEditingTranscription, setIsEditingTranscription] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const transcriptionContainerRef = useRef<HTMLDivElement>(null);

  const documentIcon = useMemo(() => <DocumentTextIcon className="w-6 h-6"/>, []);
  const languageIcon = useMemo(() => <LanguageIcon className="w-6 h-6"/>, []);

  // Clean up object URLs when component unmounts or images change
  useEffect(() => {
    return () => {
      images.forEach(image => URL.revokeObjectURL(image.url));
    };
  }, [images]);

  const handleReset = useCallback(() => {
    setImages([]);
    setTranscription(null);
    setTranslation(null);
    setError(null);
    setAppState(AppState.IDLE);
    setSelectedText(null);
    setExplainedRange(null);
    setButtonPosition(null);
    setSelectionTranslation(null);
    setSelectionError(null);
    setIsTranslatingSelection(false);
    setSelectionRange(null);
    setIsEditingTranscription(false);
  }, []);

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      // If we are adding new images, the previous results are now invalid.
      // Reset everything except the images themselves.
      setTranscription(null);
      setTranslation(null);
      setError(null);
      setAppState(AppState.IDLE);
      setSelectedText(null);
      setExplainedRange(null);
      setButtonPosition(null);
      setSelectionTranslation(null);
      setSelectionError(null);
      setIsTranslatingSelection(false);
      setSelectionRange(null);
      setIsEditingTranscription(false);

      // FIX: Explicitly type the 'file' parameter as 'File' to resolve type inference issues.
      // This ensures that properties like 'name', 'lastModified' are available and that
      // 'file' can be correctly used in URL.createObjectURL.
      const newImageFiles = Array.from(files).map((file: File) => ({
        id: `${file.name}-${file.lastModified}`,
        file,
        url: URL.createObjectURL(file),
        status: 'pending' as ImageStatus,
      }));
      setImages(prevImages => [...prevImages, ...newImageFiles]);
    }
    
    // Clear the input value to allow selecting the same file again
    if (event.target) {
        event.target.value = '';
    }
  }, []);
  
  const handleRemoveImage = useCallback((idToRemove: string) => {
    setImages(prevImages => {
      const imageToRemove = prevImages.find(img => img.id === idToRemove);
      if (imageToRemove) {
        URL.revokeObjectURL(imageToRemove.url);
      }
      return prevImages.filter(image => image.id !== idToRemove);
    });
  }, []);

  const handleUpdateTranslation = useCallback(async (textToTranslate: string) => {
    if (!textToTranslate) return;

    setAppState(AppState.PROCESSING_TRANSLATION);
    setError(null);
    setTranslation(null);

    try {
        const budgetToSend = useCustomBudget ? thinkingBudget : -1;
        const translationResult = await translateTranscription(textToTranslate, budgetToSend);
        setTranslation(translationResult);
        setAppState(AppState.SUCCESS);
    } catch (translationError) {
        const errorMessage = translationError instanceof Error ? translationError.message : "An unknown error occurred during translation.";
        setError(errorMessage);
        setAppState(AppState.ERROR);
    }
  }, [useCustomBudget, thinkingBudget]);

  const handleProcessImages = useCallback(async () => {
    if (images.length === 0) {
      setError("Please select at least one image.");
      setAppState(AppState.ERROR);
      return;
    }

    setAppState(AppState.PROCESSING_TRANSCRIPTION);
    setError(null);
    setTranscription(null);
    setTranslation(null);
    setSelectedText(null);
    setExplainedRange(null);
    setButtonPosition(null);
    setSelectionTranslation(null);
    setSelectionError(null);
    setIsEditingTranscription(false);

    setImages(prev => prev.map(img => ({ ...img, status: 'transcribing' as ImageStatus })));

    const transcriptionPromises = images.map(image =>
      transcribeImage(image.file).then(result => ({ ...image, status: 'success' as ImageStatus, transcription: result }))
      .catch(err => ({ ...image, status: 'error' as ImageStatus, error: err.message }))
    );

    const updatedImages = await Promise.all(transcriptionPromises);
    setImages(updatedImages);

    const successfulImages = updatedImages
      .filter(img => img.status === 'success' && img.transcription);

    if (successfulImages.length === 0) {
      setError("Transcription failed for all images.");
      setAppState(AppState.ERROR);
      return;
    }
    
    setAppState(AppState.PROCESSING_FORMATTING);
    let formattedTranscription: string;
    try {
      const imagesToFormat = successfulImages.map(img => ({
        file: img.file,
        transcription: img.transcription!,
      }));
      formattedTranscription = await formatTranscription(imagesToFormat);
    } catch (formattingError) {
      const errorMessage = formattingError instanceof Error ? formattingError.message : "An unknown error occurred during formatting.";
      setError(errorMessage);
      setAppState(AppState.ERROR);
      return;
    }

    setTranscription(formattedTranscription);
    await handleUpdateTranslation(formattedTranscription);
  }, [images, handleUpdateTranslation]);
  
  const handleToggleEditTranscription = useCallback(() => {
    const isEnteringEditMode = !isEditingTranscription;
    setIsEditingTranscription(isEnteringEditMode);

    if (isEnteringEditMode) {
      // User clicked "Edit" icon
      setTranslation(null); // Clear outdated translation
      // Clear selection states when starting to edit
      setSelectedText(null);
      setButtonPosition(null);
      setExplainedRange(null);
      setSelectionTranslation(null);
    } else {
      // User clicked "Save" icon
      if (transcription) {
        handleUpdateTranslation(transcription);
      }
    }
  }, [isEditingTranscription, transcription, handleUpdateTranslation]);

  const handleTranscriptionChange = useCallback((newText: string) => {
    setTranscription(newText);
  }, []);

  const handleSelection = useCallback(() => {
    if (isEditingTranscription) return; // Don't handle text selection in edit mode

    const selection = window.getSelection();
    
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      setSelectedText(null);
      setButtonPosition(null);
      setSelectionRange(null);
      return;
    }
    
    const range = selection.getRangeAt(0);
    const selectedTextString = selection.toString();
    const trimmedText = selectedTextString.trim();

    if (trimmedText.length === 0) {
      setSelectedText(null);
      setButtonPosition(null);
      setSelectionRange(null);
      return;
    }

    const container = range.commonAncestorContainer;
    const element = container.nodeType === Node.ELEMENT_NODE ? (container as HTMLElement) : container.parentElement;
    if (!element || !element.closest('[data-content-area="true"]')) {
      setSelectedText(null);
      setButtonPosition(null);
      setSelectionRange(null);
      return;
    }

    setSelectedText(trimmedText);
    
    let startNode = range.startContainer;
    let startElement = (startNode.nodeType === Node.TEXT_NODE ? startNode.parentElement : startNode) as HTMLElement;
    const blockElement = startElement.closest('[data-char-offset]');

    if (blockElement) {
        const blockOffset = parseInt(blockElement.getAttribute('data-char-offset') || '0', 10);
        
        const preRange = document.createRange();
        preRange.selectNodeContents(blockElement);
        preRange.setEnd(range.startContainer, range.startOffset);
        const localOffset = preRange.toString().length;
        
        const startIndex = blockOffset + localOffset;
        setSelectionRange({ start: startIndex, length: selectedTextString.length });
    }

    const rect = range.getBoundingClientRect();
    const containerRect = transcriptionContainerRef.current?.getBoundingClientRect();
    
    if (rect && containerRect) {
        setButtonPosition({
          top: rect.top - containerRect.top + rect.height / 2,
          left: rect.right - containerRect.left + 5,
        });
    }
  }, [isEditingTranscription]);

  const handleTranslateSelection = useCallback(async () => {
    if (!selectedText || !transcription || !translation || !selectionRange) return;
    setExplainedRange(selectionRange);
    setButtonPosition(null);
    setIsTranslatingSelection(true);
    setSelectionError(null);
    setSelectionTranslation(null);

    try {
      const result = await getExplanationForSelection(selectedText, transcription, translation);
      setSelectionTranslation(result);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "An unknown error occurred during selection translation.";
      setSelectionError(errorMessage);
      setExplainedRange(null);
    } finally {
      setIsTranslatingSelection(false);
    }
  }, [selectedText, transcription, translation, selectionRange]);
  
  const isProcessingTranscription = appState === AppState.PROCESSING_TRANSCRIPTION;
  const isProcessingFormatting = appState === AppState.PROCESSING_FORMATTING;
  const isProcessingTranslation = appState === AppState.PROCESSING_TRANSLATION;
  const isProcessing = isProcessingTranscription || isProcessingFormatting || isProcessingTranslation;
  const canSelectText = appState === AppState.SUCCESS && transcription && !isEditingTranscription;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 font-sans">
      <main className="w-full max-w-4xl mx-auto space-y-8">
        <header className="text-center">
            <div className="flex items-center justify-center gap-3">
                <SparklesIcon className="w-8 h-8 text-indigo-500"/>
                <h1 className="text-3xl md:text-4xl font-bold text-slate-800 dark:text-white">
                    Tibetan Text Translator
                </h1>
            </div>
            <p className="mt-2 text-slate-600 dark:text-slate-400">
                Upload photos of Tibetan script to get an AI-powered transcription and translation.
            </p>
        </header>

        <div className="bg-white dark:bg-slate-800/50 p-6 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
                disabled={isProcessing}
                multiple
              />
              {images.map(image => (
                <div key={image.id} className="relative aspect-square group">
                  <img src={image.url} alt={`preview ${image.id}`} className="object-cover w-full h-full rounded-lg" />
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                    {image.status === 'transcribing' && <Spinner className="w-8 h-8 text-white"/>}
                    {image.status === 'success' && <CheckCircleIcon className="w-10 h-10 text-green-400"/>}
                    {image.status === 'error' && <XCircleIcon className="w-10 h-10 text-red-400"/>}
                  </div>
                  {!isProcessing && (
                    <button onClick={() => handleRemoveImage(image.id)} className="absolute top-1 right-1 bg-black/50 text-white p-1 rounded-full hover:bg-black/80">
                      <XIcon className="w-4 h-4"/>
                    </button>
                  )}
                </div>
              ))}
              {!isProcessing && (
                 <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full aspect-square border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-slate-500 dark:text-slate-400 hover:border-indigo-500 hover:text-indigo-500 transition-colors"
                >
                  <UploadIcon className="w-8 h-8" />
                  <span className="text-sm mt-2">Add Images</span>
                </button>
              )}
            </div>
            
            <div className="flex flex-row items-center gap-4">
              <button
                  onClick={handleProcessImages}
                  disabled={isProcessing || images.length === 0}
                  className="flex-grow bg-indigo-600 text-white font-semibold py-3 px-4 rounded-lg hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all duration-300"
              >
                <SparklesIcon className="w-5 h-5"/>
                Transcribe & Translate
              </button>
              <button
                  onClick={handleReset}
                  className="flex-shrink-0 bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200 p-3 rounded-full hover:bg-slate-300 dark:hover:bg-slate-600 flex items-center justify-center transition-all duration-300"
                  aria-label="Start Over"
                  title="Start Over"
              >
                  <ResetIcon className="w-6 h-6"/>
              </button>
            </div>
            
            <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center gap-3">
                    <input
                        id="custom-budget-checkbox"
                        type="checkbox"
                        checked={useCustomBudget}
                        onChange={(e) => setUseCustomBudget(e.target.checked)}
                        disabled={isProcessing}
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <label htmlFor="custom-budget-checkbox" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                        Use Custom Thinking Budget
                    </label>
                </div>
                {useCustomBudget && (
                    <div className="pl-7">
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                            Adjust the AI's "thinking" budget for translation. A lower budget may be faster but can reduce quality.
                        </p>
                        <div className="flex items-center gap-4">
                            <input
                                id="thinking-budget"
                                type="range"
                                min="0"
                                max="100"
                                step="1"
                                value={thinkingBudget}
                                onChange={(e) => setThinkingBudget(Number(e.target.value))}
                                disabled={isProcessing}
                                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-700 disabled:cursor-not-allowed"
                                aria-label="Translation thinking budget"
                            />
                            <span className="font-semibold text-slate-800 dark:text-slate-200 w-10 text-center">{thinkingBudget}</span>
                        </div>
                    </div>
                )}
            </div>

            {isProcessing && (
                <div className="mt-6 flex items-center justify-center gap-3 text-slate-600 dark:text-slate-300">
                    <Spinner className="w-5 h-5" />
                    <span className="font-medium">
                      {isProcessingTranscription ? 'Transcribing text from images...' : isProcessingFormatting ? 'Formatting transcription...' : 'Translating combined text...'}
                    </span>
                </div>
            )}

            {appState === AppState.ERROR && error && (
                <div className="mt-6 flex items-center gap-2 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                    <XCircleIcon className="w-5 h-5" />
                    <p className="text-sm font-medium">{error}</p>
                </div>
            )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div 
              ref={transcriptionContainerRef}
              onMouseUp={canSelectText ? handleSelection : undefined} 
              className={`relative ${canSelectText ? "cursor-text" : ""}`}
              aria-label="Tibetan Transcription Result. Select text to translate a phrase."
            >
                {buttonPosition && (
                    <button
                        onClick={handleTranslateSelection}
                        className="absolute z-10 bg-indigo-600 text-white px-3 py-1 text-sm font-semibold rounded-md shadow-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-slate-900 transform -translate-y-1/2 transition-transform hover:scale-105"
                        style={{ top: `${buttonPosition.top}px`, left: `${buttonPosition.left}px` }}
                        aria-label="Explain selected text"
                        title="Explain selection"
                    >
                        EXPLAIN
                    </button>
                )}
                <ResultCard 
                    icon={documentIcon}
                    title="Tibetan Transcription" 
                    subtitle={appState === AppState.SUCCESS && !isEditingTranscription ? "Select text for a detailed explanation." : undefined}
                    text={transcription}
                    isLoading={isProcessingTranscription || isProcessingFormatting}
                    contentClassName="text-2xl"
                    highlightRange={explainedRange}
                    isEditable={!!transcription && !isProcessing}
                    isEditing={isEditingTranscription}
                    onToggleEdit={handleToggleEditTranscription}
                    onTextChange={handleTranscriptionChange}
                />
            </div>
            <ResultCard
                icon={languageIcon}
                title="English Translation" 
                text={translation}
                isLoading={isProcessingTranslation}
            />
        </div>

        {(isTranslatingSelection || selectionTranslation || selectionError) && (
          <div className="mt-6">
            {selectionError && (
              <div className="mb-4 flex items-center gap-2 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                <XCircleIcon className="w-5 h-5" />
                <p className="text-sm font-medium">{selectionError}</p>
              </div>
            )}
            <ResultCard
              icon={languageIcon}
              title="Explanation of Selected Phrase"
              text={selectionTranslation}
              isLoading={isTranslatingSelection}
              contentClassName="text-xl"
            />
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
