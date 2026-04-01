import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, NavLink, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import { ThemeProvider, useTheme } from './ThemeContext';
import LoginPage from './LoginPage';
import { auth } from './firebase';
import { signOut } from 'firebase/auth';
import { 
  LogOut, 
  LayoutDashboard, 
  Users, 
  Calendar, 
  MessageSquare, 
  ClipboardList, 
  Settings, 
  Menu, 
  X, 
  Stethoscope, 
  ShieldCheck,
  FileText,
  Clock,
  Loader2,
  Sun,
  Moon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Import components
import AdminDashboard from './AdminDashboard';
import StaffManagement from './StaffManagement';
import DutyRota from './DutyRota';
import Requests from './Requests';
import Messages from './Messages';
import HRDashboard from './HRDashboard';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      setWindowWidth(width);
      if (width < 768) {
        setIsSidebarOpen(false);
      } else if (width < 1280) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Initial check
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Close mobile menu on navigation
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [navigate]);

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard, roles: ['admin', 'cno', 'ward_admin', 'hr', 'staff'] },
    { name: 'Staff Management', path: '/staff', icon: Users, roles: ['admin', 'cno', 'ward_admin'] },
    { name: 'Duty Rota', path: '/rota', icon: Calendar, roles: ['cno', 'ward_admin', 'staff'] },
    { name: 'Requests', path: '/requests', icon: ClipboardList, roles: ['cno', 'hr', 'staff'] },
    { name: 'Messages', path: '/messages', icon: MessageSquare, roles: ['cno', 'staff'] },
    { name: 'HR Overview', path: '/hr', icon: FileText, roles: ['hr'] },
    { name: 'System Admin', path: '/admin', icon: ShieldCheck, roles: ['admin'] },
  ];

  const filteredNavItems = navItems.filter(item => profile && item.roles.includes(profile.role));

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex font-sans transition-colors duration-300 overflow-x-hidden">
      {/* Mobile Backdrop */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ 
          width: isSidebarOpen ? 260 : 72,
          x: isMobileMenuOpen ? 0 : (windowWidth < 768 ? -260 : 0)
        }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className={`bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 flex flex-col fixed md:sticky top-0 h-screen z-[70] md:z-50 shadow-xl overflow-hidden print:hidden`}
      >
        <div className="p-4 lg:p-6 flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 h-20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20 shrink-0">
              <Stethoscope className="text-white w-6 h-6" />
            </div>
            <AnimatePresence mode="wait">
              {(isSidebarOpen || isMobileMenuOpen) && (
                <motion.div 
                  initial={{ opacity: 0, x: -10, width: 0 }}
                  animate={{ opacity: 1, x: 0, width: 'auto' }}
                  exit={{ opacity: 0, x: -10, width: 0 }}
                  className="min-w-0 overflow-hidden"
                >
                  <h1 className="text-lg font-black tracking-tighter text-zinc-900 dark:text-white leading-none truncate">TUMUTUMU</h1>
                  <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest mt-1 truncate">Duty Manager</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl text-zinc-400 transition-colors hidden md:block"
            title={isSidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
          >
            <Menu className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setIsMobileMenuOpen(false)}
            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl text-zinc-400 transition-colors lg:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {filteredNavItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              title={!isSidebarOpen && !isMobileMenuOpen ? item.name : ""}
              className={({ isActive }) => 
                `flex items-center gap-4 p-3 rounded-xl transition-all group ${
                  isActive 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' 
                    : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white'
                }`
              }
            >
              <item.icon className={`w-5 h-5 transition-transform group-hover:scale-110 shrink-0`} />
              <AnimatePresence mode="wait">
                {(isSidebarOpen || isMobileMenuOpen) && (
                  <motion.span 
                    initial={{ opacity: 0, x: -10, width: 0 }}
                    animate={{ opacity: 1, x: 0, width: 'auto' }}
                    exit={{ opacity: 0, x: -10, width: 0 }}
                    className="font-bold text-sm tracking-tight truncate overflow-hidden"
                  >
                    {item.name}
                  </motion.span>
                )}
              </AnimatePresence>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-3 px-2 mb-6">
            <div className="w-10 h-10 bg-zinc-100 dark:bg-zinc-800 rounded-xl flex items-center justify-center font-bold text-blue-600 dark:text-blue-400 border border-zinc-200 dark:border-zinc-700 shrink-0">
              {profile?.name?.charAt(0)}
            </div>
            <AnimatePresence mode="wait">
              {(isSidebarOpen || isMobileMenuOpen) && (
                <motion.div 
                  initial={{ opacity: 0, x: -10, width: 0 }}
                  animate={{ opacity: 1, x: 0, width: 'auto' }}
                  exit={{ opacity: 0, x: -10, width: 0 }}
                  className="flex-1 min-w-0 overflow-hidden"
                >
                  <p className="text-sm font-bold text-zinc-900 dark:text-white truncate">{profile?.name}</p>
                  <p className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest truncate">{profile?.role?.replace('_', ' ')}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-4 p-3 rounded-xl text-red-500 hover:bg-red-500/10 transition-all group"
          >
            <LogOut className="w-5 h-5 transition-transform group-hover:-translate-x-1 shrink-0" />
            <AnimatePresence mode="wait">
              {(isSidebarOpen || isMobileMenuOpen) && (
                <motion.span 
                  initial={{ opacity: 0, x: -10, width: 0 }}
                  animate={{ opacity: 1, x: 0, width: 'auto' }}
                  exit={{ opacity: 0, x: -10, width: 0 }}
                  className="font-bold text-sm tracking-tight truncate overflow-hidden"
                >
                  Sign Out
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 relative">
        <header className="h-20 border-b border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-xl flex items-center justify-between px-4 lg:px-8 sticky top-0 z-40 print:hidden">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl text-zinc-500 dark:text-zinc-400 md:hidden"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="hidden sm:flex items-center gap-3">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
              <span className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">System Operational</span>
            </div>
          </div>
          <div className="flex items-center gap-3 lg:gap-6">
            <button 
              onClick={toggleTheme}
              className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl text-zinc-500 dark:text-zinc-400 transition-all"
              title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            >
              {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </button>
            <div className="text-right hidden md:block">
              <p className="text-xs text-zinc-400 dark:text-zinc-500 font-semibold uppercase tracking-wider">Current Ward</p>
              <p className="text-sm font-bold text-zinc-900 dark:text-white">{profile?.wardId || 'Global Access'}</p>
            </div>
            <div className="w-px h-8 bg-zinc-200 dark:bg-zinc-800 hidden sm:block" />
            <div className="flex items-center gap-3">
               <div className="text-right hidden sm:block">
                  <p className="text-sm font-bold text-zinc-900 dark:text-white">{profile?.name}</p>
                  <p className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">{profile?.role?.replace('_', ' ')}</p>
               </div>
               <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center font-bold text-white shadow-lg shadow-blue-600/20 sm:hidden">
                  {profile?.name?.charAt(0)}
               </div>
            </div>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto bg-zinc-50 dark:bg-zinc-950">
          {children}
        </div>
      </main>
    </div>
  );
};

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center"><Loader2 className="w-12 h-12 text-blue-500 animate-spin" /></div>;
  if (!user) return <Navigate to="/login" />;
  return <Layout>{children}</Layout>;
};

const RoleProtectedRoute: React.FC<{ children: React.ReactNode; allowedRoles: string[] }> = ({ children, allowedRoles }) => {
  const { profile, loading, isAuthReady } = useAuth();
  
  if (loading || !isAuthReady) {
    return <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center"><Loader2 className="w-12 h-12 text-blue-500 animate-spin" /></div>;
  }

  if (!profile || !allowedRoles.includes(profile.role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

const Dashboard: React.FC = () => {
  const { profile } = useAuth();
  
  const getStats = () => {
    const baseStats = [
      { label: 'Active Staff', value: '142', icon: Users, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/10' },
      { label: 'Pending Rotas', value: '4', icon: Calendar, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-500/10' },
      { label: 'Leave Requests', value: '12', icon: ClipboardList, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-500/10' },
      { label: 'Unread Messages', value: '8', icon: MessageSquare, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-500/10' },
    ];

    if (profile?.role === 'staff') {
      return [
        { label: 'My Ward', value: profile.wardId || 'N/A', icon: Users, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/10' },
        { label: 'My Shifts', value: '18', icon: Calendar, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-500/10' },
        { label: 'My Requests', value: '2', icon: ClipboardList, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-500/10' },
        { label: 'Messages', value: '3', icon: MessageSquare, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-500/10' },
      ];
    }

    if (profile?.role === 'ward_admin') {
      return [
        { label: 'Ward Staff', value: '18', icon: Users, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/10' },
        { label: 'Ward Rota', value: 'Draft', icon: Calendar, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-500/10' },
        { label: 'Ward Requests', value: '5', icon: ClipboardList, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-500/10' },
        { label: 'Ward Ward', value: profile.wardId || 'N/A', icon: ShieldCheck, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-500/10' },
      ];
    }

    return baseStats;
  };

  const stats = getStats();
  
  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-8 lg:space-y-12">
      <header>
        <h2 className="text-3xl lg:text-5xl font-black text-zinc-900 dark:text-white tracking-tighter mb-2">
          Welcome back, <span className="text-blue-600 dark:text-blue-500">{(profile?.name || 'User').split(' ')[0]}</span>
        </h2>
        <p className="text-zinc-500 text-sm lg:text-lg font-medium">Here's what's happening at PCEA Tumutumu Hospital today.</p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        {stats.map((stat, i) => (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            key={stat.label} 
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-3xl shadow-xl hover:border-blue-500/30 dark:hover:border-zinc-700 transition-all group"
          >
            <div className={`${stat.bg} ${stat.color} w-12 h-12 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
              <stat.icon className="w-6 h-6" />
            </div>
            <p className="text-zinc-400 dark:text-zinc-500 text-xs font-black uppercase tracking-widest mb-1">{stat.label}</p>
            <p className="text-3xl font-black text-zinc-900 dark:text-white">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        <div className="lg:col-span-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 lg:p-8 shadow-2xl">
          <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-6 flex items-center gap-3">
            <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            Recent Activity
          </h3>
          <div className="space-y-6">
            {[
              { user: 'Dr. Kamau', action: 'approved the Maternity rota', time: '2 hours ago' },
              { user: 'Nurse Mary', action: 'requested a duty swap', time: '4 hours ago' },
              { user: 'Admin', action: 'added 3 new staff members', time: 'Yesterday' },
            ].map((activity, i) => (
              <div key={i} className="flex items-start gap-4 group">
                <div className="w-10 h-10 bg-zinc-100 dark:bg-zinc-800 rounded-xl flex items-center justify-center font-bold text-zinc-500 border border-zinc-200 dark:border-zinc-700 group-hover:border-blue-500/50 transition-all">
                  {activity.user.charAt(0)}
                </div>
                <div>
                  <p className="text-sm text-zinc-600 dark:text-zinc-300">
                    <span className="font-bold text-zinc-900 dark:text-white">{activity.user}</span> {activity.action}
                  </p>
                  <p className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mt-1">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-3xl p-8 text-white shadow-2xl shadow-blue-600/20 flex flex-col justify-between">
          <div>
            <ShieldCheck className="w-10 h-10 mb-6 opacity-50" />
            <h3 className="text-2xl font-black tracking-tight mb-2">Hospital Notice</h3>
            <p className="text-blue-100 text-sm leading-relaxed">
              Please ensure all duty rotas for the month of April are submitted by the 25th of March for CNO approval.
            </p>
          </div>
          <button className="mt-8 bg-white text-blue-600 font-black py-3 rounded-2xl text-sm uppercase tracking-widest hover:bg-blue-50 transition-all">
            Read More
          </button>
        </div>
      </div>
    </div>
  );
};


export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/staff" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['admin', 'cno', 'ward_admin']}>
                  <StaffManagement />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/rota" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['cno', 'ward_admin', 'staff']}>
                  <DutyRota />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/requests" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['cno', 'hr', 'staff']}>
                  <Requests />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/messages" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['cno', 'staff']}>
                  <Messages />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/hr" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['hr']}>
                  <HRDashboard />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/admin" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['admin']}>
                  <AdminDashboard />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}
