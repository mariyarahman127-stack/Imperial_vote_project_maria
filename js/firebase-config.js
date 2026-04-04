// =====================================================
// Firebase Configuration
// UniVote Project - Realtime Database & Authentication
// =====================================================

const firebaseConfig = {
    apiKey: "AIzaSyA6wYd8QJ_fRpi4jFT9PAEsdj7sKZO7Fno",
    authDomain: "univote1-59bd1.firebaseapp.com",
    databaseURL: "https://univote1-59bd1-default-rtdb.asia-southeast1.firebasedatabase.app/",
    projectId: "univote1-59bd1",
    storageBucket: "univote1-59bd1.firebasestorage.app",
    messagingSenderId: "171480179267",
    appId: "1:171480179267:web:9bab916dc182b643b9eaf6"
};

// =====================================================
// Initialize Firebase
// =====================================================

let db = null;
let firebaseApp = null;
let firebaseAuth = null;

function initializeFirebase() {
    if (typeof firebase === 'undefined') {
        console.warn('Firebase SDK not loaded');
        return false;
    }
    
    try {
        // Check if already initialized
        if (firebase.apps.length > 0) {
            db = firebase.database();
            firebaseAuth = firebase.auth();
            return true;
        }
        
        // Initialize Firebase
        firebaseApp = firebase.initializeApp(firebaseConfig);
        db = firebase.database(firebaseApp);
        firebaseAuth = firebase.auth(firebaseApp);
        console.log('Firebase Realtime Database and Authentication initialized successfully');
        return true;
    } catch (error) {
        console.error('Firebase initialization error:', error);
        return false;
    }
}

// Initialize immediately
initializeFirebase();

// Export for use in other files
window.firebaseDb = db;
window.firebaseApp = firebaseApp;
window.firebaseAuth = firebaseAuth;
window.initializeFirebase = initializeFirebase;
