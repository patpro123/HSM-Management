import React from 'react';

interface AgeBucket {
  key: string;
  label: string;
  range: string;
  dot: string;
  color: string;
  maxDays: number;
}

const LOCATION_TABS = [
  { value: 'all', label: 'All Branches' },
  { value: 'hsm_main', label: 'HSM Main Branch' },
  { value: 'pbel_city', label: 'PBEL City' },
];

interface ProspectListProps {
  prospectList: any[];
  displayedProspects: any[];
  ageFilter: string | null;
  ageBuckets: AgeBucket[];
  getAgeDays: (createdAt: string) => number;
  getAgeBucket: (days: number) => AgeBucket;
  onAgeFilterChange: (key: string | null) => void;
  onSelectProspect: (prospect: any) => void;
  locationFilter: string;
  onLocationFilterChange: (loc: string) => void;
}

const ProspectList: React.FC<ProspectListProps> = ({
  prospectList,
  displayedProspects,
  ageFilter,
  ageBuckets,
  getAgeDays,
  getAgeBucket,
  onAgeFilterChange,
  onSelectProspect,
  locationFilter,
  onLocationFilterChange,
}) => {
  return (
    <>
      {/* Location tabs */}
      <div className="flex gap-2 mb-4 border-b border-slate-200 pb-3">
        {LOCATION_TABS.map(tab => {
          const count = tab.value === 'all'
            ? prospectList.length
            : prospectList.filter(p => (p.metadata?.location || '') === tab.value).length;
          const active = locationFilter === tab.value;
          return (
            <button
              key={tab.value}
              onClick={() => onLocationFilterChange(tab.value)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2 ${
                active
                  ? 'bg-indigo-600 text-white shadow'
                  : 'bg-white border border-slate-200 text-slate-600 hover:border-indigo-400'
              }`}
            >
              {tab.label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${active ? 'bg-white text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Ageing heatmap */}
      {prospectList.length > 0 && (
        <div className="flex flex-wrap gap-3 mb-2">
          {ageBuckets.map(bucket => {
            const count = prospectList.filter(p => getAgeBucket(getAgeDays(p.created_at)).key === bucket.key).length;
            const isActive = ageFilter === bucket.key;
            return (
              <button
                key={bucket.key}
                onClick={() => onAgeFilterChange(isActive ? null : bucket.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 text-sm font-semibold transition ${isActive ? `${bucket.color} border-current shadow` : 'bg-white border-slate-200 text-slate-600 hover:border-slate-400'
                  }`}
              >
                <span>{bucket.dot}</span>
                <span>{bucket.label}</span>
                <span className="text-xs opacity-70">{bucket.range}</span>
                <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs font-bold ${isActive ? 'bg-white bg-opacity-60' : 'bg-slate-100'}`}>{count}</span>
              </button>
            );
          })}
          {ageFilter && (
            <button onClick={() => onAgeFilterChange(null)} className="text-xs text-slate-500 hover:text-slate-700 underline self-center">Clear</button>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {prospectList.length === 0 ? (
          <div className="col-span-full text-center py-20 text-slate-400">
            No prospects yet. They appear when someone signs up for a demo on the landing page.
          </div>
        ) : displayedProspects.length === 0 ? (
          <div className="col-span-full text-center py-12 text-slate-400">No prospects match the current filters.</div>
        ) : (
          displayedProspects.map(p => {
            const initials = (p.name || 'P').split(' ').map((n: string) => n[0]).slice(0, 2).join('');
            const ageDays = getAgeDays(p.created_at);
            const age = getAgeBucket(ageDays);
            return (
              <div
                key={p.id}
                onClick={() => onSelectProspect(p)}
                className={`bg-white rounded-xl p-5 hover:shadow-lg transition-shadow cursor-pointer border-2 ${p.is_active === false ? 'border-slate-200 opacity-60' : 'border-purple-200'}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-purple-500 to-violet-500 text-white flex items-center justify-center font-bold text-base shadow">
                      {initials}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">{p.name}</h3>
                      <p className="text-xs text-slate-500">{p.metadata?.email || p.phone || '—'}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${age.color}`}>{age.dot} {ageDays}d</span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                  <span>{p.metadata?.interested_instrument ? `🎵 ${p.metadata.interested_instrument}` : '🎵 Any'}</span>
                  <span className={`px-2 py-0.5 rounded-full font-semibold ${age.color}`}>{age.label}</span>
                </div>
                {p.metadata?.location && (
                  <div className="text-xs text-slate-400">
                    📍 {p.metadata.location === 'hsm_main' ? 'HSM Main Branch' : p.metadata.location === 'pbel_city' ? 'PBEL City' : p.metadata.location}
                  </div>
                )}
                {p.is_active === false && <p className="text-xs text-red-500 mt-2 font-semibold">Inactive</p>}
              </div>
            );
          })
        )}
      </div>
    </>
  );
};

export default ProspectList;
