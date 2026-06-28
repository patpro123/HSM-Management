import { useState } from 'react';
import FunnelWidget from './FunnelWidget';
import OverdueProspects from './OverdueProspects';
import TestimonialsManager from './TestimonialsManager';
import BrandAssetLibrary from './BrandAssetLibrary';

type Section = 'overview' | 'testimonials' | 'brand';

const NAV: { key: Section; label: string; icon: string }[] = [
  {
    key: 'overview',
    label: 'Funnel & Leads',
    icon: 'M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12',
  },
  {
    key: 'testimonials',
    label: 'Testimonials',
    icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z',
  },
  {
    key: 'brand',
    label: 'Brand Assets',
    icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z',
  },
];

export default function MarketingDashboard() {
  const [section, setSection] = useState<Section>('overview');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Marketing</h2>
          <p className="text-sm text-gray-500 mt-0.5">Brand building, lead pipeline, and social proof</p>
        </div>
        <span className="text-xs bg-orange-100 text-orange-700 border border-orange-200 px-3 py-1 rounded-full font-medium">
          P0 — Measure First
        </span>
      </div>

      {/* Section nav */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {NAV.map(item => (
          <button
            key={item.key}
            onClick={() => setSection(item.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded text-sm font-medium transition-colors ${
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

      {/* Section content */}
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

      {section === 'testimonials' && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-gray-900">Student Testimonials</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              Promote high-rating evaluations to consented testimonials. Publish to the landing page once consent is obtained.
            </p>
          </div>
          <TestimonialsManager />
        </div>
      )}

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
