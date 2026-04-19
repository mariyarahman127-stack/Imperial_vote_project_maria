// =====================================================
// UniVote Configuration - Easy to Edit
// =====================================================
// Just change TOTAL_VOTERS below to update all pages!
// CANDIDATES are now stored in candidates.json file
const TOTAL_VOTERS = 2000;

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
app.use(express.json({ limit: '10mb' })); // Increase limit for photo data
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Debug middleware for API calls
app.use('/api/*', (req, res, next) => {
    console.log(`API call: ${req.method} ${req.path}`);
    next();
});

// Test endpoint
app.get('/api/test', (req, res) => {
    res.json({ message: 'API is working' });
});

function isValidImageDataUrl(photo) {
    if (typeof photo !== 'string') return false;
    const normalized = photo.trim();
    const imageDataUrlPattern = /^data:image\/(jpeg|jpg|png|webp);base64,[a-z0-9+/=\s]+$/i;
    if (!imageDataUrlPattern.test(normalized)) return false;
    return normalized.length >= 4000;
}

function validateFaceVerification(faceVerification) {
    const now = Date.now();
    const maxAgeMs = 10 * 60 * 1000;

    if (!faceVerification || typeof faceVerification !== 'object') {
        return { valid: false, message: 'Human face verification data is missing.' };
    }

    const checkedAtMs = Date.parse(faceVerification.checkedAt || '');
    if (!Number.isFinite(checkedAtMs)) {
        return { valid: false, message: 'Invalid face verification timestamp.' };
    }

    if (now - checkedAtMs > maxAgeMs || checkedAtMs > now + 30 * 1000) {
        return { valid: false, message: 'Face verification expired. Please verify again.' };
    }

    const source = String(faceVerification.source || '').toLowerCase();
    if (source !== 'camera' && source !== 'gallery') {
        return { valid: false, message: 'Invalid face verification source.' };
    }

    const confidence = Number(faceVerification.confidence);
    const faceCount = Number(faceVerification.faceCount);
    const faceRatio = Number(faceVerification.faceRatio);
    const brightness = Number(faceVerification.brightness);
    const contrast = Number(faceVerification.contrast);
    const verified = faceVerification.verified === true;
    const hasLandmarks = faceVerification.hasLandmarks === true;
    const minConfidence = hasLandmarks ? 0.75 : 0.82;

    if (!verified) return { valid: false, message: 'Face verification failed.' };
    if (!Number.isFinite(confidence) || confidence < minConfidence) {
        return { valid: false, message: 'Face confidence too low.' };
    }
    if (!Number.isFinite(faceCount) || faceCount !== 1) {
        return { valid: false, message: 'Exactly one human face is required.' };
    }
    if (!Number.isFinite(faceRatio) || faceRatio < 0.08 || faceRatio > 0.7) {
        return { valid: false, message: 'Face framing is invalid. Retake photo.' };
    }
    if (!Number.isFinite(brightness) || brightness < 30) {
        return { valid: false, message: 'Photo is too dark for verification.' };
    }
    if (!Number.isFinite(contrast) || contrast < 18) {
        return { valid: false, message: 'Photo quality is too low for verification.' };
    }

    return {
        valid: true,
        sanitized: {
            verified: true,
            source,
            checkedAt: new Date(checkedAtMs).toISOString(),
            confidence: Number(confidence.toFixed(4)),
            faceCount: 1,
            faceRatio: Number(faceRatio.toFixed(4)),
            brightness: Number(brightness.toFixed(2)),
            contrast: Number(contrast.toFixed(2)),
            hasLandmarks
        }
    };
}

// API endpoint for user registration (moved to top)
app.post('/api/user-register', async (req, res) => {
    console.log('Registration endpoint called with body:', req.body);
    const { email, name, studentId, department, password, uid, photo, faceVerification } = req.body;
    if (!email || !password || !studentId) {
        console.log('Missing required fields');
        return res.status(400).json({ success: false, message: 'Email, student ID and password required' });
    }
    
    if (!isValidImageDataUrl(photo)) {
        console.log('Photo missing or invalid');
        return res.status(400).json({ success: false, message: 'Photo is required for registration' });
    }

    const verification = validateFaceVerification(faceVerification);
    if (!verification.valid) {
        return res.status(400).json({ success: false, message: verification.message });
    }

    const emailLower = email.toLowerCase().trim();
    const studentIdClean = studentId.trim();

    try {
        // Check if user already exists by studentId
        const registeredUsersData = await firebaseRequest('GET', '/registeredUsers');
        if (registeredUsersData && registeredUsersData[studentIdClean]) {
            console.log('Student ID already registered');
            return res.status(400).json({ success: false, message: 'Student ID already registered' });
        }

        // Also check by email
        if (registeredUsersData) {
            for (const [key, user] of Object.entries(registeredUsersData)) {
                if (user.email === emailLower) {
                    console.log('Email already registered');
                    return res.status(400).json({ success: false, message: 'Email already registered' });
                }
            }
        }

        // Also check if user has already voted (check by email)
        const voters = await getAllVoters();
        const voterKey = emailToFirebaseKey(emailLower);
        if (voters && voters[voterKey]) {
            console.log('User has already voted');
            return res.status(400).json({ success: false, message: 'This student has already voted. Cannot register again.' });
        }

        // Prepare user data
        const userData = {
            email: emailLower,
            name: name,
            studentId: studentIdClean,
            department: department,
            password: password,
            uid: uid || null,
            registeredAt: new Date().toISOString()
        };

        // Add photo if provided
        if (photo) {
            userData.photo = photo;
            userData.faceVerification = verification.sanitized;
            console.log('Photo data received, length:', photo.length);
        }

        console.log('Saving user to Firebase:', userData);

        // Save to Firebase registeredUsers node using studentId as key
        console.log('Firebase PUT to /registeredUsers/' + studentIdClean);
        const result = await firebaseRequest('PUT', '/registeredUsers/' + studentIdClean, userData);
        
        console.log('Firebase PUT result:', result);

        if (!result) {
            console.error('Failed to save user to Firebase');
            return res.status(500).json({ success: false, message: 'Registration failed - could not save to database' });
        }

        console.log('Registration successful');
        res.json({ success: true, message: 'Registration successful' });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ success: false, message: 'Registration failed' });
    }
});

// Alias /api/register to /api/user-register for backward compatibility
app.post('/api/register', async (req, res) => {
    // Forward to the same handler
    req.url = '/api/user-register';
    req.originalUrl = '/api/user-register';
    const originalSend = res.json;
    res.json = function(data) {
        return originalSend.call(this, data);
    };
    
    // Re-use the same logic by calling the registration handler
    const { email, name, studentId, department, password, uid, photo, faceVerification } = req.body;
    if (!email || !password || !studentId) {
        return res.status(400).json({ success: false, message: 'Email, student ID and password required' });
    }
    
    if (!isValidImageDataUrl(photo)) {
        return res.status(400).json({ success: false, message: 'Photo is required for registration' });
    }

    const verification = validateFaceVerification(faceVerification);
    if (!verification.valid) {
        return res.status(400).json({ success: false, message: verification.message });
    }

    const emailLower = email.toLowerCase().trim();
    const studentIdClean = studentId.trim();

    try {
        const registeredUsersData = await firebaseRequest('GET', '/registeredUsers');
        if (registeredUsersData && registeredUsersData[studentIdClean]) {
            return res.status(400).json({ success: false, message: 'Student ID already registered' });
        }

        if (registeredUsersData) {
            for (const [key, user] of Object.entries(registeredUsersData)) {
                if (user.email === emailLower) {
                    return res.status(400).json({ success: false, message: 'Email already registered' });
                }
            }
        }

        const voters = await getAllVoters();
        const voterKey = emailToFirebaseKey(emailLower);
        if (voters && voters[voterKey]) {
            return res.status(400).json({ success: false, message: 'This student has already voted. Cannot register again.' });
        }

        const userData = {
            email: emailLower,
            name: name,
            studentId: studentIdClean,
            department: department,
            password: password,
            uid: uid || null,
            registeredAt: new Date().toISOString()
        };

        if (photo) {
            userData.photo = photo;
            userData.faceVerification = verification.sanitized;
        }

        const result = await firebaseRequest('PUT', '/registeredUsers/' + studentIdClean, userData);

        if (!result) {
            return res.status(500).json({ success: false, message: 'Registration failed - could not save to database' });
        }

        res.json({ success: true, message: 'Registration successful' });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ success: false, message: 'Registration failed' });
    }
});

// Firebase Configuration - Using REST API (no credentials needed)
const FIREBASE_DB_URL = 'https://univote1-59bd1-default-rtdb.asia-southeast1.firebasedatabase.app';
const FIREBASE_DB_SECRET = 'VpKnONs4KHPRhuc0I79gp0RTf81C2oA45kVQIf9G';

// File to store candidates - EDIT candidates.json TO CHANGE CANDIDATES
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

// Default candidates (fallback)
const DEFAULT_CANDIDATES = [
    { id: 1, name: 'Swarna Roy', department: 'Lecturer, CSE Department', symbol: '📖', symbolName: 'Book', votes: 0, color: '#e94560' },
    { id: 2, name: 'Sumaiya Akter', department: 'Lecturer, CSE Department', symbol: '🌹', symbolName: 'Rose', votes: 0, color: '#4361ee' },
    { id: 3, name: 'Sohely Sajlin', department: 'Lecturer, CSE Department', symbol: '✈️', symbolName: 'Airplane', votes: 0, color: '#00d9a5' },
    { id: 4, name: 'Mazharul Islam', department: 'Lecturer, CSE Department', symbol: '🥭', symbolName: 'Mango', votes: 0, color: '#ffc107' },
    { id: 5, name: 'Jahangir Polash', department: 'Lecturer, CSE Department', symbol: '🦜', symbolName: 'Parrot', votes: 0, color: '#9c27b0' },
    { id: 6, name: 'Marium Khanom', department: 'Student, CSE Department', symbol: '🦉', symbolName: 'Owl', votes: 0, color: '#14b8a6' }
];

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
                    const isSuccess = res.statusCode >= 200 && res.statusCode < 300;
                    if (!isSuccess) {
                        console.error(`Firebase error: Status ${res.statusCode}, Body: ${body}`);
                        resolve(null);
                        return;
                    }
                    if (body === 'null' || body === '') {
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

        req.on('error', reject);
        
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
        id: key,
        ...value
    }));
}

// Get all voters from Firebase
async function getAllVoters() {
    const data = await firebaseRequest('GET', '/voters');
    if (!data) return {};
    return data;
}

// Save vote to Firebase
async function saveVoteToFirebase(voteData) {
    await firebaseRequest('POST', '/votes', voteData);
}

// Helper function to create a valid Firebase key from email
function emailToFirebaseKey(email) {
    return email.toLowerCase().replace(/@/g, '_at_').replace(/\./g, '_dot_');
}

// Save voter to Firebase
async function saveVoterToFirebase(email, voterData) {
    const firebaseKey = emailToFirebaseKey(email);
    await firebaseRequest('PUT', `/voters/${firebaseKey}`, voterData);
}

// Debug endpoint to list registered users
app.get('/api/debug/users', async (req, res) => {
    try {
        const users = await firebaseRequest('GET', '/registeredUsers');
        res.json(users || {});
    } catch (error) {
        res.json({ error: error.message });
    }
});

// API Routes
app.get('/api/election', (req, res) => res.json(election));
app.get('/api/candidates', async (req, res) => {
    try {
        // ALWAYS load fresh from file - no caching
        const candidates = loadCandidatesFromFile();
        if (candidates && candidates.length > 0) {
            // Ensure all fields are preserved
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
app.get('/api/votes', async (req, res) => {
    try {
        console.log('API: Fetching votes from Firebase...');
        const votes = await getAllVotes();
        console.log('API: Votes found:', votes.length);
        res.json(votes);
    } catch (error) {
        console.error('Error fetching votes:', error);
        res.json([]);
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
    const { email, studentId, candidateId, voteId } = req.body;
    if (!email || !candidateId) {
        return res.status(400).json({ success: false, message: 'Email and candidate required' });
    }
    
    const emailLower = email.toLowerCase().trim();
    const firebaseKey = emailToFirebaseKey(emailLower);
    
    try {
        const candidates = await getCandidatesFromStore();
        // Check if already voted in Firebase - check BOTH /voters AND /votes
        const voters = await getAllVoters();
        const allVotes = await getAllVotes();
        
        // Check voters collection by email key
        if (voters && voters[firebaseKey]) {
            const voter = voters[firebaseKey];
            return res.status(400).json({ success: false, message: 'Already voted', hasVoted: true, votedFor: voter.votedFor });
        }
        
        // Also check votes collection
        if (allVotes && Array.isArray(allVotes)) {
            for (const vote of allVotes) {
                if (vote.userEmail && vote.userEmail.toLowerCase() === emailLower) {
                    return res.status(400).json({ success: false, message: 'Already voted', hasVoted: true, votedFor: vote.candidateSymbol + ' ' + vote.candidateName });
                }
            }
        }
        
        // Check if max voters reached (using TOTAL_VOTERS)
        const currentVotesCount = allVotes ? allVotes.length : 0;
        if (currentVotesCount >= TOTAL_VOTERS) {
            return res.status(400).json({ success: false, message: 'Maximum voting limit (' + TOTAL_VOTERS + ') reached. No more votes can be cast.' });
        }
        
        const candidate = candidates.find(c => c.id === candidateId);
        if (!candidate) {
            return res.status(400).json({ success: false, message: 'Candidate not found' });
        }
        
        // Use the 8-digit voteId from frontend, or generate one if not provided
        const finalVoteId = voteId || Date.now().toString().slice(-8);
        
        // Save vote to Firebase (using 8-digit voteId as key)
        const voteData = {
            userEmail: emailLower,
            studentId: studentId,
            candidateId: candidate.id,
            candidateName: candidate.name,
            candidateDepartment: candidate.department,
            candidateSymbol: candidate.symbol,
            candidateSymbolName: candidate.symbolName,
            timestamp: new Date().toISOString(),
            timestampRaw: Date.now()
        };
        await firebaseRequest('PUT', '/votes/' + finalVoteId, voteData);
        
        // Save voter to Firebase using email-based key
        await saveVoterToFirebase(emailLower, {
            hasVoted: true,
            votedFor: candidate.symbol + ' ' + candidate.name,
            timestamp: new Date().toISOString()
        });
        
        const isTied = false;
        
        res.json({ success: true, message: 'Vote recorded!', voteId: finalVoteId, tie: isTied });
    } catch (error) {
        console.error('Error saving vote:', error);
        res.status(500).json({ success: false, message: 'Failed to save vote' });
    }
});

app.get('/api/check-vote/:email', async (req, res) => {
    try {
        const emailLower = req.params.email.toLowerCase().trim();
        
        const voters = await getAllVoters();
        const allVotes = await getAllVotes();
        
        // Check voters collection
        if (voters) {
            for (const key of Object.keys(voters)) {
                if (key.toLowerCase() === emailLower) {
                    const voter = voters[key];
                    return res.json({ hasVoted: true, votedFor: voter.votedFor });
                }
            }
        }
        
        // Also check votes collection directly
        if (allVotes && Array.isArray(allVotes)) {
            for (const vote of allVotes) {
                if (vote.userEmail && vote.userEmail.toLowerCase() === emailLower) {
                    return res.json({ hasVoted: true, votedFor: vote.candidateSymbol + ' ' + vote.candidateName });
                }
            }
        }
        
        res.json({ hasVoted: false });
    } catch (error) {
        console.error('Error checking vote:', error);
        res.json({ hasVoted: false });
    }
});

// Check vote by student ID
app.get('/api/check-vote-by-student/:studentId', async (req, res) => {
    try {
        const studentId = req.params.studentId.toLowerCase().trim();
        
        const voters = await getAllVoters();
        const allVotes = await getAllVotes();
        
        // Check voters collection - try with studentId as key
        if (voters && voters[studentId]) {
            const voter = voters[studentId];
            return res.json({ hasVoted: true, votedFor: voter.votedFor });
        }
        
        // Also check votes collection by studentId in email
        if (allVotes && Array.isArray(allVotes)) {
            for (const vote of allVotes) {
                if (vote.userEmail) {
                    const emailStudentId = vote.userEmail.split('@')[0];
                    if (emailStudentId.toLowerCase() === studentId) {
                        return res.json({ hasVoted: true, votedFor: vote.candidateSymbol + ' ' + vote.candidateName });
                    }
                }
            }
        }
        
        res.json({ hasVoted: false });
    } catch (error) {
        console.error('Error checking vote by student:', error);
        res.json({ hasVoted: false });
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
    res.json({ success: true, message: `Casting vote for ${candidate.name}`, winner: candidate });
});

// Get voting schedule (public endpoint)
app.get('/api/voting-schedule', async (req, res) => {
    try {
        const schedule = await firebaseRequest('GET', '/votingSchedule');
        if (schedule && schedule.startTime && schedule.endTime) {
            res.json({ success: true, schedule: schedule });
        } else {
            res.json({ success: false, message: 'Voting schedule not configured. Please contact administrator.' });
        }
    } catch (error) {
        console.error('Error getting voting schedule:', error);
        res.status(500).json({ success: false, message: 'Failed to get voting schedule' });
    }
});

// Admin endpoint to reset all votes
app.post('/api/admin/save-schedule', async (req, res) => {
    const { adminKey, startTime, endTime, startTimeFormatted, endTimeFormatted, updatedAt, updatedAtFormatted } = req.body;
    if (adminKey && adminKey !== 'admin2026') {
        return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    
    try {
        const scheduleData = {
            startTime: startTime,
            endTime: endTime,
            startTimeFormatted: startTimeFormatted,
            endTimeFormatted: endTimeFormatted,
            updatedAt: updatedAt || Date.now(),
            updatedAtFormatted: updatedAtFormatted
        };
        
        await firebaseRequest('PUT', '/votingSchedule', scheduleData);
        res.json({ success: true });
    } catch (error) {
        console.error('Error saving schedule:', error);
        res.status(500).json({ success: false, message: 'Failed to save schedule' });
    }
});

app.post('/api/admin/delete-schedule', async (req, res) => {
    try {
        await firebaseRequest('DELETE', '/votingSchedule');
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting schedule:', error);
        res.status(500).json({ success: false, message: 'Failed to delete schedule' });
    }
});

app.post('/api/admin/reset-votes', async (req, res) => {
    const { adminKey } = req.body;
    if (adminKey !== 'admin2026') {
        return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    
    try {
        // Delete all votes from Firebase
        await firebaseRequest('DELETE', '/votes');
        // Delete all voters from Firebase so they can vote again
        await firebaseRequest('DELETE', '/voters');
        
        res.json({ success: true, message: 'All votes and voters have been reset' });
    } catch (error) {
        console.error('Error resetting votes:', error);
        res.status(500).json({ success: false, message: 'Failed to reset votes' });
    }
});

// Admin endpoint to toggle results publication
app.post('/api/admin/toggle-publish', async (req, res) => {
    const { action, adminKey } = req.body;
    if (adminKey && adminKey !== 'admin2026') {
        return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    
    try {
        const isPublish = action === 'publish';
        await firebaseRequest('PUT', '/publishStatus', { published: isPublish });
        res.json({ success: true, published: isPublish });
    } catch (error) {
        console.error('Error toggling publish:', error);
        res.status(500).json({ success: false, message: 'Failed to update publish status' });
    }
});

// Get publish status (public endpoint)
app.get('/api/publish-status', async (req, res) => {
    try {
        const status = await firebaseRequest('GET', '/publishStatus');
        res.json({ published: status && status.published ? true : false });
    } catch (error) {
        res.json({ published: false });
    }
});

// Admin endpoint to get publish status
app.get('/api/admin/publish-status', async (req, res) => {
    try {
        const status = await firebaseRequest('GET', '/publishStatus');
        res.json({ published: status && status.published ? true : false });
    } catch (error) {
        res.json({ published: false });
    }
});

// Get total votes count - public endpoint
app.get('/api/votes-count', async (req, res) => {
    try {
        const votes = await firebaseRequest('GET', '/votes');
        if (votes && typeof votes === 'object') {
            const count = Object.keys(votes).length;
            res.json({ success: true, count: count });
        } else {
            res.json({ success: true, count: 0 });
        }
    } catch (error) {
        console.error('Error getting votes count:', error);
        res.json({ success: true, count: 0 });
    }
});

// API endpoint for user login
app.post('/api/login', async (req, res) => {
    const { email, studentId, password } = req.body;
    
    const loginId = studentId || (email ? email.split('@')[0] : null);
    
    if (!loginId || !password) {
        return res.status(400).json({ success: false, message: 'Student ID and password required' });
    }
    
    // Check admin credentials
    if (email && email.toLowerCase().trim() === 'admin@ice.edu' && password === 'admin2026') {
        return res.json({ 
            success: true, 
            user: { 
                id: 1, 
                name: 'Administrator', 
                email: 'admin@ice.edu', 
                role: 'admin' 
            } 
        });
    }
    
    try {
        // Check if user exists in registeredUsers by studentId, loginId (from email), or by scanning all users for email match
        const registeredUsersData = await firebaseRequest('GET', '/registeredUsers');
        
        let user = null;
        let foundStudentId = null;
        
        // Search by loginId (studentId)
        if (registeredUsersData && registeredUsersData[studentId]) {
            user = registeredUsersData[studentId];
            foundStudentId = studentId;
        }
        
        // If still not found and we have email, scan ALL users to find email match
        if (!user && email && registeredUsersData) {
            const inputEmail = (email || '').toLowerCase().trim();
            for (const sid in registeredUsersData) {
                let storedEmail = (registeredUsersData[sid].email || '').toLowerCase().trim();
                storedEmail = storedEmail.replace(/_at_/g, '@').replace(/_dot_/g, '.');
                if (storedEmail === inputEmail) {
                    user = registeredUsersData[sid];
                    foundStudentId = sid;
                    break;
                }
            }
        }
        
        if (user) {
            // Check password
            if (user.password === password) {
                // Check if already voted
                const voters = await getAllVoters();
                const hasVoted = voters && voters[foundStudentId];
                const votedFor = hasVoted ? voters[foundStudentId].votedFor : null;
                
                return res.json({
                    success: true,
                    user: {
                        id: user.studentId,
                        name: user.name || foundStudentId,
                        email: user.email,
                        studentId: foundStudentId,
                        role: 'voter',
                        hasVoted: hasVoted || false,
                        votedFor: votedFor,
                        photo: user.photo || null,
                        registeredAt: user.registeredAt || null
                    }
                });
            } else {
                return res.status(400).json({ success: false, message: 'Incorrect password' });
            }
        }
        
        // Check if user already voted (can login with default password if not registered)
        // Only apply if user was NOT found above (i.e., not registered)
        if (!user) {
            const voters = await getAllVoters();
            const hasVoted = voters && voters[studentId];
            const votedFor = hasVoted ? voters[studentId].votedFor : null;
            
            // Allow login with default password for users who haven't registered but want to vote
            if (password === 'voter123') {
                return res.json({
                    success: true,
                    user: {
                        id: studentId,
                        name: studentId,
                        email: email ? email.toLowerCase() : null,
                        studentId: studentId,
                        role: 'voter',
                        hasVoted: hasVoted || false,
                        votedFor: votedFor
                    }
                });
            }
        }
        
        // User not found
        return res.status(400).json({ success: false, message: 'Not registered. Please register first.' });
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: 'Login failed' });
    }
});


// Debug endpoint to list registered users
app.get('/api/debug/users', async (req, res) => {
    try {
        console.log('Debug: Fetching registeredUsers from Firebase...');
        const users = await firebaseRequest('GET', '/registeredUsers');
        console.log('Debug: Users fetched:', users);
        res.json(users || {});
    } catch (error) {
        console.error('Debug error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Debug endpoint to list all voters
app.get('/api/debug/voters', async (req, res) => {
    try {
        const voters = await firebaseRequest('GET', '/voters');
        res.json(voters || {});
    } catch (error) {
        console.error('Debug error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Test endpoint to create user directly (for debugging)
app.post('/api/debug/create-user', async (req, res) => {
    const { email, name, studentId, department, password } = req.body;
    
    try {
        console.log('Debug create user:', req.body);
        const emailLower = email.toLowerCase();
        
        const result = await firebaseRequest('PUT', '/registeredUsers/' + studentId, {
            email: emailLower,
            name: name,
            studentId: studentId,
            department: department || 'CSE',
            password: password,
            role: 'voter',
            registeredAt: new Date().toISOString(),
            _debug: true
        });
        
        console.log('User created:', result);
        res.setHeader('Content-Type', 'application/json');
        res.json({ success: true, result });
    } catch (error) {
        console.error('Error creating user:', error);
        res.setHeader('Content-Type', 'application/json');
        res.status(500).json({ success: false, error: error.message });
    }
});

// Debug endpoint to test login
app.get('/api/debug/login-check/:email', async (req, res) => {
    const email = req.params.email.toLowerCase();
    const studentId = email.split('@')[0];
    
    try {
        const registeredUsersData = await firebaseRequest('GET', '/registeredUsers');
        const usersList = [];
        for (const sid in registeredUsersData) {
            usersList.push({ 
                key: sid, 
                email: registeredUsersData[sid].email, 
                name: registeredUsersData[sid].name,
                password: registeredUsersData[sid].password 
            });
        }
        
        res.json({
            inputEmail: email,
            inputStudentId: studentId,
            userByStudentId: registeredUsersData ? registeredUsersData[studentId] : null,
            allUsers: usersList
        });
    } catch (error) {
        res.json({ error: error.message });
    }
});

// API endpoint to get user info
app.get('/api/user/:email', async (req, res) => {
    try {
        const emailLower = req.params.email.toLowerCase().trim();
        const registeredUsersData = await firebaseRequest('GET', '/registeredUsers');
        if (registeredUsersData && registeredUsersData[emailLower]) {
            res.json({ exists: true, user: registeredUsersData[emailLower] });
        } else {
            res.json({ exists: false });
        }
    } catch (error) {
        console.error('Error getting user:', error);
        res.json({ exists: false });
    }
});

// Admin endpoint to delete a specific user's registration
app.delete('/api/admin/user/:email', async (req, res) => {
    const { adminKey } = req.query;
    if (adminKey !== 'admin2026') {
        return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    
    const emailLower = req.params.email.toLowerCase().trim();
    
    try {
        await firebaseRequest('DELETE', '/registeredUsers/' + emailLower);
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

            if (matchedEntry) {
                deleteKey = matchedEntry[0];
            }
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
    
    const emailLower = req.params.email.toLowerCase().trim();
    
    try {
        // Delete from voters node
        await firebaseRequest('DELETE', '/voters/' + emailLower);
        
        // Also delete from votes node
        const allVotes = await getAllVotes();
        const voteToDelete = allVotes.find(v => v.userEmail && v.userEmail.toLowerCase() === emailLower);
        
        if (voteToDelete) {
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
    
    const emailLower = req.params.email.toLowerCase().trim();
    
    try {
        await firebaseRequest('DELETE', '/registeredUsers/' + emailLower);
        await firebaseRequest('DELETE', '/voters/' + emailLower);
        
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

// Serve static files from public folder (Vercel standard)
app.use(express.static(path.join(__dirname, 'public')));
// Also serve from root
app.use(express.static(path.join(__dirname, '.')));

// Handle all routes except API - serve index.html as SPA
app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'API endpoint not found' });
    }
    
    // Try to find HTML file in public folder
    const fs = require('fs');
    const publicPath = path.join(__dirname, 'public', req.path);
    const rootPath = path.join(__dirname, req.path);
    
    // Check public folder first, then root
    if (fs.existsSync(publicPath)) {
        return res.sendFile(publicPath);
    }
    if (fs.existsSync(rootPath)) {
        return res.sendFile(rootPath);
    }
    
    // Default to index.html from public
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server (for local development)
if (process.env.VERCEL === undefined) {
    app.listen(PORT, () => {
        console.log(`UniVote server running on http://localhost:${PORT}`);
    });
}

// Export for Vercel
exports.default = app;
module.exports = app;
