# UniVote Netlify Deployment Guide

## Prerequisites
1. A Netlify account
2. A Firebase project with Firestore enabled

## Step 1: Configure Firebase

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or select existing
3. Enable **Firestore Database**:
   - Go to "Firestore Database" in the left menu
   - Click "Create Database"
   - Start in **Test Mode** (allows all read/write for 30 days)
   - Or configure security rules for production
4. Go to **Project Settings** (gear icon)
5. Scroll down to "Your apps" and click the **</>** icon (web)
6. Copy the firebaseConfig values

## Step 2: Update Firebase Config

Open `js/firebase-config.js` and replace the placeholder values:

```
javascript
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};
```

Replace with your actual Firebase credentials from Step 1.

## Step 3: Deploy to Netlify

### Option A: Drag and Drop
1. Go to [Netlify](https://www.netlify.com/) and sign in
2. Drag and drop the entire `univote` folder onto the Netlify dashboard
3. Your site will be deployed automatically

### Option B: Git Integration
1. Push your code to GitHub/GitLab
2. Connect your repo to Netlify
3. Build settings:
   - Build command: (leave empty)
   - Publish directory: .
4. Deploy

## Step 4: Configure Firestore Security Rules (Production)

For production, update Firestore rules in Firebase Console:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow anyone to read results
    match /votes/{voteId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

## How It Works

- **Votes are stored in Firebase Firestore** - Works on any hosting
- **No server needed** - Runs entirely on client-side
- **Real-time updates** - Admin dashboard auto-refreshes every 10 seconds
- **Duplicate prevention** - Checks email before allowing vote

## Files Updated for Netlify

- ✅ vote.html - Uses Firebase directly for voting
- ✅ admin-dashboard.html - Uses Firebase for results
- ✅ results.html - Uses Firebase for displaying results
- ✅ login.html - Uses Firebase for checking voting status
- ✅ _redirects - Handles client-side routing
- ✅ js/firebase-config.js - Firebase configuration
- ✅ js/firebase-service.js - Firebase operations

## Testing Locally

To test locally before deploying:
1. Open `index.html` directly in browser (file://)
2. Or use a simple HTTP server:
   
```
bash
   npx serve .
   
```

## Support

If you encounter issues:
1. Check browser console for errors
2. Verify Firebase config is correct
3. Check Firestore rules allow access
