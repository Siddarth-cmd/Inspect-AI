import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { auth } from '../lib/firebase';
import { useToast } from '../context/ToastContext';
import { downloadReport } from '../lib/generateReport';
import { API_BASE } from '../lib/api';
import axios from 'axios';

const CARD = "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm";
const SEV_COLOR = { High: 'text-red-500 dark:text-red-400', Medium: 'text-amber-500 dark:text-amber-400', Low: 'text-emerald-500 dark:text-emerald-400' };
const SEV_BG = {
  High: 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30',
  Medium: 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30',
  Low: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30',
};
const DEFECT_EMOJI = { crack: '💥', scratch: '✂️', dent: '🔧', burn: '🔥', missing_component: '🛑', corrosion: '💧' };
const REC_STYLE = {
  Pass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400',
  Review: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
  Reject: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400',
};

const getToken = async () => {
  if (auth.currentUser) return await auth.currentUser.getIdToken();
  return "guest_token";
};

export default function Upload() {
  const { addToast } = useToast();
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [mode, setMode] = useState('surface');

  const onDrop = useCallback((acceptedFiles) => {
    const f = acceptedFiles[0];
    if (f) { setFile(f); setPreview(URL.createObjectURL(f)); setResults(null); setError(null); setSaved(false); }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'image/*': [] }, multiple: false });

  const analyzeImage = async () => {
    if (!file) return;
    setLoading(true); setError(null);
    try {
      const formData = new FormData();
      formData.append('mode', mode);
      formData.append('file', file);
      const token = await getToken();
      const res = await axios.post(`${API_BASE}/predict`, formData, {
        headers: { 'Content-Type': 'multipart/form-data', 'Authorization': `Bearer ${token}` }
      });
      setResults(res.data);
      setSaved(true);
      const score = res.data.quality_score;
      if (score >= 80) addToast(`✅ Inspection complete! Score: ${score}/100 — Product passed quality check.`, 'success');
      else if (score >= 50) addToast(`⚠️ Inspection complete! Score: ${score}/100 — Review recommended.`, 'warning');
      else addToast(`🚨 Inspection complete! Score: ${score}/100 — Critical defects detected.`, 'error');
    } catch (err) {
      const msg = err.response?.data?.detail || 'Analysis failed. Is the backend running on port 8000?';
      setError(msg);
      addToast(`❌ ${msg}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => downloadReport(results, preview, file?.name || 'image.jpg');

  const scoreColor = !results ? '' : results.quality_score >= 80 ? 'text-emerald-500' : results.quality_score >= 50 ? 'text-amber-500' : 'text-red-500';

  return (
    <div className="p-6 space-y-6 animate-fade-in-up">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 dark:text-white">🔬 New Inspection</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">Upload a product image to detect defects with AI</p>
        </div>
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
          <button onClick={() => setMode('surface')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${mode === 'surface' ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Surface</button>
          <button onClick={() => setMode('internal')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${mode === 'internal' ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Internal</button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Upload Card */}
        <div className={`${CARD} p-6 space-y-5`}>
          <div {...getRootProps()}
            className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-300
              ${isDragActive ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 scale-105'
                : 'border-slate-300 dark:border-slate-600 hover:border-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}>
            <input {...getInputProps()} />
            <div className="text-5xl mb-3">{isDragActive ? '📂' : '☁️'}</div>
            {isDragActive ? <p className="text-indigo-500 font-semibold">Drop image here...</p> : (
              <>
                <p className="text-slate-600 dark:text-slate-300 font-medium">Drag & drop or click to upload</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Supports JPG, PNG, WEBP • Max 10MB</p>
              </>
            )}
          </div>

          {preview && (
            <div className="space-y-4">
              <div className="relative w-full rounded-xl overflow-hidden">
                <img src={preview} alt="Preview" className="w-full rounded-xl object-cover max-h-72" />
                {results?.defects?.map((defect, idx) => {
                  const [ymin, xmin, ymax, xmax] = defect.bbox || [0,0,0,0];
                  if (ymin === 0 && xmin === 0 && ymax === 0 && xmax === 0) return null;
                  
                  // Clamp to prevent out-of-bounds rendering
                  const clamp = (val) => Math.max(0, Math.min(1, val));
                  const t = clamp(ymin) * 100;
                  const l = clamp(xmin) * 100;
                  const height = (clamp(ymax) - clamp(ymin)) * 100;
                  const width = (clamp(xmax) - clamp(xmin)) * 100;
                  
                  return (
                    <div key={idx} className="absolute border-[3px] border-red-500 bg-red-500/20 pointer-events-none"
                      style={{ top:`${t}%`, left:`${l}%`, width:`${width}%`, height:`${height}%` }}>
                      <span className="bg-red-500 text-white text-[10px] uppercase font-black px-1.5 py-0.5 rounded-t-sm absolute -top-[22px] -left-[3px] whitespace-nowrap tracking-wide shadow-md">
                        {defect.type} {Math.round((defect.confidence||0)*100)}%
                      </span>
                    </div>
                  );
                })}
              </div>

              {saved && (
                <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-sm px-4 py-2.5 rounded-xl">
                  ✅ Inspection saved to database! Check Dashboard & History.
                </div>
              )}

              {!results && (
                <button onClick={analyzeImage} disabled={loading}
                  className="w-full py-3.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl font-semibold hover:from-indigo-600 hover:to-purple-700 transition-all disabled:opacity-50 shadow-lg">
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                      🤖 AI is analyzing...
                    </span>
                  ) : '🚀 Run AI Inspection'}
                </button>
              )}

              {results && (
                <button onClick={() => { setFile(null); setPreview(null); setResults(null); setSaved(false); }}
                  className="w-full py-3 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-medium hover:bg-slate-200 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 transition-all">
                  🔄 Inspect Another Image
                </button>
              )}
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 text-sm px-4 py-3 rounded-xl">
              ⚠️ {error}
            </div>
          )}
        </div>

        {/* Results Panel */}
        {results ? (
          <div className={`${CARD} p-6 space-y-5 animate-fade-in-up`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-2xl">✅</span>
                <h2 className="text-xl font-bold text-slate-800 dark:text-white">Inspection Results</h2>
              </div>
              {results.recommendation && (
                <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${REC_STYLE[results.recommendation] || 'bg-slate-100 text-slate-600'}`}>
                  {results.recommendation === 'Pass' ? '✅' : results.recommendation === 'Review' ? '⚠️' : '🚨'} {results.recommendation}
                </span>
              )}
            </div>

            <div className="flex items-center gap-5 p-5 bg-slate-50 dark:bg-slate-700/50 rounded-2xl border border-slate-100 dark:border-slate-700">
              <div className="text-center">
                <div className={`text-5xl font-black ${scoreColor}`}>{results.quality_score}</div>
                <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">/ 100</div>
              </div>
              <div className="flex-1">
                <div className="h-3 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-1000 ${results.quality_score >= 80 ? 'bg-gradient-to-r from-emerald-400 to-green-500' : results.quality_score >= 50 ? 'bg-gradient-to-r from-amber-400 to-orange-500' : 'bg-gradient-to-r from-red-400 to-rose-600'}`}
                    style={{ width: `${results.quality_score}%` }} />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                  {results.overall_explanation || (results.quality_score >= 80 ? '✅ Excellent condition' : results.quality_score >= 50 ? '⚠️ Needs review' : '🚨 High defect level')}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                {mode === 'internal' ? '⚠️ Internal Component Report' : `⚠️ Detected Defects (${results.defects?.length || 0})`}
              </h3>
              {results.defects?.length > 0 ? results.defects.map((d, i) => (
                <div key={i} className={`px-4 py-3 rounded-xl border ${SEV_BG[d.severity] || 'bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{DEFECT_EMOJI[d.type] || '🔍'}</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 capitalize">{d.type}</span>
                      <span className={`text-xs font-bold ${SEV_COLOR[d.severity] || 'text-slate-400'}`}>{d.severity}</span>
                    </div>
                    <span className="text-sm font-bold text-slate-500 dark:text-slate-400">{Math.round((d.confidence||0)*100)}%</span>
                  </div>
                  
                  {mode === 'internal' ? (
                     <div className="mt-2 space-y-1">
                        <p className="text-xs text-slate-600 dark:text-slate-300"><span className="font-bold text-slate-800 dark:text-slate-100">Affected Area:</span> {(d.explanation.split(' - ')[0]) || 'Component Core'}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400"><span className="font-semibold">Explanation:</span> {d.explanation.split(' - ')[1] || d.explanation}</p>
                     </div>
                  ) : (
                     <div className="mt-2 space-y-1">
                        {d.explanation && <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{d.explanation}</p>}
                        {d.cause && <p className="text-xs text-amber-600 dark:text-amber-400"><span className="font-semibold">⚡ Cause:</span> {d.cause}</p>}
                     </div>
                  )}
                  {d.solution && <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2"><span className="font-semibold">✅ Solution:</span> {d.solution}</p>}
                </div>
              )) : (
                <div className="flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-xl">
                  <span className="text-3xl">🎉</span>
                  <div>
                    <p className="font-semibold text-emerald-700 dark:text-emerald-400">{mode === 'internal' ? 'Component Healthy!' : 'No defects detected!'}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{mode === 'internal' ? 'No internal functional damage detected.' : 'Product is in top condition.'}</p>
                  </div>
                </div>
              )}
            </div>

            <button onClick={handleDownload}
              className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-semibold hover:from-emerald-600 hover:to-teal-600 transition-all shadow-lg flex items-center justify-center gap-2">
              📄 Download PDF Report
            </button>
          </div>
        ) : (
          <div className={`${CARD} p-6 flex flex-col items-center justify-center text-center min-h-64`}>
            <div className="text-6xl mb-4">🤖</div>
            <h3 className="text-xl font-bold text-slate-700 dark:text-slate-200">Ready to Inspect</h3>
            <p className="text-slate-400 dark:text-slate-500 text-sm mt-2 max-w-xs">Upload a product image and hit the button to run AI-powered defect detection.</p>
          </div>
        )}
      </div>
    </div>
  );
}
