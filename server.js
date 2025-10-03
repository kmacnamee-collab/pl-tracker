const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS for all origins
app.use(cors());

const API_BASE = 'https://api.football-data.org/v4';

// Cache configuration
const cache = {
  standings: { data: null, timestamp: null, ttl: 300000 }, // 5 minutes
  matches: { data: null, timestamp: null, ttl: 180000 },   // 3 minutes
  scorers: { data: null, timestamp: null, ttl: 600000 },   // 10 minutes
  teams: { data: null, timestamp: null, ttl: 3600000 },    // 1 hour
  competition: { data: null, timestamp: null, ttl: 86400000 }, // 24 hours
  standingsLast: { data: null, timestamp: null, ttl: 3600000 }, // 1 hour (last season changes rarely)
  matchesLast: { data: null, timestamp: null, ttl: 3600000 }    // 1 hour
};

// Helper function to check if cache is valid
function isCacheValid(cacheKey) {
  const cacheEntry = cache[cacheKey];
  if (!cacheEntry.data || !cacheEntry.timestamp) return false;
  return (Date.now() - cacheEntry.timestamp) < cacheEntry.ttl;
}

// Helper function to get from cache or fetch
async function getCachedOrFetch(cacheKey, endpoint) {
  if (isCacheValid(cacheKey)) {
    console.log(`✓ Cache hit: ${cacheKey}`);
    return cache[cacheKey].data;
  }
  
  console.log(`⟳ Cache miss: ${cacheKey}, fetching...`);
  const data = await fetchFootballData(endpoint);
  cache[cacheKey].data = data;
  cache[cacheKey].timestamp = Date.now();
  return data;
}

// Helper function to fetch from Football-Data.org
async function fetchFootballData(endpoint) {
  try {
    console.log(`Fetching: ${endpoint}`);
    const apiKey = process.env.FOOTBALL_API_KEY;
    
    if (!apiKey) {
      console.warn('⚠️  No API key found. Get one at: https://www.football-data.org/client/register');
    }
    
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        'X-Auth-Token': apiKey || ''
      }
    });
    
    if (response.status === 403) {
      throw new Error('API key required or rate limit exceeded. Get free key at: https://www.football-data.org/client/register');
    }
    
    if (response.status === 429) {
      throw new Error('Rate limit exceeded. Wait a minute or add API key.');
    }
    
    if (!response.ok) {
      console.error(`API Error: ${response.status} ${response.statusText}`);
      throw new Error(`API returned ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log(`✓ Success: ${endpoint}`);
    return data;
  } catch (error) {
    console.error(`Error fetching ${endpoint}:`, error.message);
    throw error;
  }
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Premier League API Backend (Football-Data.org)',
    timestamp: new Date().toISOString(),
    cache: {
      standings: isCacheValid('standings'),
      matches: isCacheValid('matches'),
      scorers: isCacheValid('scorers'),
      teams: isCacheValid('teams'),
      competition: isCacheValid('competition'),
      standingsLast: isCacheValid('standingsLast'),
      matchesLast: isCacheValid('matchesLast')
    }
  });
});

// Get standings
app.get('/api/standings', async (req, res) => {
  try {
    const data = await getCachedOrFetch('standings', '/competitions/PL/standings');
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch standings', details: error.message });
  }
});

// Get last season standings
app.get('/api/standings/last', async (req, res) => {
  try {
    // Get current season to calculate last season year
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();
    
    // Premier League season runs from August to May
    // If we're before August, last season is (year-2) to (year-1)
    // If we're after August, last season is (year-1) to year
    let lastSeasonYear;
    if (currentMonth < 7) { // Before August
      lastSeasonYear = currentYear - 2;
    } else {
      lastSeasonYear = currentYear - 1;
    }
    
    const data = await getCachedOrFetch('standingsLast', `/competitions/PL/standings?season=${lastSeasonYear}`);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch last season standings', details: error.message });
  }
});

// Get all matches
app.get('/api/matches', async (req, res) => {
  try {
    const data = await getCachedOrFetch('matches', '/competitions/PL/matches');
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch matches', details: error.message });
  }
});

// Get last season matches
app.get('/api/matches/last', async (req, res) => {
  try {
    // Get current season to calculate last season year
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();
    
    // Premier League season runs from August to May
    let lastSeasonYear;
    if (currentMonth < 7) { // Before August
      lastSeasonYear = currentYear - 2;
    } else {
      lastSeasonYear = currentYear - 1;
    }
    
    const data = await getCachedOrFetch('matchesLast', `/competitions/PL/matches?season=${lastSeasonYear}`);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch last season matches', details: error.message });
  }
});

// Get top scorers
app.get('/api/scorers', async (req, res) => {
  try {
    const data = await getCachedOrFetch('scorers', '/competitions/PL/scorers');
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch scorers', details: error.message });
  }
});

// Get teams
app.get('/api/teams', async (req, res) => {
  try {
    const data = await getCachedOrFetch('teams', '/competitions/PL/teams');
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch teams', details: error.message });
  }
});

// Get competition info
app.get('/api/competition', async (req, res) => {
  try {
    const data = await getCachedOrFetch('competition', '/competitions/PL');
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch competition', details: error.message });
  }
});

// Clear cache endpoint (useful for testing)
app.post('/api/cache/clear', (req, res) => {
  Object.keys(cache).forEach(key => {
    cache[key].data = null;
    cache[key].timestamp = null;
  });
  res.json({ message: 'Cache cleared successfully' });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Premier League API Backend`);
  console.log(`📡 Server running on port ${PORT}`);
  console.log(`🌐 Health check: http://localhost:${PORT}/api/health`);
  console.log(`⚽ Using Football-Data.org API`);
  console.log(`💾 Caching enabled\n`);
});
