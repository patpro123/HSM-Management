import React, { useState } from 'react';
import { apiPost } from '../api';
import { getCurrentUser } from '../auth';

interface ProspectViewerProps {
    prospect: any;
    onClose: () => void;
    onConvert: (prospectId: string) => void;
}

function buildWaLink(phone: string, message: string): string {
    const digits = phone.replace(/\D/g, '');
    const e164 = digits.startsWith('91') && digits.length === 12 ? digits
        : digits.length === 10 ? `91${digits}` : digits;
    return `https://wa.me/${e164}?text=${encodeURIComponent(message)}`;
}

const BRANCH_MAP_LINKS: Record<string, string> = {
    hsm_main: 'https://maps.google.com/?q=17.3471995,78.3909525',
    pbel_city: 'https://maps.google.com/?q=PBEL+City,+Hyderabad',
};

function generateNudgeMessage(name: string, instrument?: string, location?: string): string {
    const inst = instrument && instrument !== 'Not specified' && instrument !== '—' ? instrument : null;
    const mapLink = location ? BRANCH_MAP_LINKS[location] : null;
    const locationLine = mapLink ? `\n\n📍 Find us here: ${mapLink}` : '';
    return `Hi ${name}! 👋\n\nThis is the team at Hyderabad School of Music. You recently signed up for a free demo class${inst ? ` for ${inst}` : ''}. We'd love to get you started!\n\nCould you share a convenient time? We're available Tue–Fri (5–9 PM) and weekends.${locationLine}\n\nLooking forward to meeting you! 🎵`;
}

const WhatsAppIcon = () => (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
);

const ProspectViewerModal: React.FC<ProspectViewerProps> = ({ prospect, onClose, onConvert }) => {
    const [showWaCompose, setShowWaCompose] = useState(false);
    const [waMessage, setWaMessage] = useState('');
    const [sendingWa, setSendingWa] = useState(false);
    const [waSent, setWaSent] = useState(false);

    if (!prospect) return null;

    const user = getCurrentUser();
    const phone = prospect.phone || prospect.metadata?.phone || '';
    const email = prospect.email || prospect.metadata?.email || '';
    const name = prospect.name || 'Unknown Prospect';
    const instrument = prospect.metadata?.interested_instrument || 'Not specified';
    const source = prospect.metadata?.lead_source || 'Not specified';

    const handleOpenWaCompose = () => {
        setWaMessage(generateNudgeMessage(name, instrument, prospect.metadata?.location));
        setShowWaCompose(true);
    };

    const handleSendWhatsApp = async () => {
        setSendingWa(true);
        try {
            window.open(buildWaLink(phone, waMessage), '_blank');
            if (prospect.id) {
                await apiPost(`/api/prospects/${prospect.id}/whatsapp-nudge`, {
                    message: waMessage,
                    created_by: user?.name || user?.email || 'Admin',
                });
            }
            setWaSent(true);
            setShowWaCompose(false);
        } catch (err) {
            console.error('Failed to log WhatsApp nudge', err);
            setWaSent(true); // WhatsApp opened — log failure is non-critical
            setShowWaCompose(false);
        } finally {
            setSendingWa(false);
        }
    };

    // Format phone for standard tel: links (strip spaces, add + if needed based on locale, though simple is fine)
    const telLink = `tel:${phone.replace(/\s+/g, '')}`;
    const mailLink = email ? `mailto:${email}` : '#';

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden relative animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-4 flex justify-between items-center text-white">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <span>👋</span> New Demo Prospect
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-white/80 hover:text-white transition-colors bg-white/10 hover:bg-white/20 rounded-full p-1 h-8 w-8 flex items-center justify-center"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Body Elements */}
                <div className="p-6">
                    <div className="text-center mb-6">
                        <div className="w-20 h-20 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center text-3xl font-bold mx-auto mb-3 border-4 border-white shadow-sm">
                            {name.charAt(0).toUpperCase()}
                        </div>
                        <h3 className="text-2xl font-bold text-slate-800">{name}</h3>
                        <p className="text-sm font-medium text-orange-600 uppercase tracking-wider mt-1">{instrument} Interest</p>
                    </div>

                    {/* Contact Action Buttons */}
                    <div className="flex gap-3 mb-4">
                        <a
                            href={telLink}
                            className="flex-1 flex flex-col items-center justify-center gap-1 bg-green-50 hover:bg-green-100 border border-green-200 text-green-700 py-3 rounded-xl transition-colors font-semibold shadow-sm"
                        >
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                            <span className="text-sm">Call Now</span>
                        </a>

                        {email && (
                            <a
                                href={mailLink}
                                className="flex-1 flex flex-col items-center justify-center gap-1 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 py-3 rounded-xl transition-colors font-semibold shadow-sm"
                            >
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                                <span className="text-sm">Email</span>
                            </a>
                        )}

                        <button
                            onClick={handleOpenWaCompose}
                            disabled={waSent}
                            className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 rounded-xl transition-colors font-semibold shadow-sm border ${
                                waSent
                                    ? 'bg-slate-50 border-slate-200 text-slate-400'
                                    : 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-700'
                            }`}
                        >
                            <WhatsAppIcon />
                            <span className="text-sm">{waSent ? 'Nudge Sent' : 'WhatsApp'}</span>
                        </button>
                    </div>

                    {/* WhatsApp Compose Panel */}
                    {showWaCompose && (
                        <div className="mb-4 border border-emerald-200 bg-emerald-50 rounded-xl p-4">
                            <p className="text-xs font-semibold text-emerald-700 uppercase mb-2">Review message before sending</p>
                            <textarea
                                value={waMessage}
                                onChange={e => setWaMessage(e.target.value)}
                                rows={6}
                                className="w-full px-3 py-2 rounded-lg border border-emerald-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none text-sm resize-none bg-white"
                            />
                            <div className="flex gap-2 mt-3">
                                <button
                                    onClick={handleSendWhatsApp}
                                    disabled={sendingWa || !waMessage.trim()}
                                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition disabled:opacity-50"
                                >
                                    <WhatsAppIcon />
                                    {sendingWa ? 'Opening…' : 'Open in WhatsApp'}
                                </button>
                                <button
                                    onClick={() => setShowWaCompose(false)}
                                    className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm font-semibold hover:bg-slate-50 transition"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-3">
                        <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                            <span className="text-xs text-slate-500 font-semibold uppercase">Phone</span>
                            <span className="text-sm text-slate-800 font-medium">{phone}</span>
                        </div>
                        {email && (
                            <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                                <span className="text-xs text-slate-500 font-semibold uppercase">Email</span>
                                <span className="text-sm text-slate-800 font-medium">{email}</span>
                            </div>
                        )}
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-slate-500 font-semibold uppercase">Source</span>
                            <span className="text-sm text-slate-800 font-medium bg-slate-200 px-2 py-0.5 rounded-full">{source}</span>
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-100 transition-colors"
                    >
                        Dismiss
                    </button>
                    <button
                        onClick={() => onConvert(prospect.id)}
                        className="flex-1 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2"
                    >
                        <span>Enroll Now</span>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ProspectViewerModal;
