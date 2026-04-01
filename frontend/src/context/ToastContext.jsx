import React, { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext({});
export const useToast = () => useContext(ToastContext);

let toastIdCounter = 0;

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'success', duration = 4000) => {
    const id = ++toastIdCounter;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const ICONS = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const COLORS = {
    success: 'bg-emerald-500',
    error: 'bg-red-500',
    warning: 'bg-amber-500',
    info: 'bg-indigo-500',
  };

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      {/* Toast container */}
      <div className="fixed top-5 right-5 z-50 flex flex-col gap-3 pointer-events-none">
        {toasts.map(toast => (
          <div key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-2xl shadow-2xl text-white text-sm font-medium max-w-sm animate-fade-in-up ${COLORS[toast.type]}`}>
            <span className="text-lg leading-none mt-0.5">{ICONS[toast.type]}</span>
            <p className="flex-1 leading-snug">{toast.message}</p>
            <button onClick={() => removeToast(toast.id)} className="opacity-70 hover:opacity-100 text-white leading-none font-bold text-base">×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
