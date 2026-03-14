import React from 'react';

interface ProspectViewerProps {
    prospect: any; // Ideally typed to Student interface narrowed to prospect
    onClose: () => void;
    onConvert: (prospectId: string) => void;
}

const ProspectViewerModal: React.FC<ProspectViewerProps> = ({ prospect, onClose, onConvert }) => {
    if (!prospect) return null;

    const phone = prospect.phone || prospect.metadata?.phone || '';
    const email = prospect.email || prospect.metadata?.email || '';
    const name = prospect.name || 'Unknown Prospect';
    const instrument = prospect.metadata?.interested_instrument || 'Not specified';
    const source = prospect.metadata?.lead_source || 'Not specified';

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
                    <div className="flex gap-3 mb-6">
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
                    </div>

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
