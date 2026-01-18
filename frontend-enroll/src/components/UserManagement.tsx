import React, { useState, useEffect } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '../api';

interface User {
  id: string;
  google_id: string;
  email: string;
  name: string;
  profile_picture?: string;
  email_verified: boolean;
  last_login: string;
  is_active: boolean;
  created_at: string;
  roles: Array<{
    role: string;
    granted_at: string;
    granted_by: string;
  }>;
  teacher_id?: number;
  student_id?: number;
}

interface Teacher {
  id: number;
  name: string;
}

interface Student {
  id: number;
  fullName: string;
}

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [newRole, setNewRole] = useState('');
  const [linkEntityType, setLinkEntityType] = useState<'teacher' | 'student'>('teacher');
  const [linkEntityId, setLinkEntityId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchUsers();
    fetchTeachers();
    fetchStudents();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await apiGet('/api/users');
      setUsers(data);
      setError('');
    } catch (error: any) {
      console.error('Error fetching users:', error);
      setError('Failed to load users. Make sure you have admin access.');
    } finally {
      setLoading(false);
    }
  };

  const fetchTeachers = async () => {
    try {
      const data = await apiGet('/api/teachers');
      setTeachers(data);
    } catch (error) {
      console.error('Error fetching teachers:', error);
    }
  };

  const fetchStudents = async () => {
    try {
      const data = await apiGet('/api/students');
      setStudents(data);
    } catch (error) {
      console.error('Error fetching students:', error);
    }
  };

  const handleToggleActive = async (user: User) => {
    try {
      await apiPut(`/api/users/${user.id}`, { is_active: !user.is_active });
      await fetchUsers();
    } catch (error) {
      console.error('Error toggling user status:', error);
      setError('Failed to update user status');
    }
  };

  const handleAssignRole = async () => {
    if (!selectedUser || !newRole) return;

    try {
      await apiPost(`/api/users/${selectedUser.id}/roles`, { role: newRole });
      await fetchUsers();
      setShowRoleModal(false);
      setNewRole('');
      setSelectedUser(null);
      setError('');
    } catch (error: any) {
      console.error('Error assigning role:', error);
      setError(error.response?.data?.error || 'Failed to assign role');
    }
  };

  const handleRevokeRole = async (userId: string, role: string) => {
    if (!window.confirm(`Are you sure you want to revoke the ${role} role?`)) {
      return;
    }

    try {
      await apiDelete(`/api/users/${userId}/roles/${role}`);
      await fetchUsers();
      setError('');
    } catch (error: any) {
      console.error('Error revoking role:', error);
      setError(error.response?.data?.error || 'Failed to revoke role');
    }
  };

  const handleLinkEntity = async () => {
    if (!selectedUser || !linkEntityId) return;

    try {
      await apiPost(`/api/users/${selectedUser.id}/link`, {
        entity_type: linkEntityType,
        entity_id: parseInt(linkEntityId)
      });
      await fetchUsers();
      setShowLinkModal(false);
      setLinkEntityId('');
      setSelectedUser(null);
      setError('');
    } catch (error: any) {
      console.error('Error linking entity:', error);
      setError(error.response?.data?.error || 'Failed to link entity');
    }
  };

  const handleUnlinkEntity = async (userId: string, entityType: 'teacher' | 'student', entityId: number) => {
    if (!window.confirm(`Are you sure you want to unlink this ${entityType}?`)) {
      return;
    }

    try {
      await apiDelete(`/api/users/${userId}/link/${entityType}/${entityId}`);
      await fetchUsers();
      setError('');
    } catch (error: any) {
      console.error('Error unlinking entity:', error);
      setError(error.response?.data?.error || 'Failed to unlink entity');
    }
  };

  const openRoleModal = (user: User) => {
    setSelectedUser(user);
    setShowRoleModal(true);
    setError('');
  };

  const openLinkModal = (user: User) => {
    setSelectedUser(user);
    setShowLinkModal(true);
    setLinkEntityType('teacher');
    setLinkEntityId('');
    setError('');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return <div className="p-6">Loading users...</div>;
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">User Management</h2>
        <button
          onClick={fetchUsers}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                User
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Roles
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Links
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Last Login
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map((user) => (
              <tr key={user.id} className={!user.is_active ? 'bg-gray-50' : ''}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    {user.profile_picture && (
                      <img
                        src={user.profile_picture}
                        alt={user.name}
                        className="h-10 w-10 rounded-full mr-3"
                      />
                    )}
                    <div>
                      <div className="text-sm font-medium text-gray-900">{user.name}</div>
                      {user.email_verified && (
                        <div className="text-xs text-green-600">✓ Verified</div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{user.email}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1">
                    {user.roles.map((roleObj) => (
                      <span
                        key={roleObj.role}
                        className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                      >
                        {roleObj.role}
                        <button
                          onClick={() => handleRevokeRole(user.id, roleObj.role)}
                          className="ml-1 text-blue-600 hover:text-blue-800"
                          title="Revoke role"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    <button
                      onClick={() => openRoleModal(user)}
                      className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 hover:bg-gray-200"
                      title="Add role"
                    >
                      + Add
                    </button>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm">
                    {user.teacher_id && (
                      <div className="mb-1">
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-purple-100 text-purple-800">
                          Teacher #{user.teacher_id}
                          <button
                            onClick={() => handleUnlinkEntity(user.id, 'teacher', user.teacher_id!)}
                            className="ml-1 text-purple-600 hover:text-purple-800"
                            title="Unlink teacher"
                          >
                            ×
                          </button>
                        </span>
                      </div>
                    )}
                    {user.student_id && (
                      <div className="mb-1">
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-green-100 text-green-800">
                          Student #{user.student_id}
                          <button
                            onClick={() => handleUnlinkEntity(user.id, 'student', user.student_id!)}
                            className="ml-1 text-green-600 hover:text-green-800"
                            title="Unlink student"
                          >
                            ×
                          </button>
                        </span>
                      </div>
                    )}
                    <button
                      onClick={() => openLinkModal(user)}
                      className="text-xs text-blue-600 hover:text-blue-800"
                    >
                      + Link Entity
                    </button>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      user.is_active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {user.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {user.last_login ? formatDate(user.last_login) : 'Never'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button
                    onClick={() => handleToggleActive(user)}
                    className={`${
                      user.is_active
                        ? 'text-red-600 hover:text-red-900'
                        : 'text-green-600 hover:text-green-900'
                    }`}
                  >
                    {user.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Role Assignment Modal */}
      {showRoleModal && selectedUser && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium mb-4">
              Assign Role to {selectedUser.name}
            </h3>
            
            {error && (
              <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded text-sm">
                {error}
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Role
              </label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Select Role --</option>
                <option value="admin">Admin</option>
                <option value="teacher">Teacher</option>
                <option value="parent">Parent</option>
                <option value="student">Student</option>
              </select>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowRoleModal(false);
                  setNewRole('');
                  setSelectedUser(null);
                  setError('');
                }}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleAssignRole}
                disabled={!newRole}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Assign Role
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Entity Linking Modal */}
      {showLinkModal && selectedUser && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium mb-4">
              Link Entity to {selectedUser.name}
            </h3>

            {error && (
              <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded text-sm">
                {error}
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Entity Type
              </label>
              <select
                value={linkEntityType}
                onChange={(e) => {
                  setLinkEntityType(e.target.value as 'teacher' | 'student');
                  setLinkEntityId('');
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="teacher">Teacher</option>
                <option value="student">Student</option>
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select {linkEntityType === 'teacher' ? 'Teacher' : 'Student'}
              </label>
              <select
                value={linkEntityId}
                onChange={(e) => setLinkEntityId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Select {linkEntityType === 'teacher' ? 'Teacher' : 'Student'} --</option>
                {linkEntityType === 'teacher'
                  ? teachers.map((teacher) => (
                      <option key={teacher.id} value={teacher.id}>
                        {teacher.name} (ID: {teacher.id})
                      </option>
                    ))
                  : students.map((student) => (
                      <option key={student.id} value={student.id}>
                        {student.fullName} (ID: {student.id})
                      </option>
                    ))}
              </select>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowLinkModal(false);
                  setLinkEntityId('');
                  setSelectedUser(null);
                  setError('');
                }}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleLinkEntity}
                disabled={!linkEntityId}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Link Entity
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
