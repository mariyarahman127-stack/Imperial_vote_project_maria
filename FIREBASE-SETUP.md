# Firebase Setup Instructions

## Step 1: Create a Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click "Add project" and follow the steps
3. Give your project a name (e.g., "univote")
4. Disable Google Analytics (optional, for simpler setup)
5. Click "Create project"

## Step 2: Enable Firestore Database
1. In the Firebase Console, click "Build" in the left sidebar
2. Click "Firestore Database"
3. Click "Create database"
4. Choose a location (closest to your users)
5. Start in **Test mode** (allows read/write for 30 days)
6. Click "Done"

## Step 3: Get Your Firebase Config
1. In the Firebase Console, click the gear icon (⚙️) next to "Project Overview"
2. Click "Project settings"
3. Scroll down to "Your apps" section
4. Click the web icon (`</>`)
5. Register the app (give it a name like "univote-web")
6. **Copy** the `firebaseConfig` object values

## Step 4: Update Your Code
Open `js/firebase-config.js` and replace the placeholder values:

```
javascript
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",           // Copy from Firebase Console
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};
```

## Step 5: Deploy to Netlify
1. Push your code to GitHub
2. Connect your GitHub repo to Netlify
3. Deploy!

## How It Works
- **Votes are stored in Firestore** - All votes are saved to the cloud database
- **Real-time sync** - Admin can see all votes in real-time
- **Duplicate prevention** - Each email can only vote once
- **Fallback to localStorage** - If Firebase isn't configured, it falls back to localStorage

## Security Rules (Optional)
For production, update your Firestore rules in Firebase Console:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /votes/{vote} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
  }
}
```

## Testing
1. Open your deployed site
2. Login with any email + password "voter123"
3. Cast a vote
4. Login as admin (admin@ice.edu / admin2026)
5. You should see all votes in the dashboard!
