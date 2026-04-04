// =====================================================
// Firebase Service Module
// Handles all Realtime Database operations
// =====================================================

const FirebaseService = {
    // Collection name for votes (node in Realtime DB)
    VOTES_NODE: 'votes',

    // Initialize Realtime Database
    init: function() {
        if (typeof firebase === 'undefined') {
            console.warn('Firebase SDK not loaded. Using localStorage fallback.');
            return false;
        }
        
        try {
            if (firebase.apps.length === 0) {
                initializeFirebase();
            }
            
            if (!window.firebaseDb) {
                window.firebaseDb = firebase.database();
            }
            
            return window.firebaseDb !== null;
        } catch (e) {
            console.error('Firebase init error:', e);
            return false;
        }
    },

    // Save a vote to Realtime Database
    saveVote: async function(voteData) {
        const self = this;
        
        if (!self.init() || !window.firebaseDb) {
            // Fallback to localStorage
            return self.saveVoteLocal(voteData);
        }

        try {
            const votesRef = window.firebaseDb.ref(self.VOTES_NODE);
            // Use Receipt ID as the Firebase key instead of push()
            const voteRef = votesRef.child(voteData.id);
            
            await voteRef.set({
                id: voteData.id,
                userEmail: voteData.userEmail.toLowerCase(),
                candidateId: voteData.candidateId,
                candidateName: voteData.candidateName,
                candidateDepartment: voteData.candidateDepartment,
                candidateSymbol: voteData.candidateSymbol,
                candidateSymbolName: voteData.candidateSymbolName,
                timestamp: firebase.database.ServerValue.TIMESTAMP,
                timestampRaw: Date.now()
            });
            
            console.log('Vote saved to Realtime Database with Receipt ID:', voteData.id);
            return { success: true, id: voteData.id };
        } catch (error) {
            console.error('Error saving vote to Realtime Database:', error);
            // Fallback to localStorage
            return self.saveVoteLocal(voteData);
        }
    },

    // Fallback: Save vote to localStorage
    saveVoteLocal: function(voteData) {
        const votes = JSON.parse(localStorage.getItem('votes') || '[]');
        votes.push({
            id: Date.now(),
            ...voteData,
            timestamp: Date.now(),
            timestampRaw: Date.now()
        });
        localStorage.setItem('votes', JSON.stringify(votes));
        console.log('Vote saved to localStorage (fallback)');
        return { success: true, id: Date.now() };
    },

    // Check if an email has already voted
    checkDuplicateVote: async function(email) {
        const self = this;
        
        if (!self.init() || !window.firebaseDb) {
            // Fallback to localStorage
            return self.checkDuplicateVoteLocal(email);
        }

        try {
            const snapshot = await window.firebaseDb.ref(self.VOTES_NODE)
                .orderByChild('userEmail')
                .equalTo(email.toLowerCase())
                .limit(1)
                .once('value');
            
            return snapshot.exists() && snapshot.val() !== null;
        } catch (error) {
            console.error('Error checking duplicate vote in Realtime Database:', error);
            // Fallback to localStorage
            return self.checkDuplicateVoteLocal(email);
        }
    },

    // Fallback: Check localStorage for duplicate vote
    checkDuplicateVoteLocal: function(email) {
        const votes = JSON.parse(localStorage.getItem('votes') || '[]');
        return votes.some(v => v.userEmail && v.userEmail.toLowerCase() === email.toLowerCase());
    },

    // Get all votes from Realtime Database
    getAllVotes: async function() {
        const self = this;
        
        if (!self.init() || !window.firebaseDb) {
            // Fallback to localStorage
            return self.getAllVotesLocal();
        }

        try {
            const snapshot = await window.firebaseDb.ref(self.VOTES_NODE)
                .orderByChild('timestampRaw')
                .once('value');
            
            const votes = [];
            if (snapshot.exists()) {
                snapshot.forEach(childSnapshot => {
                    const vote = childSnapshot.val();
                    // Preserve the original 8-digit receipt ID from vote data
                    // If id doesn't exist, use Firebase key as fallback
                    if (!vote.id) {
                        vote.id = childSnapshot.key;
                    }
                    votes.push(vote);
                });
            }
            
            // Sort by timestamp descending
            return votes.sort((a, b) => (b.timestampRaw || 0) - (a.timestampRaw || 0));
        } catch (error) {
            console.error('Error getting votes from Realtime Database:', error);
            // Fallback to localStorage
            return self.getAllVotesLocal();
        }
    },

    // Fallback: Get all votes from localStorage
    getAllVotesLocal: function() {
        const votes = JSON.parse(localStorage.getItem('votes') || '[]');
        return votes.sort((a, b) => b.timestampRaw - a.timestampRaw);
    },

    // Get vote count
    getVoteCount: async function() {
        const self = this;
        
        if (!self.init() || !window.firebaseDb) {
            const votes = JSON.parse(localStorage.getItem('votes') || '[]');
            return votes.length;
        }

        try {
            const snapshot = await window.firebaseDb.ref(self.VOTES_NODE)
                .once('value');
            return snapshot.numChildren();
        } catch (error) {
            console.error('Error getting vote count:', error);
            const votes = JSON.parse(localStorage.getItem('votes') || '[]');
            return votes.length;
        }
    },

    // Clear all votes (admin function)
    clearAllVotes: async function() {
        const self = this;
        
        if (!self.init() || !window.firebaseDb) {
            localStorage.removeItem('votes');
            return { success: true };
        }

        try {
            await window.firebaseDb.ref(self.VOTES_NODE).remove();
            return { success: true };
        } catch (error) {
            console.error('Error clearing votes:', error);
            localStorage.removeItem('votes');
            return { success: true };
        }
    },

    // Real-time listener for votes (for admin dashboard)
    onVotesChange: function(callback) {
        const self = this;
        
        if (!self.init() || !window.firebaseDb) {
            // Fallback to localStorage
            const votes = self.getAllVotesLocal();
            callback(votes);
            return;
        }

        try {
            window.firebaseDb.ref(self.VOTES_NODE)
                .orderByChild('timestampRaw')
                .on('value', (snapshot) => {
                    const votes = [];
                    if (snapshot.exists()) {
                        snapshot.forEach(childSnapshot => {
                            const vote = childSnapshot.val();
                            // Preserve the original 8-digit receipt ID from vote data
                            // If id doesn't exist, use Firebase key as fallback
                            if (!vote.id) {
                                vote.id = childSnapshot.key;
                            }
                            votes.push(vote);
                        });
                    }
                    // Sort by timestamp descending
                    const sortedVotes = votes.sort((a, b) => (b.timestampRaw || 0) - (a.timestampRaw || 0));
                    callback(sortedVotes);
                });
        } catch (error) {
            console.error('Error setting up real-time listener:', error);
            const votes = self.getAllVotesLocal();
            callback(votes);
        }
    },

    // Remove real-time listener
    offVotesChange: function() {
        if (window.firebaseDb) {
            window.firebaseDb.ref(this.VOTES_NODE).off();
        }
    }
};

// Export to global scope
window.FirebaseService = FirebaseService;
