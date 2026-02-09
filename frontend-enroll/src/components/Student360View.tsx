import React, { useState, useEffect } from 'react';
import { apiGet } from '../api';

interface Student360ViewProps {
  email?: string;
  studentId?: string | number;
  onClose?: () => void;
  isModal?: boolean;
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
    };
  };
}

const Student360View: React.FC<Student360ViewProps> = ({ email, studentId, onClose, isModal = false }) => {
  const [activeTab, setActiveTab] = useState<'personal' | 'academic' | 'payment'>('personal');
  const [data, setData] = useState<Student360Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!email && !studentId) return;
    
    const fetchData = async () => {
      try {
        setLoading(true);
        // Using apiGet wrapper if available, or fetch directly
        const url = studentId 
          ? `/api/students/${studentId}/360` 
          : `/api/students/email/${encodeURIComponent(email || '')}/360`;
        const result = await apiGet(url);
        setData(result);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch student data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [email, studentId]);

  if (!email && !studentId) return null;

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
          {/* Tabs */}
          <div className="flex border-b px-6">
            {(['personal', 'academic', 'payment'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`mr-8 py-4 text-sm font-medium capitalize border-b-2 transition-colors ${
                  activeTab === tab
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab} Details
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
                      <div className="flex justify-between"><dt className="text-gray-500">Phone:</dt> <dd>{data.personal.details.phone}</dd></div>
                      <div className="flex justify-between"><dt className="text-gray-500">Guardian:</dt> <dd>{data.personal.details.guardian_contact}</dd></div>
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
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center bg-gray-50">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 011.414.586l4 4a1 1 0 01.586 1.414V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="mt-2 text-sm text-gray-500">Upload certificates, monthly reviews, or homework.</p>
                    <button className="mt-4 px-4 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50">
                      Upload Document
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Payment Tab */}
            {activeTab === 'payment' && (
              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                    <div className="text-sm text-blue-600 font-medium">Total Credits Bought</div>
                    <div className="text-2xl font-bold text-blue-800 mt-1">
                      {data.payment.summary.total_credits ?? (data.payment.summary.classes_attended + data.payment.summary.classes_remaining + data.payment.summary.classes_missed)}
                    </div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                    <div className="text-sm text-green-600 font-medium">Available Credit</div>
                    <div className="text-2xl font-bold text-green-800 mt-1">{data.payment.summary.classes_remaining}</div>
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
                          <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Package</th>
                          <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Amount</th>
                          <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 bg-white">
                        {data.payment.history.map((p) => (
                          <tr key={p.id}>
                            <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm text-gray-500">
                              {new Date(p.timestamp).toLocaleDateString()}
                            </td>
                            <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900">
                              {p.package_name || 'Custom Payment'}
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
                        ))}
                        {data.payment.history.length === 0 && (
                          <tr>
                            <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">No payment history found.</td>
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