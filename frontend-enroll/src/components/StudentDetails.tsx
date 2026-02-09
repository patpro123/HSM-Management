import React, { useState, useEffect } from 'react';
import { Student, Batch, Instrument, PaymentFrequency } from '../types';

export interface EnrollmentSelection {
  batch_id: number | string;
  payment_frequency: PaymentFrequency;
  enrollment_date: string;
}

interface StudentDetailsProps {
  student?: Student | null;
  batches: Batch[];
  instruments: Instrument[];
  onSave: (data: any, enrollments: EnrollmentSelection[]) => void;
  onCancel: () => void;
}

const StudentDetails: React.FC<StudentDetailsProps> = ({ student, batches, instruments, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    date_of_birth: '',
    email: '',
    phone: '',
    guardian_name: '',
    guardian_phone: '',
    address: ''
  });
  const [selectedBatches, setSelectedBatches] = useState<EnrollmentSelection[]>([]);
  const [instrumentSettings, setInstrumentSettings] = useState<Record<string, { payment_frequency: PaymentFrequency; enrollment_date: string }>>({});

  useEffect(() => {
    if (student) {
      const name = (student as any).name || '';
      const nameParts = name.split(' ');
      const firstName = student.first_name || nameParts[0] || '';
      const lastName = student.last_name || (nameParts.length > 1 ? nameParts.slice(1).join(' ') : '');
      const metadata = (student as any).metadata || {};

      setFormData({
        first_name: firstName,
        last_name: lastName,
        date_of_birth: student.date_of_birth || (student as any).dob?.split('T')[0] || '',
        email: metadata.email || student.email || '',
        phone: student.phone || '',
        guardian_name: metadata.guardian_name || student.guardian_name || (student as any).guardian_contact || '',
        guardian_phone: metadata.guardian_phone || student.guardian_phone || '',
        address: metadata.address || student.address || ''
      });

      // Pre-select batches and payment modes if editing
      let initialBatches: EnrollmentSelection[] = [];
      const studentBatches = (student as any).batches || (student as any).enrollments;
      if (Array.isArray(studentBatches)) {
        initialBatches = studentBatches.map((enr: any) => ({
          batch_id: enr.batch_id || enr.batchId || '',
          payment_frequency: enr.payment_frequency || 'monthly',
          enrollment_date: enr.enrolled_on ? enr.enrolled_on.split('T')[0] : ''
        }));
      }
      setSelectedBatches(initialBatches);

      // Initialize instrument settings based on existing enrollments
      const newSettings: Record<string, any> = {};
      instruments.forEach(inst => {
        const instBatchIds = batches
          .filter(b => String(b.instrument_id) === String(inst.id))
          .map(b => String(b.id));
        
        // Find if any batch of this instrument is selected to grab settings
        const existing = initialBatches.find(eb => instBatchIds.includes(String(eb.batch_id)));
        
        newSettings[inst.id] = {
          payment_frequency: existing?.payment_frequency || 'monthly',
          enrollment_date: existing?.enrollment_date || new Date().toISOString().split('T')[0]
        };
      });
      setInstrumentSettings(newSettings);

    } else {
      setFormData({
        first_name: '',
        last_name: '',
        date_of_birth: '',
        email: '',
        phone: '',
        guardian_name: '',
        guardian_phone: '',
        address: ''
      });
      setSelectedBatches([]);
      
      // Reset instrument settings to defaults
      const newSettings: Record<string, any> = {};
      instruments.forEach(inst => {
        newSettings[inst.id] = {
          payment_frequency: 'monthly',
          enrollment_date: new Date().toISOString().split('T')[0]
        };
      });
      setInstrumentSettings(newSettings);
    }
  }, [student, instruments, batches]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleBatchToggle = (batchId: number | string, instrumentId: string) => {
    setSelectedBatches(prev => {
      const exists = prev.find(e => String(e.batch_id) === String(batchId));
      if (exists) {
        return prev.filter(e => String(e.batch_id) !== String(batchId));
      } else {
        const settings = instrumentSettings[instrumentId] || {
          payment_frequency: 'monthly',
          enrollment_date: new Date().toISOString().split('T')[0]
        };
        return [...prev, { 
          batch_id: batchId, 
          payment_frequency: settings.payment_frequency, 
          enrollment_date: settings.enrollment_date 
        }];
      }
    });
  };

  const handleInstrumentSettingChange = (instrumentId: string, field: 'payment_frequency' | 'enrollment_date', value: any) => {
    setInstrumentSettings(prev => ({
      ...prev,
      [instrumentId]: { ...prev[instrumentId], [field]: value }
    }));

    // Update all selected batches for this instrument
    const instBatches = batches.filter(b => String(b.instrument_id) === String(instrumentId));
    const instBatchIds = instBatches.map(b => String(b.id));

    setSelectedBatches(prev => prev.map(eb => {
      if (instBatchIds.includes(String(eb.batch_id))) {
        return { ...eb, [field]: value };
      }
      return eb;
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('📝 [StudentDetails] Submitting form:', { formData, selectedBatches });
    onSave(formData, selectedBatches);
  };

  // Group batches by instrument
  const batchesByInstrument = (instruments || []).map(instrument => ({
    instrument,
    batches: (batches || []).filter(batch => String(batch.instrument_id) === String(instrument.id))
  }));

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">First Name *</label>
          <input name="first_name" value={formData.first_name} onChange={handleInputChange} required className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Last Name *</label>
          <input name="last_name" value={formData.last_name} onChange={handleInputChange} required className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Date of Birth</label>
          <input type="date" name="date_of_birth" value={formData.date_of_birth} onChange={handleInputChange} className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Email</label>
          <input type="email" name="email" value={formData.email} onChange={handleInputChange} className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Phone</label>
          <input type="tel" name="phone" value={formData.phone} onChange={handleInputChange} className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Guardian Name</label>
          <input name="guardian_name" value={formData.guardian_name} onChange={handleInputChange} className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Guardian Phone</label>
          <input type="tel" name="guardian_phone" value={formData.guardian_phone} onChange={handleInputChange} className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">Address</label>
        <textarea name="address" value={formData.address} onChange={handleInputChange} rows={3} className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none" />
      </div>

      <div className="border-t border-slate-200 pt-4">
        <h3 className="text-lg font-bold text-slate-800 mb-3">Enroll in Batches <span className="text-red-500">*</span></h3>
        <p className="text-sm text-slate-600 mb-4">Select the batches and payment plan for this student</p>
        <div className="space-y-4 max-h-64 overflow-y-auto">
          {batchesByInstrument.map(({ instrument, batches: instrumentBatches }) => {
            const settings = instrumentSettings[instrument.id] || {
              payment_frequency: 'monthly',
              enrollment_date: new Date().toISOString().split('T')[0]
            };

            return (
              <div key={instrument.id} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">🎵 {instrument.name}</h4>
                
                {/* Instrument Level Controls */}
                <div className="grid grid-cols-2 gap-4 mb-4 bg-white p-3 rounded border border-slate-100">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Enrollment Date</label>
                    <input type="date" value={settings.enrollment_date} onChange={(e) => handleInstrumentSettingChange(instrument.id, 'enrollment_date', e.target.value)} className="text-xs px-2 py-1 rounded border border-slate-300 focus:border-indigo-500 outline-none w-full" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Frequency</label>
                    <select value={settings.payment_frequency} onChange={(e) => handleInstrumentSettingChange(instrument.id, 'payment_frequency', e.target.value as PaymentFrequency)} className="text-xs px-2 py-1 rounded border border-slate-300 focus:border-indigo-500 outline-none w-full">
                      <option value="monthly">Monthly (8 classes)</option>
                      <option value="quarterly">Quarterly (24 classes)</option>
                      <option value="half_yearly">Half-Yearly (48 classes)</option>
                    </select>
                  </div>
                </div>

                {instrumentBatches.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">No active batches available.</p>
                ) : (
                  <div className="space-y-2">
                    {instrumentBatches.map(batch => {
                      const isSelected = selectedBatches.some(e => String(e.batch_id) === String(batch.id));
                      return (
                        <div key={batch.id} className={`p-3 rounded-lg border transition ${isSelected ? 'border-orange-500 bg-orange-50' : 'border-slate-200 bg-white'}`}>
                          <div className="flex items-start gap-2">
                            <input type="checkbox" checked={isSelected} onChange={() => handleBatchToggle(batch.id, instrument.id)} className="mt-1 w-4 h-4 text-orange-600 rounded focus:ring-2 focus:ring-orange-500" />
                            <div className="flex-1">
                              <p className="font-semibold text-slate-900 text-sm">{batch.recurrence}</p>
                              <p className="text-xs text-slate-600">{batch.day_of_week} • {batch.start_time} - {batch.end_time}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex gap-3 pt-4">
        <button type="button" onClick={onCancel} className="flex-1 px-4 py-3 bg-slate-200 text-slate-700 rounded-lg font-semibold hover:bg-slate-300 transition">Cancel</button>
        <button type="submit" className="flex-1 px-4 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-lg font-semibold hover:from-orange-600 hover:to-amber-600 transition shadow-lg">{student ? 'Save Changes' : 'Add Student & Enroll'}</button>
      </div>
    </form>
  );
};

export default StudentDetails;
