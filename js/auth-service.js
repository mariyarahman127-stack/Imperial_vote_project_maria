// =====================================================
// Firebase Authentication Service
// UniVote Project - Secure Authentication
// =====================================================

const AuthService = {
    // Current user state
    currentUser: null,

    // Initialize authentication state listener
    init: function() {
        if (typeof firebase === 'undefined' || !firebase.auth) {
            console.warn('Firebase Auth not available');
            return;
        }

        // Listen for authentication state changes
        firebase.auth().onAuthStateChanged((user) => {
            if (user) {
                this.currentUser = {
                    uid: user.uid,
                    email: user.email,
                    emailVerified: user.emailVerified
                };
                console.log('User authenticated:', user.email);
            } else {
                this.currentUser = null;
                console.log('User signed out');
            }
        });
    },

    // Validate password strength
    validatePassword: function(password) {
        const errors = [];
        
        if (password.length < 8) {
            errors.push('at least 8 characters');
        }
        if (!/[A-Z]/.test(password)) {
            errors.push('at least one uppercase letter');
        }
        if (!/[a-z]/.test(password)) {
            errors.push('at least one lowercase letter');
        }
        if (!/[0-9]/.test(password)) {
            errors.push('at least one number');
        }
        if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
            errors.push('at least one special character (!@#$%^&*()_+-=[]{};\':"\\|,.<>/?)');
        }
        
        return errors;
    },

    // Register a new user with email and password
    register: async function(email, password, name, studentId, department) {
        try {
            // Validate password strength
            const passwordErrors = this.validatePassword(password);
            if (passwordErrors.length > 0) {
                return { 
                    success: false, 
                    error: 'Password must contain: ' + passwordErrors.join(', ') 
                };
            }

            // Create user with email and password
            const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;

            // Update user profile with name
            await user.updateProfile({
                displayName: name
            });

            // Save additional user data to database under registeredUsers node using studentId as key
            await this.saveUserData(studentId, {
                uid: user.uid,
                email: email.toLowerCase(),
                name: name,
                studentId: studentId,
                department: department,
                role: 'voter',
                hasVoted: false,
                createdAt: firebase.database.ServerValue.TIMESTAMP
            });

            console.log('User registered successfully:', email);
            return { success: true, user: user };
        } catch (error) {
            console.error('Registration error:', error);
            return { success: false, error: this.getErrorMessage(error.code) };
        }
    },

    // Sign in with email and password
    login: async function(email, password) {
        try {
            const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
            const user = userCredential.user;

            // Get user data from database using UID
            const userData = await this.getUserDataByUid(user.uid);
            
            // Check if user data exists in registeredUsers node
            if (!userData) {
                console.error('User data not found in registeredUsers node');
                await firebase.auth().signOut(); // Sign out the user
                return { success: false, error: 'User account not found. Please register first.' };
            }

            console.log('User logged in successfully:', email);
            return { 
                success: true, 
                user: {
                    uid: user.uid,
                    email: user.email,
                    name: userData.name || user.displayName || email.split('@')[0],
                    studentId: userData.studentId || '',
                    department: userData.department || '',
                    role: userData.role || 'voter',
                    hasVoted: userData.hasVoted || false
                }
            };
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, error: this.getErrorMessage(error.code) };
        }
    },

    // Sign out current user
    logout: async function() {
        try {
            await firebase.auth().signOut();
            this.currentUser = null;
            localStorage.removeItem('currentUser');
            console.log('User logged out successfully');
            return { success: true };
        } catch (error) {
            console.error('Logout error:', error);
            return { success: false, error: error.message };
        }
    },

    // Get current authenticated user
    getCurrentUser: function() {
        return firebase.auth().currentUser;
    },

    // Check if user is authenticated
    isAuthenticated: function() {
        return firebase.auth().currentUser !== null;
    },

    // Save user data to database under registeredUsers node
    saveUserData: async function(key, userData) {
        try {
            await firebase.database().ref('registeredUsers/' + key).set(userData);
            console.log('User data saved to registeredUsers node with key:', key);
            return { success: true };
        } catch (error) {
            console.error('Error saving user data:', error);
            return { success: false, error: error.message };
        }
    },

    // Get user data from database from registeredUsers node
    getUserData: async function(key) {
        try {
            const snapshot = await firebase.database().ref('registeredUsers/' + key).once('value');
            return snapshot.val();
        } catch (error) {
            console.error('Error getting user data:', error);
            return null;
        }
    },
    
    // Get user data by UID (searches through all users)
    getUserDataByUid: async function(uid) {
        try {
            const snapshot = await firebase.database().ref('registeredUsers').orderByChild('uid').equalTo(uid).once('value');
            let userData = null;
            snapshot.forEach((childSnapshot) => {
                userData = childSnapshot.val();
            });
            return userData;
        } catch (error) {
            console.error('Error getting user data by UID:', error);
            return null;
        }
    },

    // Update user data in database in registeredUsers node
    updateUserData: async function(key, updates) {
        try {
            await firebase.database().ref('registeredUsers/' + key).update(updates);
            console.log('User data updated for key:', key);
            return { success: true };
        } catch (error) {
            console.error('Error updating user data:', error);
            return { success: false, error: error.message };
        }
    },
    
    // Update user data by UID (searches through all users)
    updateUserDataByUid: async function(uid, updates) {
        try {
            const snapshot = await firebase.database().ref('registeredUsers').orderByChild('uid').equalTo(uid).once('value');
            let updated = false;
            snapshot.forEach((childSnapshot) => {
                childSnapshot.ref.update(updates);
                updated = true;
            });
            if (updated) {
                console.log('User data updated by UID:', uid);
                return { success: true };
            } else {
                return { success: false, error: 'User not found' };
            }
        } catch (error) {
            console.error('Error updating user data by UID:', error);
            return { success: false, error: error.message };
        }
    },

    // Mark user as voted
    markAsVoted: async function(uid) {
        try {
            await this.updateUserDataByUid(uid, {
                hasVoted: true,
                votedAt: firebase.database.ServerValue.TIMESTAMP
            });
            console.log('User marked as voted');
            return { success: true };
        } catch (error) {
            console.error('Error marking user as voted:', error);
            return { success: false, error: error.message };
        }
    },

    // Check if user has voted
    hasUserVoted: async function(uid) {
        try {
            const userData = await this.getUserDataByUid(uid);
            return userData?.hasVoted || false;
        } catch (error) {
            console.error('Error checking vote status:', error);
            return false;
        }
    },

    // Get all users (admin function) from registeredUsers node
    getAllUsers: async function() {
        try {
            const snapshot = await firebase.database().ref('registeredUsers').once('value');
            const users = [];
            snapshot.forEach((childSnapshot) => {
                users.push({
                    uid: childSnapshot.key,
                    ...childSnapshot.val()
                });
            });
            return users;
        } catch (error) {
            console.error('Error getting all users:', error);
            return [];
        }
    },

    // Convert Firebase error codes to user-friendly messages
    getErrorMessage: function(errorCode) {
        const errorMessages = {
            'auth/email-already-in-use': 'This email is already registered. Please login instead.',
            'auth/invalid-email': 'Invalid email address format.',
            'auth/operation-not-allowed': 'Email/password accounts are not enabled. Please enable Email/Password authentication in Firebase Console.',
            'auth/weak-password': 'Password is too weak. Please use at least 6 characters.',
            'auth/user-disabled': 'This account has been disabled.',
            'auth/user-not-found': 'No account found with this email.',
            'auth/wrong-password': 'Incorrect password.',
            'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
            'auth/network-request-failed': 'Network error. Please check your connection.'
        };
        return errorMessages[errorCode] || 'An error occurred. Please try again.';
    },

    // Reset password
    resetPassword: async function(email) {
        try {
            await firebase.auth().sendPasswordResetEmail(email);
            console.log('Password reset email sent');
            return { success: true };
        } catch (error) {
            console.error('Password reset error:', error);
            return { success: false, error: this.getErrorMessage(error.code) };
        }
    }
};

// Initialize auth service when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        AuthService.init();
    });
} else {
    AuthService.init();
}

// Export to global scope
window.AuthService = AuthService;
