import React, { useState, useEffect } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '../api';

interface UserRole {
  role: string;
  granted_at: string;
  granted_by: string;
}

interface User {
  id: string;
  google_id: string;
  email: string;
  name: string;
  profile_picture: string;
  is_active: boolean;
  last_login: string;
  created_at: string;
  roles: UserRole[];
}

interface ProvisionedUser {
  id: string;
  email: string;
  entity_type: 'student' | 'teacher';
  entity_id: string;
  role: string;
  entity_name: string;
  provisioned_by_name: string;
  provisioned_at: string;
  used_at: string | null;
}

interface EntityOption {
  id: string;
  name: string;
}

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [provisioned, setProvisioned] = useState<ProvisionedUser[]>([]);
  const [students, setStudents] = useState<EntityOption[]>([]);
  const [teachers, setTeachers] = useState<EntityOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Provision form state
  const [provEmail, setProvEmail] = useState('');
  const [provEntityType, setProvEntityType] = useState<'student' | 'teacher'>('student');
  const [provEntityId, setProvEntityId] = useState('');
  const [provSubmitting, setProvSubmitting] = useState(false);
  const [showProvisionForm, setShowProvisionForm] = useState(false);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [userData, provData, studentData, teacherData] = await Promise.all([
        apiGet('/api/users'),
        apiGet('/api/users/provisioned'),
        apiGet('/api/students'),
        apiGet('/api/teachers'),
      ]);
      setUsers(Array.isArray(userData) ? userData : (userData?.users || []));
      setProvisioned(Array.isArray(provData) ? provData : []);
      const rawStudents = Array.isArray(studentData) ? studentData : (studentData?.students || []);
      setStudents(rawStudents.map((s: any) => ({ id: s.id, name: s.name })));
      const rawTeachers = Array.isArray(teacherData) ? teacherData : (teacherData?.teachers || []);
      setTeachers(rawTeachers.map((t: any) => ({ id: t.id, name: t.name })));
      setError(null);
    } catch (err: any) {
      console.error('Error fetching data:', err);
      setError(err.message || 'Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 3000);
  };

  const showError = (msg: string) => {
    setError(msg);
    setTimeout(() => setError(null), 4000);
  };

  const handleToggleActive = async (user: User) => {
    try {
      await apiPut(`/api/users/${user.id}`, { is_active: !user.is_active });
      showSuccess(`User ${user.is_active ? 'deactivated' : 'activated'} successfully`);
      fetchAll();
    } catch (err: any) {
      showError(err.message || 'Failed to update user status');
    }
  };

  const handleAddRole = async (userId: string, role: string) => {
    if (!role) return;
    try {
      await apiPost(`/api/users/${userId}/roles`, { role });
      showSuccess('Role added successfully');
      fetchAll();
    } catch (err: any) {
      showError(err.message || 'Failed to add role');
    }
  };

  const handleRemoveRole = async (userId: string, role: string) => {
    if (!confirm(`Are you sure you want to remove the ${role} role?`)) return;
    try {
      await apiDelete(`/api/users/${userId}/roles/${role}`);
      showSuccess('Role removed successfully');
      fetchAll();
    } catch (err: any) {
      showError(err.message || 'Failed to remove role');
    }
  };

  const handleProvision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!provEmail || !provEntityId) return;
    setProvSubmitting(true);
    try {
      await apiPost('/api/users/provision', {
        email: provEmail,
        entity_type: provEntityType,
        entity_id: provEntityId,
      });
      showSuccess(`Access provisioned for ${provEmail}`);
      setProvEmail('');
      setProvEntityId('');
      setShowProvisionForm(false);
      fetchAll();
    } catch (err: any) {
      showError(err.message || 'Failed to provision user');
    } finally {
      setProvSubmitting(false);
    }
  };

  const handleRemoveProvision = async (id: string, email: string) => {
    if (!confirm(`Remove provisioning for ${email}?`)) return;
    try {
      await apiDelete(`/api/users/provisioned/${id}`);
      showSuccess('Provisioning removed');
      fetchAll();
    } catch (err: any) {
      showError(err.message || 'Failed to remove provisioning');
    }
  };

  const filteredUsers = users.filter(user =>
    (user.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.email || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const entityOptions = provEntityType === 'student' ? students : teachers;
  const availableRoles = ['admin', 'teacher', 'parent', 'student'];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">User Management</h2>
          <p className="text-slate-600 mt-1">Manage system access and user roles</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowProvisionForm(v => !v)}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition font-medium text-sm"
          >
            + Provision User
          </button>
          <button
            onClick={fetchAll}
            className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition text-sm"
          >
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-700 font-bold">×</button>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex justify-between items-center">
          <span>{success}</span>
          <button onClick={() => setSuccess(null)} className="text-green-700 font-bold">×</button>
        </div>
      )}

      {/* Provision New User Form */}
      {showProvisionForm && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-5">
          <h3 className="text-base font-semibold text-slate-800 mb-4">Provision New User</h3>
          <p className="text-sm text-slate-600 mb-4">
            Enter the email address the student or teacher will use to log in with Google.
            They will not be able to log in until provisioned.
          </p>
          <form onSubmit={handleProvision} className="flex flex-wrap gap-3 items-end">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-600">Email Address</label>
              <input
                type="email"
                required
                placeholder="user@gmail.com"
                value={provEmail}
                onChange={e => setProvEmail(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none text-sm w-64"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-600">Type</label>
              <div className="flex rounded-lg border border-slate-300 overflow-hidden text-sm">
                <button
                  type="button"
                  onClick={() => { setProvEntityType('student'); setProvEntityId(''); }}
                  className={`px-4 py-2 font-medium transition ${provEntityType === 'student' ? 'bg-orange-500 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                >
                  Student
                </button>
                <button
                  type="button"
                  onClick={() => { setProvEntityType('teacher'); setProvEntityId(''); }}
                  className={`px-4 py-2 font-medium transition ${provEntityType === 'teacher' ? 'bg-orange-500 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                >
                  Teacher
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-600">
                Link to {provEntityType === 'student' ? 'Student' : 'Teacher'}
              </label>
              <select
                required
                value={provEntityId}
                onChange={e => setProvEntityId(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none text-sm w-56"
              >
                <option value="">Select {provEntityType}...</option>
                {entityOptions.map(opt => (
                  <option key={opt.id} value={opt.id}>{opt.name}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={provSubmitting}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 transition text-sm font-medium"
              >
                {provSubmitting ? 'Saving...' : 'Provision'}
              </button>
              <button
                type="button"
                onClick={() => setShowProvisionForm(false)}
                className="px-4 py-2 bg-white border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 transition text-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Provisioned Users List */}
      {provisioned.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700">Provisioned Access</h3>
            <span className="text-xs text-slate-500">{provisioned.filter(p => !p.used_at).length} pending</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 text-xs font-semibold border-b border-slate-200">
                  <th className="px-5 py-3">Email</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3">Linked To</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Provisioned</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {provisioned.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-medium text-slate-800">{p.email}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        p.entity_type === 'teacher' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {p.entity_type}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{p.entity_name || '—'}</td>
                    <td className="px-5 py-3">
                      {p.used_at ? (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                          Activated
                        </span>
                      ) : (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-slate-500 text-xs">
                      {new Date(p.provisioned_at).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3">
                      {!p.used_at && (
                        <button
                          onClick={() => handleRemoveProvision(p.id, p.email)}
                          className="text-xs text-red-500 hover:text-red-700 font-medium"
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Existing Users Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-200 bg-slate-50">
          <input
            type="text"
            placeholder="🔍 Search users by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full md:w-96 px-4 py-2 rounded-lg border border-slate-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none"
          />
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
            <p className="mt-2 text-slate-500">Loading users...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 text-sm font-semibold border-b border-slate-200">
                  <th className="px-6 py-4">User</th>
                  <th className="px-6 py-4">Roles</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Last Login</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                      No users found matching your search.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50 transition">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {user.profile_picture ? (
                            <img src={user.profile_picture} alt={user.name} className="w-10 h-10 rounded-full" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-bold">
                              {(user.name || '?').charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div className="font-medium text-slate-900">{user.name}</div>
                            <div className="text-xs text-slate-500">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-2 items-center">
                          {(user.roles || []).map((roleObj) => (
                            <span key={roleObj.role} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {roleObj.role}
                              <button
                                onClick={() => handleRemoveRole(user.id, roleObj.role)}
                                className="ml-1.5 text-blue-600 hover:text-blue-900 font-bold"
                                title="Remove role"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                          <select
                            className="text-xs border border-slate-300 rounded px-2 py-1 focus:outline-none focus:border-orange-500"
                            onChange={(e) => {
                              if (e.target.value) {
                                handleAddRole(user.id, e.target.value);
                                e.target.value = '';
                              }
                            }}
                            value=""
                          >
                            <option value="">+ Add Role</option>
                            {availableRoles
                              .filter(r => !(user.roles || []).some(ur => ur.role === r))
                              .map(role => (
                                <option key={role} value={role}>{role}</option>
                              ))
                            }
                          </select>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${
                          user.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {user.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500">
                        {user.last_login ? new Date(user.last_login).toLocaleString() : 'Never'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleToggleActive(user)}
                          className={`text-sm font-medium ${
                            user.is_active ? 'text-red-600 hover:text-red-800' : 'text-green-600 hover:text-green-800'
                          }`}
                        >
                          {user.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserManagement;
