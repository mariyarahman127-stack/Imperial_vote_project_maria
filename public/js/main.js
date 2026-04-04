/**
 * UniVote - Smart Digital Casting Vote Management System
 * Main JavaScript File
 */

// =====================================================
// Configuration & State Management
// =====================================================

const AppConfig = {
    APP_NAME: 'UniVote',
    VERSION: '1.0.0',
    ENCRYPTION_KEY: 'univote-secret-key-2024',
    SESSION_TIMEOUT: 30 * 60 * 1000, // 30 minutes
};

const AppState = {
    currentUser: null,
    currentPage: 'index',
    elections: [],
    votes: [],
    auditLog: [],
    isAuthenticated: false,
};

// Imperial College of Engineering - Voting System Data
const sampleData = {
    users: [
        { id: 1, name: 'John Doe', email: 'john@imperial.edu', role: 'voter', verified: true },
        { id: 2, name: 'Jane Smith', email: 'admin@imperial.edu', role: 'admin', verified: true },
        { id: 3, name: 'Dr. Robert Wilson', email: 'principal@imperial.edu', role: 'chairperson', verified: true },
    ],
    elections: [
        {
            id: 1,
            title: 'Imperial College of Engineering - President Election 2026',
            description: 'Vote for your College President. Each student gets ONE vote only!',
            startDate: '2026-01-01T09:00',
            endDate: '2026-12-31T18:00',
            status: 'active',
            showResultsToPublic: false, // Results only shown to admin
            candidates: [
                { id: 1, name: 'Swarna Roy (Lecturer, CSE Department)', symbol: '📖', votes: 0, position: 'President', color: '#e94560' },
                { id: 2, name: 'Sumaiya Akter (Lecturer, CSE Department)', symbol: '🌹', votes: 0, position: 'President', color: '#4361ee' },
                { id: 3, name: 'Sohely Sajlin (Lecturer, CSE Department)', symbol: '✈️', votes: 0, position: 'President', color: '#00d9a5' },
                { id: 4, name: 'Mazharul Islam (Lecturer, CSE Department)', symbol: '🥭', votes: 0, position: 'President', color: '#ffc107' },
                { id: 5, name: 'Jahangir Polash (Lecturer, CSE Department)', symbol: '🦜', votes: 0, position: 'President', color: '#9c27b0' },
            ],
            totalVoters: 500,
            hasCastingVote: true,
            castingVoteAuthority: 3,
        },
    ],
};

// =====================================================
// Encryption Module (AES-256 Simulation)
// =====================================================

const Encryption = {
    // Simple hash function for demo (in production, use proper AES-256)
    hash: (data) => {
        let hash = 0;
        const str = JSON.stringify(data);
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16).padStart(16, '0');
    },

    // Encrypt vote data
    encryptVote: (voteData) => {
        const encrypted = {
            electionId: voteData.electionId,
            candidateId: voteData.candidateId,
            timestamp: Date.now(),
            hash: null,
        };
        encrypted.hash = Encryption.hash(encrypted);
        return btoa(JSON.stringify(encrypted));
    },

    // Verify vote integrity
    verifyVote: (encryptedVote) => {
        try {
            const decoded = JSON.parse(atob(encryptedVote));
            const hash = Encryption.hash({
                electionId: decoded.electionId,
                candidateId: decoded.candidateId,
                timestamp: decoded.timestamp,
            });
            return hash === decoded.hash;
        } catch {
            return false;
        }
    },
};

// =====================================================
// Authentication Module - SIMPLIFIED FOR EVERYONE
// =====================================================

const Auth = {
    // Quick vote - no login needed!
    quickVote: async (voterName, voterId) => {
        await Utils.delay(500);
        
        if (!voterName || !voterId) {
            return { success: false, message: 'Please enter your name and ID' };
        }
        
        // Check if already voted with this ID
        const allVotes = JSON.parse(localStorage.getItem('votes') || '[]');
        const alreadyVoted = allVotes.some(v => v.voterId === voterId);
        
        if (alreadyVoted) {
            return { success: false, message: 'This ID has already voted!' };
        }
        
        // Create voter session
        const voter = {
            id: Date.now(),
            name: voterName,
            voterId: voterId,
            role: 'voter',
            verified: true,
        };
        
        localStorage.setItem('currentVoter', JSON.stringify(voter));
        AppState.currentUser = voter;
        AppState.isAuthenticated = true;
        
        Audit.log('QUICK_VOTE', `Voter ${voterName} (${voterId}) started voting session`);
        
        return { success: true, voter };
    },

    // Check if user has voted
    hasVoted: (voterId) => {
        const allVotes = JSON.parse(localStorage.getItem('votes') || '[]');
        return allVotes.some(v => v.voterId === voterId);
    },

    // Get current voter
    getCurrentVoter: () => {
        const stored = localStorage.getItem('currentVoter');
        if (stored) {
            return JSON.parse(stored);
        }
        return null;
    },

    // Login (for admin)
    login: async (email, password) => {
        await Utils.delay(1000);
        
        if (password === 'admin2026' && email === 'admin@ice.edu') {
            const user = {
                id: 1,
                name: 'Admin',
                email: email,
                role: 'admin',
                verified: true,
            };
            
            localStorage.setItem('currentUser', JSON.stringify(user));
            AppState.currentUser = user;
            AppState.isAuthenticated = true;
            
            Audit.log('LOGIN', `Admin logged in`);
            
            return { success: true, user };
        }
        
        return { success: false, message: 'Invalid admin credentials' };
    },

    // Register (optional)
    register: async (userData) => {
        await Utils.delay(1500);
        
        const newUser = {
            id: Date.now(),
            ...userData,
            verified: true,
        };
        
        Audit.log('REGISTER', `New user registered: ${userData.email}`);
        
        return { success: true, message: 'Registration successful!' };
    },

    // Logout
    logout: () => {
        if (AppState.currentUser) {
            Audit.log('LOGOUT', `User logged out`);
        }
        
        localStorage.removeItem('currentUser');
        localStorage.removeItem('currentVoter');
        AppState.currentUser = null;
        AppState.isAuthenticated = false;
        
        Utils.redirect('index.html');
    },

    // Check authentication
    checkAuth: () => {
        const stored = localStorage.getItem('currentUser');
        const voter = localStorage.getItem('currentVoter');
        
        if (stored) {
            AppState.currentUser = JSON.parse(stored);
            AppState.isAuthenticated = true;
            return true;
        }
        
        if (voter) {
            AppState.currentUser = JSON.parse(voter);
            AppState.isAuthenticated = true;
            return true;
        }
        
        return false;
    },

    // Get current user
    getCurrentUser: () => {
        return AppState.currentUser;
    },
};

// =====================================================
// Election Module
// =====================================================

const Elections = {
    // Get all elections
    getAll: () => {
        return sampleData.elections;
    },

    // Get active elections
    getActive: () => {
        const now = new Date();
        return sampleData.elections.filter(e => {
            const start = new Date(e.startDate);
            const end = new Date(e.endDate);
            return now >= start && now <= end;
        });
    },

    // Get election status based on voting schedule from Firebase/localStorage
    getElectionStatus: async (electionId) => {
        try {
            // Load voting schedule from Firebase
            let schedule = null;
            if (typeof firebase !== 'undefined' && firebase.database) {
                const snapshot = await firebase.database().ref('votingSchedule').once('value');
                schedule = snapshot.val();
                
                // If Firebase returns null, clear localStorage to prevent stale data
                if (!schedule) {
                    console.log('Firebase returned null for votingSchedule, clearing localStorage');
                    localStorage.removeItem('votingSchedule');
                }
            }
            
            // Only fallback to localStorage if Firebase is not available
            if (!schedule && typeof firebase === 'undefined') {
                const localSchedule = localStorage.getItem('votingSchedule');
                if (localSchedule) {
                    schedule = JSON.parse(localSchedule);
                    console.log('Loaded schedule from localStorage (Firebase not available):', schedule);
                }
            }
            
            if (!schedule) {
                return { status: 'upcoming', message: 'Voting schedule not available' };
            }
            
            const now = Date.now();
            const startTime = schedule.startTime;
            const endTime = schedule.endTime;
            
            if (now < startTime) {
                return { status: 'upcoming', message: 'Voting has not started yet', startTime, endTime };
            }
            
            if (now > endTime) {
                return { status: 'ended', message: 'Voting has ended', startTime, endTime };
            }
            
            return { status: 'active', message: 'Voting is active', startTime, endTime };
        } catch (error) {
            console.error('Error getting election status:', error);
            return { status: 'upcoming', message: 'Error checking election status' };
        }
    },

    // Get election by ID
    getById: (id) => {
        return sampleData.elections.find(e => e.id === parseInt(id));
    },

    // Create election (admin)
    create: async (electionData) => {
        await Utils.delay(1000);
        
        const newElection = {
            id: Date.now(),
            ...electionData,
            status: 'upcoming',
            candidates: [],
            totalVoters: 0,
            hasCastingVote: true,
        };
        
        sampleData.elections.push(newElection);
        Audit.log('ELECTION_CREATED', `Election created: ${newElection.title}`);
        
        return { success: true, election: newElection };
    },

    // Add candidate
    addCandidate: async (electionId, candidateData) => {
        await Utils.delay(500);
        
        const election = Elections.getById(electionId);
        if (!election) {
            return { success: false, message: 'Election not found' };
        }
        
        const candidate = {
            id: Date.now(),
            ...candidateData,
            votes: 0,
        };
        
        election.candidates.push(candidate);
        Audit.log('CANDIDATE_ADDED', `Candidate ${candidate.name} added to election ${election.title}`);
        
        return { success: true, candidate };
    },

    // Check for tie
    checkForTie: (electionId) => {
        const election = Elections.getById(electionId);
        if (!election || !election.candidates.length) return null;
        
        const sorted = [...election.candidates].sort((a, b) => b.votes - a.votes);
        const topVotes = sorted[0].votes;
        const tied = sorted.filter(c => c.votes === topVotes);
        
        if (tied.length > 1 && topVotes > 0) {
            return {
                isTied: true,
                candidates: tied,
                voteCount: topVotes,
            };
        }
        
        return { isTied: false };
    },
};

// =====================================================
// Voting Module
// =====================================================

const Voting = {
    // Cast vote
    castVote: async (electionId, candidateId) => {
        await Utils.delay(800);
        
        const election = Elections.getById(electionId);
        if (!election) {
            return { success: false, message: 'Election not found' };
        }
        
        // Check if already voted using Firebase duplicate check
        const userEmail = AppState.currentUser?.email || AppState.currentUser?.username;
        if (userEmail) {
            const hasAlreadyVoted = await FirebaseService.checkDuplicateVote(userEmail);
            if (hasAlreadyVoted) {
                return { success: false, message: 'You have already voted in this election' };
            }
        }
        
        // Also check localStorage as fallback
        const hasVoted = Voting.hasVoted(electionId);
        if (hasVoted) {
            return { success: false, message: 'You have already voted in this election' };
        }
        
        // Get candidate
        const candidate = election.candidates.find(c => c.id === candidateId);
        if (!candidate) {
            return { success: false, message: 'Candidate not found' };
        }
        
        // Encrypt vote
        const voteData = {
            electionId,
            candidateId,
            userId: AppState.currentUser?.id,
            userEmail: userEmail,
        };
        
        const encryptedVote = Encryption.encryptVote(voteData);
        
        // Record vote
        const vote = {
            id: Date.now(),
            electionId,
            candidateId,
            encryptedVote,
            timestamp: Date.now(),
            userId: AppState.currentUser?.id,
            userEmail: userEmail,
        };
        
        // Update candidate votes
        candidate.votes++;
        
        // Save to Firebase (primary)
        const voteDataForFirebase = {
            id: vote.id,
            userEmail: userEmail,
            candidateId: candidateId,
            candidateName: candidate.name,
            candidateDepartment: candidate.department || '',
            candidateSymbol: candidate.symbol || '',
            candidateSymbolName: candidate.symbolName || '',
            electionId: electionId,
            userId: AppState.currentUser?.id
        };
        
        // Save to Firebase
        await FirebaseService.saveVote(voteDataForFirebase);
        
        // Also store in localStorage for backup
        const votes = JSON.parse(localStorage.getItem('votes') || '[]');
        votes.push(vote);
        localStorage.setItem('votes', JSON.stringify(votes));
        
        Audit.log('VOTE_CAST', `Vote cast for candidate ${candidate.name} in election ${election.title}`);
        
        // Check for tie after vote
        const tieResult = Elections.checkForTie(electionId);
        
        return {
            success: true,
            message: 'Vote cast successfully!',
            encryptedVote,
            tieResult,
        };
    },

    // Check if user has voted in an election
    hasVoted: (electionId) => {
        const votes = JSON.parse(localStorage.getItem('votes') || '[]');
        return votes.some(v => 
            v.electionId === parseInt(electionId) && 
            v.userId === AppState.currentUser?.id
        );
    },

    // Get user's votes
    getUserVotes: () => {
        if (!AppState.currentUser) return [];
        
        const votes = JSON.parse(localStorage.getItem('votes') || '[]');
        return votes.filter(v => v.userId === AppState.currentUser.id);
    },

    // Casting vote (chairperson's tie-breaker)
    castCastingVote: async (electionId, candidateId) => {
        await Utils.delay(500);
        
        const election = Elections.getById(electionId);
        if (!election) {
            return { success: false, message: 'Election not found' };
        }
        
        // Verify chairperson role
        if (AppState.currentUser?.role !== 'chairperson' && AppState.currentUser?.role !== 'admin') {
            return { success: false, message: 'Only the chairperson can cast a deciding vote' };
        }
        
        // Check for tie
        const tieResult = Elections.checkForTie(electionId);
        if (!tieResult.isTied) {
            return { success: false, message: 'No tie detected. Casting vote is not required.' };
        }
        
        const candidate = election.candidates.find(c => c.id === candidateId);
        if (!candidate) {
            return { success: false, message: 'Candidate not found' };
        }
        
        // Add casting vote
        candidate.votes++;
        
        Audit.log('CASTING_VOTE', `${AppState.currentUser.name} cast deciding vote for ${candidate.name} in election ${election.title}`);
        
        return {
            success: true,
            message: `Casting vote cast for ${candidate.name}!`,
            winner: candidate,
        };
    },
};

// =====================================================
// Audit Module
// =====================================================

const Audit = {
    // Log action
    log: (action, details) => {
        const logEntry = {
            id: Date.now(),
            action,
            details,
            userId: AppState.currentUser?.id,
            userEmail: AppState.currentUser?.email,
            timestamp: new Date().toISOString(),
        };
        
        const logs = JSON.parse(localStorage.getItem('auditLog') || '[]');
        logs.push(logEntry);
        localStorage.setItem('auditLog', JSON.stringify(logs));
        
        // Also add to session state
        AppState.auditLog.push(logEntry);
        
        console.log('[AUDIT]', logEntry);
    },

    // Get all logs
    getAll: () => {
        return JSON.parse(localStorage.getItem('auditLog') || '[]');
    },

    // Get logs for specific election
    getByElection: (electionId) => {
        const logs = Audit.getAll();
        return logs.filter(l => l.details.includes(electionId.toString()));
    },
};

// =====================================================
// UI Module
// =====================================================

const UI = {
    // Show toast notification
    showToast: (type, title, message) => {
        const container = document.querySelector('.toast-container') || UI.createToastContainer();
        
        const icons = {
            success: '✓',
            error: '✕',
            warning: '⚠',
            info: 'ℹ',
        };
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <span class="toast-icon">${icons[type]}</span>
            <div class="toast-content">
                <div class="toast-title">${title}</div>
                <div class="toast-message">${message}</div>
            </div>
        `;
        
        container.appendChild(toast);
        
        // Auto remove
        setTimeout(() => {
            toast.style.animation = 'slideIn 0.3s ease reverse';
            setTimeout(() => toast.remove(), 300);
        }, 5000);
    },

    // Create toast container
    createToastContainer: () => {
        const container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
        return container;
    },

    // Show modal
    showModal: (modalId) => {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
        }
    },

    // Hide modal
    hideModal: (modalId) => {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
        }
    },

    // Render elections list
    renderElections: (elections, containerId) => {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        if (elections.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📋</div>
                    <h3>No Elections</h3>
                    <p>There are no active elections at the moment.</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = elections.map(election => {
            const statusClass = election.status;
            const statusText = election.status.charAt(0).toUpperCase() + election.status.slice(1);
            const hasVoted = Voting.hasVoted(election.id);
            
            return `
                <div class="election-item">
                    <div class="election-status ${statusClass}"></div>
                    <div class="election-info">
                        <h4>${election.title}</h4>
                        <p>${election.candidates.length} candidates • ${election.totalVoters} eligible voters</p>
                    </div>
                    <span class="status-badge ${statusClass}">${statusText}</span>
                    ${election.status === 'active' ? `
                        <a href="vote.html?id=${election.id}" class="btn btn-primary election-action">
                            ${hasVoted ? 'View' : 'Vote Now'}
                        </a>
                    ` : ''}
                </div>
            `;
        }).join('');
    },

    // Render candidates
    renderCandidates: (election, containerId) => {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        const hasVoted = Voting.hasVoted(election.id);
        const maxVotes = Math.max(...election.candidates.map(c => c.votes));
        
        container.innerHTML = election.candidates.map(candidate => {
            const percentage = election.totalVoters > 0 
                ? Math.round((candidate.votes / election.totalVoters) * 100) 
                : 0;
            const isLeading = candidate.votes === maxVotes && maxVotes > 0;
            
            return `
                <div class="candidate-card ${hasVoted ? 'disabled' : ''}" data-id="${candidate.id}">
                    <div class="candidate-image">${candidate.symbol}</div>
                    <div class="candidate-info">
                        <h4>${candidate.name}</h4>
                        <p>${election.totalVoters > 0 ? `${candidate.votes} votes (${percentage}%)` : 'No votes yet'}</p>
                        ${isLeading ? '<span class="status-badge active" style="margin-top: 0.5rem;">Leading</span>' : ''}
                        <div class="progress-container">
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: ${percentage}%"></div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    },

    // Render results
    renderResults: (election, containerId) => {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        const sorted = [...election.candidates].sort((a, b) => b.votes - a.votes);
        const totalVotes = sorted.reduce((sum, c) => sum + c.votes, 0);
        
        // Check for tie
        const tieResult = Elections.checkForTie(election.id);
        
        let html = '';
        
        if (tieResult.isTied) {
            html += `
                <div class="tie-alert">
                    <div class="tie-alert-header">
                        <span class="tie-icon">⚖️</span>
                        <h3>Tie Detected!</h3>
                    </div>
                    <p>There is a tie between ${tieResult.candidates.map(c => c.name).join(' and ')} with ${tieResult.voteCount} votes each.</p>
                    <p>The casting vote authority (Chairperson) has been notified to cast the deciding vote.</p>
                </div>
            `;
        }
        
        html += '<div class="results-container">';
        
        sorted.forEach((candidate, index) => {
            const percentage = totalVotes > 0 ? Math.round((candidate.votes / totalVotes) * 100) : 0;
            const isWinner = index === 0 && !tieResult.isTied;
            
            html += `
                <div class="result-item">
                    <div class="result-rank">${index + 1}</div>
                    <div class="result-info">
                        <h4>${candidate.symbol} ${candidate.name}</h4>
                        <div class="progress-bar" style="margin-top: 0.5rem;">
                            <div class="progress-fill" style="width: ${percentage}%"></div>
                        </div>
                    </div>
                    <div class="result-votes">${candidate.votes} votes</div>
                    <div class="result-percentage">${percentage}%</div>
                </div>
            `;
        });
        
        html += '</div>';
        
        // Add casting vote option if tied and user is chairperson
        if (tieResult.isTied && AppState.currentUser?.role === 'chairperson') {
            html += `
                <div style="margin-top: 2rem; padding: 1.5rem; background: var(--surface); border-radius: var(--radius-lg); border: 1px solid var(--border);">
                    <h4 style="margin-bottom: 1rem;">🎯 Cast Your Deciding Vote</h4>
                    <p style="color: var(--text-secondary); margin-bottom: 1rem;">As the chairperson, you can cast the deciding vote to break the tie.</p>
                    <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
                        ${tieResult.candidates.map(c => `
                            <button class="btn btn-primary" onclick="UI.castCastingVote(${election.id}, ${c.id})">
                                ${c.symbol} Vote for ${c.name}
                            </button>
                        `).join('')}
                    </div>
                </div>
            `;
        }
        
        container.innerHTML = html;
    },

    // Cast casting vote
    castCastingVote: async (electionId, candidateId) => {
        const result = await Voting.castCastingVote(electionId, candidateId);
        
        if (result.success) {
            UI.showToast('success', 'Casting Vote Cast!', result.message);
            // Refresh results
            const election = Elections.getById(electionId);
            UI.renderResults(election, 'results-container');
        } else {
            UI.showToast('error', 'Error', result.message);
        }
    },

    // Render stats
    renderStats: (stats) => {
        Object.keys(stats).forEach(key => {
            const element = document.querySelector(`[data-stat="${key}"]`);
            if (element) {
                const target = parseInt(stats[key]);
                UI.animateNumber(element, target);
            }
        });
    },

    // Animate number
    animateNumber: (element, target) => {
        const duration = 1000;
        const start = 0;
        const startTime = performance.now();
        
        const update = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            const easeOut = 1 - Math.pow(1 - progress, 3);
            const current = Math.floor(start + (target - start) * easeOut);
            
            element.textContent = current.toLocaleString();
            
            if (progress < 1) {
                requestAnimationFrame(update);
            }
        };
        
        requestAnimationFrame(update);
    },

    // Render admin dashboard
    renderAdminDashboard: () => {
        const elections = Elections.getAll();
        
        // Stats
        const stats = {
            totalElections: elections.length,
            activeElections: elections.filter(e => e.status === 'active').length,
            totalVotes: elections.reduce((sum, e) => sum + e.candidates.reduce((s, c) => s + c.votes, 0), 0),
            totalVoters: elections.reduce((sum, e) => sum + e.totalVoters, 0),
        };
        
        document.getElementById('total-elections').textContent = stats.totalElections;
        document.getElementById('active-elections').textContent = stats.activeElections;
        document.getElementById('total-votes').textContent = stats.totalVotes;
        document.getElementById('total-voters').textContent = stats.totalVoters;
    },
};

// =====================================================
// Utility Functions
// =====================================================

const Utils = {
    // Delay function
    delay: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

    // Redirect
    redirect: (url) => {
        window.location.href = url;
    },

    // Get URL parameter
    getUrlParam: (param) => {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(param);
    },

    // Format date
    formatDate: (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    },

    // Format relative time
    formatRelativeTime: (timestamp) => {
        const now = Date.now();
        const diff = now - timestamp;
        
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);
        
        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        
        return new Date(timestamp).toLocaleDateString();
    },

    // Validate email
    validateEmail: (email) => {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    },

    // Validate password strength
    getPasswordStrength: (password) => {
        let strength = 0;
        
        if (password.length >= 8) strength++;
        if (password.match(/[a-z]/) && password.match(/[A-Z]/)) strength++;
        if (password.match(/[0-9]/)) strength++;
        if (password.match(/[^a-zA-Z0-9]/)) strength++;
        
        if (strength < 2) return 'weak';
        if (strength < 4) return 'medium';
        return 'strong';
    },
};

// =====================================================
// Event Handlers
// =====================================================

const EventHandlers = {
    // Mobile menu
    initMobileMenu: () => {
        const menuBtn = document.querySelector('.mobile-menu-btn');
        const navLinks = document.querySelector('.nav-links');
        
        if (menuBtn && navLinks) {
            menuBtn.addEventListener('click', () => {
                navLinks.classList.toggle('active');
                menuBtn.classList.toggle('active');
            });
        }
    },

    // Login form
    initLoginForm: () => {
        const form = document.getElementById('login-form');
        if (!form) return;
        
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const submitBtn = form.querySelector('button[type="submit"]');
            
            if (!email || !password) {
                UI.showToast('error', 'Error', 'Please fill in all fields');
                return;
            }
            
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="spinner"></span>';
            
            const result = await Auth.login(email, password);
            
            submitBtn.disabled = false;
            submitBtn.textContent = 'Login';
            
            if (result.success) {
                UI.showToast('success', 'Welcome!', 'Login successful');
                
                setTimeout(() => {
                    if (result.user.role === 'admin' || result.user.role === 'chairperson') {
                        Utils.redirect('admin-dashboard.html');
                    } else {
                        Utils.redirect('voter-dashboard.html');
                    }
                }, 1000);
            } else {
                UI.showToast('error', 'Login Failed', result.message);
            }
        });
    },

    // Register form
    initRegisterForm: () => {
        const form = document.getElementById('register-form');
        if (!form) return;
        
        const passwordInput = document.getElementById('password');
        const strengthBar = document.querySelector('.password-strength-bar');
        
        if (passwordInput && strengthBar) {
            passwordInput.addEventListener('input', (e) => {
                const strength = Utils.getPasswordStrength(e.target.value);
                strengthBar.className = 'password-strength-bar ' + strength;
            });
        }
        
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const name = document.getElementById('name').value;
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const role = document.querySelector('input[name="role"]:checked')?.value || 'voter';
            
            if (!name || !email || !password) {
                UI.showToast('error', 'Error', 'Please fill in all fields');
                return;
            }
            
            if (!Utils.validateEmail(email)) {
                UI.showToast('error', 'Error', 'Please enter a valid email');
                return;
            }
            
            const submitBtn = form.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="spinner"></span>';
            
            const result = await Auth.register({ name, email, password, role });
            
            submitBtn.disabled = false;
            submitBtn.textContent = 'Create Account';
            
            if (result.success) {
                UI.showToast('success', 'Success', result.message);
                
                setTimeout(() => {
                    Utils.redirect('login.html');
                }, 1500);
            } else {
                UI.showToast('error', 'Error', result.message);
            }
        });
    },

    // Vote form
    initVoteForm: () => {
        const container = document.getElementById('candidates-grid');
        const electionId = Utils.getUrlParam('id');
        
        if (!electionId) {
            Utils.redirect('voter-dashboard.html');
            return;
        }
        
        const election = Elections.getById(electionId);
        if (!election) {
            UI.showToast('error', 'Error', 'Election not found');
            return;
        }
        
        // Render election info
        document.getElementById('election-title').textContent = election.title;
        document.getElementById('election-description').textContent = election.description;
        
        // Check if already voted
        if (Voting.hasVoted(electionId)) {
            UI.showToast('info', 'Already Voted', 'You have already cast your vote in this election');
        }
        
        // Render candidates
        UI.renderCandidates(election, 'candidates-grid');
        
        // Add click handlers
        container.addEventListener('click', async (e) => {
            const card = e.target.closest('.candidate-card');
            if (!card || Voting.hasVoted(electionId)) return;
            
            const candidateId = parseInt(card.dataset.id);
            
            // Show confirmation modal
            const candidate = election.candidates.find(c => c.id === candidateId);
            
            document.getElementById('confirm-candidate-name').textContent = candidate.name;
            document.getElementById('confirm-candidate-symbol').textContent = candidate.symbol;
            
            UI.showModal('vote-confirmation-modal');
            
            // Handle confirm vote
            document.getElementById('confirm-vote-btn').onclick = async () => {
                UI.hideModal('vote-confirmation-modal');
                
                const result = await Voting.castVote(electionId, candidateId);
                
                if (result.success) {
                    UI.showToast('success', 'Vote Cast!', 'Your vote has been recorded securely');
                    
                    if (result.tieResult?.isTied) {
                        UI.showToast('warning', 'Tie Detected!', 'The election is tied. The chairperson will be notified.');
                    }
                    
                    setTimeout(() => {
                        Utils.redirect('voter-dashboard.html');
                    }, 2000);
                } else {
                    UI.showToast('error', 'Error', result.message);
                }
            };
        });
    },

    // Results page
    initResultsPage: () => {
        const electionId = Utils.getUrlParam('id');
        
        if (!electionId) {
            Utils.redirect('admin-dashboard.html');
            return;
        }
        
        const election = Elections.getById(electionId);
        if (!election) {
            UI.showToast('error', 'Error', 'Election not found');
            return;
        }
        
        document.getElementById('election-title').textContent = election.title;
        UI.renderResults(election, 'results-container');
        
        // Auto-refresh every 10 seconds
        setInterval(() => {
            UI.renderResults(Elections.getById(electionId), 'results-container');
        }, 10000);
    },

    // Admin dashboard
    initAdminDashboard: () => {
        UI.renderAdminDashboard();
        UI.renderElections(Elections.getAll(), 'elections-list');
    },

    // Logout
    initLogout: () => {
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                Auth.logout();
            });
        }
    },

    // Stats animation on landing page
    initStatsAnimation: () => {
        const statNumbers = document.querySelectorAll('.stat-number[data-count]');
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const target = parseInt(entry.target.dataset.count);
                    UI.animateNumber(entry.target, target);
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.5 });
        
        statNumbers.forEach(stat => observer.observe(stat));
    },

    // Vote count animation on landing page
    initVoteCountAnimation: () => {
        const voteCount = document.getElementById('voteCount');
        if (!voteCount) return;
        
        let count = 0;
        setInterval(() => {
            count = (count + 1) % 100;
            voteCount.textContent = count;
        }, 2000);
    },
};

// =====================================================
// Initialization
// =====================================================

document.addEventListener('DOMContentLoaded', () => {
    // Check authentication
    Auth.checkAuth();
    
    // Initialize mobile menu
    EventHandlers.initMobileMenu();
    
    // Initialize based on current page
    const page = document.body.dataset.page;
    
    switch (page) {
        case 'index':
            EventHandlers.initStatsAnimation();
            EventHandlers.initVoteCountAnimation();
            break;
            
        case 'login':
            EventHandlers.initLoginForm();
            break;
            
        case 'register':
            EventHandlers.initRegisterForm();
            break;
            
        case 'voter-dashboard':
            EventHandlers.initLogout();
            UI.renderElections(Elections.getActive(), 'active-elections');
            break;
            
        case 'vote':
            EventHandlers.initVoteForm();
            EventHandlers.initLogout();
            break;
            
        case 'results':
            EventHandlers.initResultsPage();
            EventHandlers.initLogout();
            break;
            
        case 'admin-dashboard':
            EventHandlers.initAdminDashboard();
            EventHandlers.initLogout();
            break;
    }
    
    // Add click handlers for modals
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => {
            btn.closest('.modal-overlay').classList.remove('active');
        });
    });
    
    // Close modal on overlay click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.classList.remove('active');
            }
        });
    });
});

// Export for global access
window.UniVote = {
    Auth,
    Elections,
    Voting,
    Audit,
    UI,
    Utils,
};
