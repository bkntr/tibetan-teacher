import React, { useState, useRef, useEffect } from 'react';
import { AppState } from './types';
import { transcribeImage, translateTranscription, getExplanationForSelection } from './services/geminiService';
import ResultCard from './components/ResultCard';
import Spinner from './components/Spinner';
import { SparklesIcon, XCircleIcon, CheckCircleIcon, DocumentTextIcon, LanguageIcon, UploadIcon, XIcon } from './components/icons';

type ImageStatus = 'pending' | 'transcribing' | 'success' | 'error';

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
  const [selectionTranslation, setSelectionTranslation] = useState<string | null>(null);
  const [isTranslatingSelection, setIsTranslatingSelection] = useState<boolean>(false);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [buttonPosition, setButtonPosition] = useState<{ top: number; left: number } | null>(null);
  const [useCustomBudget, setUseCustomBudget] = useState<boolean>(false);
  const [thinkingBudget, setThinkingBudget] = useState<number>(50);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clean up object URLs when component unmounts or images change
  useEffect(() => {
    return () => {
      images.forEach(image => URL.revokeObjectURL(image.url));
    };
  }, [images]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    handleReset();
    const files = event.target.files;
    if (files) {
      const newImageFiles = Array.from(files).map(file => ({
        id: `${file.name}-${file.lastModified}`,
        file,
        url: URL.createObjectURL(file),
        status: 'pending' as ImageStatus,
      }));
      setImages(newImageFiles);
    }
    // Reset file input value to allow re-uploading the same file
    event.target.value = '';
  };
  
  const handleRemoveImage = (idToRemove: string) => {
    setImages(prevImages => {
      const imageToRemove = prevImages.find(img => img.id === idToRemove);
      if (imageToRemove) {
        URL.revokeObjectURL(imageToRemove.url);
      }
      return prevImages.filter(image => image.id !== idToRemove);
    });
  };

  const handleProcessImages = async () => {
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
    setButtonPosition(null);
    setSelectionTranslation(null);
    setSelectionError(null);

    // Set all images to transcribing
    setImages(prev => prev.map(img => ({ ...img, status: 'transcribing' as ImageStatus })));

    const transcriptionPromises = images.map(image =>
      transcribeImage(image.file).then(result => ({ ...image, status: 'success' as ImageStatus, transcription: result }))
      .catch(err => ({ ...image, status: 'error' as ImageStatus, error: err.message }))
    );

    const updatedImages = await Promise.all(transcriptionPromises);
    setImages(updatedImages);

    const successfulTranscriptions = updatedImages
      .filter(img => img.status === 'success' && img.transcription)
      .map(img => img.transcription);

    if (successfulTranscriptions.length === 0) {
      setError("Transcription failed for all images.");
      setAppState(AppState.ERROR);
      return;
    }

    const combinedTranscription = successfulTranscriptions.join('\n\n---\n\n');
    setTranscription(combinedTranscription);
    setAppState(AppState.PROCESSING_TRANSLATION);

    try {
      const budgetToSend = useCustomBudget ? thinkingBudget : -1;
      const translationResult = await translateTranscription(combinedTranscription, budgetToSend);
      setTranslation(translationResult);
      setAppState(AppState.SUCCESS);
    } catch (translationError) {
      const errorMessage = translationError instanceof Error ? translationError.message : "An unknown error occurred during translation.";
      setError(errorMessage);
      setAppState(AppState.ERROR);
    }
  };
  
  const handleReset = () => {
    setImages([]);
    setTranscription(null);
    setTranslation(null);
    setError(null);
    setAppState(AppState.IDLE);
    setSelectedText(null);
    setButtonPosition(null);
    setSelectionTranslation(null);
    setSelectionError(null);
    setIsTranslatingSelection(false);
  };

  const handleSelection = () => {
    const selection = window.getSelection();
    const text = selection?.toString().trim() ?? null;
    
    if (text && text.length > 0) {
      setSelectedText(text);
      const range = selection?.getRangeAt(0);
      if (range) {
        const rect = range.getBoundingClientRect();
        setButtonPosition({
          top: rect.top + rect.height / 2,
          left: rect.right + 5,
        });
      }
    } else {
      setSelectedText(null);
      setButtonPosition(null);
    }
  };

  const handleTranslateSelection = async () => {
    if (!selectedText || !transcription) return;

    setButtonPosition(null);
    setIsTranslatingSelection(true);
    setSelectionError(null);
    setSelectionTranslation(null);

    try {
      const result = await getExplanationForSelection(selectedText, transcription);
      setSelectionTranslation(result);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "An unknown error occurred during selection translation.";
      setSelectionError(errorMessage);
    } finally {
      setIsTranslatingSelection(false);
    }
  };
  
  const isProcessingTranscription = appState === AppState.PROCESSING_TRANSCRIPTION;
  const isProcessingTranslation = appState === AppState.PROCESSING_TRANSLATION;
  const isProcessing = isProcessingTranscription || isProcessingTranslation;
  const canSelectText = appState === AppState.SUCCESS;

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

        {buttonPosition && (
          <button
            onClick={handleTranslateSelection}
            className="fixed z-10 bg-indigo-600 text-white p-2 rounded-full shadow-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-slate-900 transform -translate-y-1/2 transition-transform hover:scale-110"
            style={{ top: `${buttonPosition.top}px`, left: `${buttonPosition.left}px` }}
            aria-label="Translate selected text"
            title="Translate selection"
          >
            <LanguageIcon className="w-5 h-5" />
          </button>
        )}

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
            
            <div className="flex flex-col sm:flex-row gap-4">
              <button
                  onClick={handleProcessImages}
                  disabled={images.length === 0 || isProcessing}
                  className="w-full bg-indigo-600 text-white font-semibold py-3 px-4 rounded-lg hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all duration-300"
              >
                  <SparklesIcon className="w-5 h-5"/>
                  Transcribe & Translate
              </button>
              <button
                  onClick={handleReset}
                  className="w-full sm:w-auto bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200 font-semibold py-3 px-4 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 flex items-center justify-center gap-2 transition-all duration-300"
              >
                  Start Over
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
                            Adjust AI thinking budget for the Pro model. Lower is faster but may reduce quality. The valid model range is 128-32768.
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
                      {isProcessingTranscription ? 'Transcribing text from images...' : 'Translating combined text...'}
                    </span>
                </div>
            )}

            {appState === AppState.ERROR && error && (
                <div className="mt-6 flex items-center gap-2 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                    <XCircleIcon className="w-5 h-5" />
                    <p className="text-sm font-medium">{error}</p>
                </div>
            )}

            {appState === AppState.SUCCESS && (
                <div className="mt-6 flex items-center gap-2 text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
                    <CheckCircleIcon className="w-5 h-5" />
                    <p className="text-sm font-medium">Processing complete! You can now select transcribed text to get a contextual explanation.</p>
                </div>
            )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div 
              onMouseUp={canSelectText ? handleSelection : undefined} 
              className={canSelectText ? "cursor-text" : ""}
              aria-label="Tibetan Transcription Result. Select text to translate a phrase."
            >
                <ResultCard 
                    icon={<DocumentTextIcon className="w-6 h-6"/>}
                    title="Tibetan Transcription" 
                    text={transcription}
                    isLoading={isProcessingTranscription}
                    contentClassName="text-2xl"
                />
            </div>
            <ResultCard
                icon={<LanguageIcon className="w-6 h-6"/>}
                title="English Translation" 
                text={translation}
                isLoading={isProcessing}
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
              icon={<LanguageIcon className="w-6 h-6" />}
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