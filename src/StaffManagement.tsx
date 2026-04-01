import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db, auth } from './firebase';
import { UserProfile, useAuth } from './AuthContext';
import { motion } from 'motion/react';
import { UserPlus, Trash2, Mail, Phone, Briefcase, Loader2, Search, Filter, IdCard, Calendar as CalendarIcon, ShieldCheck } from 'lucide-react';

const StaffManagement: React.FC = () => {
  const { profile } = useAuth();
  const [staff, setStaff] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterWard, setFilterWard] = useState('all');

  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [nckRegistrationNumber, setNckRegistrationNumber] = useState('');
  const [licenseExpiryDate, setLicenseExpiryDate] = useState('');
  const [wardId, setWardId] = useState(profile?.role === 'ward_admin' ? profile.wardId || '' : '');

  const wards = ['Ward 1', 'Ward 2', 'Ward 4', 'Ward 5/6', 'Ward 7', 'Theatre', 'OPD', 'ICU'];

  useEffect(() => {
    if (!profile) return;

    const fetchStaff = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('hospital_auth_token') || await auth.currentUser?.getIdToken();
        const response = await fetch('/api/admin/users?role=staff', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch staff');
        }

        const data = await response.json();
        setStaff(data);
      } catch (err: any) {
        console.error("Error fetching staff:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchStaff();
  }, [profile]);

  if (!profile || !['admin', 'cno', 'ward_admin'].includes(profile.role)) {
    return null;
  }

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const token = localStorage.getItem('hospital_auth_token') || await auth.currentUser?.getIdToken();
      const response = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          email, 
          password: 'TTNURSING123', 
          name, 
          phone, 
          role: 'staff', 
          wardId: profile?.role === 'ward_admin' ? profile.wardId : wardId,
          nckRegistrationNumber,
          licenseExpiryDate
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create staff account');
      }

      setSuccess(`Staff account created successfully for ${name}. Default password: TTNURSING123`);
      setIsAdding(false);
      resetForm();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setName('');
    setEmail('');
    setPhone('');
    setNckRegistrationNumber('');
    setLicenseExpiryDate('');
    if (profile?.role !== 'ward_admin') setWardId('');
  };

  const handleResetPassword = async (uid: string, userEmail: string) => {
    if (!window.confirm(`Reset password for ${userEmail} to "TTNURSING123"?`)) return;
    
    try {
      const token = localStorage.getItem('hospital_auth_token') || await auth.currentUser?.getIdToken();
      const response = await fetch('/api/admin/reset-password', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ uid, newPassword: 'TTNURSING123' })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to reset password');
      }
      alert('Password reset successfully');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteStaff = async (uid: string) => {
    if (!window.confirm('Are you sure you want to delete this staff account?')) return;
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
        throw new Error(data.error || 'Failed to delete staff member');
      }
    } catch (err: any) {
      console.error("Error deleting staff:", err);
      alert(err.message);
    }
  };

  const filteredStaff = staff.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         s.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         s.nckRegistrationNumber?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesWard = filterWard === 'all' || s.wardId === filterWard;
    return matchesSearch && matchesWard;
  });

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div>
          <h2 className="text-2xl lg:text-3xl font-bold text-zinc-900 dark:text-white tracking-tight">Staff Management</h2>
          <p className="text-zinc-500 text-sm mt-1">
            {profile?.role === 'ward_admin' ? `Managing staff for ${profile.wardId}` : 'Global staff directory and management.'}
          </p>
        </div>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-semibold transition-all shadow-lg shadow-blue-600/20 w-full md:w-auto"
        >
          {isAdding ? 'Cancel' : <><UserPlus className="w-5 h-5" /> Add New Staff</>}
        </button>
      </div>

      {isAdding && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 lg:p-8 mb-8 shadow-xl"
        >
          <h3 className="text-lg lg:text-xl font-bold text-zinc-900 dark:text-white mb-6 flex items-center gap-2">
            <UserPlus className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            Register New Staff Member
          </h3>
          <form onSubmit={handleAddStaff} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Full Name</label>
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500/50 outline-none"
                placeholder="e.g. Kelvin Mugo"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Gmail Address</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500/50 outline-none"
                placeholder="e.g. kelvin@gmail.com"
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
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">NCK Registration No.</label>
              <input 
                type="text" 
                value={nckRegistrationNumber}
                onChange={(e) => setNckRegistrationNumber(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500/50 outline-none"
                placeholder="e.g. KRCHN-12345"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">License Expiry Date</label>
              <input 
                type="date" 
                value={licenseExpiryDate}
                onChange={(e) => setLicenseExpiryDate(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500/50 outline-none"
                required
              />
            </div>
            {profile?.role !== 'ward_admin' && (
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
            <div className="lg:col-span-3 pt-4">
              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-200 dark:disabled:bg-zinc-700 text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Register Staff Member'}
              </button>
            </div>
          </form>
          {error && <p className="mt-4 text-red-500 dark:text-red-400 text-sm font-medium">{error}</p>}
          {success && <p className="mt-4 text-green-600 dark:text-green-400 text-sm font-medium">{success}</p>}
        </motion.div>
      )}

      <div className="mb-6 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
          <input 
            type="text" 
            placeholder="Search by name, email, or NCK number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-12 pr-4 py-3 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500/50 outline-none shadow-sm"
          />
        </div>
        {profile?.role !== 'ward_admin' && (
          <div className="relative w-full md:w-64">
            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
            <select 
              value={filterWard}
              onChange={(e) => setFilterWard(e.target.value)}
              className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-12 pr-4 py-3 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500/50 outline-none appearance-none font-semibold shadow-sm"
            >
              <option value="all">All Wards</option>
              {wards.map(w => <option key={w} value={w}>{w}</option>)}
            </select>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800">
                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Staff Member</th>
                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">NCK Registration</th>
                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">License Expiry</th>
                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Contact</th>
                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Ward</th>
                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {loading && !isAdding ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto" />
                  </td>
                </tr>
              ) : filteredStaff.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-zinc-500">
                    No staff members found.
                  </td>
                </tr>
              ) : (
                filteredStaff.map((s) => {
                  const expiryDate = s.licenseExpiryDate ? new Date(s.licenseExpiryDate) : null;
                  const isExpired = expiryDate && expiryDate < new Date();
                  const isExpiringSoon = expiryDate && !isExpired && expiryDate < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

                  return (
                    <tr key={s.uid} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center font-bold text-blue-600 dark:text-blue-400 border border-zinc-200 dark:border-zinc-700">
                            {s.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-semibold text-zinc-900 dark:text-white">{s.name}</p>
                            <p className="text-xs text-zinc-500 uppercase font-bold tracking-tighter">Nurse</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300 font-mono">
                          <IdCard className="w-4 h-4 text-zinc-400 dark:text-zinc-500" /> {s.nckRegistrationNumber || 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className={`flex items-center gap-2 text-sm font-medium ${
                          isExpired ? 'text-red-500 dark:text-red-400' : isExpiringSoon ? 'text-yellow-600 dark:text-yellow-400' : 'text-zinc-600 dark:text-zinc-300'
                        }`}>
                          <CalendarIcon className="w-4 h-4" />
                          {s.licenseExpiryDate || 'N/A'}
                          {isExpired && <span className="text-[10px] bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20 ml-1">EXPIRED</span>}
                          {isExpiringSoon && <span className="text-[10px] bg-yellow-500/10 px-1.5 py-0.5 rounded border border-yellow-500/20 ml-1">SOON</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                          <Mail className="w-3 h-3" /> {s.email}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                          <Phone className="w-3 h-3" /> {s.phone}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-500/10 text-blue-600 dark:text-blue-400">
                        {s.wardId}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => handleResetPassword(s.uid, s.email)}
                          className="p-2 text-zinc-400 hover:text-blue-500 transition-colors"
                          title="Reset Password"
                        >
                          <ShieldCheck className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => handleDeleteStaff(s.uid)}
                          className="p-2 text-zinc-400 hover:text-red-500 transition-colors"
                          title="Delete Account"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default StaffManagement;
