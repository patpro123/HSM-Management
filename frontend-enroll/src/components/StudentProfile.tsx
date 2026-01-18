import React, { useState, useEffect } from 'react';
import { authenticatedFetch, getCurrentUser } from '../auth';
import { API_BASE_URL } from '../config';

interface StudentProfile {
  student: {
    id: string;
    name: string;
    email: string;
    phone?: string;
    guardian_contact?: string;
    guardian_phone?: string;
    enrolled_since: string;
  };
  enrollments: {
    instrument: string;
    teacher: string;
    schedule: string;
    time: string;
    classes_remaining: number;
    payment_frequency: string;
    enrolled_on: string;
    status: string;
  }[];
  attendance: {
    current_month: {
      present: number;
      total: number;
      percentage: number;
    };
    last_3_months: {
      month: string;
      present: number;
      total: number;
      percentage: number;
    }[];
  };
  payments: {
    last_payment: {
      amount: number;
      date: string;
      method: string;
      transaction_id?: string;
    } | null;
    next_due_date: string | null;
    payment_history: {
      id: string;
      amount: number;
      date: string;
      method: string;
      package_name?: string;
      classes_count?: number;
    }[];
  };
}

const StudentProfile: React.FC = () => {
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const user = getCurrentUser();
  const userEmail = user?.email;

  useEffect(() => {
    if (userEmail) {
      fetchProfile();
    }
  }, [userEmail]);

  const fetchProfile = async () => {
    if (!userEmail) {
      setError('No user email found');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await authenticatedFetch(`${API_BASE_URL}/api/student-profile/${encodeURIComponent(userEmail)}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          setError('Student profile not found. Please contact administration.');
        } else {
          setError('Failed to load profile');
        }
        return;
      }

      const data = await response.json();
      setProfile(data);
    } catch (err) {
      console.error('Error fetching student profile:', err);
      setError('Error loading profile');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const getPaymentFrequencyLabel = (frequency: string) => {
    const labels: { [key: string]: string } = {
      monthly: 'Monthly (8 classes)',
      quarterly: 'Quarterly (24 classes)',
      half_yearly: 'Half-Yearly (48 classes)',
      yearly: 'Yearly (96 classes)'
    };
    return labels[frequency] || frequency;
  };

  const getAttendanceColor = (percentage: number) => {
    if (percentage >= 90) return 'text-green-600 bg-green-100';
    if (percentage >= 75) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
          <p className="mt-4 text-slate-600">Loading your profile...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md mx-auto">
          <h3 className="text-lg font-semibold text-red-800 mb-2">Error</h3>
          <p className="text-red-600">{error}</p>
          <button 
            onClick={fetchProfile}
            className="mt-4 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-8 text-center">
        <p className="text-slate-600">No profile data available</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-xl p-6 text-white">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-white bg-opacity-20 flex items-center justify-center text-2xl font-bold">
            {profile.student.name.split(' ').map(n => n[0]).join('').toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold">{profile.student.name}</h1>
            <p className="text-orange-100">Student Profile</p>
            <p className="text-sm text-orange-100">
              Member since {formatDate(profile.student.enrolled_since)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Enrollments */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
            🎵 Current Enrollments
          </h2>
          {profile.enrollments.length === 0 ? (
            <p className="text-slate-500 italic">No active enrollments</p>
          ) : (
            <div className="space-y-4">
              {profile.enrollments.map((enrollment, index) => (
                <div key={index} className="border border-slate-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold text-slate-800">{enrollment.instrument}</h3>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      enrollment.status === 'active' 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      {enrollment.status}
                    </span>
                  </div>
                  <div className="space-y-1 text-sm text-slate-600">
                    <p><span className="font-medium">Teacher:</span> {enrollment.teacher}</p>
                    <p><span className="font-medium">Schedule:</span> {enrollment.schedule}</p>
                    <p><span className="font-medium">Time:</span> {enrollment.time}</p>
                    <p><span className="font-medium">Classes Remaining:</span> 
                      <span className={`ml-1 font-bold ${
                        enrollment.classes_remaining < 5 ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {enrollment.classes_remaining}
                      </span>
                    </p>
                    <p><span className="font-medium">Payment Plan:</span> {getPaymentFrequencyLabel(enrollment.payment_frequency)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Attendance */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
            📊 Attendance Overview
          </h2>
          
          {/* Current Month */}
          <div className="mb-6">
            <h3 className="font-semibold text-slate-700 mb-2">This Month</h3>
            <div className="bg-slate-50 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <span className="text-slate-600">
                  {profile.attendance.current_month.present} of {profile.attendance.current_month.total} classes
                </span>
                <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                  getAttendanceColor(profile.attendance.current_month.percentage)
                }`}>
                  {profile.attendance.current_month.percentage}%
                </span>
              </div>
            </div>
          </div>

          {/* Last 3 Months */}
          <div>
            <h3 className="font-semibold text-slate-700 mb-2">Last 3 Months</h3>
            <div className="space-y-2">
              {profile.attendance.last_3_months.map((month, index) => (
                <div key={month.month} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                  <span className="text-slate-600 text-sm">
                    {new Date(month.month + '-01').toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">
                      {month.present}/{month.total}
                    </span>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      getAttendanceColor(month.percentage)
                    }`}>
                      {month.percentage}%
                    </span>
                  </div>
                </div>
              ))}
              {profile.attendance.last_3_months.length === 0 && (
                <p className="text-slate-500 italic text-sm">No attendance data available</p>
              )}
            </div>
          </div>
        </div>

        {/* Payment Information */}
        <div className="bg-white rounded-xl shadow-lg p-6 lg:col-span-2">
          <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
            💳 Payment Information
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Payment Status */}
            <div>
              <h3 className="font-semibold text-slate-700 mb-3">Payment Status</h3>
              
              {profile.payments.last_payment ? (
                <div className="space-y-3">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-green-600 font-medium">Last Payment</span>
                      <span className="text-lg font-bold text-green-700">
                        {formatCurrency(profile.payments.last_payment.amount)}
                      </span>
                    </div>
                    <div className="space-y-1 text-sm text-green-600">
                      <p>Date: {formatDate(profile.payments.last_payment.date)}</p>
                      <p>Method: {profile.payments.last_payment.method}</p>
                      {profile.payments.last_payment.transaction_id && (
                        <p>Transaction ID: {profile.payments.last_payment.transaction_id}</p>
                      )}
                    </div>
                  </div>

                  {profile.payments.next_due_date && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-amber-600 font-medium">Next Payment Due</span>
                        <span className="text-lg font-bold text-amber-700">
                          {formatDate(profile.payments.next_due_date)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <p className="text-slate-500 italic">No payment history available</p>
                </div>
              )}
            </div>

            {/* Payment History */}
            <div>
              <h3 className="font-semibold text-slate-700 mb-3">Recent Payments</h3>
              <div className="max-h-64 overflow-y-auto space-y-2">
                {profile.payments.payment_history.length > 0 ? (
                  profile.payments.payment_history.map((payment) => (
                    <div key={payment.id} className="border border-slate-200 rounded-lg p-3">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-medium text-slate-800">
                          {formatCurrency(payment.amount)}
                        </span>
                        <span className="text-xs text-slate-500">
                          {formatDate(payment.date)}
                        </span>
                      </div>
                      <div className="text-xs text-slate-600">
                        <p>Method: {payment.method}</p>
                        {payment.package_name && (
                          <p>Package: {payment.package_name} ({payment.classes_count} classes)</p>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-500 italic text-sm">No payment history available</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentProfile;