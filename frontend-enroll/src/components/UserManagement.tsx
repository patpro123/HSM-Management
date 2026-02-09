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

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await apiGet('/api/users');
      setUsers(data || []);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching users:', err);
      setError('Failed to load users. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleToggleActive = async (user: User) => {
    try {
      await apiPut(`/api/users/${user.id}`, { is_active: !user.is_active });
      setSuccess(`User ${user.is_active ? 'deactivated' : 'activated'} successfully`);
      fetchUsers();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update user status');
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleAddRole = async (userId: string, role: string) => {
    if (!role) return;
    try {
      await apiPost(`/api/users/${userId}/roles`, { role });
      setSuccess('Role added successfully');
      fetchUsers();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to add role');
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleRemoveRole = async (userId: string, role: string) => {
    if (!confirm(`Are you sure you want to remove the ${role} role?`)) return;
    try {
      await apiDelete(`/api/users/${userId}/roles/${role}`);
      setSuccess('Role removed successfully');
      fetchUsers();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to remove role');
      setTimeout(() => setError(null), 3000);
    }
  };

  const filteredUsers = users.filter(user => 
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const availableRoles = ['admin', 'teacher', 'parent', 'student'];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">User Management</h2>
          <p className="text-slate-600 mt-1">Manage system access and user roles</p>
        </div>
        <button 
          onClick={fetchUsers}
          className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition"
        >
          Refresh List
        </button>
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
                              {user.name.charAt(0).toUpperCase()}
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
                          {user.roles.map((roleObj) => (
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
                              .filter(r => !user.roles.some(ur => ur.role === r))
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