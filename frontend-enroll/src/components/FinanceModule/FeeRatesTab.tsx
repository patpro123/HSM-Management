import React, { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost } from '../../api';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Branch {
  id: string;
  name: string;
  code: string;
}

interface FeeRow {
  id: string;
  instrument_id: string;
  instrument_name: string;
  trinity_grade: string;
  classes_count: number;
  fee_amount: number;
  is_trial: boolean;
  effective_from: string;
}

// Grouped structure for display: instrument → grade → { monthly, quarterly, trial }
interface InstrumentFees {
  instrument_id: string;
  instrument_name: string;
  isVocal: boolean;    // Carnatic Vocals / Hindustani Vocals — single rate (Fixed grade)
  isViolin: boolean;   // Violin — monthly only
  isPbel: boolean;     // Pbel branch — different class counts
  trialFee: number;
  grades: GradeFee[];
  // Pbel uses 4-class and 8-class instead of monthly/quarterly
  pbel4: number;
  pbel8: number;
}

interface GradeFee {
  grade: string;
  monthly: number;    // 8 classes
  quarterly: number;  // 24 classes (0 if not offered)
}

const TRINITY_GRADES = [
  'Initial', 'Grade 1', 'Grade 2', 'Grade 3',
  'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8',
];

const VOCAL_INSTRUMENTS = ['Hindustani Vocals', 'Carnatic Vocals'];
const VIOLIN_INSTRUMENT = 'Violin';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function groupFeeRows(rows: FeeRow[], isPbel: boolean): InstrumentFees[] {
  const map = new Map<string, InstrumentFees>();

  for (const row of rows) {
    if (!map.has(row.instrument_id)) {
      const isVocal = VOCAL_INSTRUMENTS.includes(row.instrument_name);
      const isViolin = row.instrument_name === VIOLIN_INSTRUMENT;
      map.set(row.instrument_id, {
        instrument_id: row.instrument_id,
        instrument_name: row.instrument_name,
        isVocal,
        isViolin,
        isPbel,
        trialFee: 0,
        grades: TRINITY_GRADES.map(g => ({ grade: g, monthly: 0, quarterly: 0 })),
        pbel4: 0,
        pbel8: 0,
      });
    }
    const inst = map.get(row.instrument_id)!;

    if (row.is_trial) {
      inst.trialFee = row.fee_amount;
      continue;
    }

    if (isPbel) {
      if (row.classes_count === 4) inst.pbel4 = row.fee_amount;
      if (row.classes_count === 8) inst.pbel8 = row.fee_amount;
      continue;
    }

    if (row.trinity_grade === 'Fixed') {
      // Vocal: store as the first grade slot for display
      if (row.classes_count === 8) inst.grades[0].monthly = row.fee_amount;
      if (row.classes_count === 24) inst.grades[0].quarterly = row.fee_amount;
      continue;
    }

    const gradeIdx = TRINITY_GRADES.indexOf(row.trinity_grade);
    if (gradeIdx === -1) continue;
    if (row.classes_count === 8) inst.grades[gradeIdx].monthly = row.fee_amount;
    if (row.classes_count === 24) inst.grades[gradeIdx].quarterly = row.fee_amount;
  }

  return Array.from(map.values()).sort((a, b) =>
    a.instrument_name.localeCompare(b.instrument_name)
  );
}

// Build flat rate array for bulk save
function flattenEdits(
  edits: EditState,
  instrumentFees: InstrumentFees[],
  _branchId: string,
  _effectiveFrom: string,
  isPbel: boolean
): object[] {
  const rates: object[] = [];

  for (const inst of instrumentFees) {
    const instEdits = edits[inst.instrument_id] || {};

    // Trial
    const trialVal = instEdits['trial'] !== undefined ? instEdits['trial'] : inst.trialFee;
    rates.push({
      instrument_id: inst.instrument_id,
      trinity_grade: 'Initial',
      classes_count: 4,
      fee_amount: trialVal,
      is_trial: true,
    });

    if (isPbel) {
      rates.push({
        instrument_id: inst.instrument_id,
        trinity_grade: 'Fixed',
        classes_count: 4,
        fee_amount: instEdits['pbel4'] !== undefined ? instEdits['pbel4'] : inst.pbel4,
        is_trial: false,
      });
      rates.push({
        instrument_id: inst.instrument_id,
        trinity_grade: 'Fixed',
        classes_count: 8,
        fee_amount: instEdits['pbel8'] !== undefined ? instEdits['pbel8'] : inst.pbel8,
        is_trial: false,
      });
      continue;
    }

    if (inst.isVocal) {
      const monthly = instEdits['Fixed_8'] !== undefined ? instEdits['Fixed_8'] : inst.grades[0].monthly;
      rates.push({
        instrument_id: inst.instrument_id,
        trinity_grade: 'Fixed',
        classes_count: 8,
        fee_amount: monthly,
        is_trial: false,
      });
      continue;
    }

    for (let i = 0; i < TRINITY_GRADES.length; i++) {
      const grade = TRINITY_GRADES[i];
      const monthlyKey = `${grade}_8`;
      const quarterlyKey = `${grade}_24`;
      const monthly = instEdits[monthlyKey] !== undefined ? instEdits[monthlyKey] : inst.grades[i].monthly;
      const quarterly = instEdits[quarterlyKey] !== undefined ? instEdits[quarterlyKey] : inst.grades[i].quarterly;

      rates.push({ instrument_id: inst.instrument_id, trinity_grade: grade, classes_count: 8, fee_amount: monthly, is_trial: false });
      if (!inst.isViolin) {
        rates.push({ instrument_id: inst.instrument_id, trinity_grade: grade, classes_count: 24, fee_amount: quarterly, is_trial: false });
      }
    }
  }

  return rates;
}

// ─── Edit State ───────────────────────────────────────────────────────────────
// { [instrumentId]: { [fieldKey]: number } }
// fieldKey examples: 'trial', 'Fixed_8', 'Grade 1_8', 'Grade 1_24', 'pbel4', 'pbel8'
type EditState = Record<string, Record<string, number>>;

// ─── Sub-components ──────────────────────────────────────────────────────────

interface InstrumentCardProps {
  inst: InstrumentFees;
  edits: Record<string, number>;
  editing: boolean;
  isPast: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  onChange: (field: string, value: number) => void;
  saving: boolean;
}

function fmt(v: number) { return v ? `₹${v.toLocaleString()}` : '—'; }

function InstrumentCard({ inst, edits, editing, isPast, onEdit, onCancel, onSave, onChange, saving }: InstrumentCardProps) {
  function val(key: string, fallback: number) {
    return edits[key] !== undefined ? edits[key] : fallback;
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-b border-slate-200">
        <h3 className="font-semibold text-slate-800">{inst.instrument_name}</h3>
        {!isPast && (
          editing ? (
            <div className="flex gap-2">
              <button onClick={onCancel} className="text-sm px-3 py-1 rounded border border-slate-300 text-slate-600 hover:bg-slate-100">Cancel</button>
              <button onClick={onSave} disabled={saving} className="text-sm px-3 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          ) : (
            <button onClick={onEdit} className="text-sm px-3 py-1 rounded border border-indigo-300 text-indigo-600 hover:bg-indigo-50">Edit</button>
          )
        )}
      </div>

      <div className="p-5 space-y-4">
        {/* Trial rate */}
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-slate-600 w-40">Trial (2-week flat)</span>
          {editing ? (
            <input
              type="number"
              value={val('trial', inst.trialFee)}
              onChange={e => onChange('trial', parseFloat(e.target.value) || 0)}
              className="w-32 border border-slate-300 rounded px-2 py-1 text-sm"
            />
          ) : (
            <span className="text-sm text-slate-800">{fmt(inst.trialFee)}</span>
          )}
        </div>

        {/* Pbel: 4-class + 8-class */}
        {inst.isPbel ? (
          <div className="overflow-x-auto -mx-5 px-5">
          <table className="w-full text-sm min-w-[220px]">
            <thead>
              <tr className="text-slate-500 text-xs uppercase">
                <th className="text-left py-1 font-medium">Package</th>
                <th className="text-right py-1 font-medium w-32">Fee</th>
              </tr>
            </thead>
            <tbody>
              {[{ label: '4 Classes', key: 'pbel4', val: inst.pbel4 }, { label: '8 Classes', key: 'pbel8', val: inst.pbel8 }].map(pkg => (
                <tr key={pkg.key} className="border-t border-slate-100">
                  <td className="py-1.5 text-slate-700">{pkg.label}</td>
                  <td className="py-1.5 text-right">
                    {editing ? (
                      <input type="number" value={val(pkg.key, pkg.val)} onChange={e => onChange(pkg.key, parseFloat(e.target.value) || 0)}
                        className="w-28 border border-slate-300 rounded px-2 py-0.5 text-sm text-right" />
                    ) : (
                      <span className="text-slate-800">{fmt(pkg.val)}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        ) : inst.isVocal ? (
          /* Vocal: single monthly rate */
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-slate-600 w-40">Monthly (8 classes)</span>
            {editing ? (
              <input type="number" value={val('Fixed_8', inst.grades[0].monthly)}
                onChange={e => onChange('Fixed_8', parseFloat(e.target.value) || 0)}
                className="w-32 border border-slate-300 rounded px-2 py-1 text-sm" />
            ) : (
              <span className="text-sm text-slate-800">{fmt(inst.grades[0].monthly)}</span>
            )}
          </div>
        ) : (
          /* Standard: grade × monthly/quarterly table — scrollable on mobile */
          <div className="overflow-x-auto -mx-5 px-5">
          <table className="w-full text-sm min-w-[280px]">
            <thead>
              <tr className="text-slate-500 text-xs uppercase">
                <th className="text-left py-1 font-medium">Grade</th>
                <th className="text-right py-1 font-medium w-32">Monthly (8)</th>
                {!inst.isViolin && <th className="text-right py-1 font-medium w-32">Quarterly (24)</th>}
              </tr>
            </thead>
            <tbody>
              {inst.grades.map((g, i) => (
                <tr key={g.grade} className={`border-t border-slate-100 ${i % 2 === 0 ? '' : 'bg-slate-50'}`}>
                  <td className="py-1.5 text-slate-700">{g.grade}</td>
                  <td className="py-1.5 text-right">
                    {editing ? (
                      <input type="number" value={val(`${g.grade}_8`, g.monthly)}
                        onChange={e => onChange(`${g.grade}_8`, parseFloat(e.target.value) || 0)}
                        className="w-28 border border-slate-300 rounded px-2 py-0.5 text-sm text-right" />
                    ) : (
                      <span className="text-slate-800">{fmt(g.monthly)}</span>
                    )}
                  </td>
                  {!inst.isViolin && (
                    <td className="py-1.5 text-right">
                      {editing ? (
                        <input type="number" value={val(`${g.grade}_24`, g.quarterly)}
                          onChange={e => onChange(`${g.grade}_24`, parseFloat(e.target.value) || 0)}
                          className="w-28 border border-slate-300 rounded px-2 py-0.5 text-sm text-right" />
                      ) : (
                        <span className="text-slate-800">{fmt(g.quarterly)}</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

const FeeRatesTab: React.FC = () => {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [years, setYears] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [instrumentFees, setInstrumentFees] = useState<InstrumentFees[]>([]);
  const [loading, setLoading] = useState(false);

  // editingInstrument: which instrument card is open for editing
  const [editingInstrument, setEditingInstrument] = useState<string | null>(null);
  // edits: staged changes before save, keyed by instrumentId
  const [edits, setEdits] = useState<EditState>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New revision modal
  const [showNewRevision, setShowNewRevision] = useState(false);
  const [newEffectiveDate, setNewEffectiveDate] = useState('');

  const currentYear = new Date().getFullYear();

  // Load branches on mount
  useEffect(() => {
    apiGet('/api/fee-structures/branches')
      .then(data => {
        setBranches(data.branches || []);
        if (data.branches?.length > 0) setSelectedBranch(data.branches[0]);
      })
      .catch(() => setError('Failed to load branches'));
  }, []);

  // Load years when branch changes
  useEffect(() => {
    if (!selectedBranch) return;
    apiGet(`/api/fee-structures/years?branch_id=${selectedBranch.id}`)
      .then(data => {
        const yr: number[] = data.years || [];
        // Always include current year even if no data yet
        if (!yr.includes(currentYear)) yr.unshift(currentYear);
        setYears(yr);
        setSelectedYear(yr[0] ?? currentYear);
      })
      .catch(() => {});
  }, [selectedBranch]);

  // Load fee rows when branch or year changes
  const loadFees = useCallback(() => {
    if (!selectedBranch) return;
    setLoading(true);
    setEditingInstrument(null);
    setEdits({});
    apiGet(`/api/fee-structures?branch_id=${selectedBranch.id}&year=${selectedYear}`)
      .then(data => {
        const rows: FeeRow[] = data.fee_structures || [];
        setInstrumentFees(groupFeeRows(rows, selectedBranch.code === 'pbel'));
      })
      .catch(() => setError('Failed to load fee rates'))
      .finally(() => setLoading(false));
  }, [selectedBranch, selectedYear]);

  useEffect(() => { loadFees(); }, [loadFees]);

  const isPastYear = selectedYear < currentYear;

  function handleChange(instrumentId: string, field: string, value: number) {
    setEdits(prev => ({
      ...prev,
      [instrumentId]: { ...(prev[instrumentId] || {}), [field]: value },
    }));
  }

  async function handleSave(inst: InstrumentFees) {
    if (!selectedBranch) return;
    setSaving(true);
    setError(null);
    try {
      const effectiveFrom = `${selectedYear}-01-01`;
      const rates = flattenEdits(
        { [inst.instrument_id]: edits[inst.instrument_id] || {} },
        [inst],
        selectedBranch.id,
        effectiveFrom,
        selectedBranch.code === 'pbel'
      );
      await apiPost('/api/fee-structures/bulk', {
        branch_id: selectedBranch.id,
        effective_from: effectiveFrom,
        rates,
      });
      setEditingInstrument(null);
      setEdits(prev => { const { [inst.instrument_id]: _, ...rest } = prev; return rest; });
      loadFees();
    } catch {
      setError('Failed to save rates. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleNewRevision() {
    if (!selectedBranch || !newEffectiveDate) return;
    setSaving(true);
    setError(null);
    try {
      // Collect all current edits across all instruments
      const rates = flattenEdits(
        edits,
        instrumentFees,
        selectedBranch.id,
        newEffectiveDate,
        selectedBranch.code === 'pbel'
      );
      await apiPost('/api/fee-structures/bulk', {
        branch_id: selectedBranch.id,
        effective_from: newEffectiveDate,
        rates,
      });
      setShowNewRevision(false);
      setNewEffectiveDate('');
      setEdits({});
      // Switch to the new year
      const newYear = parseInt(newEffectiveDate.slice(0, 4));
      setSelectedYear(newYear);
    } catch {
      setError('Failed to create new revision.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Branch + Year selectors */}
      <div className="flex flex-col gap-3">
        {/* Row 1: Branch toggle + New revision button */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex bg-slate-100 p-1 rounded-lg">
            {branches.map(b => (
              <button
                key={b.id}
                onClick={() => setSelectedBranch(b)}
                className={`px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap transition ${
                  selectedBranch?.id === b.id
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {b.name}
              </button>
            ))}
          </div>

          {!isPastYear && (
            <button
              onClick={() => setShowNewRevision(true)}
              className="ml-auto flex items-center gap-1 px-3 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 whitespace-nowrap"
            >
              + New Revision
            </button>
          )}
        </div>

        {/* Row 2: Year pills — scrollable on mobile */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-500 shrink-0">Year:</span>
          <div className="overflow-x-auto flex gap-1 pb-0.5">
            {years.map(y => (
              <button
                key={y}
                onClick={() => setSelectedYear(y)}
                className={`px-3 py-1 rounded-full text-sm font-medium whitespace-nowrap transition ${
                  selectedYear === y
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {y}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Past year notice */}
      {isPastYear && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
          <span>Viewing historical rates for {selectedYear}. Switch to {currentYear} to edit.</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* New Revision Modal */}
      {showNewRevision && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-80 space-y-4">
            <h3 className="font-semibold text-slate-900">New Rate Revision</h3>
            <p className="text-sm text-slate-600">
              All current rates will be copied to the new revision. You can then edit individual instruments.
            </p>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Effective From</label>
              <input
                type="date"
                value={newEffectiveDate}
                onChange={e => setNewEffectiveDate(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowNewRevision(false)} className="px-4 py-2 text-sm border border-slate-300 rounded-lg text-slate-600">Cancel</button>
              <button onClick={handleNewRevision} disabled={!newEffectiveDate || saving}
                className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                {saving ? 'Creating…' : 'Create Revision'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Instrument cards */}
      {loading ? (
        <div className="text-center py-12 text-slate-500">Loading fee rates…</div>
      ) : instrumentFees.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          No fee rates configured for {selectedBranch?.name} in {selectedYear}.
          {!isPastYear && ' Use "New Rate Revision" to set rates.'}
        </div>
      ) : (
        <div className="grid gap-4">
          {instrumentFees.map(inst => (
            <InstrumentCard
              key={inst.instrument_id}
              inst={inst}
              edits={edits[inst.instrument_id] || {}}
              editing={editingInstrument === inst.instrument_id}
              isPast={isPastYear}
              onEdit={() => setEditingInstrument(inst.instrument_id)}
              onCancel={() => {
                setEditingInstrument(null);
                setEdits(prev => { const { [inst.instrument_id]: _, ...rest } = prev; return rest; });
              }}
              onSave={() => handleSave(inst)}
              onChange={(field, value) => handleChange(inst.instrument_id, field, value)}
              saving={saving}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default FeeRatesTab;
