@echo off
echo ========================================
echo Firebase Database Rules Deployment
echo ========================================
echo.
echo This script will deploy your database rules to Firebase.
echo.
echo Prerequisites:
echo 1. Firebase CLI must be installed: npm install -g firebase-tools
echo 2. You must be logged in to Firebase: firebase login
echo.
echo ========================================
echo.
pause
echo.
echo Deploying database rules...
firebase deploy --only database
echo.
echo ========================================
echo Deployment complete!
echo.
echo If you see "Permission denied" errors, please:
echo 1. Make sure you're logged in: firebase login
echo 2. Make sure you're in the correct project: firebase use univote1-59bd1
echo 3. Try deploying again: firebase deploy --only database
echo ========================================
pause
