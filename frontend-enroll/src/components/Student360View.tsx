import React, { useState, useEffect } from 'react';
import { apiGet, apiPost, apiDelete } from '../api';
import PhoneLink from './PhoneLink';
import HomeworkTab from './HomeworkTab';
import HabitTrackerTab from './HabitTrackerTab';
import XPBadge from './XPBadge';
import PTMHistoryTab from './PTMHistoryTab';

interface Student360ViewProps {
  email?: string;
  studentId?: string | number;
  onClose?: () => void;
  isModal?: boolean;
  hidePayments?: boolean;
  selfMode?: boolean; // uses /me/360 — resolves student via student_guardians (JWT-based)
}

interface Student360Data {
  personal: {
    details: any;
    attendance_summary: {
      present: number;
      absent: number;
      excused: number;
    };
  };
  academic: {
    batches: any[];
    reviews: any[];
    certificates: any[];
    homework: any[];
  };
  payment: {
    history: any[];
    summary: {
      total_credits?: number;
      classes_attended: number;
      classes_remaining: number;
      classes_missed: number;
      classes_excused?: number;
      instrument_credits?: Record<string, number>;
    };
  };
}

interface Document {
  id: string;
  filename: string;
  file_type: string;
  file_url: string | null;        // Drive public URL (new uploads)
  file_storage_id: string | null;
  uploaded_at: string;
}


const Student360View: React.FC<Student360ViewProps> = ({ email, studentId, onClose, isModal = false, hidePayments = false, selfMode = false }) => {
  const [activeTab, setActiveTab] = useState<'personal' | 'academic' | 'payment' | 'homework' | 'habits' | 'ptm'>('personal');
  const [data, setData] = useState<Student360Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [totalXP, setTotalXP] = useState<number | null>(null);


  useEffect(() => {
    if (!selfMode && !email && !studentId) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        const url = selfMode
          ? '/api/students/me/360'
          : studentId
            ? `/api/students/${studentId}/360`
            : `/api/students/email/${encodeURIComponent(email || '')}/360`;
        const result = await apiGet(url);
        setData(result);

        // Fetch documents + XP once we have the student ID
        const resolvedId = studentId || result.personal.details.id;
        if (resolvedId) {
          fetchDocuments(resolvedId);
          apiGet(`/api/students/${resolvedId}/xp`)
            .then(xp => setTotalXP(xp.totalXP ?? 0))
            .catch(() => {});
        }
      } catch (err: any) {
        setError(err.message || 'Failed to fetch student data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selfMode, email, studentId]);

  const fetchDocuments = async (id: string) => {
    try {
      const res = await apiGet(`/api/students/${id}/documents`);
      setDocuments(res.documents || []);
    } catch (err) {
      console.error('Failed to fetch documents', err);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !data) return;

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64Data = reader.result as string;
        await apiPost(`/api/students/${data.personal.details.id}/documents`, {
          filename: file.name,
          file_type: file.type,
          file_data: base64Data
        });
        setUploadSuccess('Document uploaded successfully!');
        fetchDocuments(data.personal.details.id);
        setTimeout(() => setUploadSuccess(null), 3000);
      } catch (err) {
        console.error('Upload failed', err);
        alert('Failed to upload document');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDownload = async (docId: string, filename: string) => {
    // Fast path: Drive URL already in list state — open directly
    const cached = documents.find(d => d.id === docId);
    if (cached?.file_url) {
      window.open(cached.file_url, '_blank');
      return;
    }

    // Legacy path: fetch full row to get base64 file_data
    try {
      const doc = await apiGet(`/api/documents/${docId}`);
      const link = document.createElement('a');
      link.href = doc.file_data;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Download failed', err);
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;
    try {
      await apiDelete(`/api/documents/${docId}`);
      if (data) fetchDocuments(data.personal.details.id);
    } catch (err) {
      console.error('Delete failed', err);
    }
  };


  if (!selfMode && !email && !studentId) return null;

  const shouldHidePayment = hidePayments || selfMode;
  const visibleStudentTabs = (['personal', 'academic', 'payment', 'homework', 'habits', 'ptm'] as const)
    .filter(tab => !(shouldHidePayment && tab === 'payment'))
    .filter(tab => !(selfMode && tab === 'ptm'));

  const STUDENT_TAB_ICONS: Record<string, React.ReactNode> = {
    personal: <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />,
    academic: <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 0 0-.491 6.347A48.627 48.627 0 0 1 12 20.904a48.627 48.627 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.57 50.57 0 0 0-2.658-.813A59.905 59.905 0 0 1 12 3.493a59.902 59.902 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5" />,
    payment: <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />,
    homework: <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />,
    habits: <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />,
    ptm: <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />,
  };
  const STUDENT_TAB_LABELS: Record<string, string> = {
    personal: 'Personal',
    academic: 'Academic',
    payment: 'Payment',
    homework: 'Homework',
    habits: 'Practice Habits',
    ptm: 'PTM History',
  };
  const STUDENT_TAB_MOBILE_LABELS: Record<string, string> = {
    ...STUDENT_TAB_LABELS,
    habits: 'Habits',
    ptm: 'PTM',
  };

  const content = (
    <div className={`bg-white ${isModal ? 'rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col' : 'min-h-screen'}`}>
      {/* Header */}
      <div className="p-6 border-b flex justify-between items-start bg-gray-50">
        <div>
          {loading ? (
            <div className="h-8 w-48 bg-gray-200 animate-pulse rounded"></div>
          ) : error ? (
            <h2 className="text-xl text-red-600">Error loading profile</h2>
          ) : data ? (
            <>
              <h2 className="text-2xl font-bold text-gray-800">{data.personal.details.name}</h2>
              <p className="text-gray-600">{data.personal.details.email}</p>
              {totalXP !== null && (
                <div className="mt-2">
                  <XPBadge totalXP={totalXP} />
                </div>
              )}
            </>
          ) : null}
        </div>
        {isModal && onClose && (
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 p-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Loading/Error States */}
      {loading && (
        <div className="p-8 flex justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      )}

      {error && !loading && (
        <div className="p-8 text-center text-red-500">
          <p>{error}</p>
        </div>
      )}

      {/* Main Content */}
      {!loading && !error && data && (
        <>
          {/* Tabs — mobile: icon card grid | desktop: horizontal bar */}
          <div className={`sm:hidden grid gap-2 p-3 border-b bg-gray-50 ${visibleStudentTabs.length <= 4 ? 'grid-cols-2' : 'grid-cols-3'}`}>
            {visibleStudentTabs.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl text-xs font-medium transition-colors ${
                  activeTab === tab
                    ? 'bg-blue-50 text-blue-600 ring-1 ring-blue-200'
                    : 'bg-white text-gray-500 border border-gray-200'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  {STUDENT_TAB_ICONS[tab]}
                </svg>
                {STUDENT_TAB_MOBILE_LABELS[tab]}
              </button>
            ))}
          </div>
          <div className="hidden sm:flex border-b px-4">
            {visibleStudentTabs.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`mr-6 py-3 text-sm font-medium whitespace-nowrap flex-none border-b-2 transition-colors ${
                  activeTab === tab
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {STUDENT_TAB_LABELS[tab]}
              </button>
            ))}
          </div>

          <div className={`p-6 ${isModal ? 'overflow-y-auto' : ''}`}>
            {/* Personal Tab */}
            {activeTab === 'personal' && (
              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-gray-50 p-5 rounded-lg border border-gray-100">
                    <h3 className="font-semibold text-lg mb-4 text-gray-800">Basic Information</h3>
                    <dl className="space-y-3 text-sm">
                      <div className="flex justify-between"><dt className="text-gray-500">Date of Birth:</dt> <dd>{new Date(data.personal.details.dob).toLocaleDateString()}</dd></div>
                      <div className="flex justify-between"><dt className="text-gray-500">Phone:</dt> <dd><PhoneLink phone={data.personal.details.phone} /></dd></div>
                      <div className="flex justify-between"><dt className="text-gray-500">Guardian:</dt> <dd><PhoneLink phone={data.personal.details.guardian_contact} /></dd></div>
                      <div className="flex justify-between"><dt className="text-gray-500">Address:</dt> <dd className="text-right max-w-xs">{data.personal.details.metadata?.address || 'N/A'}</dd></div>
                    </dl>
                  </div>

                  <div className="bg-gray-50 p-5 rounded-lg border border-gray-100">
                    <h3 className="font-semibold text-lg mb-4 text-gray-800">Attendance Overview</h3>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div className="bg-white p-3 rounded shadow-sm border-l-4 border-green-500">
                        <div className="text-2xl font-bold text-gray-800">{data.personal.attendance_summary.present || 0}</div>
                        <div className="text-xs text-gray-500 uppercase tracking-wide mt-1">Present</div>
                      </div>
                      <div className="bg-white p-3 rounded shadow-sm border-l-4 border-red-500">
                        <div className="text-2xl font-bold text-gray-800">{data.personal.attendance_summary.absent || 0}</div>
                        <div className="text-xs text-gray-500 uppercase tracking-wide mt-1">Absent</div>
                      </div>
                      <div className="bg-white p-3 rounded shadow-sm border-l-4 border-yellow-500">
                        <div className="text-2xl font-bold text-gray-800">{data.personal.attendance_summary.excused || 0}</div>
                        <div className="text-xs text-gray-500 uppercase tracking-wide mt-1">Excused</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Academic Tab */}
            {activeTab === 'academic' && (
              <div className="space-y-8">
                <div>
                  <h3 className="font-semibold text-lg mb-4 text-gray-800">Active Classes</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    {data.academic.batches.map((batch) => (
                      <div key={batch.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow bg-white">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-bold text-blue-600 text-lg">{batch.instrument}</h4>
                            <p className="text-sm text-gray-600 mt-1">{batch.recurrence}</p>
                            <p className="text-xs text-gray-500 mt-1">Teacher: {batch.teacher}</p>
                          </div>
                          <div className="text-center bg-gray-50 p-2 rounded">
                            <div className={`text-xl font-bold ${batch.classes_remaining < 4 ? 'text-red-500' : 'text-green-600'}`}>
                              {batch.classes_remaining}
                            </div>
                            <div className="text-xs text-gray-500">Credits Left</div>
                          </div>
                        </div>
                      </div>
                    ))}
                    {data.academic.batches.length === 0 && <p className="text-gray-500 italic">No active enrollments found.</p>}
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-lg mb-4 text-gray-800">Academic Achievements</h3>

                  {uploadSuccess && (
                    <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-lg text-sm font-medium">
                      {uploadSuccess}
                    </div>
                  )}

                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center bg-gray-50">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 011.414.586l4 4a1 1 0 01.586 1.414V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="mt-2 text-sm text-gray-500">Upload certificates, monthly reviews, or homework.</p>
                    <label className="mt-4 inline-block px-4 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer">
                      Upload Document
                      <input type="file" className="hidden" onChange={handleFileUpload} />
                    </label>
                  </div>

                  {documents.length > 0 && (
                    <div className="mt-6">
                      <h4 className="text-sm font-semibold text-gray-700 mb-3">Uploaded Documents</h4>
                      <ul className="divide-y divide-gray-200 border rounded-lg bg-white">
                        {documents.map((doc) => (
                          <li key={doc.id} className="p-4 flex justify-between items-center hover:bg-gray-50">
                            <div className="flex items-center gap-3">
                              <span className="text-2xl">📄</span>
                              <div>
                                <p className="text-sm font-medium text-gray-900">{doc.filename}</p>
                                <p className="text-xs text-gray-500">{new Date(doc.uploaded_at).toLocaleDateString()}</p>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleDownload(doc.id, doc.filename)}
                                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                              >
                                Download
                              </button>
                              <button
                                onClick={() => handleDeleteDocument(doc.id)}
                                className="text-red-600 hover:text-red-800 text-sm font-medium"
                              >
                                Delete
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Homework Tab */}
            {activeTab === 'homework' && (
              <HomeworkTab
                studentId={data.personal.details.id}
                selfMode={selfMode}
              />
            )}

            {/* Practice Habits Tab */}
            {activeTab === 'habits' && (
              <HabitTrackerTab
                studentId={data.personal.details.id}
                selfMode={selfMode ?? false}
              />
            )}

            {/* PTM History Tab */}
            {activeTab === 'ptm' && (
              <PTMHistoryTab studentId={String(data.personal.details.id)} />
            )}

            {/* Payment Tab */}
            {activeTab === 'payment' && (
              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                    <div className="text-sm text-blue-600 font-medium">Total Credits Bought</div>
                    <div className="text-2xl font-bold text-blue-800 mt-1">
                      {data.payment.summary.total_credits ?? 0}
                    </div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                    <div className="text-sm text-green-600 font-medium">Available Credit</div>
                    <div className="text-2xl font-bold text-green-800 mt-1">{data.payment.summary.classes_remaining}</div>
                    {data.payment.summary.instrument_credits && Object.keys(data.payment.summary.instrument_credits).length > 1 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {Object.entries(data.payment.summary.instrument_credits).map(([instrument, credits]) => (
                          <span key={instrument} className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                            {instrument}: {credits}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="bg-orange-50 p-4 rounded-lg border border-orange-100">
                    <div className="text-sm text-orange-600 font-medium">Classes Missed</div>
                    <div className="text-2xl font-bold text-orange-800 mt-1">{data.payment.summary.classes_missed}</div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-lg mb-4 text-gray-800">Transaction History</h3>
                  <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 rounded-lg">
                    <table className="min-w-full divide-y divide-gray-300">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900">Date</th>
                          <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Stream</th>
                          <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Location</th>
                          <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Package</th>
                          <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Credits</th>
                          <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Amount</th>
                          <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Method</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 bg-white">
                        {data.payment.history.map((p) => {
                          const meta = (p as any).metadata || {};
                          const credits = meta.credits_bought
                            ? parseInt(String(meta.credits_bought))
                            : (p as any).classes_count
                              ? parseInt(String((p as any).classes_count))
                              : null;
                          const locationLabel = meta.location === 'pbel' ? 'PBEL City' : meta.location === 'hsm' ? 'HSM' : '—';
                          return (
                            <tr key={p.id}>
                              <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm text-gray-500">
                                {new Date(p.timestamp).toLocaleDateString()}
                              </td>
                              <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-700">
                                {(p as any).instrument_name || '—'}
                              </td>
                              <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                {locationLabel}
                              </td>
                              <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900">
                                {(p as any).package_name || '—'}
                              </td>
                              <td className="whitespace-nowrap px-3 py-4 text-sm font-medium text-indigo-700">
                                {credits !== null ? credits : '—'}
                              </td>
                              <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900">
                                ₹{p.amount}
                              </td>
                              <td className="whitespace-nowrap px-3 py-4 text-sm">
                                <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 capitalize">
                                  {p.method}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                        {data.payment.history.length === 0 && (
                          <tr>
                            <td colSpan={7} className="px-6 py-4 text-center text-sm text-gray-500">No payment history found.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
        {content}
      </div>
    );
  }

  return content;
};

export default Student360View;