# UniVote Vercel Deployment Guide

## Configuration Complete ✅

The UniVote application has been configured for deployment to Vercel with Firebase Realtime Database for permanent data storage.

### What's Been Updated:

1. **vercel.json** - Updated for proper Vercel serverless deployment with static files and API routes
2. **index.js** - Modified to work with Vercel serverless functions
3. **package.json** - Updated main entry point to index.js

### Firebase Configuration:

The application is already configured to use Firebase Realtime Database:
- **Project ID**: univote-396af
- **Database URL**: https://univote-396af-default-rtdb.firebaseio.com

### Important: Firebase Database Rules

Before deploying, ensure your Firebase Realtime Database has the following rules to allow read/write:

```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

**To update Firebase rules:**
1. Go to Firebase Console (https://console.firebase.google.com)
2. Select project "univote-396af"
3. Go to Realtime Database → Rules
4. Update the rules as shown above
5. Publish the rules

### Deploy to Vercel:

#### Option 1: Deploy via Vercel CLI
```bash
cd d:\FB BCS\univote
npm install -g vercel
vercel login
vercel
```

#### Option 2: Deploy via GitHub
1. Push your code to GitHub
2. Go to Vercel Dashboard
3. Import the repository
4. Deploy

#### Option 3: Deploy via Vercel Dashboard
1. Go to https://vercel.com/dashboard
2. Click "Add New Project"
3. Select "From Directory" 
4. Choose the `univote` folder
5. Click Deploy

### How Votes Are Stored:

Votes are permanently stored in Firebase Realtime Database:
- **Frontend** (vote.html): Uses Firebase SDK to save votes directly to Firebase
- **Backend API** (index.js): Also saves votes via Firebase REST API
- **Backup**: LocalStorage is used as fallback, but Firebase is the primary storage

### Verify Deployment:

After deployment, test by:
1. Opening the deployed URL
2. Go to voting page
3. Cast a vote
4. Check Firebase Console → Realtime Database → votes node to confirm votes are stored

### API Endpoints:

- `/api/election` - Get election info
- `/api/candidates` - Get candidates list
- `/api/results` - Get voting results
- `/api/vote` - Submit a vote (POST)
- `/api/check-vote/:email` - Check if email has voted
- `/api/admin/votes` - Get all votes (admin)
- `/api/admin/reset-votes` - Reset all votes (admin, requires key)

### Support:

For issues, check the browser console (F12) for Firebase connection errors.
