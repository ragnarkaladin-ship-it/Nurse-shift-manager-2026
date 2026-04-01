import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, setDoc, updateDoc, onSnapshot, addDoc, deleteDoc, orderBy } from 'firebase/firestore';
import { db, auth } from './firebase';
import { UserProfile, useAuth } from './AuthContext';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { ClipboardList, Plus, CheckCircle, XCircle, Clock, Loader2, User, Calendar as CalendarIcon, MessageSquare, Send } from 'lucide-react';

interface LeaveRequest {
  id: string;
  staffId: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: string;
  timestamp: string;
}

interface SwapRequest {
  id: string;
  requesterId: string;
  targetStaffId: string;
  requesterDate: string;
  targetDate: string;
  status: 'pending_target' | 'pending_cno' | 'approved' | 'rejected';
  timestamp: string;
}

const Requests: React.FC = () => {
  const { profile } = useAuth();
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [swapRequests, setSwapRequests] = useState<SwapRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddingLeave, setIsAddingLeave] = useState(false);
  const [isAddingSwap, setIsAddingSwap] = useState(false);
  const [staffList, setStaffList] = useState<UserProfile[]>([]);

  if (!profile || !['cno', 'hr', 'staff'].includes(profile.role)) {
    return null;
  }

  // Form state
  const [leaveStart, setLeaveStart] = useState('');
  const [leaveEnd, setLeaveEnd] = useState('');
  const [leaveReason, setLeaveReason] = useState('');
  const [swapTarget, setSwapTarget] = useState('');
  const [swapReqDate, setSwapReqDate] = useState('');
  const [swapTargetDate, setSwapTargetDate] = useState('');

  useEffect(() => {
    if (!profile) return;
    fetchRequests();
    if (profile.role === 'staff') fetchStaffList();
  }, [profile]);

  const fetchStaffList = async () => {
    try {
      const token = localStorage.getItem('hospital_auth_token') || await auth.currentUser?.getIdToken();
      const response = await fetch(`/api/admin/users?role=staff&wardId=${profile?.wardId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setStaffList(data.filter((s: UserProfile) => s.uid !== profile?.uid));
      }
    } catch (err) {
      console.error("Error fetching staff list:", err);
    }
  };

  const fetchRequests = () => {
    setLoading(true);
    let leaveQ, swapQ;

    if (profile?.role === 'cno' || profile?.role === 'hr') {
      leaveQ = query(collection(db, 'leaveRequests'), orderBy('timestamp', 'desc'));
      swapQ = query(collection(db, 'swapRequests'), orderBy('timestamp', 'desc'));
    } else {
      leaveQ = query(collection(db, 'leaveRequests'), where('staffId', '==', profile?.uid), orderBy('timestamp', 'desc'));
      swapQ = query(collection(db, 'swapRequests'), where('requesterId', '==', profile?.uid), orderBy('timestamp', 'desc'));
    }

    const unsubLeave = onSnapshot(leaveQ, (snapshot) => {
      setLeaveRequests(snapshot.docs.map(doc => doc.data() as LeaveRequest));
    });

    const unsubSwap = onSnapshot(swapQ, (snapshot) => {
      setSwapRequests(snapshot.docs.map(doc => doc.data() as SwapRequest));
      setLoading(false);
    });

    return () => {
      unsubLeave();
      unsubSwap();
    };
  };

  const handleCreateLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    try {
      const id = doc(collection(db, 'leaveRequests')).id;
      await setDoc(doc(db, 'leaveRequests', id), {
        id,
        staffId: profile.uid,
        startDate: leaveStart,
        endDate: leaveEnd,
        reason: leaveReason,
        status: 'pending',
        timestamp: new Date().toISOString()
      });
      setIsAddingLeave(false);
      setLeaveStart('');
      setLeaveEnd('');
      setLeaveReason('');
    } catch (err) {
      console.error("Error creating leave request:", err);
    }
  };

  const handleCreateSwap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    try {
      const id = doc(collection(db, 'swapRequests')).id;
      await setDoc(doc(db, 'swapRequests', id), {
        id,
        requesterId: profile.uid,
        targetStaffId: swapTarget,
        requesterDate: swapReqDate,
        targetDate: swapTargetDate,
        status: 'pending_target',
        timestamp: new Date().toISOString()
      });
      setIsAddingSwap(false);
      setSwapTarget('');
      setSwapReqDate('');
      setSwapTargetDate('');
    } catch (err) {
      console.error("Error creating swap request:", err);
    }
  };

  const handleReviewLeave = async (id: string, status: 'approved' | 'rejected') => {
    if (profile?.role !== 'cno') return;
    try {
      await updateDoc(doc(db, 'leaveRequests', id), {
        status,
        reviewedBy: profile.uid
      });
    } catch (err) {
      console.error("Error reviewing leave request:", err);
    }
  };

  const handleReviewSwap = async (id: string, status: 'approved' | 'rejected' | 'pending_cno') => {
    try {
      await updateDoc(doc(db, 'swapRequests', id), { status });
    } catch (err) {
      console.error("Error reviewing swap request:", err);
    }
  };

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div>
          <h2 className="text-2xl lg:text-3xl font-bold text-zinc-900 dark:text-white tracking-tight flex items-center gap-3">
            <ClipboardList className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            Requests & Approvals
          </h2>
          <p className="text-zinc-500 text-sm mt-1">Manage leave requests and duty swaps.</p>
        </div>
        {profile?.role === 'staff' && (
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <button 
              onClick={() => setIsAddingLeave(!isAddingLeave)}
              className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-3 rounded-xl font-semibold transition-all shadow-lg shadow-blue-600/20 w-full sm:w-auto"
            >
              <Plus className="w-4 h-4" /> Leave Request
            </button>
            <button 
              onClick={() => setIsAddingSwap(!isAddingSwap)}
              className="inline-flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 text-white px-5 py-3 rounded-xl font-semibold transition-all shadow-lg shadow-purple-600/20 w-full sm:w-auto"
            >
              <Plus className="w-4 h-4" /> Duty Swap
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Leave Requests Section */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              Leave Requests
            </h3>
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">{leaveRequests.length} Total</span>
          </div>

          {isAddingLeave && (
            <motion.form 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              onSubmit={handleCreateLeave}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 lg:p-6 space-y-4 shadow-xl"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Start Date</label>
                  <input type="date" value={leaveStart} onChange={e => setLeaveStart(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50" required />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">End Date</label>
                  <input type="date" value={leaveEnd} onChange={e => setLeaveEnd(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50" required />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Reason</label>
                <textarea value={leaveReason} onChange={e => setLeaveReason(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 min-h-[100px]" placeholder="Explain why you need leave..." required />
              </div>
              <div className="flex gap-3">
                <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-all">Submit Request</button>
                <button type="button" onClick={() => setIsAddingLeave(false)} className="px-6 py-3 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-400 font-bold rounded-xl transition-all">Cancel</button>
              </div>
            </motion.form>
          )}

          <div className="space-y-4">
            {loading ? (
              <div className="py-12 text-center"><Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto" /></div>
            ) : leaveRequests.length === 0 ? (
              <div className="py-12 text-center bg-zinc-900/50 border border-zinc-800 border-dashed rounded-2xl text-zinc-500">No leave requests found.</div>
            ) : (
              leaveRequests.map(req => (
                <div key={req.id} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-zinc-100 dark:bg-zinc-800 rounded-xl flex items-center justify-center font-bold text-blue-600 dark:text-blue-400 border border-zinc-200 dark:border-zinc-700">
                        {req.staffId.charAt(0)}
                      </div>
                      <div>
                        <p className="text-xs text-zinc-500 font-bold uppercase tracking-tighter">Staff ID: {req.staffId.substring(0, 8)}</p>
                        <p className="font-bold text-zinc-900 dark:text-white">{req.startDate} to {req.endDate}</p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                      req.status === 'approved' ? 'bg-green-500/10 text-green-600 dark:text-green-400' :
                      req.status === 'rejected' ? 'bg-red-500/10 text-red-600 dark:text-red-400' :
                      'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400'
                    }`}>
                      {req.status}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4 italic">"{req.reason}"</p>
                  {profile?.role === 'cno' && req.status === 'pending' && (
                    <div className="flex gap-2 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                      <button onClick={() => handleReviewLeave(req.id, 'approved')} className="flex-1 flex items-center justify-center gap-2 bg-green-600/10 hover:bg-green-600 text-green-600 dark:text-green-400 hover:text-white py-2 rounded-lg transition-all font-bold text-xs"><CheckCircle className="w-4 h-4" /> Approve</button>
                      <button onClick={() => handleReviewLeave(req.id, 'rejected')} className="flex-1 flex items-center justify-center gap-2 bg-red-600/10 hover:bg-red-600 text-red-600 dark:text-red-400 hover:text-white py-2 rounded-lg transition-all font-bold text-xs"><XCircle className="w-4 h-4" /> Reject</button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </section>

        {/* Swap Requests Section */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              Duty Swaps
            </h3>
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">{swapRequests.length} Total</span>
          </div>

          {isAddingSwap && (
            <motion.form 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              onSubmit={handleCreateSwap}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 lg:p-6 space-y-4 shadow-xl"
            >
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Swap With</label>
                <select value={swapTarget} onChange={e => setSwapTarget(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50" required>
                  <option value="">Select a colleague...</option>
                  {staffList.map(s => <option key={s.uid} value={s.uid}>{s.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">My Duty Date</label>
                  <input type="date" value={swapReqDate} onChange={e => setSwapReqDate(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50" required />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Their Duty Date</label>
                  <input type="date" value={swapTargetDate} onChange={e => setSwapTargetDate(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50" required />
                </div>
              </div>
              <div className="flex gap-3">
                <button type="submit" className="flex-1 bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded-xl transition-all">Send Request</button>
                <button type="button" onClick={() => setIsAddingSwap(false)} className="px-6 py-3 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-400 font-bold rounded-xl transition-all">Cancel</button>
              </div>
            </motion.form>
          )}

          <div className="space-y-4">
            {loading ? (
              <div className="py-12 text-center"><Loader2 className="w-8 h-8 text-blue-600 dark:text-blue-500 animate-spin mx-auto" /></div>
            ) : swapRequests.length === 0 ? (
              <div className="py-12 text-center bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 border-dashed rounded-2xl text-zinc-500">No swap requests found.</div>
            ) : (
              swapRequests.map(req => (
                <div key={req.id} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-zinc-100 dark:bg-zinc-800 rounded-xl flex items-center justify-center font-bold text-purple-600 dark:text-purple-400 border border-zinc-200 dark:border-zinc-700">
                        <Clock className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs text-zinc-500 font-bold uppercase tracking-tighter">Swap Request</p>
                        <p className="font-bold text-zinc-900 dark:text-white">{req.requesterDate} ↔ {req.targetDate}</p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                      req.status === 'approved' ? 'bg-green-500/10 text-green-600 dark:text-green-400' :
                      req.status === 'rejected' ? 'bg-red-500/10 text-red-600 dark:text-red-400' :
                      'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400'
                    }`}>
                      {req.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="text-sm text-zinc-500 dark:text-zinc-400 mb-4 flex flex-col gap-1">
                    <p>Requester: <span className="text-zinc-900 dark:text-zinc-200 font-medium">{req.requesterId.substring(0, 8)}</span></p>
                    <p>Target: <span className="text-zinc-900 dark:text-zinc-200 font-medium">{req.targetStaffId.substring(0, 8)}</span></p>
                  </div>
                  {profile?.role === 'cno' && req.status === 'pending_cno' && (
                    <div className="flex gap-2 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                      <button onClick={() => handleReviewSwap(req.id, 'approved')} className="flex-1 flex items-center justify-center gap-2 bg-green-600/10 hover:bg-green-600 text-green-600 dark:text-green-400 hover:text-white py-2 rounded-lg transition-all font-bold text-xs"><CheckCircle className="w-4 h-4" /> Approve</button>
                      <button onClick={() => handleReviewSwap(req.id, 'rejected')} className="flex-1 flex items-center justify-center gap-2 bg-red-600/10 hover:bg-red-600 text-red-600 dark:text-red-400 hover:text-white py-2 rounded-lg transition-all font-bold text-xs"><XCircle className="w-4 h-4" /> Reject</button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default Requests;
