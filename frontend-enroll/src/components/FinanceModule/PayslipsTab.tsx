import React, { useState, useEffect, useCallback } from 'react';
import { pdf, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { apiGet, apiPut } from '../../api';
import { Teacher, TeacherPayslip } from './types';

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
            ‡ Teacher rate per student is computed from the student's package fee using the school's payout formula.
          </Text>
        </View>

      </Page>
    </Document>
  );
};

// ── Rate Config Panel ─────────────────────────────────────────────────────────

interface PayoutParams {
  rate_type: 'fixed' | 'percentage';
  fixed_rate: number;
  maintenance_amount: number;
  payout_percentage: number;
}

interface RateConfigPanelProps {
  teachers: Teacher[];
}

const RateConfigPanel: React.FC<RateConfigPanelProps> = ({ teachers }) => {
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [payoutParams, setPayoutParams] = useState<PayoutParams | null>(null);
  const [localRateType, setLocalRateType] = useState<'fixed' | 'percentage'>('percentage');
  const [localFixedRate, setLocalFixedRate] = useState('');
  const [localMaintenance, setLocalMaintenance] = useState('');
  const [localPayoutPct, setLocalPayoutPct] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!selectedTeacherId) { setPayoutParams(null); return; }
    apiGet(`/api/finance/payout-params/${selectedTeacherId}`)
      .then((d: PayoutParams) => {
        setPayoutParams(d);
        setLocalRateType(d.rate_type);
        setLocalFixedRate(String(d.fixed_rate));
        setLocalMaintenance(String(d.maintenance_amount));
        setLocalPayoutPct(String(Math.round(d.payout_percentage * 100)));
      })
      .catch(() => {});
  }, [selectedTeacherId]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const body = localRateType === 'fixed'
        ? { rate_type: 'fixed', fixed_rate: parseFloat(localFixedRate) }
        : { rate_type: 'percentage', maintenance_amount: parseFloat(localMaintenance), payout_percentage: parseFloat(localPayoutPct) / 100 };
      const updated = await apiPut(`/api/finance/payout-params/${selectedTeacherId}`, body);
      setPayoutParams({ ...payoutParams!, ...updated });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const perStudentTeachers = teachers.filter(t => t.payout_type === 'per_student_monthly' && t.is_active);

  return (
    <div className="space-y-10 max-w-2xl">

      {/* Formula reference */}
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">How Teacher Payout is Calculated</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-lg border border-indigo-100 p-4">
            <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide mb-2">Fixed Rate per Student</p>
            <p className="text-xs text-slate-600 mb-3">
              Teacher receives a flat amount for each billable student, regardless of what the student pays.
            </p>
            <div className="bg-indigo-50 rounded px-3 py-2 font-mono text-xs text-indigo-800">
              payout = fixed_rate × billable_students
            </div>
          </div>
          <div className="bg-white rounded-lg border border-emerald-100 p-4">
            <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-2">Percentage of Student Fee</p>
            <p className="text-xs text-slate-600 mb-3">
              R = student's monthly-equivalent fee. Teacher gets a % of what remains after deducting maintenance.
            </p>
            <div className="bg-emerald-50 rounded px-3 py-2 font-mono text-xs text-emerald-800 space-y-1">
              <p>per student = max(0, (R − maintenance) × %)</p>
              <p>payout = sum across billable students</p>
            </div>
          </div>
        </div>
        <div className="mt-4 text-xs text-slate-500 space-y-1">
          <p><span className="font-semibold">R — monthly-equivalent fee:</span> monthly package → fee as-is · quarterly → fee ÷ 3 · 4-class → monthly fee × 53% · trial → fee × 2</p>
          <p><span className="font-semibold">Billable:</span> enrolled before the 20th of the month and attended more than 1 class.</p>
          <p><span className="font-semibold">Deferred:</span> enrolled after the 20th — counted in the following month.</p>
          <p><span className="font-semibold">Excluded:</span> attended 1 or fewer classes — first class is complimentary.</p>
        </div>
      </div>

      {/* Per-teacher config */}
      <div>
        <h3 className="text-base font-semibold text-slate-800 mb-1">Teacher Payout Configuration</h3>
        <p className="text-xs text-slate-500 mb-5">Select a teacher to configure their rate type and parameters.</p>

        <div className="flex items-center gap-3 mb-6">
          <label className="text-sm font-medium text-slate-600 shrink-0">Teacher</label>
          <select
            value={selectedTeacherId}
            onChange={e => setSelectedTeacherId(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white min-w-[220px]"
          >
            <option value="">— select teacher —</option>
            {perStudentTeachers.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>

        {selectedTeacherId && payoutParams && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
            {/* Rate type toggle */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Rate Type</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setLocalRateType('fixed')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${
                    localRateType === 'fixed'
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-slate-600 border-slate-300 hover:border-indigo-400'
                  }`}
                >
                  Fixed Rate per Student
                </button>
                <button
                  onClick={() => setLocalRateType('percentage')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${
                    localRateType === 'percentage'
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-slate-600 border-slate-300 hover:border-indigo-400'
                  }`}
                >
                  % of Student Fee
                </button>
              </div>
            </div>

            {/* Fields */}
            {localRateType === 'fixed' ? (
              <div className="space-y-3">
                <p className="text-xs text-slate-500">Teacher earns this amount per billable student per month.</p>
                <div className="flex items-center gap-3">
                  <label className="text-sm text-slate-600 w-48">Fixed Rate per Student (₹)</label>
                  <input
                    type="number" min="0"
                    value={localFixedRate}
                    onChange={e => setLocalFixedRate(e.target.value)}
                    className="w-32 border border-slate-300 rounded px-2 py-1.5 text-sm"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-slate-500">
                  Per student: <span className="font-mono">max(0, (R − maintenance) × payout%)</span>
                </p>
                <div className="flex items-center gap-3">
                  <label className="text-sm text-slate-600 w-48">Per-Student Maintenance (₹)</label>
                  <input
                    type="number" min="0"
                    value={localMaintenance}
                    onChange={e => setLocalMaintenance(e.target.value)}
                    className="w-32 border border-slate-300 rounded px-2 py-1.5 text-sm"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-sm text-slate-600 w-48">Payout Percentage (%)</label>
                  <input
                    type="number" min="0" max="100" step="1"
                    value={localPayoutPct}
                    onChange={e => setLocalPayoutPct(e.target.value)}
                    className="w-32 border border-slate-300 rounded px-2 py-1.5 text-sm"
                  />
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              {saved && <span className="text-xs text-emerald-600 font-medium">Saved</span>}
            </div>
          </div>
        )}

        {perStudentTeachers.length === 0 && (
          <p className="text-sm text-slate-400">No per-student payout teachers found.</p>
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
                            <th className="px-3 py-2 text-xs font-semibold text-slate-500">Teacher Rate</th>
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
                          <td colSpan={inst.is_vocal ? 3 : 4} className="px-3 py-2 text-xs text-slate-500 text-right font-medium">
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
            <li><span className="font-semibold">‡</span> Teacher rate per student is computed from the student's package fee using the school's payout formula.</li>
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
        <RateConfigPanel teachers={teachers} />
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
