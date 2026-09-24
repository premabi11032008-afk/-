import React, { useState, useRef } from 'react';
import axios from 'axios';
import { 
  UploadCloud, 
  Settings, 
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
  MessageSquare
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

const AUDIENCES = ['General', 'Technical', 'Executive', 'Internal', 'Public'];
const TONES = ['Professional', 'Urgent', 'Casual', 'Persuasive', 'Informative', 'Humorous'];
const LANGUAGES = ['English', 'Spanish', 'French', 'German', 'Hindi', 'Japanese'];

interface GenerationResult {
  format: string;
  content: string;
}

function App() {
  const [sourceText, setSourceText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [selectedOutputs, setSelectedOutputs] = useState<string[]>(['linkedin', 'twitter']);
  const [audience, setAudience] = useState('General');
  const [tone, setTone] = useState('Professional');
  const [language, setLanguage] = useState('English');
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [results, setResults] = useState<GenerationResult[]>([]);
  const [activeTab, setActiveTab] = useState(0);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleToggleOutput = (id: string) => {
    setSelectedOutputs(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleGenerate = async () => {
    if (!sourceText.trim() && !file) {
      alert("Please provide source text or upload a file.");
      return;
    }
    if (selectedOutputs.length === 0) {
      alert("Please select at least one output format.");
      return;
    }

    setIsGenerating(true);
    setResults([]);
    setActiveTab(0);

    try {
      const formData = new FormData();
      formData.append('source_text', sourceText);
      formData.append('outputs', selectedOutputs.join(','));
      formData.append('audience', audience);
      formData.append('tone', tone);
      formData.append('language', language);
      if (file) {
        formData.append('file', file);
      }

      // We hit the backend running on port 8000
      const response = await axios.post('http://localhost:8000/api/generate', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      setResults(response.data.results);
    } catch (error) {
      console.error("Generation error:", error);
      alert("Failed to generate content. Make sure backend is running.");
    } finally {
      setIsGenerating(false);
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
    document.body.appendChild(element); // Required for this to work in FireFox
    element.click();
  };

  return (
    <div className="app-container">
      <header className="animate-fade-in">
        <h1 className="logo">Nexus Transform</h1>
        <p className="subtitle">AI-powered content transformation engine</p>
      </header>

      <main className="main-content">
        {/* Left Column: Configuration */}
        <div className="config-section animate-fade-in" style={{ animationDelay: '0.1s' }}>
          
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
            
            <div style={{ textAlign: 'center', margin: '1rem 0', color: 'var(--text-secondary)' }}>OR</div>
            
            <textarea 
              placeholder="Paste your source text, raw information, or context here..."
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
            />
          </div>

          <div className="glass-panel form-group">
            <h3><Settings size={20} /> Output Formats</h3>
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

          <div className="glass-panel form-group">
            <h3><Settings size={20} /> Parameters</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label>Target Audience</label>
                <select value={audience} onChange={e => setAudience(e.target.value)}>
                  {AUDIENCES.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div>
                <label>Tone of Voice</label>
                <select value={tone} onChange={e => setTone(e.target.value)}>
                  {TONES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label>Language</label>
                <select value={language} onChange={e => setLanguage(e.target.value)}>
                  {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
            </div>
          </div>

          <button 
            className="btn-primary" 
            onClick={handleGenerate}
            disabled={isGenerating}
          >
            {isGenerating ? <div className="loader"></div> : <Sparkles size={20} />}
            {isGenerating ? 'Generating...' : 'Transform Content'}
          </button>
        </div>

        {/* Right Column: Output Results */}
        <div className="results-section animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <div className="glass-panel" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <h3><Sparkles size={20} /> Generated Deliverables</h3>
            
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
                  </div>
                  
                  <div className="markdown-body">
                    <ReactMarkdown>{results[activeTab].content}</ReactMarkdown>
                  </div>
                </div>
              </>
            ) : (
              <div className="empty-state">
                <Sparkles size={48} />
                <p>Select your configuration and hit generate to see the magic happen.</p>
              </div>
            )}
            
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
