import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { auth } from '../lib/firebase';
import { API_BASE } from '../lib/api';
import { useToast } from '../context/ToastContext';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const CARD = "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm";
const DEFECT_COLORS = { crack: '#ef4444', scratch: '#f59e0b', dent: '#8b5cf6' };

const getToken = async () => {
  if (auth.currentUser) return await auth.currentUser.getIdToken();
  return "guest_token";
};

const StatCard = ({ emoji, label, value, color }) => (
  <div className={`${CARD} p-4 transition-all duration-300 hover:scale-105 hover:shadow-md`}>
    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{emoji} {label}</p>
    <p className={`text-4xl font-black mt-3 ${color}`}>{value}</p>
  </div>
);

export default function Dashboard() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { addToast } = useToast();

  const fetchHistory = useCallback(async (isManualRefresh = false) => {
    setLoading(true);
    try {
      const token = await getToken();
      const res = await axios.get(`${API_BASE}/history`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setHistory(res.data || []);
      setError(null);
      if (isManualRefresh) {
        addToast("success", "Dashboard data refreshed!");
      }
    } catch (err) {
      console.error('History fetch error:', err);
      setError('Could not load data. Is the backend running?');
      if (isManualRefresh) {
        addToast("error", "Failed to refresh data.");
      }
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchHistory();
    // Refresh data when the user navigates back to this tab
    window.addEventListener('focus', fetchHistory);
    return () => window.removeEventListener('focus', fetchHistory);
  }, [fetchHistory]);

  const totalInspections = history.length;
  let defectsDetected = 0, totalScore = 0;
  const defectTypeCounts = {};

  history.forEach(item => {
    (item.defects || []).forEach(d => {
      defectsDetected++;
      if (d.type) defectTypeCounts[d.type] = (defectTypeCounts[d.type] || 0) + 1;
    });
    if (item.quality_score != null) totalScore += item.quality_score;
  });

  const avgScore = totalInspections > 0 ? Math.round(totalScore / totalInspections) : 0;
  const chartData = [...history].reverse().map((item, idx) => ({ name: `#${idx + 1}`, score: item.quality_score }));
  const pieData = Object.entries(defectTypeCounts).map(([name, value]) => ({ name, value }));

  return (
    <div className="p-6 space-y-4 animate-fade-in-up">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-800 dark:text-white">📊 Dashboard</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">Real-time AI inspection overview</p>
        </div>
        <button onClick={() => fetchHistory(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors">
          🔄 Refresh
        </button>
      </div>

      {error && (
        <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-400 text-sm px-4 py-3 rounded-xl">
          ⚠️ {error}
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard emoji="🔬" label="Total Inspections" value={totalInspections} color="text-indigo-600 dark:text-indigo-400" />
        <StatCard emoji="⚠️" label="Defects Detected" value={defectsDetected} color="text-red-600 dark:text-red-400" />
        <StatCard emoji="⭐" label="Avg Quality Score" value={`${avgScore}/100`}
          color={avgScore > 75 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-500 dark:text-amber-400"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className={`lg:col-span-2 ${CARD} p-4`}>
          <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-4">📈 Quality Score Trend</h2>
          {loading ? (
            <div className="h-56 flex items-center justify-center">
              <div className="flex gap-2">
                {['bg-indigo-500','bg-purple-500','bg-pink-500'].map((c,i) => (
                  <div key={i} className={`w-2.5 h-2.5 rounded-full ${c} animate-bounce`} style={{animationDelay:`${i*0.1}s`}}/>
                ))}
              </div>
            </div>
          ) : chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                <defs>
                  <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,102,241,0.15)"/>
                <XAxis dataKey="name" tick={{ fill:'#94a3b8', fontSize:11 }} axisLine={false} tickLine={false}/>
                <YAxis domain={[0,100]} tick={{ fill:'#94a3b8', fontSize:11 }} axisLine={false} tickLine={false}/>
                <Tooltip contentStyle={{ background:'rgba(15,23,42,0.92)', border:'1px solid rgba(99,102,241,0.4)', borderRadius:'12px', color:'#fff', fontSize:'13px' }}/>
                <Area type="monotone" dataKey="score" stroke="#6366f1" strokeWidth={3} fill="url(#grad)" name="Quality Score"/>
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-56 flex flex-col items-center justify-center">
              <span className="text-5xl mb-3">📭</span>
              <p className="font-medium text-slate-400 dark:text-slate-500">No inspection data yet</p>
            </div>
          )}
        </div>

        <div className={`${CARD} p-4`}>
          <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-4">🥧 Defect Breakdown</h2>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={5} dataKey="value">
                  {pieData.map((_, idx) => <Cell key={idx} fill={DEFECT_COLORS[pieData[idx].name] || '#6366f1'} />)}
                </Pie>
                <Tooltip contentStyle={{ background:'rgba(15,23,42,0.92)', border:'1px solid rgba(99,102,241,0.4)', borderRadius:'12px', color:'#fff', fontSize:'13px'}}/>
                <Legend formatter={val => <span style={{color:'#94a3b8', textTransform:'capitalize'}}>{val}</span>}/>
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-56 flex flex-col items-center justify-center">
              <span className="text-5xl mb-3">✅</span>
              <p className="font-medium text-center text-sm text-slate-400 dark:text-slate-500">No defects recorded</p>
            </div>
          )}
        </div>
      </div>

      {/* Recent */}
      <div className={`${CARD} p-4`}>
        <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-4">🕐 Recent Inspections</h2>
        {history.length > 0 ? (
          <div className="space-y-2">
            {history.slice(0, 5).map((item, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-100 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg ${item.quality_score > 80 ? 'bg-emerald-100 dark:bg-emerald-500/20' : 'bg-red-100 dark:bg-red-500/20'}`}>
                    {item.quality_score > 80 ? '✅' : '⚠️'}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate max-w-[200px]">{item.filename}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">{item.date ? new Date(item.date).toLocaleString() : ''}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-lg font-extrabold ${item.quality_score > 80 ? 'text-emerald-500' : item.quality_score > 50 ? 'text-amber-500' : 'text-red-500'}`}>{item.quality_score}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">{item.defects?.length || 0} defect(s)</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-10 text-center">
            <p className="text-4xl mb-3">🔎</p>
            <p className="font-medium text-slate-500 dark:text-slate-400">Run your first inspection to see data here!</p>
          </div>
        )}
      </div>
    </div>
  );
}
