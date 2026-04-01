import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { db, auth } from './firebase';
import { UserProfile, UserRole, useAuth } from './AuthContext';
import { motion } from 'motion/react';
import { UserPlus, Trash2, ShieldCheck, Mail, Phone, Briefcase, Calendar as CalendarIcon, Loader2, ShieldAlert } from 'lucide-react';

const AdminDashboard: React.FC = () => {
  const { profile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [confirmAction, setConfirmAction] = useState<{
    type: 'reset' | 'delete';
    uid: string;
    email?: string;
    name?: string;
  } | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<UserRole>('ward_admin');
  const [wardId, setWardId] = useState('');

  const wards = ['Ward 1', 'Ward 2', 'Ward 4', 'Ward 5/6', 'Ward 7', 'Theatre', 'OPD', 'ICU'];

  useEffect(() => {
    if (profile?.role === 'admin') {
      fetchUsers();
    }
  }, [profile]);

  if (profile?.role !== 'admin') {
    return null; // Or a restricted access message
  }

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('hospital_auth_token') || await auth.currentUser?.getIdToken();
      const response = await fetch('/api/admin/users', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }

      const data = await response.json();
      // Filter out 'admin' and 'staff' for this view
      const filtered = data.filter((u: UserProfile) => ['cno', 'ward_admin', 'hr'].includes(u.role));
      setUsers(filtered);
    } catch (err) {
      console.error("Error fetching users:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const token = localStorage.getItem('hospital_auth_token') || await auth.currentUser?.getIdToken();
      const defaultPassword = role === 'cno' ? 'admin123' : 'TTADMIN123';
      
      const response = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ email, password: defaultPassword, name, phone, role, wardId })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create user');
      }

      setSuccess(`Account created successfully for ${name}. Default password: ${defaultPassword}`);
      setIsAdding(false);
      setName('');
      setEmail('');
      setPhone('');
      setWardId('');
      fetchUsers();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (uid: string, userEmail: string) => {
    const defaultPassword = userEmail === 'cno@tumutumu.org' ? 'admin123' : 'TTADMIN123';
    setError('');
    setSuccess('');
    setLoading(true);
    
    try {
      const token = localStorage.getItem('hospital_auth_token') || await auth.currentUser?.getIdToken();
      const response = await fetch('/api/admin/reset-password', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ uid, newPassword: defaultPassword })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to reset password');
      }
      setSuccess(`Password reset successfully for ${userEmail}`);
      setConfirmAction(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (uid: string) => {
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const token = localStorage.getItem('hospital_auth_token') || await auth.currentUser?.getIdToken();
      const response = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ uid })
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete user');
      }
      
      setSuccess('Account deleted successfully');
      setConfirmAction(null);
      fetchUsers();
    } catch (err: any) {
      console.error("Error deleting user:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div>
          <h2 className="text-2xl lg:text-3xl font-bold text-zinc-900 dark:text-white tracking-tight">System Administration</h2>
          <p className="text-zinc-500 text-sm mt-1">Manage high-level hospital administration accounts.</p>
        </div>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-semibold transition-all shadow-lg shadow-blue-600/20 w-full md:w-auto"
        >
          {isAdding ? 'Cancel' : <><UserPlus className="w-5 h-5" /> Add Administrator</>}
        </button>
      </div>

      {isAdding && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 lg:p-8 mb-8 shadow-xl"
        >
          <h3 className="text-lg lg:text-xl font-bold text-zinc-900 dark:text-white mb-6 flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            Create New Administrative Account
          </h3>
          <form onSubmit={handleAddUser} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Full Name</label>
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500/50 outline-none"
                placeholder="e.g. Dr. Jane Doe"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Email Address</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500/50 outline-none"
                placeholder="e.g. jane.doe@tumutumu.org"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Phone Number</label>
              <input 
                type="tel" 
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500/50 outline-none"
                placeholder="+254 ..."
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Role</label>
              <select 
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500/50 outline-none"
              >
                <option value="cno">Chief Nursing Officer (CNO)</option>
                <option value="ward_admin">Ward Administrator</option>
                <option value="hr">HR Manager</option>
              </select>
            </div>
            {role === 'ward_admin' && (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Assigned Ward</label>
                <select 
                  value={wardId}
                  onChange={(e) => setWardId(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500/50 outline-none"
                  required
                >
                  <option value="">Select a ward...</option>
                  {wards.map(w => <option key={w} value={w}>{w}</option>)}
                </select>
              </div>
            )}
            <div className="md:col-span-2 pt-4">
              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-200 dark:disabled:bg-zinc-700 text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create Account'}
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {error && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-500 dark:text-red-400 text-sm font-medium"
        >
          <ShieldAlert className="w-5 h-5 shrink-0" />
          {error}
        </motion.div>
      )}

      {success && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center gap-3 text-green-600 dark:text-green-400 text-sm font-medium"
        >
          <ShieldCheck className="w-5 h-5 shrink-0" />
          {success}
        </motion.div>
      )}

      {confirmAction && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 max-w-md w-full shadow-2xl"
          >
            <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">
              {confirmAction.type === 'reset' ? 'Reset Password' : 'Delete Account'}
            </h3>
            <p className="text-zinc-500 dark:text-zinc-400 mb-6">
              {confirmAction.type === 'reset' 
                ? `Are you sure you want to reset the password for ${confirmAction.name}? The password will be set to the system default.`
                : `Are you sure you want to permanently delete the account for ${confirmAction.name}? This action cannot be undone.`}
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setConfirmAction(null)}
                className="flex-1 px-4 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white font-semibold rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => confirmAction.type === 'reset' 
                  ? handleResetPassword(confirmAction.uid, confirmAction.email!) 
                  : handleDeleteUser(confirmAction.uid)}
                disabled={loading}
                className={`flex-1 px-4 py-2 font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 ${
                  confirmAction.type === 'reset' 
                    ? 'bg-blue-600 hover:bg-blue-500 text-white' 
                    : 'bg-red-600 hover:bg-red-500 text-white'
                }`}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800">
                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Administrator</th>
                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Contact</th>
                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Role</th>
                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Ward</th>
                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {loading && !isAdding ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto" />
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-zinc-500">
                    No administrators found. Create one to get started.
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.uid} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center font-bold text-blue-600 dark:text-blue-400 border border-zinc-200 dark:border-zinc-700">
                          {user.name.charAt(0)}
                        </div>
                        <span className="font-semibold text-zinc-900 dark:text-white">{user.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                          <Mail className="w-3 h-3" /> {user.email}
                        </div>
                        {user.phone && (
                          <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                            <Phone className="w-3 h-3" /> {user.phone}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                        user.role === 'cno' ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400' :
                        user.role === 'hr' ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400' :
                        'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                      }`}>
                        {user.role.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-zinc-600 dark:text-zinc-400">
                      {user.wardId || 'Global'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => setConfirmAction({ type: 'reset', uid: user.uid, email: user.email, name: user.name })}
                          className="p-2 text-zinc-400 hover:text-blue-500 transition-colors"
                          title="Reset Password"
                        >
                          <ShieldCheck className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => setConfirmAction({ type: 'delete', uid: user.uid, email: user.email, name: user.name })}
                          className="p-2 text-zinc-400 hover:text-red-500 transition-colors"
                          title="Delete Account"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
