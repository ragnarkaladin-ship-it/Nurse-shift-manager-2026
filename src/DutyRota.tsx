import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs, doc, setDoc, updateDoc, onSnapshot, addDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db, auth } from './firebase';
import { UserProfile, useAuth } from './AuthContext';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, getDaysInMonth, startOfWeek, endOfWeek, isSameMonth } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Save, Send, CheckCircle, Clock, AlertCircle, Loader2, Download, Printer, Filter, LayoutGrid, List, X, User, MapPin } from 'lucide-react';

interface Duty {
  id: string;
  rotaId: string;
  staffId: string;
  date: string;
  type: 'S' | 'N' | 'O' | 'L' | 'PH';
}

interface Rota {
  id: string;
  wardId: string;
  month: number;
  year: number;
  status: 'draft' | 'pending_cno' | 'approved';
  createdBy: string;
  approvedBy?: string;
  submittedAt?: any;
  approvedAt?: any;
}

const DutyRota: React.FC = () => {
  const { profile } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [rota, setRota] = useState<Rota | null>(null);
  const [duties, setDuties] = useState<Duty[]>([]);
  const [wardStaff, setWardStaff] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedWard, setSelectedWard] = useState(profile?.wardId || 'Ward 1');
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('calendar');
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (!profile || !['cno', 'ward_admin', 'staff'].includes(profile.role)) {
    return null;
  }

  const wards = ['Ward 1', 'Ward 2', 'Ward 4', 'Ward 5/6', 'Ward 7', 'Theatre', 'OPD', 'ICU'];
  const dutyTypes = [
    { code: 'S', label: 'Straight (7:30am - 6:30pm)', color: 'bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/20 dark:border-blue-500/30', solid: 'bg-blue-600 text-white' },
    { code: 'N', label: 'Night (6:30pm - 7:30am)', color: 'bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-500/20 dark:border-purple-500/30', solid: 'bg-purple-600 text-white' },
    { code: 'O', label: 'Off', color: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700', solid: 'bg-zinc-400 text-white' },
    { code: 'L', label: 'Leave', color: 'bg-orange-500/10 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 border-orange-500/20 dark:border-orange-500/30', solid: 'bg-orange-600 text-white' },
    { code: 'PH', label: 'Public Holiday Off', color: 'bg-green-500/10 dark:bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/20 dark:border-green-500/30', solid: 'bg-green-600 text-white' },
  ];

  const month = currentDate.getMonth() + 1;
  const year = currentDate.getFullYear();
  const daysInMonth = getDaysInMonth(currentDate);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentDate));
    const end = endOfWeek(endOfMonth(currentDate));
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  useEffect(() => {
    if (!profile) return;
    fetchWardStaff();
    fetchRota();
  }, [profile, selectedWard, month, year]);

  const fetchWardStaff = async () => {
    try {
      const token = localStorage.getItem('hospital_auth_token') || await auth.currentUser?.getIdToken();
      const response = await fetch(`/api/admin/users?role=staff&wardId=${selectedWard}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch ward staff');
      }

      const data = await response.json();
      setWardStaff(data);
    } catch (err) {
      console.error("Error fetching ward staff:", err);
    }
  };

  const fetchRota = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'rotas'), 
        where('wardId', '==', selectedWard), 
        where('month', '==', month), 
        where('year', '==', year)
      );
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
          const rotaData = snapshot.docs[0].data() as Rota;
          setRota(rotaData);
          fetchDuties(rotaData.id);
        } else {
          setRota(null);
          setDuties([]);
          setLoading(false);
        }
      });

      return () => unsubscribe();
    } catch (err) {
      console.error("Error fetching rota:", err);
      setLoading(false);
    }
  };

  const fetchDuties = async (rotaId: string) => {
    try {
      const q = query(collection(db, 'duties'), where('rotaId', '==', rotaId));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setDuties(snapshot.docs.map(doc => doc.data() as Duty));
        setLoading(false);
      });
      return () => unsubscribe();
    } catch (err) {
      console.error("Error fetching duties:", err);
      setLoading(false);
    }
  };

  const handleCreateRota = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      const rotaId = `${selectedWard}-${year}-${month}`;
      const newRota: Rota = {
        id: rotaId,
        wardId: selectedWard,
        month,
        year,
        status: 'draft',
        createdBy: profile.uid,
      };
      await setDoc(doc(db, 'rotas', rotaId), newRota);
      setRota(newRota);
    } catch (err) {
      console.error("Error creating rota:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDutyChange = async (staffId: string, date: Date, type: Duty['type']) => {
    if (!rota || rota.status !== 'draft' || profile?.role !== 'ward_admin') return;
    if (!isSameMonth(date, currentDate)) return;
    
    const dateStr = format(date, 'yyyy-MM-dd');
    const dutyId = `${rota.id}-${staffId}-${dateStr}`;
    
    try {
      const existingDuty = duties.find(d => d.staffId === staffId && d.date === dateStr);
      if (existingDuty) {
        if (existingDuty.type === type) return;
        await updateDoc(doc(db, 'duties', existingDuty.id), { type });
      } else {
        const newDuty: Duty = {
          id: dutyId,
          rotaId: rota.id,
          staffId,
          date: dateStr,
          type
        };
        await setDoc(doc(db, 'duties', dutyId), newDuty);
      }
    } catch (err) {
      console.error("Error updating duty:", err);
    }
  };

  const handleSubmitToCNO = async () => {
    if (!rota || profile?.role !== 'ward_admin') return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'rotas', rota.id), {
        status: 'pending_cno',
        submittedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error("Error submitting rota:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleApproveRota = async () => {
    if (!rota || profile?.role !== 'cno') return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'rotas', rota.id), {
        status: 'approved',
        approvedBy: profile.uid,
        approvedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error("Error approving rota:", err);
    } finally {
      setSaving(false);
    }
  };

  const getDutyType = (staffId: string, day: number) => {
    const dateStr = format(new Date(year, month - 1, day), 'yyyy-MM-dd');
    return duties.find(d => d.staffId === staffId && d.date === dateStr)?.type || 'O';
  };

  const canEdit = rota?.status === 'draft' && profile?.role === 'ward_admin' && profile.wardId === selectedWard;

  const handleExportCSV = () => {
    if (!wardStaff.length) return;

    const headers = ['"Staff Name"', '"NCK Reg No"', ...days.map(d => `"${format(new Date(year, month - 1, d), 'yyyy-MM-dd')}"`)];
    const rows = wardStaff.map(staff => {
      const rowData = [
        `"${staff.name.replace(/"/g, '""')}"`,
        `"${(staff.nckRegistrationNumber || 'N/A').replace(/"/g, '""')}"`,
        ...days.map(day => `"${getDutyType(staff.uid, day)}"`)
      ];
      return rowData.join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Duty_Rota_${selectedWard}_${format(currentDate, 'MMM_yyyy')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  const isAuthorizedToExport = profile?.role === 'cno' || profile?.role === 'ward_admin';

  const handleDayClick = (day: Date) => {
    setSelectedDay(day);
    setIsModalOpen(true);
  };

  const getDayDuties = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return duties.filter(d => d.date === dateStr);
  };

  const getStaffDutyOnDay = (staffId: string, date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return duties.find(d => d.staffId === staffId && d.date === dateStr)?.type || 'O';
  };

  return (
    <div className="p-4 lg:p-8 print:p-0">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 mb-8 print:hidden">
        <div>
          <h2 className="text-2xl lg:text-3xl font-bold text-zinc-900 dark:text-white tracking-tight flex items-center gap-3">
            <CalendarIcon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            Duty Rota Management
          </h2>
          <p className="text-zinc-500 text-sm mt-1">Manage and view staff shifts for PCEA Tumutumu Hospital.</p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center justify-between sm:justify-start gap-4 w-full sm:w-auto">
            <div className="flex items-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-1 shadow-sm">
              <button 
                onClick={() => setViewMode('calendar')}
                className={`p-2 rounded-lg transition-all ${viewMode === 'calendar' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
                title="Calendar View"
              >
                <LayoutGrid className="w-5 h-5" />
              </button>
              <button 
                onClick={() => setViewMode('table')}
                className={`p-2 rounded-lg transition-all ${viewMode === 'table' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
                title="Table View"
              >
                <List className="w-5 h-5" />
              </button>
            </div>

            {isAuthorizedToExport && (
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleExportCSV}
                  className="p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all shadow-sm"
                  title="Export CSV"
                >
                  <Download className="w-5 h-5" />
                </button>
                <button 
                  onClick={handlePrint}
                  className="p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all shadow-sm"
                  title="Print Rota"
                >
                  <Printer className="w-5 h-5" />
                </button>
              </div>
            )}

            <div className="flex items-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-1 shadow-sm">
              <button 
                onClick={() => setCurrentDate(subMonths(currentDate, 1))}
                className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors text-zinc-600 dark:text-zinc-400"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="px-3 lg:px-4 font-bold text-zinc-900 dark:text-white min-w-[120px] lg:min-w-[140px] text-center text-sm lg:text-base">
                {format(currentDate, 'MMMM yyyy')}
              </span>
              <button 
                onClick={() => setCurrentDate(addMonths(currentDate, 1))}
                className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors text-zinc-600 dark:text-zinc-400"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full sm:w-auto">
            {profile?.role !== 'ward_admin' && (
              <div className="relative w-full sm:w-auto">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <select 
                  value={selectedWard}
                  onChange={(e) => setSelectedWard(e.target.value)}
                  className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500/50 outline-none appearance-none font-semibold shadow-sm"
                >
                  {wards.map(w => <option key={w} value={w}>{w}</option>)}
                </select>
              </div>
            )}

            {rota ? (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                <span className={`inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider border ${
                  rota.status === 'approved' ? 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20' :
                  rota.status === 'pending_cno' ? 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20' :
                  'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700'
                }`}>
                  {rota.status === 'approved' ? <CheckCircle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                  {rota.status.replace('_', ' ')}
                </span>

                {rota.status === 'draft' && profile?.role === 'ward_admin' && (
                  <button 
                    onClick={handleSubmitToCNO}
                    disabled={saving}
                    className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 w-full sm:w-auto"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4" /> Submit to CNO</>}
                  </button>
                )}

                {rota.status === 'pending_cno' && profile?.role === 'cno' && (
                  <button 
                    onClick={handleApproveRota}
                    disabled={saving}
                    className="bg-green-600 hover:bg-green-500 text-white px-6 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-600/20 w-full sm:w-auto"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle className="w-4 h-4" /> Approve Rota</>}
                  </button>
                )}
              </div>
            ) : (
              profile?.role === 'ward_admin' && profile.wardId === selectedWard && (
                <button 
                  onClick={handleCreateRota}
                  disabled={saving}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 w-full sm:w-auto"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CalendarIcon className="w-4 h-4" /> Initialize Rota</>}
                </button>
              )
            )}
          </div>
        </div>
      </div>

      {viewMode === 'table' ? (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-zinc-200 dark:scrollbar-thumb-zinc-800">
            <table className="w-full text-center border-collapse table-fixed min-w-[1200px]">
              <thead>
                <tr className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800">
                  <th className="w-48 px-4 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider text-left sticky left-0 bg-zinc-50 dark:bg-zinc-900 z-10 border-r border-zinc-200 dark:border-zinc-800">Staff Member</th>
                  {days.map(day => (
                    <th key={day} className="px-1 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider border-l border-zinc-200 dark:border-zinc-800/50">
                      <div className="flex flex-col items-center">
                        <span>{format(new Date(year, month - 1, day), 'EEE')}</span>
                        <span className="text-zinc-900 dark:text-white text-sm">{day}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {loading ? (
                  <tr>
                    <td colSpan={days.length + 1} className="py-20">
                      <Loader2 className="w-10 h-10 text-blue-500 animate-spin mx-auto" />
                    </td>
                  </tr>
                ) : wardStaff.length === 0 ? (
                  <tr>
                    <td colSpan={days.length + 1} className="py-20 text-zinc-500">
                      No staff members assigned to this ward.
                    </td>
                  </tr>
                ) : (
                  wardStaff.map((staff) => (
                    <tr key={staff.uid} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors group">
                      <td className="px-4 py-3 text-left sticky left-0 bg-white dark:bg-zinc-900 z-10 border-r border-zinc-200 dark:border-zinc-800 shadow-xl">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-zinc-100 dark:bg-zinc-800 rounded-lg flex items-center justify-center font-bold text-blue-600 dark:text-blue-400 text-xs border border-zinc-200 dark:border-zinc-700">
                            {staff.name.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-zinc-900 dark:text-white truncate">{staff.name}</p>
                            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-tighter truncate">{staff.nckRegistrationNumber || 'KRCHN'}</p>
                          </div>
                        </div>
                      </td>
                      {days.map(day => {
                        const currentType = getDutyType(staff.uid, day);
                        const typeConfig = dutyTypes.find(t => t.code === currentType) || dutyTypes[2];
                        
                        return (
                          <td key={day} className="px-0.5 py-1 border-l border-zinc-200 dark:border-zinc-800/50">
                            {canEdit ? (
                              <select 
                                value={currentType}
                                onChange={(e) => handleDutyChange(staff.uid, new Date(year, month - 1, day), e.target.value as Duty['type'])}
                                className={`w-full h-10 rounded-lg text-xs font-bold text-center appearance-none cursor-pointer border transition-all ${typeConfig.color} hover:scale-105 active:scale-95`}
                              >
                                {dutyTypes.map(t => (
                                  <option key={t.code} value={t.code} className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white">{t.code}</option>
                                ))}
                              </select>
                            ) : (
                              <div className={`w-full h-10 rounded-lg flex items-center justify-center text-xs font-bold border ${typeConfig.color}`}>
                                {currentType}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-px bg-zinc-200 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-2xl">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="bg-zinc-50 dark:bg-zinc-800/50 py-3 text-center text-xs font-bold text-zinc-500 uppercase tracking-wider">
              {day}
            </div>
          ))}
          {calendarDays.map((day, idx) => {
            const isCurrentMonth = isSameMonth(day, currentDate);
            const dayDuties = getDayDuties(day);
            const myDuty = profile ? dayDuties.find(d => d.staffId === profile.uid) : null;
            const myDutyConfig = myDuty ? dutyTypes.find(t => t.code === myDuty.type) : null;

            return (
              <div 
                key={idx}
                onClick={() => handleDayClick(day)}
                className={`min-h-[120px] p-2 bg-white dark:bg-zinc-900 transition-all cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 relative group ${!isCurrentMonth ? 'opacity-30' : ''}`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className={`text-sm font-bold ${isSameDay(day, new Date()) ? 'bg-blue-600 text-white w-7 h-7 flex items-center justify-center rounded-full' : 'text-zinc-500'}`}>
                    {format(day, 'd')}
                  </span>
                  {myDuty && (
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase ${myDutyConfig?.solid}`}>
                      My Shift: {myDuty.type}
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  {dutyTypes.map(type => {
                    const count = dayDuties.filter(d => d.type === type.code).length;
                    if (count === 0) return null;
                    return (
                      <div key={type.code} className={`flex items-center justify-between px-2 py-0.5 rounded text-[10px] font-bold ${type.color}`}>
                        <span>{type.label.split(' ')[0]}</span>
                        <span>{count}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-lg">
                    <X className="w-3 h-3 rotate-45" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {isModalOpen && selectedDay && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl border border-zinc-200 dark:border-zinc-800"
            >
              <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/50">
                <div>
                  <h3 className="text-xl font-bold text-zinc-900 dark:text-white">
                    {format(selectedDay, 'EEEE, MMMM do, yyyy')}
                  </h3>
                  <p className="text-sm text-zinc-500 flex items-center gap-2 mt-1">
                    <MapPin className="w-4 h-4" /> {selectedWard} Coverage
                  </p>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-xl transition-colors text-zinc-500"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6 max-h-[60vh] overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-200 dark:scrollbar-thumb-zinc-800">
                <div className="space-y-4">
                  {wardStaff.map(staff => {
                    const currentType = getStaffDutyOnDay(staff.uid, selectedDay);
                    const typeConfig = dutyTypes.find(t => t.code === currentType) || dutyTypes[2];
                    
                    return (
                      <div key={staff.uid} className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/30 rounded-2xl border border-zinc-200 dark:border-zinc-800 group hover:border-blue-500/50 transition-all">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-white dark:bg-zinc-800 rounded-xl flex items-center justify-center font-bold text-blue-600 dark:text-blue-400 border border-zinc-200 dark:border-zinc-700 shadow-sm">
                            {staff.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-zinc-900 dark:text-white">{staff.name}</p>
                            <p className="text-xs text-zinc-500 font-medium">{staff.nckRegistrationNumber || 'Staff Member'}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {canEdit ? (
                            <div className="flex gap-1">
                              {dutyTypes.map(t => (
                                <button
                                  key={t.code}
                                  onClick={() => handleDutyChange(staff.uid, selectedDay, t.code as Duty['type'])}
                                  className={`w-8 h-8 rounded-lg text-[10px] font-black transition-all border ${currentType === t.code ? t.solid : 'bg-white dark:bg-zinc-900 text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-zinc-400'}`}
                                  title={t.label}
                                >
                                  {t.code}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <span className={`px-3 py-1.5 rounded-xl text-xs font-bold border ${typeConfig.color}`}>
                              {typeConfig.label.split(' ')[0]}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="p-6 bg-zinc-50 dark:bg-zinc-800/50 border-t border-zinc-200 dark:border-zinc-800 flex justify-end">
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-2.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl font-bold hover:opacity-90 transition-opacity"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {dutyTypes.map(type => (
          <div key={type.code} className={`p-4 rounded-2xl border ${type.color} flex flex-col gap-1 shadow-sm`}>
            <span className="text-lg font-black">{type.code}</span>
            <span className="text-xs font-semibold opacity-80">{type.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DutyRota;
