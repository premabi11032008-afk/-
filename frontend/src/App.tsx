import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { 
  UploadCloud, 
  FileText, 
  Sparkles, 
  Copy, 
  Download, 
  CheckCircle2,
  Video,
  FileBarChart,
  Presentation,
  AlignLeft,
  Share2,
  MessageSquare,
  XCircle,
  RotateCcw,
  Trash2,
  RefreshCw,
  AlertTriangle,
  Dna,
  Lock,
  User,
  LogOut,
  SlidersHorizontal,
  ChevronRight,
  KeyRound,
  Layers,
  History,
  ShieldCheck,
  GraduationCap,
  Briefcase,
  Users,
  HelpCircle
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import './index.css';

const OUTPUT_TYPES = [
  { id: 'video', label: 'Video Script', icon: Video },
  { id: 'linkedin', label: 'LinkedIn Post', icon: MessageSquare },
  { id: 'twitter', label: 'Twitter/X Post', icon: Share2 },
  { id: 'advisory', label: 'Advisory', icon: FileText },
  { id: 'infographic', label: 'Infographic Concept', icon: FileBarChart },
  { id: 'executive', label: 'Executive Summary', icon: AlignLeft },
  { id: 'presentation', label: 'Presentation', icon: Presentation },
];

const ROLES = [
  { id: 'Public', label: 'Public User', icon: Users },
  { id: 'Student', label: 'Student', icon: GraduationCap },
  { id: 'Staff', label: 'Staff / Faculty', icon: Briefcase },
  { id: 'Admin', label: 'Administrator', icon: ShieldCheck },
  { id: 'Others', label: 'Others', icon: HelpCircle },
];

const AUDIENCES = ['General', 'Technical', 'Executive', 'Internal', 'Public'];
const TONES = ['Professional', 'Urgent', 'Casual', 'Persuasive', 'Informative', 'Humorous'];
const LANGUAGES = ['English', 'Tamil', 'Spanish', 'French', 'German', 'Hindi', 'Japanese'];


interface FormatParam {
  audience: string;
  tone: string;
  language: string;
  custom_notes: string;
}

interface InformationDNA {
  title: string;
  summary: string;
  key_takeaways: string[];
  entities_and_topics: string[];
  full_context: string;
}

interface GenerationResult {
  format: string;
  content: string;
}

interface HistoryItem {
  id: string;
  username: string;
  role: string;
  outputs: string[];
  output_count: number;
  timestamp: string;
  source_title: string;
}

function App() {
  // Authentication State
  const [user, setUser] = useState<{ username: string; role: string; token: string } | null>(() => {
    const saved = localStorage.getItem('nexus_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [loginUsername, setLoginUsername] = useState('admin');
  const [loginPassword, setLoginPassword] = useState('password123');
  const [loginRole, setLoginRole] = useState('Admin');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Forgot Password State
  const [isForgotPasswordView, setIsForgotPasswordView] = useState(false);
  const [forgotUsername, setForgotUsername] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotSuccessMsg, setForgotSuccessMsg] = useState('');
  const [forgotErrorMsg, setForgotErrorMsg] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  // Main Navigation View ('generator' or 'history')
  const [activeView, setActiveView] = useState<'generator' | 'history'>('generator');

  // Content Input State
  const [sourceText, setSourceText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [selectedOutputs, setSelectedOutputs] = useState<string[]>(['linkedin', 'twitter']);

  // Per-Format Parameters State
  const [perFormatParams, setPerFormatParams] = useState<Record<string, FormatParam>>({
    linkedin: { audience: 'General', tone: 'Casual', language: 'English', custom_notes: '' },
    twitter: { audience: 'Public', tone: 'Urgent', language: 'English', custom_notes: '' },
    video: { audience: 'Executive', tone: 'Professional', language: 'English', custom_notes: '' },
    advisory: { audience: 'Technical', tone: 'Informative', language: 'English', custom_notes: '' },
    infographic: { audience: 'General', tone: 'Persuasive', language: 'English', custom_notes: '' },
    executive: { audience: 'Executive', tone: 'Professional', language: 'English', custom_notes: '' },
    presentation: { audience: 'General', tone: 'Professional', language: 'English', custom_notes: '' },
  });
  const [activeParamTab, setActiveParamTab] = useState<string>('linkedin');

  // Information DNA State
  const [dna, setDna] = useState<InformationDNA | null>(null);
  const [isExtractingDna, setIsExtractingDna] = useState(false);
  const [dnaActiveTab, setDnaActiveTab] = useState<'summary' | 'takeaways' | 'entities'>('summary');

  // Generation & Results State
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [completedFormats, setCompletedFormats] = useState<string[]>([]);
  const [currentFormat, setCurrentFormat] = useState<string>('');

  const [results, setResults] = useState<GenerationResult[]>([]);
  const [activeTab, setActiveTab] = useState(0);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [retryingIndex, setRetryingIndex] = useState<number | null>(null);

  // History Log State (Admin only)
  const [historyLogs, setHistoryLogs] = useState<HistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historySearch, setHistorySearch] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Authentication Handlers
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginUsername.trim() || !loginPassword.trim()) {
      setLoginError("Please enter both username and password.");
      return;
    }
    setIsLoggingIn(true);
    setLoginError("");

    try {
      const response = await axios.post('http://localhost:8000/api/login', {
        username: loginUsername,
        password: loginPassword,
        role: loginRole
      });
      const userData = { username: response.data.username, role: response.data.role, token: response.data.token };
      setUser(userData);
      localStorage.setItem('nexus_user', JSON.stringify(userData));
    } catch (err: any) {
      if (err.response?.status === 401) {
        setLoginError("Incorrect password for this username. Access denied.");
      } else {
        setLoginError(err.response?.data?.detail || "Login failed. Please check server connection.");
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotUsername.trim() || !forgotNewPassword.trim()) {
      setForgotErrorMsg("Username and new password are required.");
      return;
    }
    setIsResettingPassword(true);
    setForgotErrorMsg("");
    setForgotSuccessMsg("");

    try {
      const response = await axios.post('http://localhost:8000/api/forgot-password', {
        username: forgotUsername,
        new_password: forgotNewPassword
      });
      setForgotSuccessMsg(response.data.message || "Password updated successfully!");
      setTimeout(() => {
        setIsForgotPasswordView(false);
        setForgotSuccessMsg('');
        setLoginUsername(forgotUsername);
        setLoginPassword(forgotNewPassword);
      }, 2000);
    } catch (err: any) {
      setForgotErrorMsg(err.response?.data?.detail || "Failed to reset password. Check if username exists.");
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('nexus_user');
    setActiveView('generator');
  };

  // Fetch History Logs for Admin
  const fetchAdminHistory = async () => {
    if (!user || user.role !== 'Admin') return;
    setIsLoadingHistory(true);
    try {
      const res = await axios.get(`http://localhost:8000/api/history?role=${user.role}`);
      if (res.data.status === 'success') {
        setHistoryLogs(res.data.history);
      }
    } catch (err) {
      console.error("Failed to fetch history:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (activeView === 'history' && user?.role === 'Admin') {
      fetchAdminHistory();
    }
  }, [activeView, user]);

  // Format Selection Handlers
  const handleToggleOutput = (id: string) => {
    setSelectedOutputs(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      if (next.length > 0 && !next.includes(activeParamTab)) {
        setActiveParamTab(next[0]);
      }
      return next;
    });
  };

  const updateFormatParam = (formatId: string, field: keyof FormatParam, value: string) => {
    setPerFormatParams(prev => ({
      ...prev,
      [formatId]: {
        ...(prev[formatId] || { audience: 'General', tone: 'Professional', language: 'English', custom_notes: '' }),
        [field]: value
      }
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  // Extract Information DNA Handler
  const handleExtractDNA = async () => {
    if (!sourceText.trim() && !file) {
      alert("Please provide source text or upload a file first.");
      return;
    }

    setIsExtractingDna(true);
    const formData = new FormData();
    formData.append('source_text', sourceText);
    if (file) {
      formData.append('file', file);
    }

    try {
      const res = await axios.post('http://localhost:8000/api/extract-dna', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data.status === 'success') {
        setDna(res.data.dna);
      }
    } catch (err) {
      console.error("DNA Extraction Error:", err);
      alert("Failed to extract Information DNA. Make sure backend is running.");
    } finally {
      setIsExtractingDna(false);
    }
  };

  // Cancel & Reset Handlers
  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
    setProgressMessage("Generation cancelled by user.");
  };

  const handleClearResults = () => {
    setResults([]);
    setCompletedFormats([]);
    setCurrentFormat('');
    setProgress(0);
    setProgressMessage('');
    setActiveTab(0);
  };

  const handleRetrySingleItem = async (index: number) => {
    const targetResult = results[index];
    if (!targetResult) return;

    setRetryingIndex(index);
    const fp = perFormatParams[targetResult.format] || { audience: 'General', tone: 'Professional', language: 'English', custom_notes: '' };

    const formData = new FormData();
    formData.append('source_text', sourceText);
    formData.append('output_format', targetResult.format);
    formData.append('audience', fp.audience);
    formData.append('tone', fp.tone);
    formData.append('language', fp.language);
    formData.append('custom_notes', fp.custom_notes);
    formData.append('username', user?.username || 'Anonymous');
    formData.append('user_role', user?.role || 'Public');

    if (dna) {
      formData.append('dna_json', JSON.stringify(dna));
    }
    if (file) {
      formData.append('file', file);
    }

    try {
      const res = await axios.post('http://localhost:8000/api/generate-single', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setResults(prev => {
        const next = [...prev];
        next[index] = res.data;
        return next;
      });
    } catch (err) {
      console.error("Single item retry error:", err);
      alert("Failed to regenerate deliverable. Please check backend connection.");
    } finally {
      setRetryingIndex(null);
    }
  };

  // Generation Handler
  const handleGenerate = async () => {
    if (!sourceText.trim() && !file && !dna) {
      alert("Please provide source text, upload a file, or extract Information DNA first.");
      return;
    }
    if (selectedOutputs.length === 0) {
      alert("Please select at least one output format.");
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsGenerating(true);
    setProgress(5);
    setProgressMessage("Initializing Information DNA & per-format parameters...");
    setCompletedFormats([]);
    setCurrentFormat('');
    setResults([]);
    setActiveTab(0);

    const activeParams: Record<string, FormatParam> = {};
    selectedOutputs.forEach(outId => {
      activeParams[outId] = perFormatParams[outId] || { audience: 'General', tone: 'Professional', language: 'English', custom_notes: '' };
    });

    const formData = new FormData();
    formData.append('source_text', sourceText);
    formData.append('outputs', selectedOutputs.join(','));
    formData.append('per_format_params', JSON.stringify(activeParams));
    formData.append('username', user?.username || 'Anonymous');
    formData.append('user_role', user?.role || 'Public');

    if (dna) {
      formData.append('dna_json', JSON.stringify(dna));
    }
    if (file) {
      formData.append('file', file);
    }

    try {
      const response = await fetch('http://localhost:8000/api/generate-stream', {
        method: 'POST',
        body: formData,
        signal: controller.signal
      });

      if (!response.ok || !response.body) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        if (controller.signal.aborted) break;

        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim() || controller.signal.aborted) continue;
          try {
            const data = JSON.parse(line);
            if (typeof data.progress === 'number') {
              setProgress(data.progress);
            }
            if (data.message) {
              setProgressMessage(data.message);
            }
            if (data.current_format) {
              setCurrentFormat(data.current_format);
            }
            if (data.status === 'item_complete' && data.result) {
              setResults(prev => {
                const exists = prev.some(r => r.format === data.result.format);
                return exists ? prev : [...prev, data.result];
              });
              if (data.result.format) {
                setCompletedFormats(prev => [...prev, data.result.format]);
              }
            }
            if (data.status === 'finished' && data.results) {
              setResults(data.results);
              setProgress(100);
              setProgressMessage("All content generated successfully!");
            }
          } catch (err) {
            console.error("JSON stream parse error:", err);
          }
        }
      }
    } catch (streamErr: any) {
      if (streamErr.name === 'AbortError' || controller.signal.aborted) {
        console.log("Generation request aborted by user.");
        return;
      }

      console.warn("Streaming endpoint unavailable, using standard API with progress timer:", streamErr);
      
      let currentProg = 10;
      const interval = setInterval(() => {
        if (controller.signal.aborted) {
          clearInterval(interval);
          return;
        }
        currentProg = Math.min(currentProg + 15, 90);
        setProgress(currentProg);
        setProgressMessage(`Generating deliverables... (${currentProg}%)`);
      }, 700);

      try {
        const response = await axios.post('http://localhost:8000/api/generate', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          signal: controller.signal
        });
        clearInterval(interval);
        if (!controller.signal.aborted) {
          setProgress(100);
          setProgressMessage("Generation complete!");
          setResults(response.data.results);
          setCompletedFormats(selectedOutputs);
        }
      } catch (error: any) {
        clearInterval(interval);
        if (error.name === 'CanceledError' || error.name === 'AbortError' || controller.signal.aborted) {
          console.log("Axios request cancelled by user.");
        } else {
          console.error("Generation error:", error);
          alert("Failed to generate content. Make sure backend is running.");
        }
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsGenerating(false);
      }
    }
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const downloadAsTxt = (format: string, text: string) => {
    const element = document.createElement("a");
    const file = new Blob([text], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = `${format}_output.txt`;
    document.body.appendChild(element);
    element.click();
  };

  // UNAUTHENTICATED LOGIN / FORGOT PASSWORD SCREEN
  if (!user) {
    if (isForgotPasswordView) {
      return (
        <div className="login-page-container">
          <div className="login-glass-card animate-fade-in">
            <div className="login-header">
              <div className="login-logo-icon">
                <KeyRound size={30} />
              </div>
              <h1 className="logo">Reset Password</h1>
              <p className="subtitle">Update your account credentials</p>
            </div>

            <form onSubmit={handleForgotPassword} className="login-form">
              {forgotErrorMsg && (
                <div className="login-error-alert">
                  <AlertTriangle size={16} />
                  <span>{forgotErrorMsg}</span>
                </div>
              )}

              {forgotSuccessMsg && (
                <div className="login-success-alert">
                  <CheckCircle2 size={16} color="var(--success-color)" />
                  <span>{forgotSuccessMsg}</span>
                </div>
              )}

              <div className="form-group">
                <label><User size={15} /> Username</label>
                <div className="input-with-icon">
                  <input 
                    type="text" 
                    value={forgotUsername}
                    onChange={e => setForgotUsername(e.target.value)}
                    placeholder="Enter your registered username..."
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label><KeyRound size={15} /> New Password</label>
                <div className="input-with-icon">
                  <input 
                    type="password" 
                    value={forgotNewPassword}
                    onChange={e => setForgotNewPassword(e.target.value)}
                    placeholder="Enter new password..."
                    required
                  />
                </div>
              </div>

              <button type="submit" className="btn-primary" disabled={isResettingPassword}>
                {isResettingPassword ? <div className="loader" /> : <KeyRound size={18} />}
                <span>{isResettingPassword ? 'Updating...' : 'Update Password'}</span>
              </button>

              <button 
                type="button" 
                className="btn-link-forgot"
                onClick={() => setIsForgotPasswordView(false)}
              >
                Back to Sign In
              </button>
            </form>
          </div>
        </div>
      );
    }

    return (
      <div className="login-page-container">
        <div className="login-glass-card animate-fade-in">
          <div className="login-header">
            <div className="login-logo-icon">
              <Sparkles size={32} />
            </div>
            <h1 className="logo">Nexus Transform</h1>
            <p className="subtitle">AI-Powered Content Transformation Engine</p>
          </div>

          <form onSubmit={handleLogin} className="login-form">
            {loginError && (
              <div className="login-error-alert">
                <AlertTriangle size={16} />
                <span>{loginError}</span>
              </div>
            )}

            <div className="form-group">
              <label><User size={15} /> Username</label>
              <div className="input-with-icon">
                <input 
                  type="text" 
                  value={loginUsername}
                  onChange={e => setLoginUsername(e.target.value)}
                  placeholder="Enter your username..."
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label><KeyRound size={15} /> Password</label>
              <div className="input-with-icon">
                <input 
                  type="password" 
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  placeholder="Enter password..."
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label><ShieldCheck size={15} /> Who is Logging In? (User Role)</label>
              <select value={loginRole} onChange={e => setLoginRole(e.target.value)}>
                {ROLES.map(r => (
                  <option key={r.id} value={r.id}>{r.label}</option>
                ))}
              </select>
            </div>

            <div style={{ textAlign: 'right', marginTop: '-0.25rem' }}>
              <button 
                type="button" 
                className="btn-link-forgot"
                onClick={() => {
                  setForgotUsername(loginUsername);
                  setIsForgotPasswordView(true);
                }}
              >
                Forgot Password?
              </button>
            </div>

            <button type="submit" className="btn-primary" disabled={isLoggingIn}>
              {isLoggingIn ? <div className="loader" /> : <Lock size={18} />}
              <span>{isLoggingIn ? 'Authenticating...' : 'Sign In / Register'}</span>
            </button>

            <div className="login-hint">
              <Lock size={13} /> Demo Credentials: Username: <strong>admin</strong> / Password: <strong>password123</strong>
            </div>
          </form>
        </div>
      </div>
    );
  }

  const activeResult = results[activeTab];
  const isTabError = activeResult?.content ? (activeResult.content.startsWith('⚠️') || activeResult.content.toLowerCase().includes('generation failed')) : false;
  const currentFormatParam = perFormatParams[activeParamTab] || { audience: 'General', tone: 'Professional', language: 'English', custom_notes: '' };

  const filteredHistory = historyLogs.filter(h => 
    h.username.toLowerCase().includes(historySearch.toLowerCase()) ||
    h.role.toLowerCase().includes(historySearch.toLowerCase()) ||
    h.outputs.join(', ').toLowerCase().includes(historySearch.toLowerCase()) ||
    h.source_title.toLowerCase().includes(historySearch.toLowerCase())
  );

  return (
    <div className="app-container">
      <header className="app-header animate-fade-in">
        <div className="header-brand">
          <h1 className="logo">Nexus Transform</h1>
          <p className="subtitle">AI-Powered Content & Information DNA Engine</p>
        </div>
        <div className="header-user-bar">
          <div className="user-profile-badge">
            <User size={15} />
            <span>{user.username}</span>
            <span className="role-tag-pill">{user.role}</span>
          </div>

          {user.role === 'Admin' && (
            <div className="view-switch-tabs">
              <button 
                className={`view-tab-btn ${activeView === 'generator' ? 'active' : ''}`}
                onClick={() => setActiveView('generator')}
              >
                <Sparkles size={15} /> Generator
              </button>
              <button 
                className={`view-tab-btn ${activeView === 'history' ? 'active' : ''}`}
                onClick={() => setActiveView('history')}
              >
                <History size={15} /> History Log
              </button>
            </div>
          )}

          <button className="icon-btn-logout" onClick={handleLogout} title="Log Out">
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* ADMIN GENERATION HISTORY VIEW */}
      {activeView === 'history' && user.role === 'Admin' && (
        <main className="history-page-content animate-fade-in">
          <div className="glass-panel" style={{ width: '100%' }}>
            <div className="history-header">
              <div className="history-title">
                <History size={22} color="var(--accent-color)" />
                <div>
                  <h3 style={{ margin: 0 }}>System Generation Audit Log</h3>
                  <p className="section-help-text" style={{ margin: 0 }}>Restricted Admin View — Track user generation activities and timestamps</p>
                </div>
              </div>

              <div className="history-actions">
                <input 
                  type="text" 
                  placeholder="Search user, role, or format..." 
                  value={historySearch}
                  onChange={e => setHistorySearch(e.target.value)}
                  className="history-search-input"
                />
                <button className="btn-dna-refresh" onClick={fetchAdminHistory} disabled={isLoadingHistory}>
                  <RefreshCw size={14} className={isLoadingHistory ? "icon-spin" : ""} />
                  <span>Refresh Log</span>
                </button>
              </div>
            </div>

            {isLoadingHistory ? (
              <div className="empty-state">
                <div className="loader" style={{ width: 32, height: 32, borderWidth: 4 }} />
                <p style={{ marginTop: '1rem' }}>Loading system audit history...</p>
              </div>
            ) : filteredHistory.length > 0 ? (
              <div className="history-table-container">
                <table className="history-table">
                  <thead>
                    <tr>
                      <th>User Account</th>
                      <th>Role</th>
                      <th>Deliverables Generated</th>
                      <th>Output Count</th>
                      <th>Source Document / Context</th>
                      <th>Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHistory.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <div className="history-user-cell">
                            <User size={15} />
                            <strong>{item.username}</strong>
                          </div>
                        </td>
                        <td>
                          <span className={`role-badge role-${item.role.toLowerCase()}`}>
                            {item.role}
                          </span>
                        </td>
                        <td>
                          <div className="history-formats-cell">
                            {item.outputs.map((fmt, idx) => (
                              <span key={idx} className="format-chip">{fmt}</span>
                            ))}
                          </div>
                        </td>
                        <td>
                          <strong>{item.output_count}</strong> outputs
                        </td>
                        <td className="history-source-cell">
                          {item.source_title}
                        </td>
                        <td className="history-time-cell">
                          {item.timestamp}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">
                <History size={48} />
                <p>No generation history records found.</p>
              </div>
            )}
          </div>
        </main>
      )}

      {/* GENERATOR WORKSPACE VIEW */}
      {activeView === 'generator' && (
        <main className="main-content">
          {/* Left Column: Configuration & Per-Format Parameters */}
          <div className="config-section animate-fade-in" style={{ animationDelay: '0.1s' }}>
            
            {/* Source Content Panel */}
            <div className="glass-panel form-group">
              <h3><FileText size={20} /> Source Content</h3>
              
              <div 
                className="file-dropzone" 
                onClick={() => fileInputRef.current?.click()}
              >
                <UploadCloud size={32} style={{ color: 'var(--accent-color)', marginBottom: '10px' }} />
                <p>{file ? file.name : "Click or drag file here (PDF, DOCX, TXT)"}</p>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  accept=".pdf,.docx,.txt"
                />
              </div>
              
              <div style={{ textAlign: 'center', margin: '0.75rem 0', color: 'var(--text-secondary)' }}>OR</div>
              
              <textarea 
                placeholder="Paste your source text, raw information, or context here..."
                value={sourceText}
                onChange={(e) => setSourceText(e.target.value)}
              />

              <button 
                className="btn-secondary-dna"
                onClick={handleExtractDNA}
                disabled={isExtractingDna || (!sourceText.trim() && !file)}
                style={{ marginTop: '0.75rem' }}
              >
                {isExtractingDna ? <div className="loader" /> : <Dna size={18} />}
                <span>{isExtractingDna ? 'Extracting DNA...' : 'Generate Information DNA'}</span>
              </button>
            </div>

            {/* Output Formats Selection Panel */}
            <div className="glass-panel form-group">
              <h3><Layers size={20} /> Select Output Formats</h3>
              <div className="checkbox-grid">
                {OUTPUT_TYPES.map(type => (
                  <label 
                    key={type.id} 
                    className={`checkbox-label ${selectedOutputs.includes(type.id) ? 'selected' : ''}`}
                  >
                    <input 
                      type="checkbox" 
                      checked={selectedOutputs.includes(type.id)}
                      onChange={() => handleToggleOutput(type.id)}
                      style={{ display: 'none' }}
                    />
                    <type.icon size={16} />
                    <span style={{ fontSize: '0.85rem' }}>{type.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Per-Format Custom Parameters Panel */}
            {selectedOutputs.length > 0 && (
              <div className="glass-panel form-group per-format-params-card animate-fade-in">
                <div className="per-format-header">
                  <h3><SlidersHorizontal size={20} /> Per-Format Custom Parameters</h3>
                  <span className="params-badge">{selectedOutputs.length} Formats Configured</span>
                </div>
                
                <p className="section-help-text">Configure separate audience, tone, language & instructions for each output format:</p>

                {/* Per-Format Tabs */}
                <div className="format-param-tabs">
                  {selectedOutputs.map(outId => {
                    const outObj = OUTPUT_TYPES.find(o => o.id === outId);
                    return (
                      <button 
                        key={outId} 
                        className={`format-param-tab-btn ${activeParamTab === outId ? 'active' : ''}`}
                        onClick={() => setActiveParamTab(outId)}
                      >
                        {outObj?.label || outId}
                      </button>
                    );
                  })}
                </div>

                {/* Parameter Controls for Active Format Tab */}
                <div className="format-param-content">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    <div className="param-field">
                      <label>Target Audience ({OUTPUT_TYPES.find(o => o.id === activeParamTab)?.label})</label>
                      <select 
                        value={currentFormatParam.audience} 
                        onChange={e => updateFormatParam(activeParamTab, 'audience', e.target.value)}
                      >
                        {AUDIENCES.map(a => <option key={a} value={a}>{a}</option>)}
                      </select>
                    </div>

                    <div className="param-field">
                      <label>Tone of Voice ({OUTPUT_TYPES.find(o => o.id === activeParamTab)?.label})</label>
                      <select 
                        value={currentFormatParam.tone} 
                        onChange={e => updateFormatParam(activeParamTab, 'tone', e.target.value)}
                      >
                        {TONES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>

                    <div className="param-field">
                      <label>Language ({OUTPUT_TYPES.find(o => o.id === activeParamTab)?.label})</label>
                      <select 
                        value={currentFormatParam.language} 
                        onChange={e => updateFormatParam(activeParamTab, 'language', e.target.value)}
                      >
                        {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                      </select>
                    </div>

                    <div className="param-field">
                      <label>Custom Focus / Prompt Notes (Optional)</label>
                      <input 
                        type="text" 
                        placeholder={`e.g. Focus on ROI metrics for ${OUTPUT_TYPES.find(o => o.id === activeParamTab)?.label}`}
                        value={currentFormatParam.custom_notes}
                        onChange={e => updateFormatParam(activeParamTab, 'custom_notes', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons Area */}
            <div className="action-buttons-group">
              <button 
                className={`btn-primary ${isGenerating ? 'is-generating' : ''}`} 
                onClick={handleGenerate}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <>
                    <div className="btn-progress-bg" style={{ width: `${progress}%` }} />
                    <div className="btn-content">
                      <div className="loader"></div>
                      <span>{progress}% • {progressMessage || 'Generating...'}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <Sparkles size={20} />
                    <span>Transform Content</span>
                  </>
                )}
              </button>

              {isGenerating && (
                <button 
                  className="btn-cancel" 
                  onClick={handleCancel}
                  title="Cancel generation process"
                >
                  <XCircle size={18} />
                  <span>Cancel Generation</span>
                </button>
              )}

              {!isGenerating && results.length > 0 && (
                <button 
                  className="btn-reset" 
                  onClick={handleClearResults}
                  title="Clear current deliverables"
                >
                  <RotateCcw size={16} />
                  <span>Reset Deliverables</span>
                </button>
              )}
            </div>
          </div>

          {/* Right Column: Information DNA Vault & Output Results */}
          <div className="results-section animate-fade-in" style={{ animationDelay: '0.2s' }}>
            
            {/* Information DNA Vault Card */}
            {dna && (
              <div className="glass-panel dna-vault-panel animate-fade-in" style={{ marginBottom: '1.5rem' }}>
                <div className="dna-vault-header">
                  <div className="dna-title-group">
                    <Dna size={22} className="dna-icon-pulse" />
                    <div>
                      <h3 style={{ margin: 0 }}>Information DNA Vault</h3>
                      <span className="dna-subtitle-tag">{dna.title}</span>
                    </div>
                  </div>
                  <button className="btn-dna-refresh" onClick={handleExtractDNA} disabled={isExtractingDna}>
                    <RefreshCw size={14} className={isExtractingDna ? "icon-spin" : ""} />
                    <span>Re-Extract</span>
                  </button>
                </div>

                {/* DNA Tabs */}
                <div className="dna-tabs-bar">
                  <button 
                    className={`dna-tab-btn ${dnaActiveTab === 'summary' ? 'active' : ''}`}
                    onClick={() => setDnaActiveTab('summary')}
                  >
                    Overview & Summary
                  </button>
                  <button 
                    className={`dna-tab-btn ${dnaActiveTab === 'takeaways' ? 'active' : ''}`}
                    onClick={() => setDnaActiveTab('takeaways')}
                  >
                    Key Facts ({dna.key_takeaways.length})
                  </button>
                  <button 
                    className={`dna-tab-btn ${dnaActiveTab === 'entities' ? 'active' : ''}`}
                    onClick={() => setDnaActiveTab('entities')}
                  >
                    Entities & Topics ({dna.entities_and_topics.length})
                  </button>
                </div>

                {/* DNA Content Display */}
                <div className="dna-tab-body">
                  {dnaActiveTab === 'summary' && (
                    <p className="dna-summary-text">{dna.summary}</p>
                  )}
                  {dnaActiveTab === 'takeaways' && (
                    <ul className="dna-takeaways-list">
                      {dna.key_takeaways.map((point, idx) => (
                        <li key={idx}><ChevronRight size={14} color="var(--accent-color)" /> {point}</li>
                      ))}
                    </ul>
                  )}
                  {dnaActiveTab === 'entities' && (
                    <div className="dna-tags-grid">
                      {dna.entities_and_topics.map((tag, idx) => (
                        <span key={idx} className="dna-tag-pill">{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div className="results-header">
                <h3><Sparkles size={20} /> Generated Deliverables</h3>
                {results.length > 0 && !isGenerating && (
                  <button className="icon-btn-danger" onClick={handleClearResults} title="Clear generated outputs">
                    <Trash2 size={15} />
                    <span>Clear All</span>
                  </button>
                )}
              </div>
              
              {/* Live Progress Card */}
              {isGenerating && (
                <div className="progress-dashboard animate-fade-in">
                  <div className="progress-header">
                    <div className="progress-title">
                      <Sparkles size={18} className="icon-spin-slow" />
                      <span>Processing Deliverables</span>
                    </div>
                    <div className="progress-header-right">
                      <span className="progress-percentage">{progress}%</span>
                      <button className="btn-cancel-sm" onClick={handleCancel} title="Stop generation">
                        <XCircle size={15} />
                        <span>Cancel</span>
                      </button>
                    </div>
                  </div>

                  <div className="progress-bar-track">
                    <div 
                      className="progress-bar-fill" 
                      style={{ width: `${progress}%` }}
                    />
                  </div>

                  <div className="progress-status-message">
                    {progressMessage || 'Working on your content...'}
                  </div>

                  <div className="format-steps-grid">
                    {selectedOutputs.map((outputId, idx) => {
                      const outputObj = OUTPUT_TYPES.find(o => o.id === outputId);
                      const isDone = completedFormats.includes(outputId) || results.some(r => r.format.toLowerCase() === outputId.toLowerCase());
                      const isActive = currentFormat.toLowerCase() === outputId.toLowerCase() || (isGenerating && !isDone && completedFormats.length === idx);
                      const Icon = outputObj?.icon || FileText;

                      return (
                        <div 
                          key={outputId} 
                          className={`format-step-card ${isDone ? 'step-completed' : isActive ? 'step-active' : 'step-pending'}`}
                        >
                          <div className="step-icon">
                            {isDone ? (
                              <CheckCircle2 size={16} color="var(--success-color)" />
                            ) : isActive ? (
                              <div className="step-loader" />
                            ) : (
                              <Icon size={16} />
                            )}
                          </div>
                          <span className="step-label">{outputObj?.label || outputId}</span>
                          <span className="step-badge">
                            {isDone ? 'Ready' : isActive ? 'Generating' : 'Queued'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Results Display */}
              {results.length > 0 ? (
                <>
                  <div className="tabs-header">
                    {results.map((r, idx) => (
                      <button 
                        key={idx}
                        className={`tab-btn ${activeTab === idx ? 'active' : ''}`}
                        onClick={() => setActiveTab(idx)}
                      >
                        {r.format.charAt(0).toUpperCase() + r.format.slice(1)}
                      </button>
                    ))}
                  </div>
                  
                  <div className="tab-content">
                    <div className="content-toolbar">
                      {!isTabError && (
                        <>
                          <button 
                            className="icon-btn" 
                            onClick={() => copyToClipboard(results[activeTab].content, activeTab)}
                          >
                            {copiedIndex === activeTab ? <CheckCircle2 size={16} color="var(--success-color)" /> : <Copy size={16} />}
                            {copiedIndex === activeTab ? 'Copied' : 'Copy'}
                          </button>
                          <button 
                            className="icon-btn"
                            onClick={() => downloadAsTxt(results[activeTab].format, results[activeTab].content)}
                          >
                            <Download size={16} />
                            Download TXT
                          </button>
                        </>
                      )}
                      <button 
                        className="icon-btn"
                        onClick={() => handleRetrySingleItem(activeTab)}
                        disabled={retryingIndex === activeTab}
                        title="Re-generate this deliverable"
                      >
                        <RefreshCw size={15} className={retryingIndex === activeTab ? "icon-spin" : ""} />
                        {retryingIndex === activeTab ? 'Retrying...' : 'Re-generate'}
                      </button>
                    </div>

                    {isTabError ? (
                      <div className="error-card animate-fade-in">
                        <div className="error-card-header">
                          <AlertTriangle size={20} className="error-icon" />
                          <span>Generation Issue Detected</span>
                        </div>
                        <p className="error-card-message">{activeResult.content}</p>
                        <button 
                          className="btn-retry-single" 
                          onClick={() => handleRetrySingleItem(activeTab)}
                          disabled={retryingIndex === activeTab}
                        >
                          <RefreshCw size={16} className={retryingIndex === activeTab ? "icon-spin" : ""} />
                          <span>{retryingIndex === activeTab ? 'Retrying Generation...' : 'Retry Generation'}</span>
                        </button>
                      </div>
                    ) : (
                      <div className="markdown-body">
                        <ReactMarkdown>{results[activeTab].content}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                </>
              ) : !isGenerating && (
                <div className="empty-state">
                  <Sparkles size={48} />
                  <p>Upload a file or paste text $\rightarrow$ Extract Information DNA $\rightarrow$ Configure per-format parameters and hit generate!</p>
                </div>
              )}
              
            </div>
          </div>
        </main>
      )}
    </div>
  );
}

export default App;
