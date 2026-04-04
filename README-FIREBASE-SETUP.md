# Firebase Setup Instructions for UniVote

## Overview
Your university voting system has been updated to store votes in **Firebase Realtime Database**. Follow these steps to configure Firebase.

## Step 1: Create a Firebase Project (Already Done)
✅ You have created project: **univote-396af**
✅ Database URL: **https://univote-396af-default-rtdb.firebaseio.com**

## Step 2: Enable Realtime Database (Already Done)
✅ Your Realtime Database is created at the URL above

## Step 3: Get Your Firebase Config
1. Go to https://console.firebase.google.com/u/0/project/univote-396af/settings/general
2. Scroll down to "Your apps" section
3. Click the `</>` icon (Web app)
4. If not registered, register app with nickname "UniVote"
5. Click "Register app"
6. Copy the `firebaseConfig` object values

## Step 4: Update js/firebase-config.js
Open `js/firebase-config.js` and replace the placeholder values with your actual Firebase credentials:

```javascript
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",           // e.g., "AIzaSy..."
    authDomain: "univote-396af.firebaseapp.com",
    databaseURL: "https://univote-396af-default-rtdb.firebaseio.com",
    projectId: "univote-396af",
    storageBucket: "univote-396af.appspotSenderId: "YOUR_SENDER_ID.com",
    messaging",          // e.g., "123456789"
    appId: "YOUR_APP_ID"              // e.g., "1:123456789:web:abc123..."
};
```

**Important:** The `databaseURL` is already set to your Realtime Database. You just need to add your `apiKey`, `messagingSenderId`, and `appId` from the Firebase console.

## Step 5: Set Database Rules (Important!)
1. Go to https://console.firebase.google.com/u/0/project/univote-396af/database/univote-396af-default-rtdb/rules
2. Replace the rules with:

```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

3. Click "Publish"

This allows anyone to read/write for testing. For production, you should restrict this.

## Step 6: Test the Application
1. Open `index.html` in a browser
2. Login as voter (use password: voter123)
3. Cast a vote
4. Login as admin (email: admin@ice.edu, password: admin2026)
5. Verify votes appear in the admin dashboard

## Features Implemented
- ✅ Votes stored in Firebase Realtime Database
- ✅ Admin can view all votes in real-time
- ✅ Only admin can access results
- ✅ Duplicate voting prevented by email
- ✅ Fallback to localStorage if Firebase not configured

## Troubleshooting
- If votes don't save, check browser console for errors
- Ensure Realtime Database rules allow read/write
- Verify the firebaseConfig values are correct
- Make sure databaseURL points to: https://univote-396af-default-rtdb.firebaseio.com
