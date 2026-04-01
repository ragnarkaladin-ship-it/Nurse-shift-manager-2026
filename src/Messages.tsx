import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, getDocs, doc, setDoc, updateDoc, onSnapshot, addDoc, orderBy, limit } from 'firebase/firestore';
import { db, auth } from './firebase';
import { UserProfile, useAuth } from './AuthContext';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, Send, User, Loader2, Check, CheckCheck, Search } from 'lucide-react';

interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  timestamp: string;
  read: boolean;
}

const Messages: React.FC = () => {
  const { profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [cnoProfile, setCnoProfile] = useState<UserProfile | null>(null);
  const [staffList, setStaffList] = useState<UserProfile[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  if (!profile || !['cno', 'staff'].includes(profile.role)) {
    return null;
  }

  useEffect(() => {
    if (!profile) return;
    if (profile.role === 'staff') {
      fetchCNO();
    } else if (profile.role === 'cno') {
      fetchStaffList();
    }
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    
    let q;
    if (profile.role === 'staff' && cnoProfile) {
      q = query(
        collection(db, 'messages'),
        where('senderId', 'in', [profile.uid, cnoProfile.uid]),
        where('receiverId', 'in', [profile.uid, cnoProfile.uid]),
        orderBy('timestamp', 'asc')
      );
    } else if (profile.role === 'cno' && selectedStaffId) {
      q = query(
        collection(db, 'messages'),
        where('senderId', 'in', [profile.uid, selectedStaffId]),
        where('receiverId', 'in', [profile.uid, selectedStaffId]),
        orderBy('timestamp', 'asc')
      );
    } else {
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => doc.data() as Message));
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });

    return () => unsubscribe();
  }, [profile, cnoProfile, selectedStaffId]);

  const fetchCNO = async () => {
    try {
      const token = localStorage.getItem('hospital_auth_token') || await auth.currentUser?.getIdToken();
      const response = await fetch('/api/admin/users?role=cno', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.length > 0) {
          setCnoProfile(data[0]);
        }
      }
    } catch (err) {
      console.error("Error fetching CNO:", err);
    }
  };

  const fetchStaffList = async () => {
    try {
      const token = localStorage.getItem('hospital_auth_token') || await auth.currentUser?.getIdToken();
      const response = await fetch('/api/admin/users?role=staff', {
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

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !newMessage.trim()) return;
    
    const receiverId = profile.role === 'staff' ? cnoProfile?.uid : selectedStaffId;
    if (!receiverId) return;

    try {
      const id = doc(collection(db, 'messages')).id;
      await setDoc(doc(db, 'messages', id), {
        id,
        senderId: profile.uid,
        receiverId,
        content: newMessage,
        timestamp: new Date().toISOString(),
        read: false
      });
      setNewMessage('');
    } catch (err) {
      console.error("Error sending message:", err);
    }
  };

  const filteredStaff = staffList.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="h-[calc(100vh-80px)] flex bg-zinc-50 dark:bg-zinc-950 overflow-hidden relative">
      {/* Sidebar for CNO */}
      {profile?.role === 'cno' && (
        <aside className={`${selectedStaffId ? 'hidden lg:flex' : 'flex'} w-full lg:w-80 border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 flex-col shrink-0`}>
          <div className="p-4 lg:p-6 border-b border-zinc-200 dark:border-zinc-800">
            <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-4">Staff Messages</h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input 
                type="text" 
                placeholder="Search staff..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl pl-10 pr-4 py-2 text-sm text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500/50 outline-none"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {filteredStaff.map(s => (
              <button 
                key={s.uid}
                onClick={() => setSelectedStaffId(s.uid)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${selectedStaffId === s.uid ? 'bg-blue-600 text-white' : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold border ${selectedStaffId === s.uid ? 'bg-blue-500 border-blue-400' : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-blue-600 dark:text-blue-400'}`}>
                  {s.name.charAt(0)}
                </div>
                <div className="text-left min-w-0">
                  <p className="font-bold text-sm truncate">{s.name}</p>
                  <p className={`text-[10px] font-bold uppercase tracking-tighter ${selectedStaffId === s.uid ? 'text-blue-200' : 'text-zinc-500'}`}>{s.wardId}</p>
                </div>
              </button>
            ))}
          </div>
        </aside>
      )}

      {/* Chat Area */}
      <div className={`flex-1 flex flex-col relative ${profile?.role === 'cno' && !selectedStaffId ? 'hidden lg:flex' : 'flex'}`}>
        {((profile?.role === 'staff' && cnoProfile) || (profile?.role === 'cno' && selectedStaffId)) ? (
          <>
            {/* Chat Header */}
            <header className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/30 backdrop-blur-sm flex items-center gap-4">
              {profile?.role === 'cno' && (
                <button 
                  onClick={() => setSelectedStaffId(null)}
                  className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl text-zinc-500 lg:hidden"
                >
                  <Search className="w-5 h-5 rotate-90" /> {/* Back icon placeholder or use ChevronLeft */}
                </button>
              )}
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center font-bold text-white shadow-lg shadow-blue-600/20">
                {(profile?.role === 'staff' ? cnoProfile?.name : staffList.find(s => s.uid === selectedStaffId)?.name)?.charAt(0)}
              </div>
              <div>
                <h4 className="font-bold text-zinc-900 dark:text-white">
                  {profile?.role === 'staff' ? 'Chief Nursing Officer (CNO)' : staffList.find(s => s.uid === selectedStaffId)?.name}
                </h4>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Online</span>
                </div>
              </div>
            </header>

            {/* Messages List */}
            <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-4">
              {messages.map((msg, idx) => {
                const isMe = msg.senderId === profile?.uid;
                return (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95, x: isMe ? 20 : -20 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    key={msg.id} 
                    className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[85%] sm:max-w-[70%] p-4 rounded-2xl shadow-xl ${isMe ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-200 rounded-tl-none'}`}>
                      <p className="text-sm leading-relaxed">{msg.content}</p>
                      <div className={`mt-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-tighter ${isMe ? 'text-blue-200' : 'text-zinc-500'}`}>
                        {format(new Date(msg.timestamp), 'HH:mm')}
                        {isMe && (msg.read ? <CheckCheck className="w-3 h-3" /> : <Check className="w-3 h-3" />)}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
              <div ref={scrollRef} />
            </div>

            {/* Message Input */}
            <form onSubmit={handleSendMessage} className="p-4 lg:p-6 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
              <div className="relative">
                <input 
                  type="text" 
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type your message here..."
                  className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl pl-6 pr-16 py-4 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all shadow-inner"
                />
                <button 
                  type="submit"
                  disabled={!newMessage.trim()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-12 h-12 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-100 dark:disabled:bg-zinc-800 text-white rounded-xl flex items-center justify-center transition-all shadow-lg shadow-blue-600/20"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-zinc-50 dark:bg-zinc-950">
            <div className="w-20 h-20 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 flex items-center justify-center mb-6 shadow-2xl">
              <MessageSquare className="w-10 h-10 text-zinc-300 dark:text-zinc-700" />
            </div>
            <h3 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">Direct Communication</h3>
            <p className="text-zinc-500 max-w-xs mx-auto">
              {profile?.role === 'cno' ? 'Select a staff member from the list to start a conversation.' : 'You can send direct messages to the Chief Nursing Officer for inquiries or urgent matters.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Messages;
