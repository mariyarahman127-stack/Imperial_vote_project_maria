const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const https = require('https');
const fs = require('fs');

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
const FIREBASE_DB_SECRET = 'VpKnONs4KHPRhuc0I79gp0RTf81C2oA45kVQIf9G';

// File to store candidates - EDIT THIS FILE TO CHANGE CANDIDATES
const CANDIDATES_FILE = path.join(__dirname, 'candidates.json');

// Load candidates from file
function loadCandidatesFromFile() {
    try {
        if (fs.existsSync(CANDIDATES_FILE)) {
            const data = fs.readFileSync(CANDIDATES_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch(e) {
        console.log('Error loading candidates file:', e.message);
    }
    return null;
}

// Save candidates to file
function saveCandidatesToFile(candidates) {
    try {
        fs.writeFileSync(CANDIDATES_FILE, JSON.stringify(candidates, null, 4));
        return true;
    } catch(e) {
        console.log('Error saving candidates file:', e.message);
        return false;
    }
}

// Get candidates - ALWAYS reads fresh from file
function getCandidates() {
    const candidates = loadCandidatesFromFile();
    // Add votes: 0 to each candidate if not present, preserve all fields
    if (candidates) {
        return candidates.map(c => ({
            ...c, 
            votes: c.votes || 0,
            department: c.department || '',
            symbolName: c.symbolName || '',
            color: c.color || '#2563eb'
        }));
    }
    return [];
}

function normalizeCandidate(candidate) {
    const id = Number(candidate && candidate.id);
    if (!Number.isFinite(id) || id <= 0) return null;
    const name = String((candidate && candidate.name) || '').trim();
    const department = String((candidate && candidate.department) || '').trim();
    const symbol = String((candidate && candidate.symbol) || '').trim();
    const symbolName = String((candidate && candidate.symbolName) || '').trim();
    const color = String((candidate && candidate.color) || '#2563eb').trim();
    if (!name || !department || !symbol || !symbolName) return null;
    return { id, name, department, symbol, symbolName, color, votes: 0 };
}

function normalizeCandidateList(rawCandidates) {
    const list = [];
    if (Array.isArray(rawCandidates)) {
        for (const candidate of rawCandidates) {
            const normalized = normalizeCandidate(candidate);
            if (normalized) list.push(normalized);
        }
    } else if (rawCandidates && typeof rawCandidates === 'object') {
        for (const candidate of Object.values(rawCandidates)) {
            const normalized = normalizeCandidate(candidate);
            if (normalized) list.push(normalized);
        }
    }
    return list.sort((a, b) => a.id - b.id);
}

function toCandidateMap(candidateList) {
    const map = {};
    for (const candidate of candidateList) {
        map[String(candidate.id)] = candidate;
    }
    return map;
}

async function getCandidatesFromStore() {
    // Read from candidates.json file - edits in admin panel will update this file
    return getCandidates();
}

async function saveCandidatesToStore(candidateList) {
    const normalized = normalizeCandidateList(candidateList);
    if (normalized.length === 0) {
        throw new Error('At least one candidate is required');
    }
    // Save to file - this makes changes persist everywhere
    saveCandidatesToFile(normalized);
    cachedCandidates = normalized;
    return normalized;
}
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
app.get('/api/candidates', async (req, res) => {
    try {
        // ALWAYS load fresh from file - no caching
        const candidates = loadCandidatesFromFile();
        if (candidates && candidates.length > 0) {
            const processed = candidates.map(c => ({
                ...c,
                votes: c.votes || 0,
                department: c.department || '',
                symbolName: c.symbolName || '',
                color: c.color || '#2563eb'
            }));
            res.json(processed);
        } else {
            res.json(DEFAULT_CANDIDATES);
        }
    } catch (error) {
        console.error('Error fetching candidates:', error);
        res.json(DEFAULT_CANDIDATES);
    }
});

app.get('/api/results', async (req, res) => {
    try {
        const votes = await getAllVotes();
        const candidates = await getCandidatesFromStore();
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
            id: c.id,
            name: c.name,
            department: c.department || '',
            symbol: c.symbol || '',
            symbolName: c.symbolName || '',
            color: c.color || '#2563eb',
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
        const candidates = await getCandidatesFromStore();
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
        // Check if user already exists in Firebase by email
        const registeredUsers = await firebaseRequest('GET', '/registeredUsers');
        if (registeredUsers && registeredUsers[firebaseKey]) {
            return res.status(400).json({ success: false, message: 'This email is already registered' });
        }
        
        // Check if studentId is already registered
        if (registeredUsers) {
            const studentIdExists = Object.values(registeredUsers).some(user => 
                user.studentId && user.studentId.toString() === studentId.toString()
            );
            if (studentIdExists) {
                return res.status(400).json({ success: false, message: 'This Student ID is already registered' });
            }
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

app.get('/api/admin/candidates', async (req, res) => {
    const { adminKey } = req.query;
    if (adminKey !== 'admin2026') {
        return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    try {
        const candidates = await getCandidatesFromStore();
        return res.json({ success: true, candidates });
    } catch (error) {
        console.error('Error loading admin candidates:', error);
        return res.status(500).json({ success: false, message: 'Failed to load candidates' });
    }
});

app.post('/api/admin/candidates', async (req, res) => {
    const { adminKey, name, department, symbol, symbolName, color } = req.body || {};
    if (adminKey !== 'admin2026') {
        return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    if (!name || !department || !symbol || !symbolName) {
        return res.status(400).json({ success: false, message: 'name, department, symbol, symbolName are required' });
    }
    try {
        const candidates = await getCandidatesFromStore();
        const normalizedName = String(name).trim().toLowerCase();
        const normalizedSymbol = String(symbol).trim();
        const exists = candidates.some((c) => c.name.toLowerCase() === normalizedName || c.symbol === normalizedSymbol);
        if (exists) {
            return res.status(400).json({ success: false, message: 'Candidate with same name or symbol already exists' });
        }

        const nextId = candidates.reduce((maxId, c) => Math.max(maxId, Number(c.id) || 0), 0) + 1;
        const newCandidate = {
            id: nextId,
            name: String(name).trim(),
            department: String(department).trim(),
            symbol: String(symbol).trim(),
            symbolName: String(symbolName).trim(),
            color: String(color || '#2563eb').trim(),
            votes: 0
        };

        const updated = await saveCandidatesToStore([...candidates, newCandidate]);
        return res.json({ success: true, message: 'Candidate added', candidate: newCandidate, candidates: updated });
    } catch (error) {
        console.error('Error adding candidate:', error);
        return res.status(500).json({ success: false, message: 'Failed to add candidate' });
    }
});

app.delete('/api/admin/candidates/:id', async (req, res) => {
    const { adminKey } = req.query;
    if (adminKey !== 'admin2026') {
        return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const candidateId = Number(req.params.id);
    if (!Number.isFinite(candidateId) || candidateId <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid candidate id' });
    }

    try {
        const candidates = await getCandidatesFromStore();
        const target = candidates.find((c) => c.id === candidateId);
        if (!target) {
            return res.status(404).json({ success: false, message: 'Candidate not found' });
        }
        if (candidates.length <= 2) {
            return res.status(400).json({ success: false, message: 'At least 2 candidates are required' });
        }

        const votes = await getAllVotes();
        const hasVotes = (votes || []).some((v) => Number(v.candidateId) === candidateId);
        if (hasVotes) {
            return res.status(400).json({ success: false, message: 'Cannot delete candidate with existing votes' });
        }

        const updated = await saveCandidatesToStore(candidates.filter((c) => c.id !== candidateId));
        return res.json({ success: true, message: 'Candidate deleted', deletedId: candidateId, candidates: updated });
    } catch (error) {
        console.error('Error deleting candidate:', error);
        return res.status(500).json({ success: false, message: 'Failed to delete candidate' });
    }
});

// Debug endpoint to list registered users (compat with admin dashboard)
app.get('/api/debug/users', async (req, res) => {
    try {
        const users = await firebaseRequest('GET', '/registeredUsers');
        res.json(users || {});
    } catch (error) {
        console.error('Debug users error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/casting-vote', async (req, res) => {
    const { adminKey, candidateId } = req.body;
    if (adminKey !== 'admin2026casting') {
        return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    const candidates = await getCandidatesFromStore();
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

// Admin endpoint to delete a registered user by studentId key (with optional email fallback)
app.delete('/api/admin/registered-user/:studentId', async (req, res) => {
    const { adminKey, email } = req.query;
    if (adminKey !== 'admin2026') {
        return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const studentId = String(req.params.studentId || '').trim();
    const emailLower = String(email || '').toLowerCase().trim();

    if (!studentId && !emailLower) {
        return res.status(400).json({ success: false, message: 'Student ID or email is required' });
    }

    try {
        const users = await firebaseRequest('GET', '/registeredUsers');
        const usersMap = users && typeof users === 'object' && !users.success ? users : {};
        let deleteKey = null;

        if (studentId && usersMap[studentId]) {
            deleteKey = studentId;
        } else {
            const matchedEntry = Object.entries(usersMap).find(([key, user]) => {
                const keyNormalized = String(key || '').toLowerCase().trim();
                const userEmail = String((user && user.email) || '').toLowerCase().trim();
                const userSid = String((user && user.studentId) || '').trim();
                const sidMatch = studentId && (userSid === studentId || keyNormalized === studentId.toLowerCase());
                const emailMatch = emailLower && (userEmail === emailLower || keyNormalized === emailLower);
                return sidMatch || emailMatch;
            });
            if (matchedEntry) deleteKey = matchedEntry[0];
        }

        if (!deleteKey) {
            return res.status(404).json({ success: false, message: 'Registered user not found' });
        }

        await firebaseRequest('DELETE', '/registeredUsers/' + deleteKey);

        const afterDelete = await firebaseRequest('GET', '/registeredUsers');
        const afterMap = afterDelete && typeof afterDelete === 'object' && !afterDelete.success ? afterDelete : {};
        if (afterMap[deleteKey]) {
            return res.status(500).json({ success: false, message: 'Delete failed. User still exists in database.' });
        }

        return res.json({ success: true, message: 'Registered user deleted from database', deletedKey: deleteKey });
    } catch (error) {
        console.error('Error deleting registered user:', error);
        return res.status(500).json({ success: false, message: 'Failed to delete registered user' });
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
