
import React, { useRef } from 'react';
import { UploadIcon } from './icons';

interface ImageUploaderProps {
  onImageSelect: (file: File) => void;
  imageUrl: string | null;
  disabled: boolean;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({ onImageSelect, imageUrl, disabled }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onImageSelect(file);
    }
  };

  const handleClick = () => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  };

  return (
    <div
      onClick={handleClick}
      className={`relative w-full aspect-video border-2 border-dashed rounded-xl flex items-center justify-center text-slate-500 dark:text-slate-400 transition-all duration-300 ${
        disabled
          ? 'cursor-not-allowed bg-slate-200 dark:bg-slate-800'
          : 'cursor-pointer bg-white dark:bg-slate-800/50 hover:border-indigo-500 hover:text-indigo-500'
      } ${imageUrl ? 'border-solid' : ''}`}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
        disabled={disabled}
      />
      {imageUrl ? (
        <img src={imageUrl} alt="Uploaded Tibetan text" className="object-contain w-full h-full rounded-xl" />
      ) : (
        <div className="text-center">
          <UploadIcon className="w-12 h-12 mx-auto" />
          <p className="mt-2 text-sm font-medium">Click to upload an image</p>
          <p className="text-xs text-slate-400">PNG, JPG, WEBP</p>
        </div>
      )}
    </div>
  );
};

export default ImageUploader;
