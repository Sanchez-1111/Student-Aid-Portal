import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  FileText, 
  History, 
  Upload, 
  Megaphone, 
  MessageSquare, 
  LogOut, 
  User as UserIcon,
  ChevronRight,
  Bell,
  Search,
  Plus,
  CheckCircle,
  XCircle,
  Clock,
  Menu,
  X,
  Shield,
  Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { io, Socket } from 'socket.io-client';
import { User, Role, Application, Announcement, Message, Document } from './types';

// --- Components ---

const Modal = ({ isOpen, onClose, title, children }: { isOpen: boolean, onClose: () => void, title: string, children: React.ReactNode }) => {
  if (!isOpen) return null;
  const titleId = `modal-title-${title.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden"
      >
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h3 id={titleId} className="font-bold text-slate-900">{title}</h3>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-emerald-500 outline-none"
            aria-label="Close modal"
          >
            <X size={20} className="text-slate-500" />
          </button>
        </div>
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {children}
        </div>
      </motion.div>
    </div>
  );
};

const Input = ({ label, id, ...props }: any) => {
  const inputId = id || `input-${label.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <div className="space-y-1">
      <label htmlFor={inputId} className="text-sm font-medium text-slate-700">{label}</label>
      <input 
        id={inputId}
        {...props} 
        className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
      />
    </div>
  );
};

const Select = ({ label, id, options, ...props }: any) => {
  const selectId = id || `select-${label.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <div className="space-y-1">
      <label htmlFor={selectId} className="text-sm font-medium text-slate-700">{label}</label>
      <select 
        id={selectId}
        {...props} 
        className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
      >
        {options.map((opt: string) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </div>
  );
};

const Button = ({ children, variant = 'primary', className = '', ...props }: any) => {
  const variants = {
    primary: 'bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:ring-emerald-500',
    secondary: 'bg-slate-100 text-slate-900 hover:bg-slate-200 focus-visible:ring-slate-400',
    outline: 'border border-slate-200 text-slate-600 hover:bg-slate-50 focus-visible:ring-slate-400',
    ghost: 'text-slate-600 hover:bg-slate-100 focus-visible:ring-slate-400'
  };
  return (
    <button 
      {...props} 
      className={`px-4 py-2 rounded-lg font-medium transition-all active:scale-95 disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${variants[variant as keyof typeof variants]} ${className}`}
    >
      {children}
    </button>
  );
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<'login' | 'signup' | 'dashboard'>('login');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Auth State
  const [loginData, setLoginData] = useState({ identifier: '', password: '' });
  const [signupData, setSignupData] = useState({
    schoolId: '',
    firstName: '',
    lastName: '',
    email: '',
    course: 'BSIT',
    year: '1st year',
    role: 'student',
    password: '',
    confirmPassword: ''
  });

  // Data State
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [userDocuments, setUserDocuments] = useState<Document[]>([]);
  const [contacts, setContacts] = useState<User[]>([]);
  const [selectedContact, setSelectedContact] = useState<User | null>(null);
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);
  const [applicationDocuments, setApplicationDocuments] = useState<Document[]>([]);
  const [announcementFilter, setAnnouncementFilter] = useState({ category: 'All', date: '' });
  const [reportData, setReportData] = useState<any>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [emailLogs, setEmailLogs] = useState<any[]>([]);
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [newAnnouncement, setNewAnnouncement] = useState({ title: '', content: '', category: 'General' });
  const [socket, setSocket] = useState<Socket | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      fetchData();
      const newSocket = io();
      setSocket(newSocket);

      newSocket.emit("join", user.id);

      newSocket.on("new_message", (message: Message) => {
        setMessages(prev => [...prev, message]);
        // Simple notification logic
        if (message.senderId !== user.id) {
          // If browser supports, we could use Notification API
          console.log("New message received!");
        }
      });

      return () => {
        newSocket.disconnect();
      };
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    try {
      const annRes = await fetch('/api/announcements');
      const annData = await annRes.json();
      setAnnouncements(annData);

      const appUrl = user.role === 'student' ? `/api/applications/${user.id}` : '/api/admin/applications';
      const appRes = await fetch(appUrl);
      const appData = await appRes.json();
      setApplications(appData);

      const msgRes = await fetch(`/api/messages/${user.id}`);
      const msgData = await msgRes.json();
      setMessages(msgData);

      const contactRes = await fetch(`/api/users?role=${user.role}`);
      const contactData = await contactRes.json();
      setContacts(contactData);

      if (user.role === 'admin') {
        const reportRes = await fetch('/api/admin/reports');
        const reportData = await reportRes.json();
        setReportData(reportData);

        const usersRes = await fetch('/api/admin/users');
        const usersData = await usersRes.json();
        setAllUsers(usersData);

        const emailRes = await fetch('/api/admin/email-logs');
        const emailData = await emailRes.json();
        setEmailLogs(emailData);
      }
    } catch (err) {
      console.error("Failed to fetch data", err);
    }
  };

  const sendMessage = (content: string) => {
    if (!socket || !user || !selectedContact) return;
    socket.emit("send_message", {
      senderId: user.id,
      receiverId: selectedContact.id,
      content
    });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginData)
      });
      const data = await res.json();
      if (data.user) {
        setUser(data.user);
        setView('dashboard');
      } else {
        alert(data.error);
      }
    } catch (err) {
      alert("Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (signupData.password !== signupData.confirmPassword) {
      alert("Passwords do not match");
      return;
    }
    if (signupData.password.length < 8) {
      alert("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(signupData)
      });
      const data = await res.json();
      if (data.user) {
        alert("Account created! Please login.");
        setView('login');
      } else {
        alert(data.error);
      }
    } catch (err) {
      alert("Signup failed");
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async (type: string, details: string) => {
    if (!user) return;
    try {
      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, type, details })
      });
      if (res.ok) {
        alert("Application submitted!");
        fetchData();
        setActiveTab('my applications');
      }
    } catch (err) {
      alert("Failed to submit application");
    }
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    const formData = new FormData(e.currentTarget as HTMLFormElement);
    formData.append('userId', user.id.toString());
    
    setLoading(true);
    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        alert("Document uploaded successfully!");
        fetchData();
        (e.target as HTMLFormElement).reset();
      } else {
        const data = await res.json();
        alert(data.error || "Upload failed");
      }
    } catch (err) {
      alert("Failed to upload document");
    } finally {
      setLoading(false);
    }
  };

  const handleViewApplication = async (app: Application) => {
    setSelectedApplication(app);
    try {
      const res = await fetch(`/api/documents/${app.userId}`);
      const docs = await res.json();
      setApplicationDocuments(docs);
    } catch (err) {
      console.error("Failed to fetch application documents", err);
    }
  };

  if (view === 'login') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 rounded-2xl shadow-xl shadow-slate-200 w-full max-w-md border border-slate-100"
        >
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <LayoutDashboard size={32} />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Student Aid Portal</h1>
            <p className="text-slate-500">Welcome back! Please login to your account.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <Input 
              label="Email or School ID" 
              placeholder="SCC-00-00000000"
              value={loginData.identifier}
              onChange={(e: any) => setLoginData({ ...loginData, identifier: e.target.value })}
              required
            />
            <Input 
              label="Password" 
              type="password"
              placeholder="••••••••"
              value={loginData.password}
              onChange={(e: any) => setLoginData({ ...loginData, password: e.target.value })}
              required
            />
            <Button type="submit" className="w-full py-3" disabled={loading}>
              {loading ? 'Logging in...' : 'Login'}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-500">
            Don't have an account?{' '}
            <button onClick={() => setView('signup')} className="text-emerald-600 font-semibold hover:underline">
              Sign up
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (view === 'signup') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 rounded-2xl shadow-xl shadow-slate-200 w-full max-w-2xl border border-slate-100"
        >
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-slate-900">Create Account</h1>
            <p className="text-slate-500">Join the SCC Student Aid Portal</p>
          </div>

          <form onSubmit={handleSignup} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input 
              label="School ID" 
              placeholder="SCC-00-00000000"
              value={signupData.schoolId}
              onChange={(e: any) => setSignupData({ ...signupData, schoolId: e.target.value })}
              required
            />
            <div className="hidden md:block"></div>
            <Input 
              label="First Name" 
              placeholder="John"
              value={signupData.firstName}
              onChange={(e: any) => setSignupData({ ...signupData, firstName: e.target.value })}
              required
            />
            <Input 
              label="Last Name" 
              placeholder="Doe"
              value={signupData.lastName}
              onChange={(e: any) => setSignupData({ ...signupData, lastName: e.target.value })}
              required
            />
            <Input 
              label="Email Address" 
              type="email"
              placeholder="john@example.com"
              value={signupData.email}
              onChange={(e: any) => setSignupData({ ...signupData, email: e.target.value })}
              required
            />
            <Select 
              label="Course"
              options={['BSIT', 'BSHM', 'BSED', 'BSBA', 'BSCRIM', 'ACT', 'BEED', 'BSTM']}
              value={signupData.course}
              onChange={(e: any) => setSignupData({ ...signupData, course: e.target.value })}
            />
            <Select 
              label="Year Level"
              options={['1st year', '2nd year', '3rd year', '4th year']}
              value={signupData.year}
              onChange={(e: any) => setSignupData({ ...signupData, year: e.target.value })}
            />
            <Select 
              label="Account Role (Testing)"
              options={['student', 'staff', 'admin']}
              value={signupData.role || 'student'}
              onChange={(e: any) => setSignupData({ ...signupData, role: e.target.value })}
            />
            <Input 
              label="Password (min 8 chars)" 
              type="password"
              placeholder="••••••••"
              value={signupData.password}
              onChange={(e: any) => setSignupData({ ...signupData, password: e.target.value })}
              required
            />
            <Input 
              label="Confirm Password" 
              type="password"
              placeholder="••••••••"
              value={signupData.confirmPassword}
              onChange={(e: any) => setSignupData({ ...signupData, confirmPassword: e.target.value })}
              required
            />
            <div className="md:col-span-2 mt-4">
              <Button type="submit" className="w-full py-3" disabled={loading}>
                {loading ? 'Creating account...' : 'Sign Up'}
              </Button>
            </div>
          </form>

          <div className="mt-6 text-center text-sm text-slate-500">
            Already have an account?{' '}
            <button onClick={() => setView('login')} className="text-emerald-600 font-semibold hover:underline">
              Login
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // --- Dashboard Layout ---

  const sidebarItems = {
    student: [
      { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { id: 'apply for aid', icon: FileText, label: 'Apply for Aid' },
      { id: 'my applications', icon: History, label: 'My Applications' },
      { id: 'upload documents', icon: Upload, label: 'Upload Documents' },
      { id: 'announcements', icon: Megaphone, label: 'Announcements' },
      { id: 'messages', icon: MessageSquare, label: 'Messages' },
    ],
    staff: [
      { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { id: 'manage applications', icon: FileText, label: 'Manage Applications' },
      { id: 'announcements', icon: Megaphone, label: 'Post Announcements' },
      { id: 'messages', icon: MessageSquare, label: 'Student Messages' },
    ],
    admin: [
      { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { id: 'user management', icon: UserIcon, label: 'User Management' },
      { id: 'system settings', icon: LayoutDashboard, label: 'System Settings' },
      { id: 'reports', icon: FileText, label: 'Reports' },
      { id: 'announcements', icon: Megaphone, label: 'Announcements' },
    ]
  };

  const currentSidebarItems = sidebarItems[user?.role || 'student'];

  const renderMessages = () => (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex h-[70vh]">
      {/* Contacts List */}
      <div className="w-1/3 border-r border-slate-100 flex flex-col">
        <div className="p-4 border-b border-slate-50">
          <h3 className="font-bold text-slate-900">Contacts</h3>
        </div>
        <div className="flex-1 overflow-y-auto">
          {contacts.map(contact => (
            <button
              key={contact.id}
              onClick={() => setSelectedContact(contact)}
              aria-label={`Chat with ${contact.firstName} ${contact.lastName}`}
              className={`w-full p-4 flex items-center gap-3 hover:bg-slate-50 transition-all border-b border-slate-50 outline-none focus-visible:bg-slate-50 ${selectedContact?.id === contact.id ? 'bg-emerald-50' : ''}`}
            >
              <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500">
                <UserIcon size={20} aria-hidden="true" />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-slate-900">{contact.firstName} {contact.lastName}</p>
                <p className="text-xs text-slate-500 uppercase tracking-wider">{contact.role}</p>
              </div>
            </button>
          ))}
          {contacts.length === 0 && (
            <div className="p-8 text-center text-slate-400 text-sm">
              No contacts found.
            </div>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-slate-50/30">
        {selectedContact ? (
          <>
            <div className="p-4 bg-white border-b border-slate-100 flex items-center gap-3">
              <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
                <UserIcon size={16} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">{selectedContact.firstName} {selectedContact.lastName}</h3>
                <p className="text-xs text-emerald-700 font-medium uppercase tracking-wider">Online</p>
              </div>
            </div>
            <div 
              className="flex-1 overflow-y-auto p-4 space-y-4"
              role="log"
              aria-live="polite"
              aria-label="Message history"
            >
              {messages
                .filter(m => (m.senderId === user?.id && m.receiverId === selectedContact.id) || (m.senderId === selectedContact.id && m.receiverId === user?.id))
                .map(msg => (
                  <div key={msg.id} className={`flex ${msg.senderId === user?.id ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%] p-3 rounded-2xl text-sm ${msg.senderId === user?.id ? 'bg-emerald-600 text-white rounded-tr-none' : 'bg-white text-slate-900 border border-slate-100 rounded-tl-none shadow-sm'}`}>
                      {msg.content}
                      <span className={`block text-xs mt-1 ${msg.senderId === user?.id ? 'text-emerald-100' : 'text-slate-500'}`}>
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
            <div className="p-4 bg-white border-t border-slate-100">
              <form onSubmit={(e) => {
                e.preventDefault();
                const input = e.currentTarget.elements.namedItem('message') as HTMLInputElement;
                if (input.value.trim()) {
                  sendMessage(input.value);
                  input.value = '';
                }
              }} className="flex gap-2">
                <input
                  name="message"
                  placeholder="Type a message..."
                  aria-label="Type a message"
                  className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-sm"
                />
                <Button type="submit" className="px-6">Send</Button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
            <MessageSquare size={48} className="mb-4 opacity-30" />
            <p className="text-sm font-medium">Select a contact to start messaging</p>
          </div>
        )}
      </div>
    </div>
  );

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAnnouncement)
      });
      if (res.ok) {
        setShowAnnouncementModal(false);
        setNewAnnouncement({ title: '', content: '', category: 'General' });
        fetchData();
      }
    } catch (err) {
      alert("Failed to create announcement");
    }
  };

  const handleDeleteAnnouncement = async (id: number) => {
    if (!confirm("Are you sure you want to delete this announcement?")) return;
    try {
      const res = await fetch(`/api/admin/announcements/${id}`, { method: 'DELETE' });
      if (res.ok) fetchData();
    } catch (err) {
      alert("Failed to delete announcement");
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (!confirm("Are you sure you want to delete this user?")) return;
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
      if (res.ok) fetchData();
    } catch (err) {
      alert("Failed to delete user");
    }
  };

  const handleUpdateApplicationStatus = async (id: number, status: string) => {
    try {
      const res = await fetch(`/api/applications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        alert(`Application ${status} successfully. Email notification sent to student.`);
        fetchData();
      }
    } catch (err) {
      alert(`Failed to ${status} application`);
    }
  };

  const handleBackup = async () => {
    try {
      const res = await fetch('/api/admin/backup', { method: 'POST' });
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `scc_backup_${new Date().toISOString()}.json`;
      a.click();
    } catch (err) {
      alert("Backup failed");
    }
  };

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        const res = await fetch('/api/admin/restore', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data })
        });
        if (res.ok) {
          alert("System restored successfully");
          fetchData();
        }
      } catch (err) {
        alert("Restore failed: Invalid file");
      }
    };
    reader.readAsText(file);
  };

  const renderContent = () => {
    if (user?.role === 'admin') {
      switch (activeTab) {
        case 'dashboard':
          return (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                  <p className="text-xs text-slate-600 uppercase font-bold tracking-wider mb-1">Total Users</p>
                  <h3 className="text-2xl font-bold text-slate-900">{reportData?.totalUsers || 0}</h3>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                  <p className="text-xs text-slate-600 uppercase font-bold tracking-wider mb-1">Applications</p>
                  <h3 className="text-2xl font-bold text-slate-900">{reportData?.totalApplications || 0}</h3>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                  <p className="text-xs text-slate-600 uppercase font-bold tracking-wider mb-1">Pending</p>
                  <h3 className="text-2xl font-bold text-emerald-700">{reportData?.pendingApplications || 0}</h3>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                  <p className="text-xs text-slate-600 uppercase font-bold tracking-wider mb-1">Documents</p>
                  <h3 className="text-2xl font-bold text-slate-900">{reportData?.totalDocuments || 0}</h3>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                  <h3 className="font-bold text-slate-900 mb-4">Recent System Activity</h3>
                  <div className="space-y-4">
                    {reportData?.recentActivity.map((act: any, i: number) => (
                      <div key={i} className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <div className={`p-2 rounded-lg ${act.type === 'Application' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'}`}>
                          {act.type === 'Application' ? <FileText size={16} /> : <Megaphone size={16} />}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">{act.detail}</p>
                          <p className="text-xs text-slate-500 mt-1">{new Date(act.date).toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                  <h3 className="font-bold text-slate-900 mb-4">User Distribution</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">Students</span>
                      <span className="text-sm font-bold">{reportData?.totalStudents}</span>
                    </div>
                    <div 
                      className="w-full bg-slate-100 h-2 rounded-full overflow-hidden"
                      role="progressbar"
                      aria-valuenow={reportData?.totalStudents}
                      aria-valuemin={0}
                      aria-valuemax={reportData?.totalUsers}
                      aria-label="Student distribution"
                    >
                      <div className="bg-emerald-500 h-full" style={{ width: `${(reportData?.totalStudents / reportData?.totalUsers) * 100}%` }}></div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">Staff</span>
                      <span className="text-sm font-bold">{reportData?.totalStaff}</span>
                    </div>
                    <div 
                      className="w-full bg-slate-100 h-2 rounded-full overflow-hidden"
                      role="progressbar"
                      aria-valuenow={reportData?.totalStaff}
                      aria-valuemin={0}
                      aria-valuemax={reportData?.totalUsers}
                      aria-label="Staff distribution"
                    >
                      <div className="bg-blue-500 h-full" style={{ width: `${(reportData?.totalStaff / reportData?.totalUsers) * 100}%` }}></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        case 'user management':
          return (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <h2 className="text-lg font-bold text-slate-900">User Management</h2>
                <div className="flex gap-2">
                  <Input 
                    placeholder="Search users..." 
                    className="w-64" 
                    aria-label="Search users"
                  />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-slate-600 text-xs uppercase font-bold tracking-wider">
                    <tr>
                      <th scope="col" className="px-6 py-4">Name</th>
                      <th scope="col" className="px-6 py-4">School ID</th>
                      <th scope="col" className="px-6 py-4">Role</th>
                      <th scope="col" className="px-6 py-4">Email</th>
                      <th scope="col" className="px-6 py-4">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {allUsers.map(u => (
                      <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-500">
                              <UserIcon size={16} aria-hidden="true" />
                            </div>
                            <span className="text-sm font-medium text-slate-900">{u.firstName} {u.lastName}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">{u.schoolId}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                            u.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                            u.role === 'staff' ? 'bg-blue-100 text-blue-800' :
                            'bg-emerald-100 text-emerald-800'
                          }`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">{u.email}</td>
                        <td className="px-6 py-4">
                          <Button 
                            variant="ghost" 
                            className="text-red-600 hover:bg-red-50 p-2 h-auto"
                            onClick={() => handleDeleteUser(u.id)}
                            aria-label={`Delete user ${u.firstName} ${u.lastName}`}
                          >
                            <X size={16} aria-hidden="true" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        case 'system settings':
          return (
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm">
                <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                  <Shield size={24} className="text-emerald-600" />
                  Security & Data Management
                </h2>
                
                <div className="space-y-8">
                  <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                    <div>
                      <h3 className="font-bold text-emerald-900">Data Encryption</h3>
                      <p className="text-sm text-emerald-700">All system data is currently encrypted using AES-256 standards at rest.</p>
                    </div>
                    <div className="flex items-center gap-2 text-emerald-600">
                      <Shield size={20} />
                      <span className="text-sm font-bold">ACTIVE</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                      <h3 className="font-bold text-slate-900 mb-2">System Backup</h3>
                      <p className="text-sm text-slate-500 mb-4">Download a full backup of the system database including users, applications, and documents.</p>
                      <Button onClick={handleBackup} className="w-full flex items-center justify-center gap-2">
                        <Download size={18} />
                        Download Backup
                      </Button>
                    </div>
                    <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                      <h3 className="font-bold text-slate-900 mb-2">System Restore</h3>
                      <p className="text-sm text-slate-500 mb-4">Restore the system state from a previously downloaded backup file.</p>
                      <label className="w-full flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-xl text-sm font-medium hover:bg-slate-50 transition-all cursor-pointer">
                        <Upload size={18} />
                        Upload & Restore
                        <input type="file" className="hidden" accept=".json" onChange={handleRestore} />
                      </label>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-slate-100">
                    <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                      <Megaphone size={18} className="text-blue-600" />
                      Email Notification Log
                    </h3>
                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                      {emailLogs.length > 0 ? emailLogs.map((log, i) => (
                        <div key={i} className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                          <div className="flex justify-between mb-1">
                            <span className="font-bold text-slate-700">To: {log.to}</span>
                            <span className="text-slate-400">{new Date(log.date).toLocaleString()}</span>
                          </div>
                          <div className="font-medium text-blue-600 mb-1">Subject: {log.subject}</div>
                          <p className="text-slate-500 line-clamp-2">{log.body}</p>
                        </div>
                      )) : (
                        <div className="text-center py-8 text-slate-400 italic">No emails sent yet.</div>
                      )}
                    </div>
                  </div>

                  <div className="pt-6 border-t border-slate-100">
                    <h3 className="font-bold text-slate-900 mb-4">General Settings</h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-slate-900">Maintenance Mode</p>
                          <p className="text-xs text-slate-500">Disable student access for system updates.</p>
                        </div>
                        <button 
                          role="switch"
                          aria-checked="false"
                          aria-label="Toggle Maintenance Mode"
                          className="w-12 h-6 bg-slate-200 rounded-full relative cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
                        >
                          <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm"></div>
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-slate-900">Auto-Approve Merit Aid</p>
                          <p className="text-xs text-slate-500">Automatically approve applications meeting GPA requirements.</p>
                        </div>
                        <button 
                          role="switch"
                          aria-checked="true"
                          aria-label="Toggle Auto-Approve Merit Aid"
                          className="w-12 h-6 bg-emerald-500 rounded-full relative cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
                        >
                          <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm"></div>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        case 'reports':
          return (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-slate-900">System Reports</h2>
                <Button variant="outline" className="flex items-center gap-2">
                  <Download size={16} />
                  Export PDF
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                  <h3 className="font-bold text-slate-900 mb-6">Application Trends</h3>
                  <div 
                    className="h-64 flex items-end gap-2 px-4"
                    role="img"
                    aria-label="Bar chart showing application trends over the week"
                  >
                    {[40, 70, 45, 90, 65, 80, 55].map((h, i) => (
                      <div key={i} className="flex-1 bg-emerald-100 rounded-t-lg relative group">
                        <div className="bg-emerald-500 absolute bottom-0 left-0 right-0 rounded-t-lg transition-all" style={{ height: `${h}%` }}></div>
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                          {h} apps
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between mt-4 px-4 text-xs text-slate-500 font-bold uppercase tracking-wider">
                    <span>Mon</span>
                    <span>Tue</span>
                    <span>Wed</span>
                    <span>Thu</span>
                    <span>Fri</span>
                    <span>Sat</span>
                    <span>Sun</span>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                  <h3 className="font-bold text-slate-900 mb-6">Aid Distribution by Course</h3>
                  <div className="space-y-6">
                    {[
                      { label: 'BSIT', value: 45, color: 'bg-emerald-500' },
                      { label: 'BSCS', value: 30, color: 'bg-blue-500' },
                      { label: 'BSBA', value: 15, color: 'bg-amber-500' },
                      { label: 'BSED', value: 10, color: 'bg-purple-500' }
                    ].map((item, i) => (
                      <div key={i} className="space-y-2">
                        <div className="flex justify-between text-xs font-medium">
                          <span>{item.label}</span>
                          <span>{item.value}%</span>
                        </div>
                        <div 
                          className="w-full bg-slate-100 h-2 rounded-full overflow-hidden"
                          role="progressbar"
                          aria-valuenow={item.value}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`Aid distribution for ${item.label}`}
                        >
                          <div className={`${item.color} h-full`} style={{ width: `${item.value}%` }}></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                <h3 className="font-bold text-slate-900 mb-4">Detailed Statistics</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-center">
                    <p className="text-xs text-slate-600 uppercase font-bold tracking-wider mb-1">Avg Processing Time</p>
                    <p className="text-lg font-bold text-slate-900">3.2 Days</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-center">
                    <p className="text-xs text-slate-600 uppercase font-bold tracking-wider mb-1">Approval Rate</p>
                    <p className="text-lg font-bold text-slate-900">78%</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-center">
                    <p className="text-xs text-slate-600 uppercase font-bold tracking-wider mb-1">Active Scholarships</p>
                    <p className="text-lg font-bold text-slate-900">12</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-center">
                    <p className="text-xs text-slate-600 uppercase font-bold tracking-wider mb-1">System Uptime</p>
                    <p className="text-lg font-bold text-slate-900">99.9%</p>
                  </div>
                </div>
              </div>
            </div>
          );
        case 'announcements':
          const filteredAnnouncements = announcements.filter(ann => {
            const categoryMatch = announcementFilter.category === 'All' || ann.category === announcementFilter.category;
            const dateMatch = !announcementFilter.date || new Date(ann.date).toLocaleDateString() === new Date(announcementFilter.date).toLocaleDateString();
            return categoryMatch && dateMatch;
          });
          const categories = ['All', ...new Set(announcements.map(a => a.category))];

          return (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-slate-900">Manage Announcements</h2>
                <Button onClick={() => setShowAnnouncementModal(true)} className="flex items-center gap-2">
                  <Plus size={16} />
                  New Announcement
                </Button>
              </div>
              
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-[200px]">
                  <Select 
                    label="Filter by Category"
                    value={announcementFilter.category}
                    onChange={(e: any) => setAnnouncementFilter({ ...announcementFilter, category: e.target.value })}
                    options={categories}
                  />
                </div>
                <div className="flex-1 min-w-[200px]">
                  <Input 
                    label="Filter by Date"
                    type="date"
                    value={announcementFilter.date}
                    onChange={(e: any) => setAnnouncementFilter({ ...announcementFilter, date: e.target.value })}
                  />
                </div>
                <Button 
                  variant="outline" 
                  onClick={() => setAnnouncementFilter({ category: 'All', date: '' })}
                  className="h-10"
                >
                  Reset Filters
                </Button>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {filteredAnnouncements.map(ann => (
                  <motion.div 
                    key={ann.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-lg font-bold text-slate-900">{ann.title}</h3>
                      <div className="flex gap-2">
                        <span className="px-2 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold uppercase rounded-full">
                          {ann.category}
                        </span>
                        <Button 
                          variant="ghost" 
                          className="p-1 h-auto text-red-500 hover:text-red-700"
                          onClick={() => handleDeleteAnnouncement(ann.id)}
                          aria-label={`Delete announcement: ${ann.title}`}
                        >
                          <X size={14} aria-hidden="true" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-slate-600 text-sm leading-relaxed mb-4">{ann.content}</p>
                    <div className="flex items-center gap-2 text-slate-600 text-xs font-medium uppercase tracking-wider">
                      <Clock size={12} aria-hidden="true" />
                      {new Date(ann.date).toLocaleDateString()} at {new Date(ann.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </motion.div>
                ))}
              </div>

              <Modal 
                isOpen={showAnnouncementModal} 
                onClose={() => setShowAnnouncementModal(false)}
                title="Create New Announcement"
              >
                <form onSubmit={handleCreateAnnouncement} className="space-y-4">
                  <Input 
                    label="Title" 
                    value={newAnnouncement.title}
                    onChange={(e: any) => setNewAnnouncement({ ...newAnnouncement, title: e.target.value })}
                    required
                  />
                  <Select 
                    label="Category"
                    options={['General', 'Scholarship', 'Deadline', 'System', 'Event']}
                    value={newAnnouncement.category}
                    onChange={(e: any) => setNewAnnouncement({ ...newAnnouncement, category: e.target.value })}
                  />
                  <div className="space-y-1">
                    <label htmlFor="announcement-content" className="text-sm font-medium text-slate-700">Content</label>
                    <textarea 
                      id="announcement-content"
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-sm min-h-[120px]"
                      value={newAnnouncement.content}
                      onChange={(e) => setNewAnnouncement({ ...newAnnouncement, content: e.target.value })}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full py-3">Post Announcement</Button>
                </form>
              </Modal>
            </div>
          );
        default:
          return <div className="text-center py-12 text-slate-400">Admin {activeTab} view under development.</div>;
      }
    }

    if (user?.role === 'staff') {
      switch (activeTab) {
        case 'dashboard':
          return (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                <h3 className="text-2xl font-bold text-slate-900">{applications.filter(a => a.status === 'pending').length}</h3>
                <p className="text-sm text-slate-600">Pending Applications</p>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                <h3 className="text-2xl font-bold text-slate-900">12</h3>
                <p className="text-sm text-slate-600">Interviews Today</p>
              </div>
            </div>
          );
        case 'manage applications':
          return (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100">
                <h2 className="text-lg font-bold text-slate-900">All Applications</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-slate-600 text-xs uppercase font-bold tracking-wider">
                    <tr>
                      <th scope="col" className="px-6 py-4">Student ID</th>
                      <th scope="col" className="px-6 py-4">Type</th>
                      <th scope="col" className="px-6 py-4">Status</th>
                      <th scope="col" className="px-6 py-4">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {applications.map(app => (
                      <tr key={app.id}>
                        <td className="px-6 py-4 text-sm">#{app.userId}</td>
                        <td className="px-6 py-4 font-medium">{app.type}</td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-1 rounded-full text-xs font-bold uppercase bg-amber-100 text-amber-700">{app.status}</span>
                        </td>
                        <td className="px-6 py-4 flex gap-2">
                          <Button variant="outline" className="text-xs px-2 py-1" onClick={() => handleViewApplication(app)}>View</Button>
                          <Button 
                            variant="primary" 
                            className="text-xs px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={() => handleUpdateApplicationStatus(app.id, 'approved')}
                            disabled={app.status === 'approved'}
                          >
                            Approve
                          </Button>
                          <Button 
                            variant="outline" 
                            className="text-xs px-2 py-1 text-red-600 border-red-200 hover:bg-red-50"
                            onClick={() => handleUpdateApplicationStatus(app.id, 'rejected')}
                            disabled={app.status === 'rejected'}
                          >
                            Reject
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        case 'announcements':
          const filteredAnnouncements = announcements.filter(ann => {
            const categoryMatch = announcementFilter.category === 'All' || ann.category === announcementFilter.category;
            const dateMatch = !announcementFilter.date || new Date(ann.date).toLocaleDateString() === new Date(announcementFilter.date).toLocaleDateString();
            return categoryMatch && dateMatch;
          });
          const categories = ['All', ...new Set(announcements.map(a => a.category))];

          return (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-slate-900">Manage Announcements</h2>
                <Button className="flex items-center gap-2">
                  <Plus size={16} />
                  New Announcement
                </Button>
              </div>
              
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-[200px]">
                  <Select 
                    label="Filter by Category"
                    value={announcementFilter.category}
                    onChange={(e: any) => setAnnouncementFilter({ ...announcementFilter, category: e.target.value })}
                    options={categories}
                  />
                </div>
                <div className="flex-1 min-w-[200px]">
                  <Input 
                    label="Filter by Date"
                    type="date"
                    value={announcementFilter.date}
                    onChange={(e: any) => setAnnouncementFilter({ ...announcementFilter, date: e.target.value })}
                  />
                </div>
                <Button 
                  variant="outline" 
                  onClick={() => setAnnouncementFilter({ category: 'All', date: '' })}
                  className="h-10"
                >
                  Reset Filters
                </Button>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {filteredAnnouncements.map(ann => (
                  <motion.div 
                    key={ann.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-lg font-bold text-slate-900">{ann.title}</h3>
                      <div className="flex gap-2">
                        <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold uppercase rounded-full">
                          {ann.category}
                        </span>
                        <Button 
                          variant="ghost" 
                          className="p-1 h-auto text-slate-500 hover:text-slate-700"
                          aria-label={`Delete announcement: ${ann.title}`}
                        >
                          <X size={14} aria-hidden="true" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-slate-600 text-sm leading-relaxed mb-4">{ann.content}</p>
                    <div className="flex items-center gap-2 text-slate-600 text-xs font-medium uppercase tracking-wider">
                      <Clock size={12} aria-hidden="true" />
                      {new Date(ann.date).toLocaleDateString()} at {new Date(ann.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          );
        case 'messages':
          return renderMessages();
        default:
          return <div className="text-center py-12 text-slate-400">Staff {activeTab} view under development.</div>;
      }
    }

    switch (activeTab) {
      case 'dashboard':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                    <FileText size={20} aria-hidden="true" />
                  </div>
                  <span className="text-xs font-medium text-slate-500">Total</span>
                </div>
                <h3 className="text-2xl font-bold text-slate-900">{applications.length}</h3>
                <p className="text-sm text-slate-500">Applications Submitted</p>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
                    <Clock size={20} aria-hidden="true" />
                  </div>
                  <span className="text-xs font-medium text-slate-500">Status</span>
                </div>
                <h3 className="text-2xl font-bold text-slate-900">
                  {applications.filter(a => a.status === 'pending').length}
                </h3>
                <p className="text-sm text-slate-500">Pending Review</p>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                    <Bell size={20} aria-hidden="true" />
                  </div>
                  <span className="text-xs font-medium text-slate-500">Updates</span>
                </div>
                <h3 className="text-2xl font-bold text-slate-900">{announcements.length}</h3>
                <p className="text-sm text-slate-500">New Announcements</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                <h3 className="font-bold text-slate-900 mb-4">Recent Announcements</h3>
                <div className="space-y-4">
                  {announcements.slice(0, 3).map(ann => (
                    <div key={ann.id} className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="flex justify-between items-start mb-1">
                        <h4 className="font-semibold text-slate-900 text-sm">{ann.title}</h4>
                        <span className="text-xs font-bold uppercase px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full">
                          {ann.category}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 line-clamp-2">{ann.content}</p>
                      <span className="text-xs text-slate-500 mt-2 block">
                        {new Date(ann.date).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                <h3 className="font-bold text-slate-900 mb-4">Application Status</h3>
                <div className="space-y-4">
                  {applications.slice(0, 3).map(app => (
                    <div key={app.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <div>
                        <h4 className="font-semibold text-slate-900 text-sm">{app.type}</h4>
                        <span className="text-xs text-slate-500">ID: #{app.id}</span>
                      </div>
                      <div className={`px-2 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                        app.status === 'approved' ? 'bg-emerald-100 text-emerald-800' :
                        app.status === 'rejected' ? 'bg-red-100 text-red-800' :
                        'bg-amber-100 text-amber-800'
                      }`}>
                        {app.status}
                      </div>
                    </div>
                  ))}
                  {applications.length === 0 && (
                    <div className="text-center py-8 text-slate-400 text-sm">
                      No applications yet.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      case 'apply for aid':
        return (
          <div className="max-w-2xl mx-auto bg-white p-8 rounded-2xl border border-slate-100 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900 mb-6">Financial Aid Application</h2>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              handleApply(formData.get('type') as string, formData.get('details') as string);
            }} className="space-y-6">
              <Select 
                label="Type of Aid"
                name="type"
                options={['Academic Scholarship', 'Financial Assistance', 'Working Student Program', 'Athletic Grant']}
              />
              <div className="space-y-1">
                <label htmlFor="aid-reason" className="text-sm font-medium text-slate-700">Reason for Application</label>
                <textarea 
                  id="aid-reason"
                  name="details"
                  className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all h-32"
                  placeholder="Tell us why you are applying for this aid..."
                  required
                />
              </div>
              <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
                <p className="text-xs text-blue-700 leading-relaxed">
                  <strong>Note:</strong> Please ensure all your profile information is up to date before applying. You will be required to upload supporting documents in the next step.
                </p>
              </div>
              <Button type="submit" className="w-full py-3">Submit Application</Button>
            </form>
          </div>
        );
      case 'my applications':
        return (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-6 border-bottom border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">Application History</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-600 text-xs uppercase font-bold tracking-wider">
                  <tr>
                    <th scope="col" className="px-6 py-4">ID</th>
                    <th scope="col" className="px-6 py-4">Type</th>
                    <th scope="col" className="px-6 py-4">Date</th>
                    <th scope="col" className="px-6 py-4">Status</th>
                    <th scope="col" className="px-6 py-4">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {applications.map(app => (
                    <tr key={app.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 text-sm text-slate-600">#{app.id}</td>
                      <td className="px-6 py-4 font-medium text-slate-900">{app.type}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{new Date(app.date).toLocaleDateString()}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                          app.status === 'approved' ? 'bg-emerald-100 text-emerald-800' :
                          app.status === 'rejected' ? 'bg-red-100 text-red-800' :
                          'bg-amber-100 text-amber-800'
                        }`}>
                          {app.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <Button variant="ghost" className="text-xs" onClick={() => handleViewApplication(app)}>View Details</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {applications.length === 0 && (
                <div className="text-center py-12 text-slate-400">
                  No applications found.
                </div>
              )}
            </div>
          </div>
        );
      case 'upload documents':
        return (
          <div className="space-y-6">
            <div className="max-w-2xl mx-auto bg-white p-8 rounded-2xl border border-slate-100 shadow-sm">
              <h2 className="text-xl font-bold text-slate-900 mb-6">Upload Required Documents</h2>
              <form onSubmit={handleFileUpload} className="space-y-6">
                <Select 
                  label="Document Type"
                  name="type"
                  options={['Proof of Enrollment', 'Income Tax Return (ITR)', 'Certificate of Indigency', 'Report Card / Transcript', 'Valid ID']}
                  required
                />
                <div className="space-y-1">
                  <label htmlFor="file-upload" className="text-sm font-medium text-slate-700">Select File</label>
                  <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-200 border-dashed rounded-xl hover:border-emerald-500 transition-colors cursor-pointer group focus-within:ring-2 focus-within:ring-emerald-500">
                    <div className="space-y-1 text-center">
                      <Upload className="mx-auto h-12 w-12 text-slate-400 group-hover:text-emerald-500 transition-colors" aria-hidden="true" />
                      <div className="flex text-sm text-slate-600">
                        <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-emerald-600 hover:text-emerald-500 focus-within:outline-none">
                          <span>Upload a file</span>
                          <input id="file-upload" name="file" type="file" className="sr-only" required />
                        </label>
                        <p className="pl-1">or drag and drop</p>
                      </div>
                      <p className="text-xs text-slate-500">PNG, JPG, PDF up to 10MB</p>
                    </div>
                  </div>
                </div>
                <Button type="submit" className="w-full py-3" disabled={loading}>
                  {loading ? 'Uploading...' : 'Upload Document'}
                </Button>
              </form>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100">
                <h2 className="text-lg font-bold text-slate-900">Your Uploaded Documents</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-slate-600 text-xs uppercase font-bold tracking-wider">
                    <tr>
                      <th scope="col" className="px-6 py-4">Type</th>
                      <th scope="col" className="px-6 py-4">File Name</th>
                      <th scope="col" className="px-6 py-4">Size</th>
                      <th scope="col" className="px-6 py-4">Date Uploaded</th>
                      <th scope="col" className="px-6 py-4">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {userDocuments.map(doc => (
                      <tr key={doc.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 font-medium text-slate-900">{doc.type}</td>
                        <td className="px-6 py-4 text-sm text-slate-600">{doc.originalName}</td>
                        <td className="px-6 py-4 text-sm text-slate-500">{(doc.size / 1024).toFixed(2)} KB</td>
                        <td className="px-6 py-4 text-sm text-slate-500">{new Date(doc.date).toLocaleDateString()}</td>
                        <td className="px-6 py-4">
                          <Button variant="ghost" className="text-xs">View</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {userDocuments.length === 0 && (
                  <div className="text-center py-12 text-slate-400">
                    No documents uploaded yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      case 'announcements':
        const filteredAnnouncements = announcements.filter(ann => {
          const categoryMatch = announcementFilter.category === 'All' || ann.category === announcementFilter.category;
          const dateMatch = !announcementFilter.date || new Date(ann.date).toLocaleDateString() === new Date(announcementFilter.date).toLocaleDateString();
          return categoryMatch && dateMatch;
        });
        const categories = ['All', ...new Set(announcements.map(a => a.category))];

        return (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-wrap gap-4 items-end">
              <div className="flex-1 min-w-[200px]">
                <Select 
                  label="Filter by Category"
                  value={announcementFilter.category}
                  onChange={(e: any) => setAnnouncementFilter({ ...announcementFilter, category: e.target.value })}
                  options={categories}
                />
              </div>
              <div className="flex-1 min-w-[200px]">
                <Input 
                  label="Filter by Date"
                  type="date"
                  value={announcementFilter.date}
                  onChange={(e: any) => setAnnouncementFilter({ ...announcementFilter, date: e.target.value })}
                />
              </div>
              <Button 
                variant="outline" 
                onClick={() => setAnnouncementFilter({ category: 'All', date: '' })}
                className="h-10"
              >
                Reset Filters
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {filteredAnnouncements.map(ann => (
                <motion.div 
                  key={ann.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all"
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-lg font-bold text-slate-900">{ann.title}</h3>
                    <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold uppercase rounded-full">
                      {ann.category}
                    </span>
                  </div>
                  <p className="text-slate-600 text-sm leading-relaxed mb-4">{ann.content}</p>
                  <div className="flex items-center gap-2 text-slate-600 text-xs font-medium uppercase tracking-wider">
                    <Clock size={12} aria-hidden="true" />
                    {new Date(ann.date).toLocaleDateString()} at {new Date(ann.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </motion.div>
              ))}
              {filteredAnnouncements.length === 0 && (
                <div className="text-center py-20 bg-white rounded-2xl border border-slate-100 border-dashed">
                  <Megaphone size={48} className="mx-auto text-slate-200 mb-4" />
                  <p className="text-slate-400">No announcements found matching your filters.</p>
                </div>
              )}
            </div>
          </div>
        );
      case 'messages':
        return renderMessages();
      default:
        return (
          <div className="flex flex-col items-center justify-center h-[60vh] text-slate-400">
            <Clock size={48} className="mb-4 opacity-20" />
            <p className="text-lg font-medium">Coming Soon</p>
            <p className="text-sm">This section is currently under development.</p>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans">
      {/* Sidebar */}
      <aside 
        aria-label="Main Sidebar"
        className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-100 transition-transform duration-300 transform
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:relative lg:translate-x-0
      `}>
        <div className="p-6 flex items-center gap-3 border-b border-slate-50">
          <div className="w-8 h-8 bg-emerald-600 text-white rounded-lg flex items-center justify-center">
            <LayoutDashboard size={18} />
          </div>
          <h1 className="font-bold text-slate-900 tracking-tight">School Portal</h1>
        </div>

        <nav className="p-4 space-y-1" aria-label="Main Navigation">
          {currentSidebarItems.map(item => (
            <button
              key={item.id}
              aria-current={activeTab === item.id ? 'page' : undefined}
              onClick={() => {
                setActiveTab(item.id);
                if (window.innerWidth < 1024) setIsSidebarOpen(false);
              }}
              className={`
                w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all outline-none focus-visible:ring-2 focus-visible:ring-emerald-500
                ${activeTab === item.id 
                  ? 'bg-emerald-50 text-emerald-700 shadow-sm shadow-emerald-100/50' 
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}
              `}
            >
              <item.icon size={18} aria-hidden="true" />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-50">
          <button 
            onClick={() => {
              setUser(null);
              setView('login');
            }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 transition-all"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </aside>

      {/* Application Detail Modal */}
      <Modal 
        isOpen={!!selectedApplication} 
        onClose={() => setSelectedApplication(null)}
        title="Application Details"
      >
        {selectedApplication && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-600 uppercase font-bold tracking-wider">Type</p>
                <p className="text-sm font-semibold text-slate-900">{selectedApplication.type}</p>
              </div>
              <div>
                <p className="text-xs text-slate-600 uppercase font-bold tracking-wider">Status</p>
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                  selectedApplication.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                  selectedApplication.status === 'rejected' ? 'bg-red-100 text-red-700' :
                  'bg-amber-100 text-amber-700'
                }`}>
                  {selectedApplication.status}
                </span>
              </div>
              <div>
                <p className="text-xs text-slate-600 uppercase font-bold tracking-wider">Date Submitted</p>
                <p className="text-sm font-semibold text-slate-900">{new Date(selectedApplication.date).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-xs text-slate-600 uppercase font-bold tracking-wider">Application ID</p>
                <p className="text-sm font-semibold text-slate-900">#{selectedApplication.id}</p>
              </div>
            </div>

            <div>
              <p className="text-xs text-slate-600 uppercase font-bold tracking-wider mb-2">Reason/Details</p>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-sm text-slate-700 leading-relaxed">
                {selectedApplication.details}
              </div>
            </div>

            <div>
              <p className="text-xs text-slate-600 uppercase font-bold tracking-wider mb-3">Associated Documents</p>
              <div className="space-y-2">
                {applicationDocuments.length > 0 ? (
                  applicationDocuments.map(doc => (
                    <div key={doc.id} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-100 text-slate-500 rounded-lg">
                          <FileText size={16} />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">{doc.type}</p>
                          <p className="text-xs text-slate-500">{doc.originalName} ({(doc.size / 1024).toFixed(2)} KB)</p>
                        </div>
                      </div>
                      <Button variant="ghost" className="text-xs">View</Button>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-400 italic py-4 text-center border border-dashed border-slate-200 rounded-xl">
                    No documents uploaded for this user yet.
                  </p>
                )}
              </div>
            </div>

            {user?.role !== 'student' && selectedApplication.status === 'pending' && (
              <div className="pt-4 flex gap-3">
                <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700">Approve Application</Button>
                <Button variant="outline" className="flex-1 text-red-600 border-red-100 hover:bg-red-50">Reject Application</Button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-100 flex items-center justify-between px-6 sticky top-0 z-40">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="lg:hidden p-2 text-slate-600 hover:bg-slate-50 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              aria-label={isSidebarOpen ? "Close menu" : "Open menu"}
              aria-expanded={isSidebarOpen}
            >
              <Menu size={20} aria-hidden="true" />
            </button>
            <h2 className="text-lg font-bold text-slate-900 capitalize">{activeTab}</h2>
          </div>

          <div className="flex items-center gap-4">
            <button 
              className="p-2 text-slate-500 hover:text-slate-700 relative outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-lg"
              aria-label="View notifications"
            >
              <Bell size={20} aria-hidden="true" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
            <div className="h-8 w-px bg-slate-100"></div>
            <div className="flex items-center gap-3 pl-2">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-slate-900 leading-none">{user?.firstName} {user?.lastName}</p>
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mt-1">{user?.role}</p>
              </div>
              <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center border-2 border-white shadow-sm overflow-hidden">
                <UserIcon size={20} className="text-slate-500" aria-hidden="true" />
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="p-6 lg:p-8 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
