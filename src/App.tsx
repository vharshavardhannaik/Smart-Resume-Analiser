/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, Search, CheckCircle, XCircle, TrendingUp, Award, Zap, 
  AlertCircle, ChevronDown, Copy, RotateCcw, FileText, Briefcase,
  ExternalLink, ChevronRight, Activity, Cpu
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Type } from "@google/genai";

// Initialize Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// --- Types ---
interface MissingSkill {
  skill: string;
  priority: 'high' | 'medium' | 'low';
  reason: string;
}

interface Improvement {
  section: string;
  issue: string;
  fix: string;
}

interface AnalysisResults {
  matchScore: number;
  scoreBreakdown: {
    skillsMatch: number;
    experienceMatch: number;
    educationMatch: number;
    keywordMatch: number;
  };
  presentSkills: string[];
  missingSkills: MissingSkill[];
  strengths: string[];
  improvements: Improvement[];
  keywordsToAdd: string[];
  overallFeedback: string;
  hireProbability: 'low' | 'medium' | 'high';
  atsCompatibility: number;
}

// --- Components ---

const ScoreGauge = ({ value, label, color = "#00e5ff" }: { value: number, label: string, color?: string }) => {
  const [displayValue, setDisplayValue] = useState(0);
  const size = 128;
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (displayValue / 100) * circumference;

  useEffect(() => {
    const timer = setTimeout(() => {
      setDisplayValue(value);
    }, 100);
    return () => clearTimeout(timer);
  }, [value]);

  return (
    <div className="bg-[#161b22] border border-[#30363d] p-6 rounded-lg flex items-center gap-6 relative overflow-hidden group">
      <div className="relative" style={{ width: size, height: size }}>
        <svg className="transform -rotate-90 w-full h-full">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#30363d"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.5, ease: "easeOut" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-black text-white">{Math.round(displayValue)}%</span>
          <span className="text-[10px] font-mono uppercase opacity-50 tracking-widest">{label.split(' ')[0]}</span>
        </div>
      </div>
      <div>
        <h3 className="text-2xl font-black italic uppercase tracking-tighter leading-none text-white transition-colors group-hover:text-[#00e5ff]">
          {label.split(' ').map((word, i) => <React.Fragment key={i}>{word}<br/></React.Fragment>)}
        </h3>
        <p className="mt-2 text-[10px] opacity-60 font-mono text-white/60">System validation complete.</p>
      </div>
    </div>
  );
};

const ProgressBar = ({ value, label }: { value: number, label: string }) => {
  return (
    <div className="w-full space-y-1">
      <div className="flex justify-between text-[10px] font-mono mb-1 uppercase tracking-widest">
        <span className="opacity-60">{label}</span>
        <span className="text-[#00e5ff] font-bold">{value}%</span>
      </div>
      <div className="h-1.5 w-full bg-[#30363d] rounded-full overflow-hidden">
        <motion.div 
          className="h-full bg-[#00e5ff]"
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </div>
    </div>
  );
};

const PriorityBadge = ({ priority }: { priority: 'high' | 'medium' | 'low' }) => {
  const styles = {
    high: "bg-red-500/20 text-red-500 border-red-500/20",
    medium: "bg-amber-500/20 text-amber-500 border-amber-500/20",
    low: "bg-emerald-500/20 text-emerald-500 border-emerald-500/20"
  };
  
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-mono border uppercase tracking-wider ${styles[priority]}`}>
      {priority}
    </span>
  );
};

const SkeletonLoader = () => (
  <div className="space-y-8 animate-pulse">
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {[1, 2, 3].map(i => (
        <div key={i} className="h-40 bg-white/5 rounded-xl border border-white/10" />
      ))}
    </div>
    <div className="h-64 bg-white/5 rounded-xl border border-white/10" />
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="h-80 bg-white/5 rounded-xl border border-white/10" />
      <div className="h-80 bg-white/5 rounded-xl border border-white/10" />
    </div>
  </div>
);

export default function App() {
  const [resume, setResume] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState<AnalysisResults | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [expandedImprovements, setExpandedImprovements] = useState<Record<number, boolean>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setIsParsing(true);

    // If it's a simple text file, read it directly
    if (file.type === "text/plain" || file.name.endsWith('.txt')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setResume(event.target?.result as string);
        setIsParsing(false);
      };
      reader.onerror = () => {
        setError("Failed to read the file.");
        setIsParsing(false);
      };
      reader.readAsText(file);
    } else if (file.type === "application/pdf" || file.name.endsWith('.docx') || file.name.endsWith('.doc')) {
      // Use server-side parsing for PDF and DOCX
      const formData = new FormData();
      formData.append('file', file);

      try {
        const response = await fetch('/api/parse-resume', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || "Failed to parse document.");
        }

        const data = await response.json();
        setResume(data.text);
      } catch (err: any) {
        console.error("Parse error:", err);
        setError(err.message === "Failed to fetch" ? "Server connection refused. Please try again in 5 seconds." : (err.message || "Failed to parse document."));
      } finally {
        setIsParsing(false);
      }
    } else {
      setError("Unsupported file type. Please upload a .txt, .pdf, or .docx file.");
      setIsParsing(false);
    }
    // Reset file input value so the same file can be uploaded again if needed
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const toggleImprovement = (index: number) => {
    setExpandedImprovements(prev => ({ ...prev, [index]: !prev[index] }));
  };

  const handleAnalyze = async () => {
    if (!resume || !jobDescription) {
      setError("Please provide both your resume and the job description.");
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setResults(null);

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Resume:\n${resume}\n\nJob Description:\n${jobDescription}`,
        config: {
          systemInstruction: `You are an expert ATS (Applicant Tracking System) and career coach. 
Analyze the resume against the job description and return a detailed JSON 
object. Ensure high accuracy in alignment scoring.`,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              matchScore: { type: Type.NUMBER },
              scoreBreakdown: {
                type: Type.OBJECT,
                properties: {
                  skillsMatch: { type: Type.NUMBER },
                  experienceMatch: { type: Type.NUMBER },
                  educationMatch: { type: Type.NUMBER },
                  keywordMatch: { type: Type.NUMBER }
                },
                required: ["skillsMatch", "experienceMatch", "educationMatch", "keywordMatch"]
              },
              presentSkills: { type: Type.ARRAY, items: { type: Type.STRING } },
              missingSkills: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    skill: { type: Type.STRING },
                    priority: { type: Type.STRING, enum: ['high', 'medium', 'low'] },
                    reason: { type: Type.STRING }
                  },
                  required: ["skill", "priority", "reason"]
                }
              },
              strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
              improvements: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    section: { type: Type.STRING },
                    issue: { type: Type.STRING },
                    fix: { type: Type.STRING }
                  },
                  required: ["section", "issue", "fix"]
                }
              },
              keywordsToAdd: { type: Type.ARRAY, items: { type: Type.STRING } },
              overallFeedback: { type: Type.STRING },
              hireProbability: { type: Type.STRING, enum: ['low', 'medium', 'high'] },
              atsCompatibility: { type: Type.NUMBER }
            },
            required: [
              "matchScore", "scoreBreakdown", "presentSkills", "missingSkills", 
              "strengths", "improvements", "keywordsToAdd", "overallFeedback", 
              "hireProbability", "atsCompatibility"
            ]
          }
        }
      });

      const text = response.text;
      if (!text) throw new Error("No response from AI.");
      
      const data = JSON.parse(text);
      setResults(data);
    } catch (err: any) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      console.error("AI Analysis Error:", err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const copyTips = () => {
    if (!results) return;
    const tips = results.improvements.map(imp => 
      `Section: ${imp.section}\nIssue: ${imp.issue}\nFix: ${imp.fix}\n`
    ).join('\n---\n\n');
    navigator.clipboard.writeText(tips);
  };

  const reset = () => {
    setResults(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[#0d1117] text-[#e6edf3] font-sans selection:bg-[#00e5ff]/30 selection:text-white">
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.15] brightness-100 contrast-150 mix-blend-overlay" />
      </div>

      <header className="relative z-10 p-6 border-b border-[#30363d] bg-black/40 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto flex items-end justify-between">
          <div>
            <h1 className="font-mono text-[#00e5ff] text-[10px] tracking-[0.3em] uppercase mb-1 font-bold">System State: {isAnalyzing ? 'Processing' : 'Stable'}</h1>
            <h2 className="text-4xl font-extrabold tracking-tighter text-white uppercase italic">
              SMART RESUME <span className="text-[#00e5ff] not-italic">ANALYZER v2.4</span>
            </h2>
          </div>
          <div className="flex items-center gap-6">
            {!results && !isAnalyzing ? (
              <div className="hidden md:flex flex-col items-end">
                <p className="font-mono text-[10px] uppercase opacity-50 tracking-widest text-[#e6edf3]">System Engine</p>
                <p className="font-mono text-sm text-white">GEMINI-3-FLASH</p>
              </div>
            ) : results ? (
              <button 
                onClick={reset}
                className="px-6 py-2 bg-[#00e5ff]/10 border border-[#00e5ff] text-[#00e5ff] font-mono text-xs font-bold uppercase tracking-widest hover:bg-[#00e5ff] hover:text-black transition-all rounded-sm flex items-center gap-2"
              >
                <RotateCcw className="w-3 h-3" />
                <span>TERMINATE_REBOOT</span>
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto p-6 md:p-12">
        <AnimatePresence mode="wait">
          {!results && !isAnalyzing ? (
            <motion.div 
              key="inputs"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-12"
            >
              <div className="text-center space-y-4 mb-12">
                <h2 className="text-6xl md:text-8xl font-black tracking-tighter text-white uppercase italic leading-[0.8] mb-8">
                  BRIDGE THE <span className="text-[#00e5ff] not-italic">GAP_</span>
                </h2>
                <div className="max-w-2xl mx-auto h-px bg-gradient-to-r from-transparent via-[#30363d] to-transparent mb-8" />
                <p className="text-white/50 font-mono text-xs md:text-sm tracking-widest uppercase leading-loose">
                  Neural engine processing for industrial grade ATS compatibility. 
                  <br className="hidden md:block"/> Connect career data to structural requirements.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-[#30363d] border border-[#30363d] overflow-hidden rounded-sm shadow-2xl">
                {/* Resume Input */}
                <div className="bg-[#0d1117] p-8 flex flex-col space-y-6">
                  <div className="flex items-center justify-between border-b border-[#30363d] pb-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 bg-[#00e5ff] rounded-full animate-pulse" />
                      <h3 className="text-[10px] font-mono font-bold tracking-[0.2em] text-[#00e5ff] uppercase">Data Instance: User Resume</h3>
                    </div>
                    <div className="flex items-center space-x-2">
                      {isParsing && (
                        <div className="flex items-center space-x-1.5 px-2 py-1 bg-white/5 rounded-sm border border-white/5">
                          <div className="w-1.5 h-1.5 bg-[#00e5ff] rounded-full animate-bounce" />
                          <span className="text-[9px] font-mono text-[#00e5ff]/70 uppercase tracking-widest">Parsing...</span>
                        </div>
                      )}
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isParsing}
                        className={`p-1.5 bg-white/5 hover:bg-white/10 rounded-sm border border-white/10 transition-colors text-white/40 hover:text-[#00e5ff] ${isParsing ? 'opacity-50 cursor-not-allowed' : ''}`}
                        title="Upload .txt, .pdf, or .docx"
                      >
                        <Upload className="w-3.5 h-3.5" />
                      </button>
                      <FileText className="w-4 h-4 text-white/20" />
                    </div>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleFileChange} 
                      accept=".txt,.pdf,.docx,.doc" 
                      className="hidden" 
                    />
                  </div>
                  <textarea 
                    value={resume}
                    onChange={(e) => setResume(e.target.value)}
                    placeholder={isParsing ? "EXTRACTING_DATA..." : "PASTE_PAYLOAD_HERE... or upload .txt, .pdf, or .docx"}
                    disabled={isParsing}
                    className="flex-grow bg-transparent text-white font-mono text-sm leading-relaxed min-h-[300px] resize-none focus:outline-none placeholder:text-white/10"
                  />
                </div>

                {/* JD Input */}
                <div className="bg-[#0d1117] p-8 flex flex-col space-y-6">
                  <div className="flex items-center justify-between border-b border-[#30363d] pb-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 bg-[#ffb300] rounded-full animate-pulse" />
                      <h3 className="text-[10px] font-mono font-bold tracking-[0.2em] text-[#ffb300] uppercase">Target Schema: Job Specifications</h3>
                    </div>
                    <Briefcase className="w-4 h-4 text-white/20" />
                  </div>
                  <textarea 
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                    placeholder="PASTE_REQUIREMENTS_HERE..."
                    className="flex-grow bg-transparent text-white font-mono text-sm leading-relaxed min-h-[300px] resize-none focus:outline-none placeholder:text-white/10"
                  />
                </div>
              </div>

              <div className="flex flex-col items-center space-y-6 pt-12">
                {error && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center space-x-3 px-6 py-3 bg-red-950/20 border border-red-900 text-red-400 text-xs font-mono uppercase tracking-widest font-bold"
                  >
                    <AlertCircle className="w-4 h-4" />
                    <span>SYSTEM_ERROR: {error}</span>
                  </motion.div>
                )}
                
                <button 
                  onClick={handleAnalyze}
                  className="group relative px-12 py-5 bg-[#00e5ff] text-black font-black uppercase tracking-tighter text-lg italic hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_0_50px_-12px_rgba(0,229,255,0.5)]"
                >
                  <span className="relative flex items-center space-x-3">
                    <Activity className="w-6 h-6" />
                    <span>INITIATE_NEURAL_ANALYTICS</span>
                  </span>
                </button>
              </div>
            </motion.div>
          ) : isAnalyzing ? (
            <motion.div 
              key="loader"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-12"
            >
              <div className="flex flex-col items-center text-center space-y-8 mb-12">
                <div className="relative">
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                    className="w-24 h-24 border-2 border-dashed border-cyan-500/40 rounded-full"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Cpu className="w-8 h-8 text-cyan-400 animate-pulse" />
                  </div>
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-mono font-bold tracking-widest uppercase animate-pulse">PROCESSING_DATA_SET</h2>
                  <p className="text-white/30 font-mono text-xs max-w-md mx-auto">Extracting entities, calculating weight distribution, and matching requirements through multi-layered analysis...</p>
                </div>
              </div>
              <SkeletonLoader />
            </motion.div>
          ) : results && (
            <motion.div 
              key="results"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              {/* TOP ROW: Scores */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <ScoreGauge value={results.matchScore} label="Overall Match" color="#00e5ff" />
                <ScoreGauge value={results.atsCompatibility} label="Parsing Health" color="#ffb300" />
                <div className="bg-[#161b22] border border-[#30363d] p-6 rounded-lg flex flex-col justify-center relative overflow-hidden group">
                  <span className="font-mono text-[10px] uppercase opacity-50 mb-2 tracking-widest">Hire Probability</span>
                  <div className="flex items-center gap-4">
                    <span className="text-6xl font-black text-[#00e5ff] italic uppercase tracking-tighter leading-none">{results.hireProbability}</span>
                    <div className="flex flex-col gap-1.5 translate-y-1">
                      <div className="w-4 h-1.5 bg-[#00e5ff] opacity-100 shadow-[0_0_10px_rgba(0,229,255,0.5)]"></div>
                      <div className={`w-4 h-1.5 bg-[#00e5ff] transition-opacity ${results.hireProbability === 'low' ? 'opacity-20' : 'opacity-100'}`}></div>
                      <div className={`w-4 h-1.5 bg-[#00e5ff] transition-opacity ${results.hireProbability !== 'high' ? 'opacity-20' : 'opacity-100'}`}></div>
                    </div>
                  </div>
                  <p className="mt-4 text-[10px] opacity-60 font-mono italic">Market alignment ranking validated.</p>
                </div>
              </div>

              {/* Main Content Grid */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-12 mt-12">
                {/* Col 1: Breakdown & Feedback */}
                <div className="md:col-span-3 space-y-10">
                  <div>
                    <h4 className="font-mono text-[10px] text-[#00e5ff] uppercase tracking-[0.3em] font-bold mb-6 italic underline underline-offset-8">Data_Metrics</h4>
                    <div className="space-y-6">
                      <ProgressBar value={results.scoreBreakdown.skillsMatch} label="Skills_Load" />
                      <ProgressBar value={results.scoreBreakdown.experienceMatch} label="Exp_Density" />
                      <ProgressBar value={results.scoreBreakdown.educationMatch} label="Edu_Sync" />
                      <ProgressBar value={results.scoreBreakdown.keywordMatch} label="Keyword_Hit" />
                    </div>
                  </div>
                  <div className="bg-[#00e5ff]/5 border-l-4 border-[#00e5ff] p-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-12 h-12 bg-[#00e5ff]/10 rotate-45 translate-x-6 -translate-y-6" />
                    <h4 className="font-mono text-[10px] text-[#00e5ff] uppercase font-bold mb-3 tracking-widest whitespace-nowrap">Overall Feedback // v2.4</h4>
                    <p className="text-sm font-medium italic leading-relaxed text-white/90">
                      "{results.overallFeedback}"
                    </p>
                  </div>
                </div>

                {/* Col 2: Skills & Gaps */}
                <div className="md:col-span-5 md:border-x border-[#30363d] md:px-10 space-y-10">
                  <div className="space-y-6">
                    <h4 className="font-mono text-[10px] text-[#ffb300] uppercase tracking-[0.3em] font-bold italic">Positive_Identities</h4>
                    <div className="flex flex-wrap gap-2.5">
                      {results.presentSkills.map((skill, idx) => (
                        <span key={idx} className="px-3 py-1.5 bg-[#161b22] border border-[#30363d] text-[#00e5ff] text-[11px] font-mono font-bold tracking-tight hover:border-[#00e5ff]/50 transition-colors">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-6">
                    <h4 className="font-mono text-[10px] text-red-500 uppercase tracking-[0.3em] font-bold italic">Critical_Anomalies</h4>
                    <div className="space-y-3">
                      {results.missingSkills.map((item, idx) => (
                        <div key={idx} className="p-4 bg-red-950/10 border border-red-900/40 rounded-sm flex justify-between items-start group hover:bg-red-950/20 transition-colors">
                          <div className="pr-4">
                            <p className="text-sm font-black text-white uppercase italic tracking-tighter group-hover:text-red-400 transition-colors">{item.skill}</p>
                            <p className="text-[10px] opacity-60 mt-1 italic leading-relaxed text-white/70">{item.reason}</p>
                          </div>
                          <PriorityBadge priority={item.priority} />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-6">
                    <h4 className="font-mono text-[10px] text-[#00e5ff] uppercase tracking-[0.3em] font-bold italic">Keyword_Injections</h4>
                    <div className="flex flex-wrap gap-2.5">
                      {results.keywordsToAdd.map((kw, idx) => (
                        <span key={idx} className="px-3 py-1.5 border border-dashed border-[#00e5ff]/30 text-[#00e5ff]/80 text-[11px] font-mono uppercase font-medium hover:border-[#00e5ff] hover:text-[#00e5ff] transition-all cursor-default">
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Col 3: Improvements */}
                <div className="md:col-span-4 space-y-6 flex flex-col h-full">
                  <h4 className="font-mono text-[10px] text-[#00e5ff] uppercase tracking-[0.3em] font-bold italic mb-2">Manual_Overrides</h4>
                  
                  <div className="space-y-4 flex-grow overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-[#30363d]">
                    {results.improvements.map((imp, idx) => (
                      <div key={idx} className="bg-[#161b22] border border-[#30363d] rounded-sm group overflow-hidden">
                        <button 
                          onClick={() => toggleImprovement(idx)}
                          className="w-full flex items-center justify-between p-4 bg-[#0d1117] border-b border-[#30363d] group-hover:bg-[#161b22] transition-colors"
                        >
                          <span className="text-xs font-black font-mono text-white uppercase tracking-tighter italic">{imp.section}</span>
                          <span className={`text-[#00e5ff] font-bold transition-transform duration-300 ${expandedImprovements[idx] ? 'rotate-45' : ''}`}>+</span>
                        </button>
                        <AnimatePresence>
                          {expandedImprovements[idx] && (
                            <motion.div 
                              initial={{ height: 0 }}
                              animate={{ height: 'auto' }}
                              exit={{ height: 0 }}
                              className="p-5"
                            >
                              <p className="text-[10px] text-[#ffb300] font-mono mb-2 uppercase font-bold tracking-widest italic">Anomalous Data Detected</p>
                              <p className="text-xs opacity-70 mb-5 leading-relaxed font-medium">"{imp.issue}"</p>
                              <div className="p-4 bg-black/40 border border-white/5 rounded-sm mb-4">
                                <p className="text-[10px] text-[#00e5ff] font-mono mb-2 uppercase font-bold tracking-widest italic">Suggested Correction</p>
                                <p className="text-sm font-bold italic tracking-tight">{imp.fix}</p>
                              </div>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigator.clipboard.writeText(imp.fix);
                                }}
                                className="w-full py-2 font-mono text-[10px] font-black uppercase tracking-tighter bg-[#00e5ff] text-black hover:bg-white transition-colors"
                              >
                                Commit_Patch_to_Clipboard
                              </button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    ))}
                  </div>

                  <div className="pt-8 flex gap-4 mt-auto">
                    <button 
                      onClick={reset}
                      className="flex-1 py-4 bg-[#00e5ff] text-black font-black uppercase tracking-tighter text-sm italic hover:scale-[1.02] shadow-[0_0_30px_-10px_rgba(0,229,255,0.5)] transition-all"
                    >
                      New_Analysis
                    </button>
                    <button 
                      onClick={copyTips}
                      className="flex-1 py-4 border border-[#30363d] text-white font-black uppercase tracking-tighter text-sm italic hover:bg-white/5 transition-all"
                    >
                      Export_Report
                    </button>
                  </div>
                </div>
              </div>

            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="relative z-10 p-12 border-t border-[#30363d] bg-black/20">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center space-y-6 md:space-y-0 opacity-40 hover:opacity-100 transition-opacity">
          <div className="text-[10px] font-mono tracking-[0.4em] uppercase text-[#00e5ff] font-bold">Encrypted Tunnel Active // Protocol v2.4</div>
          <div className="flex items-center space-x-8 text-[10px] font-mono uppercase tracking-[0.2em]">
            <a href="#" className="hover:text-[#00e5ff] transition-colors">Neural_Documentation</a>
            <a href="#" className="hover:text-[#ffb300] transition-colors">Core_Service</a>
            <span className="text-white/20">|</span>
            <span className="text-white/60">Lat: 480ms</span>
          </div>
        </div>
      </footer>

      <style dangerouslySetInnerHTML={{ __html: `
        .mask-fade-right {
          mask-image: linear-gradient(to right, black 85%, transparent 100%);
        }
        ::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        ::-webkit-scrollbar-track {
          background: transparent;
        }
        ::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}} />
    </div>
  );
}
