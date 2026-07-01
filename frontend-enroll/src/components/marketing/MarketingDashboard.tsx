import { useState } from 'react';
import FunnelWidget from './FunnelWidget';
import OverdueProspects from './OverdueProspects';
import TestimonialsManager from './TestimonialsManager';
import BrandAssetLibrary from './BrandAssetLibrary';
import CopywriterPanel from './CopywriterPanel';
import WhatsAppPromoPanel from './WhatsAppPromoPanel';
import SettingsPanel from '../SettingsPanel';

type Section = 'overview' | 'whatsapp' | 'copywriter' | 'website' | 'brand';
type WebsiteTab = 'announcements' | 'testimonials';

const NAV: { key: Section; label: string; icon: string }[] = [
  {
    key: 'overview',
    label: 'Funnel & Leads',
    icon: 'M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12',
  },
  {
    key: 'whatsapp',
    label: 'WhatsApp Promos',
    icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
  },
  {
    key: 'copywriter',
    label: 'AI Copywriter',
    icon: 'M13 10V3L4 14h7v7l9-11h-7z',
  },
  {
    key: 'website',
    label: 'Website Content',
    icon: 'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  {
    key: 'brand',
    label: 'Brand Assets',
    icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z',
  },
];

export default function MarketingDashboard() {
  const [section, setSection] = useState<Section>('overview');
  const [websiteTab, setWebsiteTab] = useState<WebsiteTab>('announcements');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Marketing</h2>
          <p className="text-sm text-gray-500 mt-0.5">Lead pipeline, website content, and brand building</p>
        </div>
      </div>

      {/* Top nav — horizontally scrollable on mobile */}
      <div className="overflow-x-auto -mx-1 px-1 pb-1">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-max min-w-full sm:w-fit">
        {NAV.map(item => (
          <button
            key={item.key}
            onClick={() => setSection(item.key)}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
              section === item.key ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
            </svg>
            {item.label}
          </button>
        ))}
        </div>
      </div>

      {/* Funnel & Leads */}
      {section === 'overview' && (
        <div className="space-y-8">
          <div className="bg-white rounded-lg shadow p-6">
            <FunnelWidget />
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <OverdueProspects />
          </div>
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
            <p className="text-sm font-medium text-blue-800 mb-1">Coming in P1</p>
            <p className="text-xs text-blue-600">
              WhatsApp broadcast campaigns, email newsletters, content calendar, milestone celebration automation, Google review nudges, and GA4 attribution.
            </p>
          </div>
        </div>
      )}

      {/* WhatsApp Promos */}
      {section === 'whatsapp' && (
        <div className="bg-white rounded-lg shadow p-6">
          <WhatsAppPromoPanel />
        </div>
      )}

      {/* AI Copywriter */}
      {section === 'copywriter' && (
        <div className="bg-white rounded-lg shadow p-6">
          <CopywriterPanel />
        </div>
      )}

      {/* Website Content */}
      {section === 'website' && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-100 rounded-lg px-4 py-3 flex items-center gap-2">
            <svg className="w-4 h-4 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-xs text-amber-700">
              Changes here go live on the public HSM website immediately after saving.
            </p>
          </div>

          {/* Website sub-tabs */}
          <div className="flex gap-2 border-b border-gray-200">
            {([
              { key: 'announcements' as WebsiteTab, label: 'Announcements & Banners' },
              { key: 'testimonials' as WebsiteTab, label: 'Testimonials' },
            ]).map(t => (
              <button
                key={t.key}
                onClick={() => setWebsiteTab(t.key)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
                  websiteTab === t.key
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {websiteTab === 'announcements' && (
            <div className="bg-white rounded-lg shadow p-6">
              <SettingsPanel />
            </div>
          )}

          {websiteTab === 'testimonials' && (
            <div className="bg-white rounded-lg shadow p-6">
              <div className="mb-4">
                <h3 className="text-base font-semibold text-gray-900">Website Testimonials</h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  Published testimonials with parent consent appear on the public HSM website. Promote from student evaluations or add manually.
                </p>
              </div>
              <TestimonialsManager />
            </div>
          )}
        </div>
      )}

      {/* Brand Assets */}
      {section === 'brand' && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-gray-900">Brand Asset Library</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              Central repository for approved logos, colors, taglines, and creative assets. Single source of truth for all brand materials.
            </p>
          </div>
          <BrandAssetLibrary />
        </div>
      )}
    </div>
  );
}
