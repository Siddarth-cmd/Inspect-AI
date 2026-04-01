# InspectAI - AI Defect Detection System

Your full-stack application has been successfully built!

## ✨ Features Implemented
- **Frontend**: React, Vite, Tailwind CSS, Recharts, Lucide Icons
- **Backend**: FastAPI, Python
- **AI Integration**: Gemini Vision API ready
- **Database**: Firebase Admin mapped
- **Core Functions**: Dashboard Analytics, Image Upload & Bounding Box Rendering, PDF Report Download, User Authentication

## 🚀 How to Run

### 1. Setup Backend
1. Open a new terminal and navigate to the `backend` folder:
   ```bash
   cd "backend"
   ```
2. Create and activate a Python virtual environment:
   ```bash
   python -m venv venv
   .\venv\Scripts\activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Create a `.env` file from `.env.example` and add your **Gemini API Key** and Firebase `serviceAccountKey.json` path:
   ```env
   GEMINI_API_KEY=your_actual_key_here
   FIREBASE_SERVICE_ACCOUNT_PATH=./serviceAccountKey.json
   ```
5. Run the FastAPI server:
   ```bash
   python main.py
   ```
   *(Running on http://localhost:8000)*

### 2. Setup Frontend
1. Open a second terminal and navigate to the `frontend` folder:
   ```bash
   cd "frontend"
   ```
2. Open `src/lib/firebase.js` and input your **Firebase Project Configuration**.
3. Run the development server:
   ```bash
   npm run dev
   ```
   *(Running on http://localhost:5173)*

### 💡 Notes
- Make sure to enable **Email/Password Authentication** and **Firestore Database** in your Firebase console.
- If you don't have a Firebase project yet, you can comment out the auth checks in `backend/api/routes.py` and `frontend/src/App.jsx` to test the AI upload UI purely locally.

Enjoy your new AI Defect Detection System! Let me know if you encounter any issues or want to add Custom YOLOv8 models.
