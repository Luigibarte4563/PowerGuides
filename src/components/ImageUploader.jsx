import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { Button } from './ui/Button';
import { IMAGE_UPLOAD } from '@/utils/constants';

/**
 * Single-image picker with preview, client-side type/size validation and an
 * upload progress bar. Used by the outage report form (`upload_image.php`).
 */
export default function ImageUploader({
  value,
  onChange,
  label = 'Photo (optional)',
  hint,
  progress,
  uploading = false,
  error,
  disabled = false,
  maxWidth = 'max-w-md',
}) {
  const inputRef = useRef(null);
  const [preview, setPreview] = useState('');
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    if (!value) {
      setPreview('');
      return undefined;
    }
    const objectUrl = URL.createObjectURL(value);
    setPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [value]);

  const handleFile = (event) => {
    const file = event.target.files?.[0];
    setLocalError('');
    if (!file) return;

    if (!IMAGE_UPLOAD.acceptedTypes.includes(file.type)) {
      setLocalError('Please choose a JPG, PNG, WEBP or GIF image.');
      event.target.value = '';
      return;
    }
    if (file.size > IMAGE_UPLOAD.maxBytes) {
      setLocalError(`That image is larger than ${IMAGE_UPLOAD.maxBytesLabel}. Please choose a smaller file.`);
      event.target.value = '';
      return;
    }
    onChange?.(file);
  };

  const clear = () => {
    onChange?.(null);
    setLocalError('');
    if (inputRef.current) inputRef.current.value = '';
  };

  const message = localError || error;

  return (
    <div className={maxWidth}>
      <p className="text-sm font-semibold text-navy-800">{label}</p>

      {preview ? (
        <div className="mt-2 overflow-hidden rounded-card border border-navy-200">
          <img src={preview} alt="Selected report photo preview" className="h-40 w-full bg-navy-100 object-cover" />
          <div className="flex items-center justify-between gap-2 border-t border-navy-100 px-3 py-2">
            <span className="truncate text-xs text-navy-500">
              {value?.name} ({(value?.size / 1024).toFixed(0)} KB)
            </span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              icon={Trash2}
              onClick={clear}
              disabled={disabled || uploading}
            >
              Remove
            </Button>
          </div>
          {uploading || progress > 0 ? (
            <div className="px-3 pb-3">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-navy-100">
                <div
                  className="h-full rounded-full bg-primary-500 transition-all"
                  style={{ width: `${Math.min(100, progress || 0)}%` }}
                />
              </div>
              <p className="mt-1 text-xs font-medium text-navy-500">
                {uploading ? <Loader2 className="mr-1 inline h-3 w-3 animate-spin" aria-hidden="true" /> : null}
                Uploading… {progress || 0}%
              </p>
            </div>
          ) : null}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || uploading}
          className="mt-2 flex w-full flex-col items-center justify-center gap-2 rounded-card border border-dashed border-navy-300 bg-canvas px-4 py-8 text-center transition hover:border-primary-400 hover:bg-primary-50/50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <ImagePlus className="h-6 w-6 text-navy-400" aria-hidden="true" />
          <span className="text-sm font-semibold text-navy-700">Tap to choose a photo</span>
          <span className="text-xs text-navy-400">
            JPG, PNG, WEBP or GIF · up to {IMAGE_UPLOAD.maxBytesLabel}
          </span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={IMAGE_UPLOAD.accept}
        className="sr-only"
        onChange={handleFile}
        aria-label={label}
      />

      {message ? (
        <p role="alert" className="mt-1.5 text-xs font-medium text-danger-600">
          {message}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-navy-400">{hint}</p>
      ) : null}
    </div>
  );
}
