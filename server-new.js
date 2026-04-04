const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// In-memory database
const db = {
    candidates: [
        { id: 1, name: 'Alex Thompson', symbol: '🌟', votes: 0, color: '#e94560' },
        { id: 2, name: 'Jordan Rivera', symbol: '🔥', votes: 0, color: '#4361ee' },
        { id: 3, name: 'Sam Williams', symbol: '🎯', votes: 0, color: '#00d9a5' },
        { id: 4, name: 'Casey Morgan', symbol: '⚡', votes: 0, color: '#ffc107' }
    ],
    votes: [],
    voters: new Map(),
    election: {
        title: 'Imperial College of Engineering',
        subtitle: 'College President Election 2026',
        status: 'active'
    }
};

// API Routes
app.get('/api/election', (req, res) => res.json(db.election));
app.get('/api/candidates', (req, res) => res.json(db.candidates));

app.get('/api/results', (req, res) => {
    const totalVotes = db.votes.length;
    const candidates = db.candidates.map(c => ({
        ...c,
        percentage: totalVotes > 0 ? Math.round((c.votes / totalVotes) * 100) : 0
    })).sort((a, b) => b.votes - a.votes);
    
    const isTied = candidates.length >= 2 && candidates[0].votes === candidates[1].votes && candidates[0].votes > 0;
    res.json({ candidates, totalVotes, isTied });
});

app.post('/api/vote', (req, res) => {
    const { email, candidateId } = req.body;
    if (!email || !candidateId) {
        return res.status(400).json({ success: false, message: 'Email and candidate required' });
    }
    
    if (db.voters.has(email)) {
        const voter = db.voters.get(email);
        return res.status(400).json({ success: false, message: 'Already voted', hasVoted: true, votedFor: voter.votedFor });
    }
    
    const candidate = db.candidates.find(c => c.id === candidateId);
    if (!candidate) {
        return res.status(400).json({ success: false, message: 'Candidate not found' });
    }
    
    candidate.votes++;
    db.voters.set(email, { hasVoted: true, votedFor: candidate.symbol + ' ' + candidate.name, timestamp: new Date().toISOString() });
    db.votes.push({ id: uuidv4(), email, candidateId, candidateName: candidate.name, timestamp: new Date().toISOString() });
    
    const sorted = [...db.candidates].sort((a, b) => b.votes - a.votes);
    const isTied = sorted[0].votes === sorted[1].votes && sorted[0].votes > 0;
    
    res.json({ success: true, message: 'Vote recorded!', tie: isTied });
});

app.get('/api/check-vote/:email', (req, res) => {
    const voter = db.voters.get(req.params.email.toLowerCase());
    res.json(voter ? { hasVoted: true, votedFor: voter.votedFor } : { hasVoted: false });
});

app.get('/api/admin/votes', (req, res) => res.json(db.votes));

app.post('/api/casting-vote', (req, res) => {
    const { adminKey, candidateId } = req.body;
    if (adminKey !== 'admin2026casting') {
        return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    const candidate = db.candidates.find(c => c.id === candidateId);
    if (!candidate) {
        return res.status(400).json({ success: false, message: 'Candidate not found' });
    }
    candidate.votes++;
    res.json({ success: true, message: `Casting vote for ${candidate.name}`, winner: candidate });
});

// Serve frontend
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'login-api.html')));
app.get('/vote', (req, res) => res.sendFile(path.join(__dirname, 'vote-api.html')));
app.get('/results', (req, res) => res.sendFile(path.join(__dirname, 'results-api.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin-api.html')));
app.get('/admin-dashboard', (req, res) => res.sendFile(path.join(__dirname, 'admin-dashboard.html')));

app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n✅ ICE VOTING SERVER RUNNING`);
    console.log(`   Local:   http://localhost:${PORT}`);
    console.log(`   Network: http://[YOUR-IP]:${PORT}\n`);
});
