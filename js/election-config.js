// =====================================================
// UniVote Centralized Configuration
// Loads candidates from server API - syncs with Manage Candidates
// =====================================================

// Default config while loading
window.ELECTION_CONFIG = {
    title: 'Imperial College of Engineering - President Election 2026',
    subtitle: 'College President Election 2026',
    year: '2026',
    organization: 'Imperial College of Engineering',
    candidates: [],
    totalVoters: 2000,
    hasCastingVote: true,
    castingVoteAuthority: 3,
    showResultsToPublic: false
};

// Load candidates from server API - with cache busting
async function loadCandidatesFromAPI() {
    try {
        const response = await fetch('/api/candidates?t=' + Date.now());
        if (response.ok) {
            const data = await response.json();
            if (data && Array.isArray(data)) {
                window.ELECTION_CONFIG.candidates = data;
                return data;
            }
        }
    } catch(e) {
        console.log('Could not load from API, using default candidates');
    }
    // Default candidates if API fails
    window.ELECTION_CONFIG.candidates = [
        { id: 1, name: 'Swarna Roy (Lecturer, CSE Department)', symbol: '📖', position: 'President', color: '#e94560' },
        { id: 2, name: 'Sumaiya Akter (Lecturer, CSE Department)', symbol: '🌹', position: 'President', color: '#4361ee' },
        { id: 3, name: 'Sohely Sajlin (Lecturer, CSE Department)', symbol: '✈️', position: 'President', color: '#00d9a5' },
        { id: 4, name: 'Mazharul Islam (Lecturer, CSE Department)', symbol: '🥭', position: 'President', color: '#ffc107' },
        { id: 5, name: 'Jahangir Polash (Lecturer, CSE Department)', symbol: '🦜', position: 'President', color: '#9c27b0' },
        { id: 6, name: 'Marium Khanom (Student, CSE Department)', symbol: '🦉', position: 'President', color: '#14b8a6' },
    ];
    return window.ELECTION_CONFIG.candidates;
}

// Initialize - load candidates when page loads
loadCandidatesFromAPI();

// Helper function to get candidate count
window.getCandidateCount = function() {
    return window.ELECTION_CONFIG.candidates.length;
};

// Helper function to get all candidates
window.getCandidates = function() {
    return window.ELECTION_CONFIG.candidates;
};

// Helper function to get election info
window.getElectionInfo = function() {
    return {
        title: window.ELECTION_CONFIG.title,
        subtitle: window.ELECTION_CONFIG.subtitle,
        year: window.ELECTION_CONFIG.year,
        candidateCount: window.getCandidateCount(),
        organization: window.ELECTION_CONFIG.organization
    };
};