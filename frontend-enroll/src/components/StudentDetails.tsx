import React, { useState } from 'react';
import { Student } from '../types';

interface StudentDetailsProps {
  student: Student;
  onUpdate: (updated: Student) => void;
}

const StudentDetails: React.FC<StudentDetailsProps> = ({ student, onUpdate }) => {
  const [form, setForm] = useState({
    first_name: student.first_name || '',
    last_name: student.last_name || '',
    email: student.email || '',
    phone: student.phone || '',
    address: student.address || '',
    guardian_name: student.guardian_name || '',
    guardian_phone: student.guardian_phone || '',
  });
  const [saving, setSaving] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    // Call onUpdate with new data
    onUpdate({ ...student, ...form });
    setSaving(false);
  };

  return (
    <form className="max-w-xl mx-auto bg-white rounded-xl shadow p-8 mt-10" onSubmit={handleSubmit}>
      <h2 className="text-2xl font-bold mb-4">Student Details</h2>
      <div className="mb-4">
        <label className="block font-semibold mb-1">First Name</label>
        <input name="first_name" value={form.first_name} onChange={handleChange} className="w-full border rounded p-2" />
      </div>
      <div className="mb-4">
        <label className="block font-semibold mb-1">Last Name</label>
        <input name="last_name" value={form.last_name} onChange={handleChange} className="w-full border rounded p-2" />
      </div>
      <div className="mb-4">
        <label className="block font-semibold mb-1">Email</label>
        <input name="email" value={form.email} onChange={handleChange} className="w-full border rounded p-2" />
      </div>
      <div className="mb-4">
        <label className="block font-semibold mb-1">Phone</label>
        <input name="phone" value={form.phone} onChange={handleChange} className="w-full border rounded p-2" />
      </div>
      <div className="mb-4">
        <label className="block font-semibold mb-1">Address</label>
        <input name="address" value={form.address} onChange={handleChange} className="w-full border rounded p-2" />
      </div>
      <div className="mb-4">
        <label className="block font-semibold mb-1">Guardian Name</label>
        <input name="guardian_name" value={form.guardian_name} onChange={handleChange} className="w-full border rounded p-2" />
      </div>
      <div className="mb-4">
        <label className="block font-semibold mb-1">Guardian Phone</label>
        <input name="guardian_phone" value={form.guardian_phone} onChange={handleChange} className="w-full border rounded p-2" />
      </div>
      <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded" disabled={saving}>
        {saving ? 'Saving...' : 'Update'}
      </button>
    </form>
  );
};

export default StudentDetails;
