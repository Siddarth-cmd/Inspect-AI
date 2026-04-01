import React, { useRef, useState, useCallback } from 'react';
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
const DEFECT_EMOJI = { crack: '💥', scratch: '✂️', dent: '🔧' };
const REC_STYLE = {
  Pass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400',
  Review: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
  Reject: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400',
};

const getToken = async () => auth.currentUser ? await auth.currentUser.getIdToken() : "guest_token";

export default function Webcam() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [streaming, setStreaming] = useState(false);
  const [recording, setRecording] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  
  const [captured, setCaptured] = useState(null);  // img base64
  const [capturedBlob, setCapturedBlob] = useState(null); // img blob
  
  const [capturedVideo, setCapturedVideo] = useState(null); // video url
  const [capturedVideoBlob, setCapturedVideoBlob] = useState(null); // video blob

  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);

  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const { addToast } = useToast();

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } } });
      videoRef.current.srcObject = stream;
      videoRef.current.play();
      setStreaming(true);
      setCaptured(null); setResults(null); setError(null);
    } catch (err) {
      setError('Could not access camera. Please allow camera permissions in your browser.');
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(t => t.stop());
    }
    setStreaming(false);
  };

  const captureFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setCaptured(dataUrl);
    canvas.toBlob(blob => setCapturedBlob(blob), 'image/jpeg', 0.9);
    stopCamera();
  }, []);

  const startVideoRecord = () => {
    if (!videoRef.current?.srcObject) return;
    recordedChunksRef.current = [];
    const stream = videoRef.current.srcObject;
    try {
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8,opus' });
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        setCapturedVideoBlob(blob);
        setCapturedVideo(url);
        stopCamera();
      };
      
      mediaRecorder.start();
      setRecording(true);
      setTimeLeft(5);
      
      // Auto-stop countdown (Hardcap prevents file bloat)
      let currentTicks = 5;
      const interval = setInterval(() => {
        currentTicks--;
        setTimeLeft(currentTicks);
        if (currentTicks <= 0) {
          clearInterval(interval);
          if (mediaRecorderRef.current?.state === 'recording') {
            mediaRecorderRef.current.stop();
            setRecording(false);
          }
        }
      }, 1000);
      
    } catch (err) {
      console.error(err);
      setError('Video recording is not supported on this browser/device.');
    }
  };

  const resetCapture = () => {
    setCaptured(null); setCapturedBlob(null);
    setCapturedVideo(null); setCapturedVideoBlob(null);
    setResults(null);
    startCamera();
  };

  const analyzeCapture = async () => {
    if (!capturedBlob && !capturedVideoBlob) return;
    setLoading(true); setError(null);
    try {
      const formData = new FormData();
      if (capturedVideoBlob) {
        formData.append('file', capturedVideoBlob, 'webcam_capture.webm');
      } else {
        formData.append('file', capturedBlob, 'webcam_capture.jpg');
      }
      const token = await getToken();
      const res = await axios.post(`${API_BASE}/predict`, formData, {
        headers: { 'Content-Type': 'multipart/form-data', 'Authorization': `Bearer ${token}` }
      });
      setResults(res.data);
      const score = res.data.quality_score;
      if (score >= 80) addToast(`✅ Inspection complete! Quality score: ${score}/100 — No major defects.`, 'success');
      else if (score >= 50) addToast(`⚠️ Inspection complete! Score: ${score}/100 — Defects found, review needed.`, 'warning');
      else addToast(`🚨 Inspection complete! Score: ${score}/100 — High defect level detected.`, 'error');
    } catch (err) {
      const msg = err.response?.data?.detail || 'Analysis failed.';
      setError(msg);
      addToast(`❌ ${msg}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => downloadReport(results, captured, 'webcam_capture.jpg');

  const scoreColor = !results ? '' : results.quality_score >= 80 ? 'text-emerald-500' : results.quality_score >= 50 ? 'text-amber-500' : 'text-red-500';

  return (
    <div className="p-6 space-y-6 animate-fade-in-up">
      <div>
        <h1 className="text-3xl font-black text-slate-800 dark:text-white">📸 Live Camera Inspection</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">Capture a live image from your webcam and detect defects instantly</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Camera Feed */}
        <div className={`${CARD} p-6 space-y-5`}>
          <div className="relative w-full bg-slate-900 dark:bg-black rounded-2xl overflow-hidden aspect-video flex items-center justify-center">
            <video ref={videoRef} className={`w-full h-full object-cover ${streaming && !recording ? 'block' : recording ? 'block' : 'hidden'}`} playsInline muted />
            {captured && !capturedVideo && <img src={captured} alt="Captured" className="w-full h-full object-cover" />}
            {capturedVideo && <video src={capturedVideo} controls autoPlay loop playsInline className="w-full h-full object-cover" />}
            
            {!streaming && !captured && !capturedVideo && (
              <div className="text-center">
                <div className="text-6xl mb-3">📷</div>
                <p className="text-slate-400 text-sm font-medium">Camera is off</p>
              </div>
            )}
            
            {streaming && !recording && (
              <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-indigo-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                <span className="w-2 h-2 rounded-full bg-white animate-pulse"/>LIVE
              </div>
            )}
            {recording && (
              <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-red-600 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg">
                <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping"/>REC {timeLeft}s
              </div>
            )}
          </div>

          <canvas ref={canvasRef} className="hidden" />

          <div className="flex gap-3">
            {!streaming && !captured && !capturedVideo && (
              <button onClick={startCamera}
                className="flex-1 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl font-semibold hover:from-indigo-600 hover:to-purple-700 transition-all shadow-lg flex items-center justify-center gap-2">
                📷 Start Camera
              </button>
            )}
            {streaming && !recording && (
              <>
                <button onClick={captureFrame}
                  className="flex-1 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl font-semibold hover:from-indigo-600 hover:to-purple-700 transition-all shadow-lg flex items-center justify-center gap-2">
                  📸 Photo
                </button>
                <button onClick={startVideoRecord}
                  className="flex-1 py-3 bg-gradient-to-r from-rose-500 to-red-600 text-white rounded-xl font-semibold hover:from-rose-600 hover:to-red-700 transition-all shadow-lg flex items-center justify-center gap-2">
                  📹 Scan 5s Video
                </button>
                <button onClick={stopCamera}
                  className="px-5 py-3 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-medium hover:bg-slate-200 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 transition-all">
                  ✕
                </button>
              </>
            )}
            {recording && (
               <div className="flex-1 py-3 bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 rounded-xl font-bold flex items-center justify-center gap-2 border border-red-200 dark:border-red-500/30">
                 Recording active... Please pan object slowly.
               </div>
            )}
            {(captured || capturedVideo) && !results && (
              <>
                <button onClick={analyzeCapture} disabled={loading}
                  className="flex-1 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl font-semibold hover:from-indigo-600 hover:to-purple-700 transition-all shadow-lg disabled:opacity-50 flex items-center justify-center gap-2">
                  {loading ? (
                    <>
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                      🤖 Analyzing...
                    </>
                  ) : '🚀 Analyze Frame'}
                </button>
                <button onClick={resetCapture}
                  className="px-5 py-3 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-medium border border-slate-200 dark:border-slate-600 transition-all hover:bg-slate-200 dark:hover:bg-slate-600">
                  🔄 Retake
                </button>
              </>
            )}
            {results && (
              <button onClick={resetCapture}
                className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-medium border border-slate-200 dark:border-slate-600 transition-all hover:bg-slate-200 dark:hover:bg-slate-600">
                🔄 New Capture
              </button>
            )}
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 text-sm px-4 py-3 rounded-xl">
              ⚠️ {error}
            </div>
          )}
        </div>

        {/* Results */}
        {results ? (
          <div className={`${CARD} p-6 space-y-5 animate-fade-in-up`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-2xl">✅</span>
                <h2 className="text-xl font-bold text-slate-800 dark:text-white">Analysis Results</h2>
              </div>
              {results.recommendation && (
                <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${REC_STYLE[results.recommendation] || 'bg-slate-100 text-slate-600'}`}>
                  {results.recommendation === 'Pass' ? '✅' : results.recommendation === 'Review' ? '⚠️' : '🚨'} {results.recommendation}
                </span>
              )}
            </div>

            {/* Score bar */}
            <div className="flex items-center gap-5 p-5 bg-slate-50 dark:bg-slate-700/50 rounded-2xl border border-slate-100 dark:border-slate-700">
              <div className="text-center min-w-[60px]">
                <div className={`text-5xl font-black ${scoreColor}`}>{results.quality_score}</div>
                <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">/ 100</div>
              </div>
              <div className="flex-1">
                <div className="h-3 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-1000 ${results.quality_score >= 80 ? 'bg-gradient-to-r from-emerald-400 to-green-500' : results.quality_score >= 50 ? 'bg-gradient-to-r from-amber-400 to-orange-500' : 'bg-gradient-to-r from-red-400 to-rose-600'}`}
                    style={{ width: `${results.quality_score}%` }} />
                </div>
                {results.overall_explanation && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">{results.overall_explanation}</p>
                )}
              </div>
            </div>

            {/* Defects */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                ⚠️ Detected Defects ({results.defects?.length || 0})
              </h3>
              {results.defects?.length > 0 ? results.defects.map((d, i) => (
                <div key={i} className={`px-4 py-3 rounded-xl border ${SEV_BG[d.severity] || 'bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{DEFECT_EMOJI[d.type] || '🔍'}</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 capitalize">{d.type}</span>
                      <span className={`text-xs font-bold ${SEV_COLOR[d.severity] || ''}`}>{d.severity}</span>
                    </div>
                    <span className="text-sm font-bold text-slate-500 dark:text-slate-400">{Math.round((d.confidence||0)*100)}%</span>
                  </div>
                  {d.explanation && <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mt-1">{d.explanation}</p>}
                  {d.cause && <p className="text-xs text-amber-600 dark:text-amber-400 mt-1"><span className="font-semibold">⚡ Cause:</span> {d.cause}</p>}
                  {d.solution && <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1"><span className="font-semibold">✓ Solution:</span> {d.solution}</p>}
                </div>
              )) : (
                <div className="flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-xl">
                  <span className="text-3xl">🎉</span>
                  <div>
                    <p className="font-semibold text-emerald-700 dark:text-emerald-400">No defects found!</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Product passes quality inspection.</p>
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
            <div className="text-6xl mb-4">📷</div>
            <h3 className="text-xl font-bold text-slate-700 dark:text-slate-200">Live Camera Detection</h3>
            <p className="text-slate-400 dark:text-slate-500 text-sm mt-2 max-w-xs">Start your camera, point at a product, and capture a frame to detect defects in real-time.</p>
            <div className="mt-6 flex flex-col gap-2 text-left text-sm text-slate-500 dark:text-slate-400">
              {['1. Click "Start Camera"', '2. Point at product surface', '3. Click "Capture Frame"', '4. Click "Analyze Frame"'].map(s => (
                <p key={s} className="flex items-center gap-2"><span className="text-indigo-500">→</span>{s}</p>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
