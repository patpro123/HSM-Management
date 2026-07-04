import { MaterialType } from '../types';

export function inferMaterialType(mimeType: string): MaterialType {
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('image/')) return 'image';
  return 'document';
}

interface MaterialPreviewProps {
  mimeType: string;
  fileName?: string;
  /** URL to actually render inline (blob: URL for a not-yet-saved pick, or the
   *  server's inline-stream proxy for a saved library item — never Drive's own
   *  public URL, which forces a download and won't render in <img>/<audio>/<video>). */
  previewUrl: string;
  /** URL for an explicit "Download" action. Defaults to previewUrl when omitted
   *  (e.g. the pre-save preview, where the file isn't saved anywhere else yet). */
  downloadUrl?: string;
}

// Full preview for a material — image you can actually see, audio/video you can play
// inline, and a PDF you can either view or explicitly download. Shared between the
// library's own search results and the in-assignment picker so both look and behave
// the same way.
export default function MaterialPreview({ mimeType, fileName, previewUrl, downloadUrl }: MaterialPreviewProps) {
  const type = inferMaterialType(mimeType);
  const viewUrl = previewUrl;
  const saveUrl = downloadUrl || previewUrl;

  if (type === 'audio') {
    return (
      <div className="space-y-1">
        <audio src={viewUrl} controls className="w-full h-10" />
        {fileName && <p className="text-[11px] text-slate-400 truncate">{fileName}</p>}
      </div>
    );
  }

  if (type === 'video') {
    return (
      <div className="space-y-1">
        <video src={viewUrl} controls className="w-full max-h-72 rounded-lg bg-black" />
        {fileName && <p className="text-[11px] text-slate-400 truncate">{fileName}</p>}
      </div>
    );
  }

  if (type === 'image') {
    return (
      <div className="space-y-1">
        <a href={viewUrl} target="_blank" rel="noreferrer">
          <img
            src={viewUrl}
            alt={fileName || ''}
            className="max-h-72 w-full rounded-lg object-contain bg-slate-50 border border-slate-100"
          />
        </a>
        <a href={viewUrl} target="_blank" rel="noreferrer" className="text-xs text-orange-600 underline">
          View full size ↗
        </a>
      </div>
    );
  }

  // document (PDF)
  return (
    <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-lg p-3">
      <span className="text-2xl">📄</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-slate-700 truncate">{fileName || 'Document'}</p>
        <div className="flex gap-3 mt-1">
          <a href={viewUrl} target="_blank" rel="noreferrer" className="text-xs text-orange-600 underline">
            View
          </a>
          <a href={saveUrl} download={fileName || true} className="text-xs text-orange-600 underline">
            Download
          </a>
        </div>
      </div>
    </div>
  );
}
