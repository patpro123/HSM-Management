import { useState } from 'react';
import { apiPost } from '../../api';

// ── shared types ─────────────────────────────────────────────────────────────

type Mode = 'copy' | 'images';
type ContentType = 'tagline' | 'social_post' | 'ad_copy' | 'whatsapp_message' | 'email_subject' | 'email_body';
type Audience = 'parents_kids' | 'adult_learners' | 'general' | 'corporate';
type Tone = 'warm' | 'professional' | 'playful' | 'inspiring';
type ImageType = 'social_square' | 'banner' | 'story' | 'logo_concept' | 'whatsapp';

interface CopyVariant { text: string; angle: string; }
interface ImageConcept { angle: string; prompt: string; url: string; thumbnail_url: string; width: number; height: number; seed: number; }

// ── constants ─────────────────────────────────────────────────────────────────

const CONTENT_TYPES: { value: ContentType; label: string; icon: string }[] = [
  { value: 'tagline',          label: 'Brand Tagline',     icon: 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a2 2 0 012-2z' },
  { value: 'social_post',      label: 'Social Post',       icon: 'M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z' },
  { value: 'ad_copy',          label: 'Ad Copy',           icon: 'M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z' },
  { value: 'whatsapp_message', label: 'WhatsApp Message',  icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
  { value: 'email_subject',    label: 'Email Subject',     icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
  { value: 'email_body',       label: 'Email Body',        icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
];

const IMAGE_TYPES: { value: ImageType; label: string; dims: string; aspect: string }[] = [
  { value: 'social_square', label: 'Social Post',       dims: '1080 × 1080', aspect: 'aspect-square' },
  { value: 'banner',        label: 'Ad Banner',         dims: '1200 × 630',  aspect: 'aspect-video' },
  { value: 'story',         label: 'Story / Reel',      dims: '768 × 1344',  aspect: 'aspect-[9/16]' },
  { value: 'logo_concept',  label: 'Logo Concept',      dims: '512 × 512',   aspect: 'aspect-square' },
  { value: 'whatsapp',      label: 'WhatsApp Image',    dims: '800 × 800',   aspect: 'aspect-square' },
];

const AUDIENCES: { value: Audience; label: string; desc: string }[] = [
  { value: 'parents_kids',   label: 'Parents (Kids)',  desc: 'Children 6–16 years' },
  { value: 'adult_learners', label: 'Adult Learners',  desc: 'Hobby & self-growth' },
  { value: 'general',        label: 'General',         desc: 'Broad Hyderabad' },
  { value: 'corporate',      label: 'Corporate',       desc: 'Teams & gifting' },
];

const TONES: { value: Tone; label: string }[] = [
  { value: 'warm',         label: 'Warm' },
  { value: 'professional', label: 'Professional' },
  { value: 'playful',      label: 'Playful' },
  { value: 'inspiring',    label: 'Inspiring' },
];

const INSTRUMENTS = ['', 'Keyboard', 'Guitar', 'Piano', 'Drums', 'Tabla', 'Violin', 'Hindustani Vocals', 'Carnatic Vocals'];

// ── sub-components ────────────────────────────────────────────────────────────

function ImageCard({ concept, idx }: { concept: ImageConcept; idx: number }) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const [saved, setSaved] = useState(false);

  async function saveToAssets() {
    try {
      await apiPost('/api/marketing/brand-assets', {
        kind: 'photo',
        name: concept.angle,
        value: concept.url,
        metadata: { generated_by: 'ai-image-assist', prompt: concept.prompt, seed: concept.seed, width: concept.width, height: concept.height },
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      // silently fail — user can still open/download manually
    }
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Image preview */}
      <div className={`relative bg-gray-100 ${concept.width === concept.height ? 'aspect-square' : concept.height > concept.width ? 'aspect-[9/16] max-h-64' : 'aspect-video'} overflow-hidden`}>
        {!loaded && !errored && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <svg className="w-5 h-5 animate-spin text-orange-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-xs text-gray-400">Generating image...</span>
          </div>
        )}
        {errored && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs text-gray-400">Image unavailable</span>
          </div>
        )}
        <img
          src={concept.thumbnail_url}
          alt={concept.angle}
          className={`w-full h-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          onLoad={() => setLoaded(true)}
          onError={() => { setLoaded(true); setErrored(true); }}
        />
      </div>

      {/* Card footer */}
      <div className="p-3 space-y-2">
        <span className="text-xs font-medium text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
          {concept.angle}
        </span>
        <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">{concept.prompt}</p>
        <div className="flex gap-2 pt-1">
          <a
            href={concept.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded border border-gray-200 hover:border-gray-300 transition-colors"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Full size
          </a>
          <button
            onClick={saveToAssets}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-orange-600 px-2 py-1 rounded border border-gray-200 hover:border-orange-300 transition-colors"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
            {saved ? 'Saved!' : 'Save to Assets'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

export default function CopywriterPanel() {
  // shared inputs
  const [audience, setAudience]           = useState<Audience>('parents_kids');
  const [instrument, setInstrument]       = useState('');
  const [customContext, setCustomContext] = useState('');

  // mode
  const [mode, setMode] = useState<Mode>('copy');

  // copy state
  const [contentType, setContentType] = useState<ContentType>('tagline');
  const [tone, setTone]               = useState<Tone>('warm');
  const [copyVariants, setCopyVariants] = useState<CopyVariant[]>([]);
  const [copied, setCopied]           = useState<number | null>(null);
  const [savedCopy, setSavedCopy]     = useState<number | null>(null);

  // image state
  const [imageType, setImageType]     = useState<ImageType>('social_square');
  const [imageConcepts, setImageConcepts] = useState<ImageConcept[]>([]);

  // shared ui state
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');

  // ── actions ───────────────────────────────────────────────────────────────

  async function generateCopy() {
    setLoading(true);
    setError('');
    setCopyVariants([]);
    try {
      const data = await apiPost('/api/marketing/ai-copy', {
        content_type: contentType,
        audience,
        tone,
        instrument: instrument || undefined,
        custom_context: customContext || undefined,
      });
      setCopyVariants(data.variants || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to generate copy');
    } finally {
      setLoading(false);
    }
  }

  async function generateImages() {
    setLoading(true);
    setError('');
    setImageConcepts([]);
    try {
      const data = await apiPost('/api/marketing/ai-image-prompt', {
        image_type: imageType,
        audience,
        instrument: instrument || undefined,
        custom_context: customContext || undefined,
      });
      setImageConcepts(data.images || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to generate image concepts');
    } finally {
      setLoading(false);
    }
  }

  async function copyToClipboard(text: string, idx: number) {
    await navigator.clipboard.writeText(text);
    setCopied(idx);
    setTimeout(() => setCopied(null), 2000);
  }

  async function saveCopyToAssets(variant: CopyVariant, idx: number) {
    try {
      await apiPost('/api/marketing/brand-assets', {
        kind: 'tagline',
        name: variant.angle,
        value: variant.text,
        metadata: { generated_by: 'ai-copywriter', audience, tone, content_type: contentType },
      });
      setSavedCopy(idx);
      setTimeout(() => setSavedCopy(null), 2500);
    } catch {
      setError('Failed to save to brand assets');
    }
  }

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-gray-900">AI Copywriter</h3>
        <p className="text-sm text-gray-500 mt-0.5">
          Generate marketing copy and image concepts using your school's live data.
        </p>
      </div>

      {/* Mode tabs */}
      <div className="overflow-x-auto -mx-1 px-1">
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-max">
        {([
          { key: 'copy' as Mode,   label: 'Copy',         icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' },
          { key: 'images' as Mode, label: 'Image Assist', icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' },
        ]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setMode(tab.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded text-sm font-medium transition-colors whitespace-nowrap ${
              mode === tab.key ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
            </svg>
            {tab.label}
          </button>
        ))}
      </div>
      </div>

      {/* Shared inputs: Audience + Instrument + Custom Context */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">Target Audience</label>
          <div className="space-y-1">
            {AUDIENCES.map(a => (
              <button
                key={a.value}
                onClick={() => setAudience(a.value)}
                className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                  audience === a.value
                    ? 'border-orange-400 bg-orange-50 text-orange-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                }`}
              >
                <span className="font-medium">{a.label}</span>
                <span className="text-xs text-gray-400">{a.desc}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              Instrument Focus <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <select
              value={instrument}
              onChange={e => setInstrument(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 bg-white rounded-lg text-sm text-gray-700 focus:outline-none focus:border-orange-400"
            >
              {INSTRUMENTS.map(i => (
                <option key={i} value={i}>{i || 'All instruments'}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              Custom Context <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={customContext}
              onChange={e => setCustomContext(e.target.value)}
              placeholder="e.g. Summer camp promo, 20% off first month..."
              rows={4}
              className="w-full px-3 py-2 border border-gray-200 bg-white rounded-lg text-sm text-gray-700 resize-none focus:outline-none focus:border-orange-400"
            />
          </div>
        </div>

        <div className="text-xs text-gray-400 pt-1 space-y-1">
          <p className="font-medium text-gray-500">Used for generation</p>
          <p>These fields feed into both copy and image prompts. Set once, switch between tabs freely.</p>
        </div>
      </div>

      {/* ── COPY TAB ── */}
      {mode === 'copy' && (
        <div className="space-y-5">
          {/* Content type */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">Content Type</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {CONTENT_TYPES.map(ct => (
                <button
                  key={ct.value}
                  onClick={() => setContentType(ct.value)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors text-left ${
                    contentType === ct.value
                      ? 'border-orange-400 bg-orange-50 text-orange-700 font-medium'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={ct.icon} />
                  </svg>
                  {ct.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tone */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Tone</label>
            <div className="flex flex-wrap gap-2">
              {TONES.map(t => (
                <button
                  key={t.value}
                  onClick={() => setTone(t.value)}
                  className={`px-4 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                    tone === t.value
                      ? 'border-orange-400 bg-orange-50 text-orange-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={generateCopy}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Generating...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Generate 3 Copy Variants
              </>
            )}
          </button>

          {copyVariants.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Generated Variants</p>
              {copyVariants.map((v, idx) => (
                <div key={idx} className="border border-gray-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">{v.angle}</span>
                    <div className="flex gap-2">
                      {contentType === 'tagline' && (
                        <button
                          onClick={() => saveCopyToAssets(v, idx)}
                          className="flex items-center gap-1 text-xs text-gray-500 hover:text-orange-600 px-2 py-1 rounded border border-gray-200 hover:border-orange-300 transition-colors"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                          </svg>
                          {savedCopy === idx ? 'Saved!' : 'Save to Assets'}
                        </button>
                      )}
                      <button
                        onClick={() => copyToClipboard(v.text, idx)}
                        className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded border border-gray-200 hover:border-gray-300 transition-colors"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        {copied === idx ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{v.text}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── IMAGE TAB ── */}
      {mode === 'images' && (
        <div className="space-y-5">
          {/* Image type */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">Image Format</label>
            <div className="flex flex-wrap gap-2">
              {IMAGE_TYPES.map(it => (
                <button
                  key={it.value}
                  onClick={() => setImageType(it.value)}
                  className={`flex flex-col items-start px-4 py-2 rounded-lg border text-sm transition-colors ${
                    imageType === it.value
                      ? 'border-orange-400 bg-orange-50 text-orange-700 font-medium'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <span>{it.label}</span>
                  <span className="text-xs text-gray-400 font-normal">{it.dims}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-xs text-blue-700">
            Gemini writes 3 detailed visual prompts — one human story, one instrument close-up, one atmospheric mood. Pollinations.ai (free, no account needed) renders them. Images take 10–20 seconds to load.
          </div>

          <button
            onClick={generateImages}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Generating prompts...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Generate 3 Image Concepts
              </>
            )}
          </button>

          {imageConcepts.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Image Concepts — click "Full size" to download
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {imageConcepts.map((concept, idx) => (
                  <ImageCard key={idx} concept={concept} idx={idx} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}
