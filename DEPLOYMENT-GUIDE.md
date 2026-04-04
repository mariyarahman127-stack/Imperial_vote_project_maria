# UniVote - Vercel Deployment Guide

## Files to Upload to GitHub

Upload these files/folders from the `univote` folder:

```
univote/
├── server.js          (main server file)
├── package.json       (dependencies)
├── vercel.json        (Vercel configuration)
├── .gitignore         (ignore node_modules, *.log, .env)
├── index.html         (home page)
├── login.html         (login page)
├── register.html      (registration page)
├── voter-dashboard.html
├── admin-dashboard.html
├── results.html
├── vote.html
├── vote-success.html
├── admin-login.html
├── forgot-password.html
├── create-admin.html
├── vote-link.html
├── js/                (all JavaScript files)
├── css/               (all CSS files)
├── public/           (additional public files)
```

**DO NOT upload:**
- `node_modules/` (will be installed on Vercel)
- `api/` folder (not needed - server.js handles all APIs)
- `index.js` (not used - server.js is the main file)
- `vote/` folder (not needed)
- `*.log` files
- `server.log`
- Any `.md` documentation files

## Step-by-Step Deployment Process

### Step 1: Create GitHub Repository

1. Go to https://github.com and create a new repository
2. Name it: `univote` (or any name you prefer)
3. Set it to **Public**
4. Don't add README (we'll push our code)

### Step 2: Prepare Local Files

In your `univote` folder, create a clean upload package:

```bash
# Create a list of files to include
```

### Step 3: Upload to GitHub

**Option A: Using Git Commands**
```bash
cd "D:\software project final\MY BCS\univote\univote"
git init
git add .
git commit -m "UniVote voting system"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/univote.git
git push -u origin main
```

**Option B: Using GitHub Desktop**
1. Download GitHub Desktop
2. Add local repository
3. Click "Publish"

### Step 4: Deploy to Vercel

1. Go to https://vercel.com
2. Sign up with GitHub
3. Click "Add New Project"
4. Import your GitHub repository
5. Configure:
   - Framework Preset: **Other**
   - Build Command: Leave empty
   - Output Directory: Leave empty
6. Click "Deploy"

### Step 5: Configure Environment Variables (if needed)

In Vercel dashboard, go to Settings > Environment Variables:
- No additional env vars needed (credentials are hardcoded in server.js)

### Step 6: Your App is Live!

After deployment, you'll get a URL like:
`https://univote-xxxxx.vercel.app`

## Firebase Configuration (Already Configured)

The app already has these Firebase settings in server.js:
- Project ID: `univote1-59bd1`
- Database URL: `https://univote1-59bd1-default-rtdb.asia-southeast1.firebasedatabase.app`

These will work automatically on Vercel.

## How Authentication Works

### Registration:
1. User fills registration form
2. Firebase Authentication creates user (saves to Firebase Console > Authentication tab)
3. Server saves user to Realtime Database (registeredUsers node)

### Login:
1. Frontend tries Firebase Authentication first
2. Server validates against database
3. User gets logged in

### Voting:
1. User logs in
2. Selects candidate
3. Vote saved to Firebase Realtime Database

## Testing

After deployment, test:
1. Registration with new email
2. Login with email and password
3. Voting process
4. Results page

## Troubleshooting

**If login/registration fails:**
- Check browser console for errors
- Ensure Firebase project has Email/Password authentication enabled
- Check Firebase Database rules allow read/write

**If API calls fail:**
- Check Vercel function logs
- Verify Firebase database secret is correct

## Important Notes

1. **Firebase Authentication**: Make sure in Firebase Console > Authentication > Sign-in method, "Email/Password" is enabled

2. **Database Rules**: In Firebase Console > Realtime Database > Rules:
```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

3. **All users will share the same Firebase project** (univote1-59bd1)

4. **Votes are stored in Firebase Realtime Database** under `/votes` and `/voters` nodes
