import { useState, useEffect } from 'react';
import { apiGet } from '../../api';
import type { MarketingFunnelStage, LeadSource } from '../../types';

const STAGE_LABELS: Record<string, string> = {
  intentful_user: 'Soft Leads',
  prospect:       'Prospects',
  demo_day:       'Demo Booked',
  permanent:      'Enrolled',
};

const STAGE_COLORS: Record<string, string> = {
  intentful_user: 'bg-purple-100 text-purple-800 border-purple-200',
  prospect:       'bg-blue-100 text-blue-800 border-blue-200',
  demo_day:       'bg-yellow-100 text-yellow-800 border-yellow-200',
  permanent:      'bg-green-100 text-green-800 border-green-200',
};

const STAGE_ICONS: Record<string, string> = {
  intentful_user: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z',
  prospect:       'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
  demo_day:       'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  permanent:      'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
};

export default function FunnelWidget() {
  const [stages, setStages] = useState<MarketingFunnelStage[]>([]);
  const [sources, setSources] = useState<LeadSource[]>([]);
  const [referralCount, setReferralCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [funnelData, sourceData] = await Promise.all([
          apiGet('/api/marketing/funnel'),
          apiGet('/api/marketing/lead-sources'),
        ]);
        setStages(funnelData.funnel || []);
        setReferralCount(funnelData.referral_count || 0);
        setSources(sourceData.sources || []);
      } catch {
        setError('Failed to load funnel data');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <div className="text-gray-400 text-sm py-4">Loading funnel...</div>;
  if (error) return <div className="text-red-500 text-sm py-4">{error}</div>;

  const stageOrder = ['intentful_user', 'prospect', 'demo_day', 'permanent'];
  const sortedStages = stageOrder.map(s => stages.find(r => r.stage === s)).filter(Boolean) as MarketingFunnelStage[];
  const topCount = parseInt(sortedStages[0]?.count || '1', 10) || 1;

  return (
    <div className="space-y-6">
      {/* Funnel stages */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Lead Funnel</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {sortedStages.map((stage, idx) => {
            const count = parseInt(stage.count, 10);
            const pct = Math.round((count / topCount) * 100);
            const colorClass = STAGE_COLORS[stage.stage] || 'bg-gray-100 text-gray-800 border-gray-200';
            const icon = STAGE_ICONS[stage.stage];
            return (
              <div key={stage.stage} className={`border rounded-lg p-4 ${colorClass}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium">{STAGE_LABELS[stage.stage] || stage.stage}</span>
                  {idx > 0 && (
                    <span className="text-xs opacity-60">{pct}%</span>
                  )}
                </div>
                <div className="text-2xl font-bold">{count}</div>
                <div className="text-xs opacity-70 mt-1">active: {stage.active_count}</div>
                {icon && (
                  <svg className="w-4 h-4 mt-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
                  </svg>
                )}
              </div>
            );
          })}
        </div>
        {referralCount > 0 && (
          <p className="text-xs text-gray-500 mt-2">{referralCount} lead{referralCount !== 1 ? 's' : ''} came via referral</p>
        )}
      </div>

      {/* Lead sources */}
      {sources.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Lead Sources</h3>
          <div className="bg-gray-50 rounded-lg divide-y divide-gray-200">
            {sources.slice(0, 8).map((src, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-900 capitalize">{src.source}</span>
                  {src.medium && src.medium !== 'unknown' && (
                    <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full capitalize">{src.medium}</span>
                  )}
                </div>
                <span className="text-sm font-semibold text-gray-700">{src.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
