# Firebase Deployment Guide

## Problem
The voting system is not recording votes in the admin dashboard and data is not being stored in the database because Firebase Realtime Database security rules have not been deployed.

## Solution
Deploy the Firebase database rules to allow authenticated users to read and write data.

## Steps to Deploy

### Option 1: Using Firebase CLI (Recommended)

1. **Install Firebase CLI** (if not already installed):
   ```bash
   npm install -g firebase-tools
   ```

2. **Login to Firebase**:
   ```bash
   firebase login
   ```

3. **Deploy the database rules**:
   ```bash
   cd univote
   firebase deploy --only database
   ```

### Option 2: Using Firebase Console (Manual)

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `univote1-59bd1`
3. Navigate to **Realtime Database** → **Rules** tab
4. Copy the contents of `database.rules.json` and paste it into the rules editor
5. Click **Publish**

## Database Rules Explanation

The `database.rules.json` file contains the following rules:

- **votes**: 
  - Read: Admin (`admin@ice.edu`) or any authenticated user with verified email
  - Write: Any authenticated user with verified email
  - Validates that each vote has required fields

- **voters**: 
  - Read: Admin or any authenticated user with verified email
  - Write: Any authenticated user with verified email
  - Validates that each voter record has required fields

- **registeredUsers**: 
  - Read: Admin or any authenticated user with verified email
  - Write: Any authenticated user with verified email
  - Validates that each user record has required fields

## After Deployment

Once the rules are deployed:
1. Votes will be saved to Firebase Realtime Database
2. Admin dashboard will display all votes
3. Voter information will be tracked properly
4. All authenticated users can access the system

## Troubleshooting

If you still see permission errors after deployment:
1. Make sure you're logged in with a verified email
2. Check that the Firebase project ID matches in `firebase-config.js`
3. Verify that Email/Password authentication is enabled in Firebase Console
4. Clear browser cache and try again
