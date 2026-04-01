import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, NavLink } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { auth } from './lib/firebase';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Upload from './pages/Upload';
import History from './pages/History';
import Webcam from './pages/Webcam';
import Profile from './pages/Profile';
import DebugFirebase from './pages/DebugFirebase';

const PrivateRoute = ({ children }) => {
  const { currentUser } = useAuth();
  return currentUser ? children : <Navigate to="/login" />;
};

const navItems = [
  { to: '/',        emoji: '📊', label: 'Dashboard',       end: true },
  { to: '/upload',  emoji: '🔬', label: 'New Inspection' },
  { to: '/webcam',  emoji: '📷', label: 'Live Camera' },
  { to: '/history', emoji: '📋', label: 'History' },
  { to: '/profile', emoji: '👤', label: 'Profile' },
  { to: '/debug',   emoji: '🛠️', label: 'Firebase Debug' },
];

const Sidebar = ({ isOpen, onClose }) => (
  <aside className={`fixed top-0 left-0 z-30 w-64 h-full flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700/60 shadow-xl transform transition-transform duration-300 ${
    isOpen ? 'translate-x-0' : '-translate-x-full'
  } md:translate-x-0`}>
    {/* Close button for mobile */}
    <button
      onClick={onClose}
      className="md:hidden absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
    >
      ✕
    </button>
    {/* Logo */}
    <div className="px-6 py-6 border-b border-slate-200 dark:border-slate-700/60">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
          <span className="text-xl">🔍</span>
        </div>
        <div>
          <div className="font-black text-slate-800 dark:text-white text-lg leading-tight">InspectAI</div>
          <div className="text-xs text-slate-400 font-medium">Defect Detection</div>
        </div>
      </div>
    </div>

    {/* Nav */}
    <nav className="flex-1 px-3 py-4 space-y-1">
      {navItems.map(({ to, emoji, label, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onClose} // Close sidebar on nav click for mobile
          className={({ isActive }) =>
            `w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
              isActive
                ? 'bg-gradient-to-r from-indigo-500/20 to-purple-500/10 text-indigo-600 dark:text-indigo-400 shadow-sm border border-indigo-500/20'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
            }`
          }
        >
          <span className="text-lg">{emoji}</span>
          {label}
        </NavLink>
      ))}
    </nav>

    {/* Footer */}
    <div className="px-3 py-4 border-t border-slate-200 dark:border-slate-700/60">
      <button
        onClick={() => auth.signOut()}
        className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
      >
        <span className="text-lg">🚪</span> Sign Out
      </button>
    </div>
  </aside>
);

const TopBar = ({ onMenuClick }) => {
  const { darkMode, setDarkMode } = useTheme();
  const { currentUser } = useAuth();

  return (
    <header className="fixed top-0 left-0 right-0 md:left-64 z-20 h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700/60 flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="md:hidden flex items-center justify-center w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-all"
        >
          ☰
        </button>
        <div>
          <p className="text-xs text-slate-400 dark:text-slate-500">Logged in as</p>
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate max-w-xs">{currentUser?.email}</p>
        </div>
      </div>
      <button
        onClick={() => setDarkMode(d => !d)}
        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-all text-sm font-semibold text-slate-700 dark:text-slate-200"
      >
        {darkMode ? '☀️ Light Mode' : '🌙 Dark Mode'}
      </button>
    </header>
  );
};

const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 z-20 bg-black bg-opacity-50"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <TopBar onMenuClick={() => setSidebarOpen(true)} />
      <main className="pt-16 md:ml-64 min-h-screen">
        {children}
      </main>
    </div>
  );
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/"        element={<PrivateRoute><Layout><Dashboard /></Layout></PrivateRoute>} />
      <Route path="/upload"  element={<PrivateRoute><Layout><Upload /></Layout></PrivateRoute>} />
      <Route path="/webcam"  element={<PrivateRoute><Layout><Webcam /></Layout></PrivateRoute>} />
      <Route path="/history" element={<PrivateRoute><Layout><History /></Layout></PrivateRoute>} />
      <Route path="/profile" element={<PrivateRoute><Layout><Profile /></Layout></PrivateRoute>} />
      <Route path="/debug"   element={<PrivateRoute><Layout><DebugFirebase /></Layout></PrivateRoute>} />
    </Routes>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
