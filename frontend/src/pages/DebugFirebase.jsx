import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { isFirebaseInitialized, db } from '../lib/firebase';
import { collection, addDoc, getDoc, doc } from 'firebase/firestore';

const Badge = ({ success, label }) => (
  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
    success ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' 
            : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'
  }`}>
    {success ? '✅ ' : '❌ '}{label}
  </span>
);

export default function DebugFirebase() {
  const { currentUser } = useAuth();
  const [networkOnline, setNetworkOnline] = useState(window.navigator.onLine);
  
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [testError, setTestError] = useState(null);

  useEffect(() => {
    const handleOnline = () => setNetworkOnline(true);
    const handleOffline = () => setNetworkOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const runFirestoreTest = async () => {
    setTesting(true);
    setTestResult(null);
    setTestError(null);

    try {
      console.log("[DB Test] Starting Firestore Write test...");
      
      const testCollection = collection(db, "debug_tests");
      const writeData = {
        test: "Firebase working",
        timestamp: new Date().toISOString(),
        user_agent: window.navigator.userAgent
      };
      
      const docRef = await addDoc(testCollection, writeData);
      console.log("[DB Test] Firestore Write Success:", docRef.id);

      console.log("[DB Test] Starting Firestore Read test...");
      const docSnap = await getDoc(doc(db, "debug_tests", docRef.id));
      
      if (docSnap.exists()) {
        console.log("[DB Test] Firestore Read Success:", docSnap.data());
        setTestResult({
          status: "SUCCESS",
          doc_id: docRef.id,
          read_data: docSnap.data()
        });
      } else {
        throw new Error("Document was written but cannot be found immediately on read.");
      }
      
    } catch (err) {
      console.error("[DB Test] Firestore Error:", err);
      // Ensure we extract a readable string for rendering
      let errMsg = err.message || JSON.stringify(err);
      if (errMsg.includes("Missing or insufficient permissions")) {
        errMsg += " — DID YOU UPDATE YOUR FIRESTORE RULES?";
      }
      setTestError(errMsg);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto animate-fade-in-up space-y-6">
      <div>
        <h1 className="text-3xl font-black text-slate-800 dark:text-white">🛠️ Firebase Debug</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">System Diagnostics and Status</p>
      </div>

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden p-6 space-y-6">
        
        <h2 className="text-lg font-bold text-slate-800 dark:text-white border-b border-slate-100 dark:border-slate-700 pb-2">Environment Status</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700">
            <span className="font-semibold text-slate-700 dark:text-slate-300">Firebase Init:</span>
            <Badge success={isFirebaseInitialized} label={isFirebaseInitialized ? "Connected" : "Failed"} />
          </div>

          <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700">
            <span className="font-semibold text-slate-700 dark:text-slate-300">Network:</span>
            <Badge success={networkOnline} label={networkOnline ? "Online" : "Offline"} />
          </div>

          <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700 md:col-span-2">
            <span className="font-semibold text-slate-700 dark:text-slate-300">Auth Status (UID):</span>
            <span className="font-mono text-sm px-3 py-1 bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-400 rounded-lg">
              {currentUser ? currentUser.uid : "None / Guest"}
            </span>
          </div>
        </div>

        <h2 className="text-lg font-bold text-slate-800 dark:text-white border-b border-slate-100 dark:border-slate-700 pb-2 pt-4">Firestore Database Test</h2>
        
        <div className="space-y-4">
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
            This will attempt to write a dummy document to a <code className="bg-slate-100 dark:bg-slate-900 px-1 rounded">debug_tests</code> collection and then immediately read it back. 
            <strong> Ensure your Firestore rules are temporarily set to allow open writes (`allow read, write: if true;`) before running.</strong>
          </p>

          <button 
            onClick={runFirestoreTest}
            disabled={testing || !isFirebaseInitialized}
            className="w-full flex justify-center items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold shadow-lg shadow-indigo-500/30 transition-all active:scale-95"
          >
            {testing ? "Testing..." : "🏃 Run Firestore Data Test"}
          </button>

          {/* Test Log Outputs */}
          {testError && (
            <div className="p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl font-mono text-sm text-red-600 dark:text-red-400 whitespace-pre-wrap break-all items-start flex gap-3">
              <span className="text-xl">🚨</span>
              <div>
                <strong className="block mb-1 text-red-800 dark:text-red-300">Error Output:</strong>
                {testError}
              </div>
            </div>
          )}

          {testResult && (
            <div className="p-4 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-xl font-mono text-sm text-emerald-700 dark:text-emerald-400 whitespace-pre-wrap break-all items-start flex gap-3">
              <span className="text-xl">✅</span>
              <div>
                <strong className="block mb-1 text-emerald-800 dark:text-emerald-300">Success Details:</strong>
                {JSON.stringify(testResult, null, 2)}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
