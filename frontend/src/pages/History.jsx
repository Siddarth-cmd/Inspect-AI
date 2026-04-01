import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { auth } from '../lib/firebase';
import { API_BASE } from '../lib/api';
import { downloadReport } from '../lib/generateReport';

const CARD = "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm";
const SEV_COLORS = {
  High: 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400 border-red-200 dark:border-red-500/30',
  Medium: 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 border-amber-200 dark:border-amber-500/30',
  Low: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30',
};
const DEFECT_EMOJI = { crack: '💥', scratch: '✂️', dent: '🔧' };

const getToken = async () => {
  if (auth.currentUser) return await auth.currentUser.getIdToken();
  return "guest_token";
};

export default function History() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const res = await axios.get(`${API_BASE}/history`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setHistory(res.data || []);
      setError(null);
    } catch (err) {
      console.error('History fetch error:', err);
      setError('Could not load history. Is the backend running?');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  // Pass image_data (base64 data URL stored in SQLite) so the PDF includes the annotated image
  const handleDownload = (item) => downloadReport(item, item.image_data || null, item.filename || 'inspection');

  return (
    <div className="p-6 space-y-6 animate-fade-in-up">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-800 dark:text-white">📋 Inspection History</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">All past inspections with downloadable reports</p>
        </div>
        <button onClick={fetchHistory}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors">
          🔄 Refresh
        </button>
      </div>

      {error && (
        <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-400 text-sm px-4 py-3 rounded-xl">
          ⚠️ {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="flex gap-2">
            {['bg-indigo-500','bg-purple-500','bg-pink-500'].map((c,i) => (
              <div key={i} className={`w-3 h-3 rounded-full ${c} animate-bounce`} style={{animationDelay:`${i*0.1}s`}}/>
            ))}
          </div>
        </div>
      ) : history.length === 0 ? (
        <div className={`${CARD} p-16 text-center`}>
          <p className="text-5xl mb-4">🕐</p>
          <h3 className="text-xl font-bold text-slate-700 dark:text-slate-200">No Inspections Yet</h3>
          <p className="text-slate-400 dark:text-slate-500 mt-2 text-sm">Run a new inspection to populate your history here.</p>
        </div>
      ) : (
        <div className={`${CARD} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-100 dark:border-slate-700">
                  {['🖼️ Image', '📅 Date', '⚠️ Defects', '⭐ Score', '📄 Report'].map((h, i) => (
                    <th key={i} className={`px-5 py-4 text-left text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 ${i === 4 ? 'text-right' : ''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {history.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg ${item.quality_score > 80 ? 'bg-emerald-100 dark:bg-emerald-500/20' : 'bg-red-100 dark:bg-red-500/20'}`}>
                          {item.quality_score > 80 ? '✅' : '⚠️'}
                        </div>
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate max-w-[160px]">{item.filename}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm text-slate-600 dark:text-slate-300">{item.date ? new Date(item.date).toLocaleDateString() : 'N/A'}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">{item.date ? new Date(item.date).toLocaleTimeString() : ''}</p>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-1">
                        {item.defects?.length > 0 ? item.defects.map((d, i) => (
                          <span key={i} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${SEV_COLORS[d.severity] || 'bg-slate-100 text-slate-500 dark:bg-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600'}`}>
                            {DEFECT_EMOJI[d.type] || '🔍'} {d.type}
                          </span>
                        )) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30">
                            ✅ None
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-xl font-extrabold ${item.quality_score >= 80 ? 'text-emerald-500' : item.quality_score >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
                        {item.quality_score}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button onClick={() => handleDownload(item)}
                        className="px-3 py-1.5 bg-indigo-100 dark:bg-indigo-500/20 hover:bg-indigo-200 dark:hover:bg-indigo-500/30 text-indigo-600 dark:text-indigo-400 rounded-lg text-xs font-bold border border-indigo-200 dark:border-indigo-500/30 transition-all hover:scale-105">
                        📄 Download
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
