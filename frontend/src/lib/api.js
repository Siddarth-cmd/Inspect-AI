// Central API configuration
// VITE_API_URL is set in:
//   .env.development  → http://localhost:8000/api       (local dev)
//   .env.production   → https://<render-url>.onrender.com/api  (cloud)
//   Vercel dashboard  → overrides .env.production at deploy time

export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
