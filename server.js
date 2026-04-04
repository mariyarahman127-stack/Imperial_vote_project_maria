const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files
app.use(express.static(path.join(__dirname, '.')));

// Firebase Configuration
const FIREBASE_PROJECT_ID = 'univote1-59bd1';
const FIREBASE_DB_URL = 'https://univote1-59bd1-default-rtdb.asia-southeast1.firebasedatabase.app';
const FIREBASE_DB_SECRET = 'VpKnONs4KHPRhuc0I79gp0RTf81C2oA45kVQIf9G'; // Replace with your actual Firebase database secret

// In-memory cache for candidates (these don't change)
const candidates = [
    { id: 1, name: 'Swarna Roy', department: 'Lecturer, CSE Department', symbol: '📖', symbolName: 'Book', votes: 0, color: '#e94560' },
    { id: 2, name: 'Sumaiya Akter', department: 'Lecturer, CSE Department', symbol: '🌹', symbolName: 'Rose', votes: 0, color: '#4361ee' },
    { id: 3, name: 'Sohely Sajlin', department: 'Lecturer, CSE Department', symbol: '✈️', symbolName: 'Airplane', votes: 0, color: '#00d9a5' },
    { id: 4, name: 'Mazharul Islam', department: 'Lecturer, CSE Department', symbol: '🥭', symbolName: 'Mango', votes: 0, color: '#ffc107' },
    { id: 5, name: 'Jahangir Polash', department: 'Lecturer, CSE Department', symbol: '🦜', symbolName: 'Parrot', votes: 0, color: '#9c27b0' }
];

// Election config
const election = {
    title: 'Imperial College of Engineering',
    subtitle: 'College President Election 2026',
    status: 'active'
};

// Helper function to make Firebase REST API calls
function firebaseRequest(method, path, data = null) {
    return new Promise((resolve, reject) => {
        const fullUrl = `${FIREBASE_DB_URL}${path}.json?auth=${FIREBASE_DB_SECRET}`;
        const urlObj = new URL(fullUrl);
        
        const options = {
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    console.log(`Firebase ${method} ${path}: Status ${res.statusCode}, Body: ${body.substring(0, 200)}`);
                    // Check HTTP status code for success (2xx)
                    const isSuccess = res.statusCode >= 200 && res.statusCode < 300;
                    if (!isSuccess) {
                        console.error(`Firebase error: Status ${res.statusCode}, Body: ${body}`);
                        resolve(null);
                        return;
                    }
                    if (body === 'null' || body === '') {
                        // For PUT/POST, empty response means success
                        resolve({ success: true });
                    } else if (body.includes('"error"')) {
                        console.error('Firebase error response:', body);
                        resolve(null);
                    } else {
                        resolve(JSON.parse(body));
                    }
                } catch (e) {
                    console.error('Firebase parse error:', e);
                    resolve(null);
                }
            });
        });

        req.on('error', (err) => {
            console.error('Firebase request error:', err.message);
            reject(err);
        });
        
        if (data) {
            req.write(JSON.stringify(data));
        }
        req.end();
    });
}

// Get all votes from Firebase
async function getAllVotes() {
    const data = await firebaseRequest('GET', '/votes');
    if (!data) return [];
    return Object.entries(data).map(([key, value]) => ({
        // Preserve the original 8-digit receipt ID from vote data
        // If id doesn't exist, use Firebase key as fallback
        id: value.id || key,
        ...value
    }));
}

// Get all voters from Firebase
async function getAllVoters() {
    const data = await firebaseRequest('GET', '/voters');
    if (!data) return {};
    return data;
}

// Check if voter has voted in Firebase
async function checkVoterInFirebase(email) {
    const firebaseKey = emailToFirebaseKey(email);
    const voters = await firebaseRequest('GET', '/voters');
    if (voters && voters[firebaseKey]) {
        return voters[firebaseKey];
    }
    return null;
}

// Save vote to Firebase
async function saveVoteToFirebase(voteData) {
    await firebaseRequest('POST', '/votes', voteData);
}

// Save voter to Firebase
async function saveVoterToFirebase(email, voterData) {
    const firebaseKey = emailToFirebaseKey(email);
    await firebaseRequest('PUT', `/voters/${firebaseKey}`, voterData);
}

// API Routes
app.get('/api/election', (req, res) => res.json(election));
app.get('/api/candidates', (req, res) => res.json(candidates));

app.get('/api/results', async (req, res) => {
    try {
        const votes = await getAllVotes();
        const totalVotes = votes.length;
        
        // Calculate votes per candidate
        const voteCounts = {};
        candidates.forEach(c => voteCounts[c.id] = 0);
        votes.forEach(v => {
            if (voteCounts[v.candidateId] !== undefined) {
                voteCounts[v.candidateId]++;
            }
        });
        
        const resultCandidates = candidates.map(c => ({
            ...c,
            votes: voteCounts[c.id] || 0,
            percentage: totalVotes > 0 ? Math.round((voteCounts[c.id] / totalVotes) * 100) : 0
        })).sort((a, b) => b.votes - a.votes);
        
        const isTied = resultCandidates.length >= 2 && resultCandidates[0].votes === resultCandidates[1].votes && resultCandidates[0].votes > 0;
        res.json({ candidates: resultCandidates, totalVotes, isTied });
    } catch (error) {
        console.error('Error fetching results:', error);
        res.json({ candidates: [], totalVotes: 0, isTied: false });
    }
});

app.post('/api/vote', async (req, res) => {
    const { email, candidateId, voteId } = req.body;
    if (!email || !candidateId) {
        return res.status(400).json({ success: false, message: 'Email and candidate required' });
    }
    
    const emailLower = email.toLowerCase();
    
    try {
        // Check if user is registered in Firebase
        const registeredUsers = await firebaseRequest('GET', '/registeredUsers');
        const firebaseKey = emailToFirebaseKey(emailLower);
        const isRegistered = registeredUsers && registeredUsers[firebaseKey];
        
        // Check if already voted in Firebase - check voters node
        const existingVoter = await checkVoterInFirebase(emailLower);
        if (existingVoter) {
            return res.status(400).json({ success: false, message: 'Already voted', hasVoted: true, votedFor: existingVoter.votedFor });
        }
        
        // Also check votes node in Firebase
        const allVotes = await getAllVotes();
        const alreadyVoted = allVotes.some(v => v.userEmail && v.userEmail.toLowerCase() === emailLower);
        if (alreadyVoted) {
            return res.status(400).json({ success: false, message: 'Already voted', hasVoted: true });
        }
        
        // If user is NOT in registeredUsers but also NOT in voters/votes, allow them to vote
        // This handles the case where admin deleted user from all three places
        if (!isRegistered) {
            // User is not registered AND not voted - they can vote after registering in this session
            // Allow them to proceed - they will be registered when they vote
        }
        
        const candidate = candidates.find(c => c.id === candidateId);
        if (!candidate) {
            return res.status(400).json({ success: false, message: 'Candidate not found' });
        }
        
        // Use the 8-digit voteId from frontend, or generate one if not provided
        const finalVoteId = voteId || Date.now().toString().slice(-8);
        
        // Save vote to Firebase
        const voteData = {
            id: finalVoteId,
            userEmail: emailLower,
            candidateId: candidate.id,
            candidateName: candidate.name,
            candidateDepartment: candidate.department,
            candidateSymbol: candidate.symbol,
            candidateSymbolName: candidate.symbolName,
            timestamp: new Date().toISOString(),
            timestampRaw: Date.now()
        };
        await saveVoteToFirebase(voteData);
        
        // Save voter to Firebase
        await saveVoterToFirebase(emailLower, {
            hasVoted: true,
            votedFor: candidate.symbol + ' ' + candidate.name,
            voteId: finalVoteId,
            timestamp: new Date().toISOString()
        });
        
        // If user was not in registeredUsers, add them now (for deleted users who are re-voting)
        if (!isRegistered) {
            await firebaseRequest('PUT', '/registeredUsers/' + firebaseKey, {
                email: emailLower,
                name: 'Registered via voting',
                studentId: 'N/A',
                department: 'N/A',
                registeredAt: new Date().toISOString(),
                registeredVia: 'vote'
            });
        }
        
        const isTied = false; // Will be recalculated on results
        
        res.json({ success: true, message: 'Vote recorded!', voteId: finalVoteId, tie: isTied });
    } catch (error) {
        console.error('Error saving vote:', error);
        res.status(500).json({ success: false, message: 'Failed to save vote' });
    }
});

app.get('/api/check-vote/:email', async (req, res) => {
    try {
        const emailLower = req.params.email.toLowerCase();
        
        // Check Firebase voters node using the Firebase key format
        const existingVoter = await checkVoterInFirebase(emailLower);
        if (existingVoter) {
            console.log('Found voter in Firebase:', emailLower, existingVoter);
            res.json({ hasVoted: true, votedFor: existingVoter.votedFor, voteId: existingVoter.voteId });
            return;
        }
        
        // Also check Firebase votes node
        const allVotes = await getAllVotes();
        const voteFound = allVotes.find(v => v.userEmail && v.userEmail.toLowerCase() === emailLower);
        if (voteFound) {
            console.log('Found vote in Firebase:', emailLower, voteFound);
            res.json({ hasVoted: true, votedFor: voteFound.candidateSymbol + ' ' + voteFound.candidateName, voteId: voteFound.id });
            return;
        }
        
        console.log('No vote found for:', emailLower);
        res.json({ hasVoted: false });
    } catch (error) {
        console.error('Error checking vote:', error);
        res.json({ hasVoted: false });
    }
});

// Helper function to create a valid Firebase key from email
function emailToFirebaseKey(email) {
    return email.toLowerCase().replace(/@/g, '_at_').replace(/\./g, '_dot_');
}

// API endpoint for user registration
app.post('/api/register', async (req, res) => {
    const { email, name, studentId, department, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email and password required' });
    }
    
    const emailLower = email.toLowerCase();
    const firebaseKey = emailToFirebaseKey(emailLower);
    
    try {
        // Check if user already exists in Firebase
        const registeredUsers = await firebaseRequest('GET', '/registeredUsers');
        if (registeredUsers && registeredUsers[firebaseKey]) {
            return res.status(400).json({ success: false, message: 'Email already registered' });
        }
        
        // Also check if user has already voted (cannot register after voting)
        const existingVoter = await checkVoterInFirebase(emailLower);
        if (existingVoter) {
            return res.status(400).json({ success: false, message: 'This email has already voted. Cannot register again.' });
        }
        
        // Save to Firebase in a separate "registeredUsers" node
        const result = await firebaseRequest('PUT', '/registeredUsers/' + firebaseKey, {
            email: emailLower,
            name: name,
            studentId: studentId,
            department: department,
            password: password,
            role: 'voter',
            registeredAt: new Date().toISOString()
        });
        
        if (!result) {
            console.error('Failed to save user to Firebase');
            return res.status(500).json({ success: false, message: 'Registration failed - could not save to database' });
        }
        
        res.json({ success: true, message: 'Registration successful' });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ success: false, message: 'Registration failed' });
    }
});

// API endpoint to get user info
app.get('/api/user/:email', async (req, res) => {
    try {
        const emailLower = req.params.email.toLowerCase();
        const firebaseKey = emailToFirebaseKey(emailLower);
        // Check registered users node
        const registeredUsers = await firebaseRequest('GET', '/registeredUsers');
        if (registeredUsers && registeredUsers[firebaseKey]) {
            res.json({ exists: true, user: registeredUsers[firebaseKey] });
        } else {
            res.json({ exists: false });
        }
    } catch (error) {
        console.error('Error getting user:', error);
        res.json({ exists: false });
    }
});

app.get('/api/admin/votes', async (req, res) => {
    try {
        const votes = await getAllVotes();
        res.json(votes);
    } catch (error) {
        console.error('Error fetching votes:', error);
        res.json([]);
    }
});

app.post('/api/casting-vote', (req, res) => {
    const { adminKey, candidateId } = req.body;
    if (adminKey !== 'admin2026casting') {
        return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    const candidate = candidates.find(c => c.id === candidateId);
    if (!candidate) {
        return res.status(400).json({ success: false, message: 'Candidate not found' });
    }
    // Note: Casting votes should also be saved to Firebase
    res.json({ success: true, message: `Casting vote for ${candidate.name}`, winner: candidate });
});

// Admin endpoint to reset all votes
app.post('/api/admin/reset-votes', async (req, res) => {
    const { adminKey } = req.body;
    if (adminKey !== 'admin2026') {
        return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    
    try {
        // Delete all votes from Firebase
        await firebaseRequest('DELETE', '/votes');
        // Note: We do NOT delete voters collection to preserve admin user data
        
        res.json({ success: true, message: 'All votes have been reset' });
    } catch (error) {
        console.error('Error resetting votes:', error);
        res.status(500).json({ success: false, message: 'Failed to reset votes' });
    }
});

// Admin endpoint to delete a specific user's registration
app.delete('/api/admin/user/:email', async (req, res) => {
    const { adminKey } = req.query;
    if (adminKey !== 'admin2026') {
        return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    
    const emailLower = req.params.email.toLowerCase();
    const firebaseKey = emailToFirebaseKey(emailLower);
    
    try {
        // Delete user from registeredUsers
        await firebaseRequest('DELETE', '/registeredUsers/' + firebaseKey);
        
        res.json({ success: true, message: 'User registration deleted' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ success: false, message: 'Failed to delete user' });
    }
});

// Admin endpoint to delete a user's vote (allows them to vote again)
app.delete('/api/admin/vote/:email', async (req, res) => {
    const { adminKey } = req.query;
    if (adminKey !== 'admin2026') {
        return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    
    const emailLower = req.params.email.toLowerCase();
    const firebaseKey = emailToFirebaseKey(emailLower);
    
    try {
        // Delete from voters node
        await firebaseRequest('DELETE', '/voters/' + firebaseKey);
        
        // Also delete from votes node (find and delete the vote)
        const allVotes = await getAllVotes();
        const voteToDelete = allVotes.find(v => v.userEmail && v.userEmail.toLowerCase() === emailLower);
        
        if (voteToDelete) {
            // Delete using the Firebase key
            await firebaseRequest('DELETE', '/votes/' + voteToDelete.id);
        }
        
        res.json({ success: true, message: 'Vote deleted - user can vote again' });
    } catch (error) {
        console.error('Error deleting vote:', error);
        res.status(500).json({ success: false, message: 'Failed to delete vote' });
    }
});

// Admin endpoint to delete both user registration and vote
app.delete('/api/admin/reset-user/:email', async (req, res) => {
    const { adminKey } = req.query;
    if (adminKey !== 'admin2026') {
        return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    
    const emailLower = req.params.email.toLowerCase();
    const firebaseKey = emailToFirebaseKey(emailLower);
    
    try {
        // Delete user from registeredUsers
        await firebaseRequest('DELETE', '/registeredUsers/' + firebaseKey);
        
        // Delete from voters node
        await firebaseRequest('DELETE', '/voters/' + firebaseKey);
        
        // Also delete from votes node
        const allVotes = await getAllVotes();
        const voteToDelete = allVotes.find(v => v.userEmail && v.userEmail.toLowerCase() === emailLower);
        
        if (voteToDelete) {
            await firebaseRequest('DELETE', '/votes/' + voteToDelete.id);
        }
        
        res.json({ success: true, message: 'User and vote data deleted - user can register and vote again' });
    } catch (error) {
        console.error('Error resetting user:', error);
        res.status(500).json({ success: false, message: 'Failed to reset user data' });
    }
});

// Handle static files (js, css, images) BEFORE the catch-all
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/images', express.static(path.join(__dirname, 'images')));

// Serve root static files
app.use(express.static(path.join(__dirname, '.')));

// Handle SPA routing - ONLY for HTML pages that don't exist
app.get('*', (req, res) => {
    const ext = path.extname(req.path);
    if (!ext || ext === '.html') {
        res.sendFile(path.join(__dirname, 'index.html'));
    } else {
        res.status(404).send('Not found');
    }
});

app.listen(PORT, () => {
    console.log(`UniVote server running on http://localhost:${PORT}`);
});

module.exports = app;
