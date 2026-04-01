import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db, auth } from './firebase';
import { useAuth, UserProfile } from './AuthContext';
import { format } from 'date-fns';
import { motion } from 'motion/react';
import { FileText, Users, CheckCircle, Loader2, Search, Filter } from 'lucide-react';

interface Rota {
  id: string;
  wardId: string;
  month: string;
  status: 'draft' | 'pending_cno' | 'approved';
  submittedBy: string;
  approvedBy?: string;
  timestamp: string;
}

const HRDashboard: React.FC = () => {
  const { profile } = useAuth();
  const [approvedRotas, setApprovedRotas] = useState<Rota[]>([]);
  const [staffList, setStaffList] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWard, setSelectedWard] = useState('all');

  if (profile?.role !== 'hr') {
    return null;
  }

  useEffect(() => {
    if (profile?.role !== 'hr') return;

    const q = query(
      collection(db, 'rotas'),
      where('status', '==', 'approved'),
      orderBy('timestamp', 'desc')
    );

    const fetchStaff = async () => {
      try {
        const token = localStorage.getItem('hospital_auth_token') || await auth.currentUser?.getIdToken();
        const response = await fetch('/api/admin/users', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          setStaffList(data);
        }
      } catch (err) {
        console.error("Error fetching staff list:", err);
      }
    };

    const unsubRotas = onSnapshot(q, (snapshot) => {
      setApprovedRotas(snapshot.docs.map(doc => doc.data() as Rota));
      setLoading(false);
    });

    fetchStaff();

    return () => {
      unsubRotas();
    };
  }, [profile]);

  const filteredStaff = staffList.filter(s => 
    (selectedWard === 'all' || s.wardId === selectedWard) &&
    (s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const wards = Array.from(new Set(staffList.map(s => s.wardId))).filter(Boolean);

  if (loading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-12 h-12 text-blue-500 animate-spin" /></div>;

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-8 lg:space-y-12">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-2xl lg:text-4xl font-black text-zinc-900 dark:text-white tracking-tighter flex items-center gap-4">
            <FileText className="w-8 h-8 lg:w-10 lg:h-10 text-blue-500" />
            HR Overview
          </h2>
          <p className="text-zinc-500 mt-2 font-medium text-sm lg:text-base">Monitoring approved rotas and hospital-wide staff data.</p>
        </div>
        <div className="flex items-center justify-between md:justify-end gap-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl shadow-xl w-full md:w-auto">
          <div className="text-right">
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Approved Rotas</p>
            <p className="text-xl lg:text-2xl font-black text-zinc-900 dark:text-white">{approvedRotas.length}</p>
          </div>
          <div className="w-px h-10 bg-zinc-200 dark:bg-zinc-800 mx-2" />
          <div className="text-right">
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Total Staff</p>
            <p className="text-xl lg:text-2xl font-black text-zinc-900 dark:text-white">{staffList.length}</p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Approved Rotas List */}
        <section className="lg:col-span-1 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg lg:text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              Approved Rotas
            </h3>
          </div>
          <div className="space-y-4">
            {approvedRotas.length === 0 ? (
              <div className="p-12 text-center bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 border-dashed rounded-3xl text-zinc-500">No approved rotas yet.</div>
            ) : (
              approvedRotas.map(rota => (
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  key={rota.id} 
                  className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl hover:border-blue-500/30 dark:hover:border-zinc-700 transition-all shadow-lg"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">{rota.wardId}</p>
                      <h4 className="text-lg font-bold text-zinc-900 dark:text-white">{format(new Date(rota.month + '-01'), 'MMMM yyyy')}</h4>
                    </div>
                    <div className="bg-green-500/10 text-green-600 dark:text-green-400 p-2 rounded-xl">
                      <CheckCircle className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-tighter space-y-1">
                    <p>Approved on: {format(new Date(rota.timestamp), 'MMM dd, yyyy')}</p>
                    <p>ID: {rota.id.substring(0, 8)}</p>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </section>

        {/* Global Staff List */}
        <section className="lg:col-span-2 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h3 className="text-lg lg:text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              Staff Directory
            </h3>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input 
                  type="text" 
                  placeholder="Search staff..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-10 pr-4 py-2 text-sm text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500/50 outline-none w-full"
                />
              </div>
              <select 
                value={selectedWard}
                onChange={(e) => setSelectedWard(e.target.value)}
                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2 text-sm text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500/50 outline-none w-full sm:w-auto"
              >
                <option value="all">All Wards</option>
                {wards.map(w => <option key={w} value={w}>{w}</option>)}
              </select>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
                    <th className="px-6 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest">Staff Member</th>
                    <th className="px-6 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest">NCK Registration</th>
                    <th className="px-6 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest">License Expiry</th>
                    <th className="px-6 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest">Ward</th>
                    <th className="px-6 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest">Contact</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {filteredStaff.map(s => {
                    const expiryDate = s.licenseExpiryDate ? new Date(s.licenseExpiryDate) : null;
                    const isExpired = expiryDate && expiryDate < new Date();
                    const isExpiringSoon = expiryDate && !isExpired && expiryDate < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

                    return (
                      <tr key={s.uid} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-all group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-zinc-100 dark:bg-zinc-800 rounded-xl flex items-center justify-center font-bold text-blue-600 dark:text-blue-400 border border-zinc-200 dark:border-zinc-700 group-hover:border-blue-500/50 transition-all">
                              {s.name.charAt(0)}
                            </div>
                            <div>
                              <p className="font-bold text-zinc-900 dark:text-white">{s.name}</p>
                              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-tighter">{s.role.replace('_', ' ')}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-xs font-mono text-zinc-600 dark:text-zinc-300">{s.nckRegistrationNumber || 'N/A'}</p>
                        </td>
                        <td className="px-6 py-4">
                          <div className={`text-xs font-bold ${
                            isExpired ? 'text-red-500 dark:text-red-400' : isExpiringSoon ? 'text-yellow-600 dark:text-yellow-400' : 'text-zinc-500 dark:text-zinc-400'
                          }`}>
                            {s.licenseExpiryDate || 'N/A'}
                            {isExpired && <span className="ml-2 text-[8px] bg-red-500/10 px-1 py-0.5 rounded border border-red-500/20">EXPIRED</span>}
                            {isExpiringSoon && <span className="ml-2 text-[8px] bg-yellow-500/10 px-1 py-0.5 rounded border border-yellow-500/20">SOON</span>}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-3 py-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-full text-[10px] font-black uppercase tracking-widest">
                            {s.wardId || 'Global'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-xs space-y-1">
                            <p className="text-zinc-700 dark:text-zinc-300 font-medium">{s.email}</p>
                            <p className="text-zinc-500">{s.phone || 'No phone'}</p>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default HRDashboard;
