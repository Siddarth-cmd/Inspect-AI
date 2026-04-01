import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { auth } from '../lib/firebase';
import { API_BASE } from '../lib/api';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';

export default function Profile() {
  const { currentUser } = useAuth();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({
    full_name: '',
    company: '',
    job_title: ''
  });

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = await auth.currentUser.getIdToken();
        const res = await axios.get(`${API_BASE}/profile`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.data.profile) {
          setProfile({
            full_name: res.data.profile.full_name || '',
            company: res.data.profile.company || '',
            job_title: res.data.profile.job_title || ''
          });
        }
      } catch (err) {
        console.error("Failed to load profile", err);
        addToast("error", "Failed to load profile data");
      } finally {
        setLoading(false);
      }
    };
    if (currentUser) {
      fetchProfile();
    }
  }, [currentUser, addToast]);

  const handleChange = (e) => {
    setProfile({ ...profile, [e.target.name]: e.target.value });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const token = await auth.currentUser.getIdToken();
      await axios.post(`${API_BASE}/profile`, profile, {
        headers: { Authorization: `Bearer ${token}` }
      });
      addToast("success", "Profile saved successfully!");
    } catch (err) {
      console.error("Failed to save profile", err);
      addToast("error", "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex justify-center items-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto animate-fade-in-up">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-slate-800 dark:text-white">👤 My Profile</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">Update your personal details</p>
      </div>

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden">
        <form onSubmit={handleSave} className="p-6 space-y-6">
          
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Account Email</label>
            <input 
              type="text" 
              value={currentUser?.email || 'N/A'}
              disabled 
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-500 dark:text-slate-500 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Full Name</label>
            <input 
              type="text" 
              name="full_name"
              value={profile.full_name}
              onChange={handleChange}
              placeholder="e.g. Jane Doe"
              className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Company / Organization</label>
              <input 
                type="text" 
                name="company"
                value={profile.company}
                onChange={handleChange}
                placeholder="e.g. Acme Corp"
                className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Job Title</label>
              <input 
                type="text" 
                name="job_title"
                value={profile.job_title}
                onChange={handleChange}
                placeholder="e.g. Quality Inspector"
                className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-700 flex justify-end">
            <button 
              type="submit" 
              disabled={saving}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-70 text-white rounded-xl font-semibold shadow-lg shadow-indigo-500/30 transition-all active:scale-95"
            >
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
