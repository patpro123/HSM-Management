import React, { useState } from 'react';
import { apiPut } from '../../api';

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

const standardSlots = [
  '09:00 AM', '09:45 AM', '10:30 AM', '11:15 AM', '12:00 PM', '12:45 PM',
  '01:30 PM', '02:15 PM', '03:00 PM', '03:45 PM', '04:30 PM', '05:15 PM',
  '06:00 PM', '06:45 PM'
];

interface DemoDayListProps {
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
  demoDayDateFilter: string;
  onDemoDayDateFilterChange: (date: string) => void;
  demoDayDates: string[];
  onUpdateProspect: (updated: any) => void;
  onEnrollProspect: (prospectId: string) => void;
  flashConfig: any;
}

const DemoDayList: React.FC<DemoDayListProps> = ({
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
  demoDayDateFilter,
  onDemoDayDateFilterChange,
  demoDayDates,
  onUpdateProspect,
  onEnrollProspect,
  flashConfig,
}) => {
  const [schedulingId, setSchedulingId] = useState<string | number | null>(null);
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [savingSlot, setSavingSlot] = useState<boolean>(false);

  const formatDemoDate = (dateStr?: string) => {
    if (!dateStr) return 'To be announced';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const handleSaveSlot = async (prospect: any) => {
    if (!selectedTime) {
      alert('Please select a time slot.');
      return;
    }

    setSavingSlot(true);
    try {
      const updatedMetadata = {
        ...(prospect.metadata || {}),
        demo_day_time: selectedTime,
        demo_day_date: prospect.metadata?.demo_day_date || flashConfig?.demo_day_date,
      };

      const data = await apiPut(`/api/prospects/${prospect.id}`, { metadata: updatedMetadata });
      if (data.prospect) {
        onUpdateProspect(data.prospect);
        setSchedulingId(null);
        setSelectedTime('');
      }
    } catch (err) {
      console.error('Error saving slot time:', err);
      alert('Failed to save slot time. Please try again.');
    } finally {
      setSavingSlot(false);
    }
  };

  const getWhatsAppUrl = (phone: string, name: string, date: string, time?: string, location?: string) => {
    let cleanPhone = phone.replace(/[^0-9]/g, '');
    if (cleanPhone.length === 10) {
      cleanPhone = '91' + cleanPhone;
    }

    const campusName = location === 'hsm_main'
      ? 'HSM Kismatpur (Main Branch)'
      : location === 'pbel_city'
      ? 'HSM PBEL City Campus'
      : 'Hyderabad School of Music';

    const fallbackDate = date || flashConfig?.demo_day_date;
    const formattedDate = formatDemoDate(fallbackDate);

    let text = '';
    if (time) {
      text = `Hello ${name}, welcome to Hyderabad School of Music! Your Demo Day session is scheduled for ${formattedDate} at ${time} at our ${campusName}. We look forward to seeing you!`;
    } else {
      text = `Hello ${name}, welcome to Hyderabad School of Music! Thank you for registering for our Demo Day at our ${campusName} on ${formattedDate}. We will confirm your session slot shortly.`;
    }

    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
  };

  return (
    <>
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between mb-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <label className="text-sm font-bold text-slate-700 whitespace-nowrap">📅 Demo Day Date:</label>
          <select
            value={demoDayDateFilter}
            onChange={(e) => onDemoDayDateFilterChange(e.target.value)}
            className="w-full md:w-56 px-3 py-2 rounded-lg border border-slate-300 bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none text-sm font-semibold text-slate-700"
          >
            <option value="all">All Dates ({demoDayDates.length})</option>
            {demoDayDates.map((date) => (
              <option key={date} value={date}>
                {formatDemoDate(date)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          {LOCATION_TABS.map((tab) => {
            const count = tab.value === 'all'
              ? prospectList.filter(p => p.metadata?.demo_type === 'demo_day').length
              : prospectList.filter(p => p.metadata?.demo_type === 'demo_day' && (p.metadata?.location || '') === tab.value).length;
            const active = locationFilter === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => onLocationFilterChange(tab.value)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2 whitespace-nowrap ${
                  active
                    ? 'bg-orange-500 text-white shadow-md'
                    : 'bg-white border border-slate-200 text-slate-600 hover:border-orange-400'
                }`}
              >
                {tab.label}
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${active ? 'bg-white text-orange-600' : 'bg-slate-100 text-slate-500'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {prospectList.filter(p => p.metadata?.demo_type === 'demo_day').length > 0 && (
        <div className="flex flex-wrap gap-3 mb-6">
          {ageBuckets.map((bucket) => {
            const count = prospectList.filter(
              (p) => p.metadata?.demo_type === 'demo_day' && getAgeBucket(getAgeDays(p.created_at)).key === bucket.key
            ).length;
            const isActive = ageFilter === bucket.key;
            return (
              <button
                key={bucket.key}
                onClick={() => onAgeFilterChange(isActive ? null : bucket.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 text-sm font-semibold transition ${
                  isActive ? `${bucket.color} border-current shadow` : 'bg-white border-slate-200 text-slate-600 hover:border-slate-400'
                }`}
              >
                <span>{bucket.dot}</span>
                <span>{bucket.label}</span>
                <span className="text-xs opacity-70">{bucket.range}</span>
                <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs font-bold ${isActive ? 'bg-white bg-opacity-60' : 'bg-slate-100'}`}>
                  {count}
                </span>
              </button>
            );
          })}
          {ageFilter && (
            <button onClick={() => onAgeFilterChange(null)} className="text-xs text-slate-500 hover:text-slate-700 underline self-center">
              Clear
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {prospectList.filter(p => p.metadata?.demo_type === 'demo_day').length === 0 ? (
          <div className="col-span-full text-center py-20 text-slate-400">
            No Demo Day registrations yet. They will appear here when prospects register at the Demo Day page.
          </div>
        ) : displayedProspects.length === 0 ? (
          <div className="col-span-full text-center py-12 text-slate-400">
            No Demo Day registrations match the current filters.
          </div>
        ) : (
          displayedProspects.map((p) => {
            const initials = (p.name || 'P').split(' ').map((n: string) => n[0]).slice(0, 2).join('');
            const ageDays = getAgeDays(p.created_at);
            const age = getAgeBucket(ageDays);
            const isScheduling = schedulingId === p.id;
            const prospectDate = p.metadata?.demo_day_date || flashConfig?.demo_day_date;

            const bookedSlots = prospectList.filter(other =>
              other.id !== p.id &&
              other.metadata?.demo_type === 'demo_day' &&
              (other.metadata?.demo_day_date || flashConfig?.demo_day_date) === prospectDate &&
              other.metadata?.demo_day_time
            );

            return (
              <div
                key={p.id}
                className={`bg-white rounded-xl p-5 hover:shadow-lg transition-shadow border-2 relative flex flex-col justify-between ${
                  p.is_active === false ? 'border-slate-200 opacity-60' : 'border-amber-200'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => onSelectProspect(p)}>
                      <div className="w-11 h-11 rounded-full bg-gradient-to-br from-orange-400 to-amber-500 text-white flex items-center justify-center font-bold text-base shadow">
                        {initials}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm hover:underline">{p.name}</h3>
                        <p className="text-xs text-slate-500">{p.metadata?.email || 'No email'}</p>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${age.color}`}>
                      {age.dot} {ageDays}d
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                    <span>{p.metadata?.interested_instrument ? `🎵 ${p.metadata.interested_instrument}` : '🎵 Any'}</span>
                    <span className={`px-2 py-0.5 rounded-full font-semibold ${age.color}`}>
                      {age.label}
                    </span>
                  </div>

                  {p.metadata?.location && (
                    <div className="text-xs text-slate-400 mb-3">
                      📍 {p.metadata.location === 'hsm_main' ? 'HSM Main Branch (Kismatpur)' : p.metadata.location === 'pbel_city' ? 'PBEL City' : p.metadata.location}
                    </div>
                  )}

                  <div className="mt-2 pt-2 border-t border-slate-100 flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-semibold">Demo Day Date:</span>
                    <span className="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                      {formatDemoDate(prospectDate)}
                    </span>
                  </div>

                  <div className="mt-2 pb-2 flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-semibold">Scheduled Slot:</span>
                    {p.metadata?.demo_day_time ? (
                      <span className="font-bold text-green-700 bg-green-50 border border-green-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                        ⏰ {p.metadata.demo_day_time}
                      </span>
                    ) : (
                      <span className="font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
                        ⚠️ Not Scheduled
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 space-y-3">
                  {isScheduling ? (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Pick 45-min Slot (max 5 students/slot):</label>
                        <select
                          value={selectedTime}
                          onChange={(e) => setSelectedTime(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:border-orange-500 outline-none font-semibold text-slate-700"
                        >
                          <option value="">-- Select Standard Slot --</option>
                          {standardSlots.map(slot => {
                            const slotCount = bookedSlots.filter(b => b.metadata.demo_day_time === slot).length;
                            const isFull = slotCount >= 5;
                            const sameInstrumentInSlot = bookedSlots.some(b =>
                              b.metadata.demo_day_time === slot &&
                              b.metadata.interested_instrument?.toLowerCase() === p.metadata?.interested_instrument?.toLowerCase()
                            );
                            return (
                              <option key={slot} value={slot} disabled={isFull}>
                                {slot} — {slotCount}/5 students{isFull ? ' 🔴 Full' : sameInstrumentInSlot ? ' ⚠️ Same Instrument' : ''}
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-[11px]">
                        <p className="font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                          <span>📊</span> Slot Occupancy:
                        </p>
                        {bookedSlots.length === 0 ? (
                          <p className="text-slate-400 italic">No slots booked yet on this date.</p>
                        ) : (
                          <div className="max-h-32 overflow-y-auto space-y-1.5">
                            {standardSlots
                              .filter(slot => bookedSlots.some(b => b.metadata.demo_day_time === slot))
                              .map(slot => {
                                const studentsInSlot = bookedSlots.filter(b => b.metadata.demo_day_time === slot);
                                const isFull = studentsInSlot.length >= 5;
                                return (
                                  <div key={slot} className="bg-white p-1.5 rounded border border-slate-100">
                                    <div className="flex justify-between items-center mb-0.5">
                                      <span className="font-bold text-slate-700">{slot}</span>
                                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${isFull ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                        {studentsInSlot.length}/5 {isFull ? '🔴' : '🟢'}
                                      </span>
                                    </div>
                                    <div className="text-slate-500 space-y-0.5">
                                      {studentsInSlot.map(b => (
                                        <div key={b.id} className="flex gap-1">
                                          <span>•</span>
                                          <span>{b.name}</span>
                                          {b.metadata?.interested_instrument && (
                                            <span className="text-slate-400">({b.metadata.interested_instrument})</span>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })
                            }
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSaveSlot(p)}
                          disabled={savingSlot}
                          className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold transition disabled:bg-slate-400"
                        >
                          {savingSlot ? 'Saving...' : 'Save Slot'}
                        </button>
                        <button
                          onClick={() => {
                            setSchedulingId(null);
                            setSelectedTime('');
                          }}
                          className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold transition"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setSchedulingId(p.id);
                            setSelectedTime(p.metadata?.demo_day_time || '');
                          }}
                          className="flex-1 py-2 border border-orange-200 text-orange-600 hover:bg-orange-50 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1"
                        >
                          🗓️ {p.metadata?.demo_day_time ? 'Change Slot' : 'Allocate Slot'}
                        </button>

                        <a
                          href={getWhatsAppUrl(
                            p.phone,
                            p.name,
                            p.metadata?.demo_day_date,
                            p.metadata?.demo_day_time,
                            p.metadata?.location
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1"
                          title="Send Welcome Message via WhatsApp"
                        >
                          💬 WhatsApp
                        </a>
                      </div>

                      <button
                        onClick={() => onEnrollProspect(p.id)}
                        className="w-full py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-lg text-xs font-extrabold shadow-sm transition flex items-center justify-center gap-1.5"
                      >
                        🎓 Direct Enroll Student
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
};

export default DemoDayList;
