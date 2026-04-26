import React, { useState, useEffect, useCallback } from 'react';
import { pdf, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { apiGet, apiPost, apiDelete } from '../../api';
import {
  Teacher, TeacherPayslip,
  InstrumentGradeRate, TeacherGradeRateOverride,
  TRINITY_GRADES, TrinityGrade
} from './types';

// ── Helpers ───────────────────────────────────────────────────────────────────

const VOCAL_KEYWORDS = ['hindustani vocals', 'carnatic vocals'];

function isVocalInstrument(name: string) {
  return VOCAL_KEYWORDS.includes(name.toLowerCase());
}

function fmt(val: number) {
  return `₹${Math.round(val).toLocaleString('en-IN')}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatPeriod(start: string, end: string) {
  return `${formatDate(start)} – ${formatDate(end)}`;
}

// ── PDF Document ──────────────────────────────────────────────────────────────

const pdfStyles = StyleSheet.create({
  page:       { padding: 36, fontFamily: 'Helvetica', fontSize: 9, color: '#1e293b' },
  header:     { marginBottom: 16 },
  title:      { fontSize: 16, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  subtitle:   { fontSize: 10, color: '#64748b' },
  section:    { marginTop: 14, marginBottom: 6 },
  sectionHdr: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#4f46e5',
                borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingBottom: 3, marginBottom: 6 },
  row:        { flexDirection: 'row', marginBottom: 3 },
  cell:       { flex: 1, paddingHorizontal: 4, paddingVertical: 3, fontSize: 8 },
  cellBold:   { flex: 1, paddingHorizontal: 4, paddingVertical: 3, fontSize: 8,
                fontFamily: 'Helvetica-Bold' },
  tableHead:  { flexDirection: 'row', backgroundColor: '#f1f5f9', marginBottom: 2,
                borderRadius: 2 },
  badge:      { fontSize: 7, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3 },
  divider:    { borderBottomWidth: 1, borderBottomColor: '#e2e8f0', marginVertical: 8 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  total:      { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#4f46e5',
                flexDirection: 'row', justifyContent: 'space-between', marginTop: 6,
                paddingTop: 6, borderTopWidth: 1, borderTopColor: '#6366f1' },
  tcItem:     { marginBottom: 4, lineHeight: 1.5 },
  batchName:  { fontSize: 9, fontFamily: 'Helvetica-Bold', marginBottom: 4, color: '#334155' },
  deferred:   { color: '#d97706' },
  excluded:   { color: '#94a3b8' },
});

const PayslipPDF: React.FC<{ data: TeacherPayslip }> = ({ data }) => {
  const { teacher, period, instruments, summary } = data;
  const allDeferred = instruments.flatMap(inst => inst.students.filter(s => s.status === 'deferred'));

  return (
    <Document title={`Payslip - ${teacher.name} - ${period.month}`}>
      <Page size="A4" style={pdfStyles.page}>

        {/* Header */}
        <View style={pdfStyles.header}>
          <Text style={pdfStyles.title}>Hyderabad School of Music</Text>
          <Text style={pdfStyles.subtitle}>Teacher Payslip</Text>
          <Text style={[pdfStyles.subtitle, { marginTop: 6 }]}>
            {teacher.name}  |  {formatPeriod(period.start, period.end)}  |  {teacher.payout_type === 'fixed' ? 'Fixed Salary' : 'Per Student'}
          </Text>
          {teacher.phone && <Text style={pdfStyles.subtitle}>Phone: {teacher.phone}</Text>}
        </View>

        <View style={pdfStyles.divider} />

        {/* Summary — at top */}
        <View style={pdfStyles.section}>
          <Text style={pdfStyles.sectionHdr}>Salary Summary</Text>
          {teacher.payout_type === 'fixed' ? (
            <View style={pdfStyles.summaryRow}>
              <Text>Fixed Monthly Salary</Text>
              <Text style={{ fontFamily: 'Helvetica-Bold' }}>{fmt(summary.fixed_salary!)}</Text>
            </View>
          ) : (
            instruments.map(inst => inst.billable_count > 0 && (
              <View key={inst.instrument_id} style={pdfStyles.summaryRow}>
                <Text>{inst.instrument_name} — {inst.billable_count} student{inst.billable_count !== 1 ? 's' : ''}</Text>
                <Text>{fmt(inst.instrument_subtotal)}</Text>
              </View>
            ))
          )}
          <View style={pdfStyles.total}>
            <Text>Total Payable</Text>
            <Text>{fmt(summary.total_payable)}</Text>
          </View>
        </View>

        <View style={pdfStyles.divider} />

        {/* Per-instrument sections */}
        {instruments.map(inst => (
          <View key={inst.instrument_id} style={pdfStyles.section}>
            <Text style={pdfStyles.sectionHdr}>{inst.instrument_name}</Text>

            {/* Attendance summary */}
            {(() => {
              const conducted = inst.batches.reduce((s, b) => s + b.attendance.conducted, 0);
              const missed = inst.batches.reduce((s, b) => s + b.attendance.not_conducted, 0);
              return (
                <View style={[pdfStyles.row, { marginBottom: 6 }]}>
                  <Text style={pdfStyles.cellBold}>Batches Conducted: </Text>
                  <Text style={pdfStyles.cell}>{conducted}</Text>
                  <Text style={pdfStyles.cellBold}>Batches Missed: </Text>
                  <Text style={pdfStyles.cell}>{missed}</Text>
                </View>
              );
            })()}

            {/* Students */}
            {inst.students.length > 0 && (
              <>
                <Text style={[pdfStyles.batchName, { marginTop: 8 }]}>Students</Text>
                <View style={pdfStyles.tableHead}>
                  <Text style={pdfStyles.cellBold}>Name</Text>
                  {!inst.is_vocal && <Text style={pdfStyles.cellBold}>Grade</Text>}
                  <Text style={pdfStyles.cellBold}>Classes</Text>
                  {teacher.payout_type === 'per_student_monthly' && (
                    <>
                      <Text style={pdfStyles.cellBold}>Fee (R)</Text>
                      <Text style={pdfStyles.cellBold}>Teacher Rate</Text>
                      <Text style={pdfStyles.cellBold}>Subtotal</Text>
                    </>
                  )}
                  <Text style={pdfStyles.cellBold}>Status</Text>
                </View>
                {inst.students.map(s => (
                  <View key={s.student_id} style={pdfStyles.row}>
                    <Text style={pdfStyles.cell}>{s.student_name}</Text>
                    {!inst.is_vocal && <Text style={pdfStyles.cell}>{s.trinity_grade}</Text>}
                    <Text style={pdfStyles.cell}>{s.classes_attended}</Text>
                    {teacher.payout_type === 'per_student_monthly' && (
                      <>
                        <Text style={pdfStyles.cell}>{s.status === 'billable' ? fmt(s.package_monthly_rate) : '—'}</Text>
                        <Text style={pdfStyles.cell}>{s.status === 'billable' ? fmt(s.rate) : '—'}</Text>
                        <Text style={pdfStyles.cell}>{s.status === 'billable' ? fmt(s.subtotal) : '—'}</Text>
                      </>
                    )}
                    <Text style={[pdfStyles.cell, s.status === 'deferred' ? pdfStyles.deferred : s.status === 'excluded' ? pdfStyles.excluded : {}]}>
                      {s.status === 'billable' ? 'Billable' : s.status === 'deferred' ? 'Deferred*' : 'Excluded†'}
                    </Text>
                  </View>
                ))}
                {teacher.payout_type === 'per_student_monthly' && inst.billable_count > 0 && (
                  <View style={[pdfStyles.row, { marginTop: 4 }]}>
                    <Text style={pdfStyles.cell} />
                    {!inst.is_vocal && <Text style={pdfStyles.cell} />}
                    <Text style={pdfStyles.cell} />
                    <Text style={pdfStyles.cell} />
                    <Text style={pdfStyles.cell} />
                    <Text style={pdfStyles.cellBold}>{fmt(inst.instrument_subtotal)}</Text>
                    <Text style={pdfStyles.cell} />
                  </View>
                )}
              </>
            )}
          </View>
        ))}

        <View style={pdfStyles.divider} />

        {/* Deferred students */}
        {allDeferred.length > 0 && (
          <View style={pdfStyles.section}>
            <Text style={pdfStyles.sectionHdr}>Deferred to Next Month *</Text>
            {allDeferred.map(s => (
              <Text key={s.student_id} style={[pdfStyles.tcItem, pdfStyles.deferred]}>
                {s.student_name}  ·  {s.instrument_name}  ·  Enrolled {formatDate(s.enrollment_date)}
              </Text>
            ))}
          </View>
        )}

        {/* T&C */}
        <View style={pdfStyles.section}>
          <Text style={pdfStyles.sectionHdr}>Terms &amp; Conditions</Text>
          <Text style={pdfStyles.tcItem}>
            * Students enrolled after the 20th of the month will be credited in the following month's salary.
          </Text>
          <Text style={pdfStyles.tcItem}>
            † Only students who have attended more than 1 class in the month are considered for payment.
            {'\n'}The first class is complimentary and does not count towards the teacher's payout.
          </Text>
          <Text style={pdfStyles.tcItem}>
            ‡ Teacher rate per student = (R − ₹1,200) × 0.7, where R is the student's monthly fee
            (quarterly fees divided by 3; trial fees multiplied by 2).
          </Text>
        </View>

      </Page>
    </Document>
  );
};

// ── Rate Config Panel ─────────────────────────────────────────────────────────

interface Instrument { id: string; name: string; }

interface RateConfigPanelProps {
  instruments: Instrument[];
  teachers: Teacher[];
}

const RateConfigPanel: React.FC<RateConfigPanelProps> = ({ instruments, teachers }) => {
  const [rates, setRates] = useState<InstrumentGradeRate[]>([]);
  const [overrideTeacherId, setOverrideTeacherId] = useState('');
  const [overrides, setOverrides] = useState<TeacherGradeRateOverride[]>([]);
  const [saving, setSaving] = useState(false);
  const [overrideSaving, setOverrideSaving] = useState(false);
  const [localRates, setLocalRates] = useState<Record<string, string>>({});
  const [localOverrideRates, setLocalOverrideRates] = useState<Record<string, string>>({});

  useEffect(() => {
    loadRates();
  }, []);

  useEffect(() => {
    if (overrideTeacherId) {
      setLocalOverrideRates({});
      loadOverrides(overrideTeacherId);
    }
  }, [overrideTeacherId]);

  const loadRates = async () => {
    const data = await apiGet('/api/finance/grade-rates').catch(() => ({ rates: [] }));
    const r: InstrumentGradeRate[] = data.rates || [];
    setRates(r);
    const map: Record<string, string> = {};
    r.forEach(rate => { map[`${rate.instrument_id}-${rate.trinity_grade}`] = String(rate.rate_per_student); });
    setLocalRates(map);
  };

  const loadOverrides = async (teacherId: string) => {
    const data = await apiGet(`/api/finance/grade-rates/overrides/${teacherId}`).catch(() => ({ overrides: [] }));
    const o: TeacherGradeRateOverride[] = data.overrides || [];
    setOverrides(o);
    const map: Record<string, string> = {};
    o.forEach(override => { map[`${override.instrument_id}-${override.trinity_grade}`] = String(override.rate_per_student); });
    setLocalOverrideRates(map);
  };

  const getRateValue = (instrumentId: string, grade: TrinityGrade) => {
    const found = rates.find(r => r.instrument_id === instrumentId && r.trinity_grade === grade);
    return found ? found.rate_per_student : 0;
  };

  const handleSaveRate = async (instrumentId: string, grade: TrinityGrade, value: string) => {
    const rate = parseFloat(value);
    if (isNaN(rate)) return;
    setSaving(true);
    try {
      await apiPost('/api/finance/grade-rates', { instrument_id: instrumentId, trinity_grade: grade, rate_per_student: rate });
      await loadRates();
    } finally {
      setSaving(false);
    }
  };

  const handleSaveOverride = async (instrumentId: string, grade: TrinityGrade, value: string) => {
    if (!overrideTeacherId) return;
    const rate = parseFloat(value);
    if (isNaN(rate) || value.trim() === '') return;
    setOverrideSaving(true);
    try {
      await apiPost(`/api/finance/grade-rates/overrides/${overrideTeacherId}`, {
        instrument_id: instrumentId, trinity_grade: grade, rate_per_student: rate
      });
      await loadOverrides(overrideTeacherId);
    } finally {
      setOverrideSaving(false);
    }
  };

  const handleDeleteOverride = async (overrideId: string) => {
    if (!overrideTeacherId) return;
    await apiDelete(`/api/finance/grade-rates/overrides/${overrideTeacherId}/${overrideId}`);
    await loadOverrides(overrideTeacherId);
  };

  return (
    <div className="space-y-8">
      {/* School-wide rates */}
      <div>
        <h3 className="text-base font-semibold text-slate-800 mb-4">School-Wide Rates per Grade</h3>
        <p className="text-xs text-slate-500 mb-4">
          Vocal instruments (Hindustani Vocals, Carnatic Vocals) have a single fixed rate.
          All others use Trinity grade-based rates.
        </p>
        <div className="space-y-6">
          {instruments.map(inst => {
            const vocal = isVocalInstrument(inst.name);
            return (
              <div key={inst.id} className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
                  <span className="font-semibold text-slate-700 text-sm">{inst.name}</span>
                  {vocal && <span className="ml-2 text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">Fixed rate</span>}
                </div>
                {vocal ? (
                  <div className="p-4 flex items-center gap-3">
                    <label className="text-sm text-slate-600 w-24">Rate (₹)</label>
                    <input
                      type="number"
                      min="0"
                      value={localRates[`${inst.id}-Fixed`] ?? ''}
                      onChange={e => setLocalRates(prev => ({ ...prev, [`${inst.id}-Fixed`]: e.target.value }))}
                      className="w-32 border border-slate-300 rounded px-2 py-1 text-sm"
                    />
                    <button
                      onClick={() => handleSaveRate(inst.id, 'Fixed', localRates[`${inst.id}-Fixed`] ?? '')}
                      disabled={saving}
                      className="text-xs px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 transition"
                    >Save</button>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    <div className="grid grid-cols-[160px_1fr_80px] bg-slate-50 px-4 py-1.5 text-xs font-semibold text-slate-500">
                      <span>Trinity Grade</span>
                      <span>Rate per Student (₹)</span>
                      <span />
                    </div>
                    {TRINITY_GRADES.map(grade => {
                      const rateKey = `${inst.id}-${grade}`;
                      return (
                        <div key={grade} className="grid grid-cols-[160px_1fr_80px] px-4 py-2 items-center">
                          <span className="text-sm text-slate-700">{grade}</span>
                          <input
                            type="number"
                            min="0"
                            value={localRates[rateKey] ?? ''}
                            onChange={e => setLocalRates(prev => ({ ...prev, [rateKey]: e.target.value }))}
                            className="w-32 border border-slate-300 rounded px-2 py-1 text-sm"
                          />
                          <button
                            onClick={() => handleSaveRate(inst.id, grade, localRates[rateKey] ?? '')}
                            disabled={saving}
                            className="text-xs px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 transition"
                          >Save</button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {saving && <p className="text-xs text-indigo-600 mt-2">Saving…</p>}
      </div>

      {/* Teacher overrides */}
      <div className="border-t border-slate-200 pt-8">
        <h3 className="text-base font-semibold text-slate-800 mb-1">Teacher-Level Overrides</h3>
        <p className="text-xs text-slate-500 mb-4">
          Override the school-wide rate for a specific teacher. Leave a field blank to use the school-wide rate.
          Overrides only apply to per-student payout teachers.
        </p>
        <div className="flex items-center gap-3 mb-6">
          <label className="text-sm font-medium text-slate-600">Select Teacher</label>
          <select
            value={overrideTeacherId}
            onChange={e => setOverrideTeacherId(e.target.value)}
            className="border border-slate-300 rounded px-3 py-1.5 text-sm bg-white"
          >
            <option value="">— choose teacher —</option>
            {teachers.filter(t => t.payout_type === 'per_student_monthly' && t.is_active).map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>

        {overrideTeacherId && (
          <div className="space-y-6">
            {instruments.map(inst => {
              const vocal = isVocalInstrument(inst.name);
              const gradesToShow = vocal ? (['Fixed'] as TrinityGrade[]) : TRINITY_GRADES;
              return (
                <div key={inst.id} className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                  <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
                    <span className="font-semibold text-slate-700 text-sm">{inst.name}</span>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {!vocal && (
                      <div className="grid grid-cols-[160px_180px_180px_60px_40px] bg-slate-50 px-4 py-1.5 text-xs font-semibold text-slate-500">
                        <span>Grade</span>
                        <span>School Rate</span>
                        <span>Override Rate (₹)</span>
                        <span />
                        <span />
                      </div>
                    )}
                    {gradesToShow.map(grade => {
                      const existing = overrides.find(o => o.instrument_id === inst.id && o.trinity_grade === grade);
                      const overrideKey = `${inst.id}-${grade}`;
                      return (
                        <div key={grade} className="grid grid-cols-[160px_180px_180px_60px_40px] px-4 py-2 items-center">
                          <span className="text-sm text-slate-700">{vocal ? 'Fixed Rate' : grade}</span>
                          <span className="text-sm text-slate-400">{fmt(getRateValue(inst.id, grade))}</span>
                          <input
                            type="number"
                            min="0"
                            placeholder="use school rate"
                            value={localOverrideRates[overrideKey] ?? ''}
                            onChange={e => setLocalOverrideRates(prev => ({ ...prev, [overrideKey]: e.target.value }))}
                            className="w-36 border border-slate-300 rounded px-2 py-1 text-sm"
                          />
                          <button
                            onClick={() => {
                              const val = localOverrideRates[overrideKey] ?? '';
                              if (val.trim() !== '') handleSaveOverride(inst.id, grade, val);
                            }}
                            disabled={overrideSaving || !localOverrideRates[overrideKey]?.trim()}
                            className="text-xs px-2 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 transition"
                            title="Save override"
                          >Save</button>
                          {existing && (
                            <button
                              onClick={() => handleDeleteOverride(existing.id!)}
                              className="text-red-400 hover:text-red-600 text-xs ml-1"
                              title="Remove override"
                            >✕</button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {overrideSaving && <p className="text-xs text-indigo-600">Saving override…</p>}
          </div>
        )}
      </div>
    </div>
  );
};

// ── Payslip Viewer ────────────────────────────────────────────────────────────

interface PayslipViewerProps {
  payslip: TeacherPayslip;
}

const PayslipViewer: React.FC<PayslipViewerProps> = ({ payslip }) => {
  const { teacher, period, instruments, summary } = payslip;
  const allDeferred = instruments.flatMap(inst => inst.students.filter(s => s.status === 'deferred'));

  const handleDownloadPDF = async () => {
    const blob = await pdf(<PayslipPDF data={payslip} />).toBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Payslip_${teacher.name.replace(/\s+/g, '_')}_${period.month}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleOpenWhatsApp = async () => {
    await handleDownloadPDF();
    const phone = teacher.phone?.replace(/\D/g, '') || '';
    const msg = encodeURIComponent(
      `Hi ${teacher.name}, please find attached your payslip for ${period.month}. — HSM`
    );
    const url = phone
      ? `https://wa.me/${phone}?text=${msg}`
      : `https://wa.me/?text=${msg}`;
    window.open(url, '_blank');
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-indigo-600 text-white px-6 py-5">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-indigo-200 text-xs font-medium uppercase tracking-wide">Hyderabad School of Music</p>
            <h3 className="text-xl font-bold mt-1">{teacher.name}</h3>
            <p className="text-indigo-200 text-sm mt-1">{formatPeriod(period.start, period.end)}</p>
          </div>
          <div className="text-right">
            <span className="inline-block bg-white/20 text-white text-xs px-2 py-1 rounded-full">
              {teacher.payout_type === 'fixed' ? 'Fixed Salary' : 'Per Student'}
            </span>
            {teacher.phone && <p className="text-indigo-200 text-xs mt-2">{teacher.phone}</p>}
          </div>
        </div>
      </div>

      {/* Salary Summary — at top */}
      <div className="p-6 border-b border-slate-200 bg-indigo-50">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">Salary Summary</p>
        {teacher.payout_type === 'fixed' ? (
          <div className="flex justify-between items-center text-sm text-slate-700">
            <span>Fixed Monthly Salary</span>
            <span className="font-semibold">{fmt(summary.fixed_salary!)}</span>
          </div>
        ) : (
          <div className="space-y-2">
            {instruments.map(inst => inst.billable_count > 0 && (
              <div key={inst.instrument_id} className="flex justify-between items-center text-sm text-slate-700">
                <span>{inst.instrument_name} — {inst.billable_count} student{inst.billable_count !== 1 ? 's' : ''}</span>
                <span>{fmt(inst.instrument_subtotal)}</span>
              </div>
            ))}
          </div>
        )}
        <div className="mt-4 pt-4 border-t border-indigo-200 flex justify-between items-center">
          <span className="font-bold text-slate-800">Total Payable</span>
          <span className="text-2xl font-bold text-indigo-600">{fmt(summary.total_payable)}</span>
        </div>
        <div className="mt-3 flex gap-4 text-xs text-slate-500">
          <span>{summary.billable_count} billable</span>
          {summary.deferred_count > 0 && <span className="text-amber-600">{summary.deferred_count} deferred</span>}
          {summary.excluded_count > 0 && <span>{summary.excluded_count} excluded</span>}
        </div>
      </div>

      <div className="divide-y divide-slate-100">
        {/* Per-instrument sections */}
        {instruments.map(inst => (
          <div key={inst.instrument_id} className="p-6">
            <h4 className="font-semibold text-slate-800 text-sm mb-4 flex items-center gap-2">
              <span className="text-indigo-600">{inst.instrument_name}</span>
              {inst.is_vocal && (
                <span className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full">Vocals</span>
              )}
            </h4>

            {/* Attendance summary */}
            {(() => {
              const conducted = inst.batches.reduce((s, b) => s + b.attendance.conducted, 0);
              const missed = inst.batches.reduce((s, b) => s + b.attendance.not_conducted, 0);
              return (
                <div className="mb-4 flex items-center gap-3 text-sm">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Attendance</span>
                  <span className="bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full font-medium">{conducted} conducted</span>
                  {missed > 0 && (
                    <span className="bg-red-50 text-red-600 px-2.5 py-1 rounded-full font-medium">{missed} missed</span>
                  )}
                </div>
              );
            })()}

            {/* Students table */}
            {inst.students.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Students</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-left">
                        <th className="px-3 py-2 text-xs font-semibold text-slate-500">Name</th>
                        {!inst.is_vocal && (
                          <th className="px-3 py-2 text-xs font-semibold text-slate-500">Grade</th>
                        )}
                        <th className="px-3 py-2 text-xs font-semibold text-slate-500">Classes</th>
                        {teacher.payout_type === 'per_student_monthly' && (
                          <>
                            <th className="px-3 py-2 text-xs font-semibold text-slate-500">Fee (R)</th>
                            <th className="px-3 py-2 text-xs font-semibold text-slate-500">
                              Teacher Rate
                              <span className="block text-slate-400 font-normal">(R−1200)×0.7</span>
                            </th>
                            <th className="px-3 py-2 text-xs font-semibold text-slate-500">Subtotal</th>
                          </>
                        )}
                        <th className="px-3 py-2 text-xs font-semibold text-slate-500">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {inst.students.map(s => (
                        <tr key={s.student_id} className={s.status !== 'billable' ? 'opacity-60' : ''}>
                          <td className="px-3 py-2 font-medium text-slate-800">{s.student_name}</td>
                          {!inst.is_vocal && (
                            <td className="px-3 py-2 text-slate-600">{s.trinity_grade}</td>
                          )}
                          <td className="px-3 py-2 text-slate-600">{s.classes_attended}</td>
                          {teacher.payout_type === 'per_student_monthly' && (
                            <>
                              <td className="px-3 py-2 text-slate-600">
                                {s.status === 'billable' ? fmt(s.package_monthly_rate) : '—'}
                              </td>
                              <td className="px-3 py-2 text-slate-600">
                                {s.status === 'billable' ? fmt(s.rate) : '—'}
                              </td>
                              <td className="px-3 py-2 font-medium">
                                {s.status === 'billable' ? fmt(s.subtotal) : '—'}
                              </td>
                            </>
                          )}
                          <td className="px-3 py-2">
                            {s.status === 'billable' && (
                              <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">Billable</span>
                            )}
                            {s.status === 'deferred' && (
                              <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">Deferred *</span>
                            )}
                            {s.status === 'excluded' && (
                              <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Excluded †</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {teacher.payout_type === 'per_student_monthly' && inst.billable_count > 0 && (
                      <tfoot>
                        <tr className="bg-slate-50">
                          <td colSpan={inst.is_vocal ? 4 : 5} className="px-3 py-2 text-xs text-slate-500 text-right font-medium">
                            Subtotal
                          </td>
                          <td className="px-3 py-2 font-bold text-indigo-700">{fmt(inst.instrument_subtotal)}</td>
                          <td />
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Deferred */}
        {allDeferred.length > 0 && (
          <div className="p-6">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
              Deferred to Next Month *
            </p>
            <div className="space-y-2">
              {allDeferred.map(s => (
                <div key={s.student_id} className="flex items-center gap-3 text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                  <span className="font-medium">{s.student_name}</span>
                  <span className="text-amber-400">·</span>
                  <span>{s.instrument_name}</span>
                  <span className="text-amber-400">·</span>
                  <span>Enrolled {formatDate(s.enrollment_date)}</span>
                  {s.trinity_grade !== 'Fixed' && (
                    <><span className="text-amber-400">·</span><span>{s.trinity_grade}</span></>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* T&C */}
        <div className="p-6 bg-slate-50">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Terms &amp; Conditions</p>
          <ol className="space-y-2 text-xs text-slate-600 list-none">
            <li><span className="font-semibold">*</span> Students enrolled after the 20th of the month will be credited in the following month's salary.</li>
            <li><span className="font-semibold">†</span> Only students who have attended more than 1 class in the month are considered for payment. The first class is complimentary and does not count towards the teacher's payout.</li>
            <li><span className="font-semibold">‡</span> Teacher rate per student = (R − ₹1,200) × 0.7, where R is the student's monthly fee (quarterly fees ÷ 3; trial fees × 2).</li>
          </ol>
        </div>
      </div>

      {/* Action buttons */}
      <div className="px-6 py-4 border-t border-slate-200 flex gap-3">
        <button
          onClick={handleDownloadPDF}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download PDF
        </button>
        <button
          onClick={handleOpenWhatsApp}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
            <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.558 4.115 1.535 5.845L.057 23.428a.5.5 0 00.601.601l5.583-1.478A11.944 11.944 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.895 0-3.668-.524-5.186-1.435l-.372-.22-3.858 1.021 1.021-3.858-.22-.372A9.942 9.942 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
          </svg>
          Forward via WhatsApp
        </button>
      </div>
    </div>
  );
};

// ── Main PayslipsTab ──────────────────────────────────────────────────────────

interface PayslipsTabProps {
  teachers: Teacher[];
  selectedMonth: string;
}

const PayslipsTab: React.FC<PayslipsTabProps> = ({ teachers, selectedMonth }) => {
  const [view, setView] = useState<'payslip' | 'rates'>('payslip');
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [month, setMonth] = useState(selectedMonth);
  const [payslip, setPayslip] = useState<TeacherPayslip | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [instruments, setInstruments] = useState<Instrument[]>([]);

  useEffect(() => {
    apiGet('/api/instruments').then(d => setInstruments(d.instruments || [])).catch(() => {});
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!selectedTeacherId) { setError('Please select a teacher.'); return; }
    setError('');
    setLoading(true);
    setPayslip(null);
    try {
      const data = await apiGet(`/api/finance/payslip/${selectedTeacherId}?month=${month}`);
      setPayslip(data);
    } catch {
      setError('Failed to load payslip. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [selectedTeacherId, month]);

  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <div className="flex bg-slate-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setView('payslip')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
            view === 'payslip' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Generate Payslip
        </button>
        <button
          onClick={() => setView('rates')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
            view === 'rates' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Configure Rates
        </button>
      </div>

      {view === 'rates' ? (
        <RateConfigPanel instruments={instruments} teachers={teachers} />
      ) : (
        <>
          {/* Controls */}
          <div className="flex flex-wrap items-end gap-4 bg-white p-4 rounded-xl border border-slate-200">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Teacher</label>
              <select
                value={selectedTeacherId}
                onChange={e => { setSelectedTeacherId(e.target.value); setPayslip(null); }}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white min-w-[200px]"
              >
                <option value="">— select teacher —</option>
                {teachers.filter(t => t.is_active).map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Month</label>
              <input
                type="month"
                value={month}
                onChange={e => { setMonth(e.target.value); setPayslip(null); }}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
              />
            </div>
            <button
              onClick={handleGenerate}
              disabled={loading || !selectedTeacherId}
              className="px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {loading ? 'Loading…' : 'Generate Payslip'}
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          {payslip && <PayslipViewer payslip={payslip} />}

          {!payslip && !loading && !error && (
            <div className="text-center text-slate-400 py-16 text-sm">
              Select a teacher and month, then click Generate Payslip.
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default PayslipsTab;
