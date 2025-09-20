import React, { useState, useCallback } from 'react';
import { AppState } from './types';
import { transcribeAndTranslateImage, translateText } from './services/geminiService';
import ImageUploader from './components/ImageUploader';
import ResultCard from './components/ResultCard';
import Spinner from './components/Spinner';
import { SparklesIcon, XCircleIcon, CheckCircleIcon, DocumentTextIcon, LanguageIcon } from './components/icons';

const App: React.FC = () => {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [transcription, setTranscription] = useState<string | null>(null);
  const [translation, setTranslation] = useState<string | null>(null);
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [error, setError] = useState<string | null>(null);

  const [selectedText, setSelectedText] = useState<string | null>(null);
  const [selectionTranslation, setSelectionTranslation] = useState<string | null>(null);
  const [isTranslatingSelection, setIsTranslatingSelection] = useState<boolean>(false);
  const [selectionError, setSelectionError] = useState<string | null>(null);


  const handleImageSelect = useCallback((file: File) => {
    handleReset();
    setImageFile(file);
    setImageUrl(URL.createObjectURL(file));
  }, []);

  const handleProcessImage = async () => {
    if (!imageFile) {
      setError("Please select an image first.");
      setAppState(AppState.ERROR);
      return;
    }

    setAppState(AppState.PROCESSING);
    setError(null);
    setTranscription(null);
    setTranslation(null);

    try {
      const results = await transcribeAndTranslateImage(imageFile);
      setTranscription(results.transcription);
      setTranslation(results.translation);
      setAppState(AppState.SUCCESS);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "An unknown error occurred.";
      setError(errorMessage);
      setAppState(AppState.ERROR);
    }
  };
  
  const handleReset = () => {
    setImageFile(null);
    if(imageUrl) {
      URL.revokeObjectURL(imageUrl);
    }
    setImageUrl(null);
    setTranscription(null);
    setTranslation(null);
    setError(null);
    setAppState(AppState.IDLE);
    setSelectedText(null);
    setSelectionTranslation(null);
    setSelectionError(null);
    setIsTranslatingSelection(false);
  };

  const handleSelection = () => {
    const text = window.getSelection()?.toString().trim() ?? null;
    if (text && text.length > 0) {
      if(text !== selectedText) {
        setSelectionTranslation(null);
        setSelectionError(null);
      }
      setSelectedText(text);
    } else {
      setSelectedText(null);
    }
  };

  const handleTranslateSelection = async () => {
    if (!selectedText || !transcription) return;

    setIsTranslatingSelection(true);
    setSelectionError(null);
    setSelectionTranslation(null);

    try {
      const result = await translateText(selectedText, transcription);
      setSelectionTranslation(result);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "An unknown error occurred during selection translation.";
      setSelectionError(errorMessage);
    } finally {
      setIsTranslatingSelection(false);
    }
  };
  
  const isProcessing = appState === AppState.PROCESSING;

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
                Upload a photo of Tibetan script to get an AI-powered transcription and translation.
            </p>
        </header>

        <div className="bg-white dark:bg-slate-800/50 p-6 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                <ImageUploader onImageSelect={handleImageSelect} imageUrl={imageUrl} disabled={isProcessing} />
                <div className="flex flex-col gap-4">
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                        Once you upload an image, click the button to start the AI process. The model will first transcribe the Tibetan text and then translate it into English.
                    </p>
                    {appState === AppState.IDLE && imageUrl && (
                         <button
                            onClick={handleProcessImage}
                            disabled={!imageUrl || isProcessing}
                            className="w-full bg-indigo-600 text-white font-semibold py-3 px-4 rounded-lg hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all duration-300"
                        >
                            <SparklesIcon className="w-5 h-5"/>
                            Transcribe & Translate
                        </button>
                    )}
                    {appState !== AppState.IDLE && (
                         <button
                            onClick={handleReset}
                            className="w-full bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200 font-semibold py-3 px-4 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 flex items-center justify-center gap-2 transition-all duration-300"
                        >
                            Start Over
                        </button>
                    )}
                </div>
            </div>

            {appState === AppState.PROCESSING && (
                <div className="mt-6 flex items-center justify-center gap-3 text-slate-600 dark:text-slate-300">
                    <Spinner className="w-5 h-5" />
                    <span className="font-medium">AI is working its magic...</span>
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
                    <p className="text-sm font-medium">Processing complete! You can now select transcribed text to translate phrases.</p>
                </div>
            )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div onMouseUp={handleSelection} className="cursor-text" aria-label="Tibetan Transcription Result. Select text to translate a phrase.">
                <ResultCard 
                    icon={<DocumentTextIcon className="w-6 h-6"/>}
                    title="Tibetan Transcription" 
                    text={transcription}
                    isLoading={isProcessing}
                />
            </div>
            <ResultCard
                icon={<LanguageIcon className="w-6 h-6"/>}
                title="English Translation" 
                text={translation}
                isLoading={isProcessing}
            />
        </div>

        {selectedText && (
          <div className="mt-6 bg-white dark:bg-slate-800/50 p-6 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Selected Tibetan Phrase</h3>
                <p className="mt-1 text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700/50 p-3 rounded-lg font-sans">
                  {selectedText}
                </p>
              </div>
              <button
                onClick={handleTranslateSelection}
                disabled={isTranslatingSelection}
                className="w-full sm:w-auto bg-indigo-600 text-white font-semibold py-3 px-5 rounded-lg hover:bg-indigo-700 disabled:bg-indigo-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all duration-300 h-fit"
                aria-label="Translate selected Tibetan phrase"
              >
                {isTranslatingSelection ? <Spinner className="w-5 h-5" /> : <LanguageIcon className="w-5 h-5" />}
                <span>Translate Selection</span>
              </button>
            </div>
            
            {selectionError && (
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                <XCircleIcon className="w-5 h-5" />
                <p className="text-sm font-medium">{selectionError}</p>
              </div>
            )}

            {(isTranslatingSelection || selectionTranslation) && (
              <ResultCard
                icon={<LanguageIcon className="w-6 h-6" />}
                title="Explanation of Selected Phrase"
                text={selectionTranslation}
                isLoading={isTranslatingSelection}
              />
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;