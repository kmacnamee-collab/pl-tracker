const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS for all origins
app.use(cors());

const API_BASE = 'https://api.football-data.org/v4';
const GUARDIAN_API_BASE = 'https://content.guardianapis.com';

// Cache configuration
const cache = {
  standings: { data: null, timestamp: null, ttl: 300000 }, // 5 minutes
  matches: { data: null, timestamp: null, ttl: 180000 },   // 3 minutes
  scorers: { data: null, timestamp: null, ttl: 600000 },   // 10 minutes
  teams: { data: null, timestamp: null, ttl: 3600000 },    // 1 hour
  competition: { data: null, timestamp: null, ttl: 86400000 }, // 24 hours
  guardianArticles: {} // Dynamic cache for Guardian articles by query
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

// Helper function to fetch from Guardian API
async function fetchGuardianData(endpoint, params = {}) {
  try {
    const guardianApiKey = process.env.GUARDIAN_API_KEY;
    
    if (!guardianApiKey) {
      console.warn('⚠️  No Guardian API key found. Get one at: https://open-platform.theguardian.com/access/');
      return null;
    }
    
    const queryParams = new URLSearchParams({
      'api-key': guardianApiKey,
      'show-fields': 'headline,byline,trailText,body,thumbnail',
      ...params
    });
    
    const url = `${GUARDIAN_API_BASE}${endpoint}?${queryParams}`;
    console.log(`Fetching Guardian: ${endpoint}`);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`Guardian API Error: ${response.status} ${response.statusText}`);
      return null;
    }
    
    const data = await response.json();
    console.log(`✓ Guardian Success: ${endpoint}`);
    return data;
  } catch (error) {
    console.error(`Error fetching Guardian ${endpoint}:`, error.message);
    return null;
  }
}

// Helper function to search Guardian articles with caching
async function searchGuardianArticles(query, options = {}) {
  const cacheKey = `${query}-${JSON.stringify(options)}`;
  const now = Date.now();
  
  // Check cache (30 minute TTL for Guardian articles)
  if (cache.guardianArticles[cacheKey] && 
      cache.guardianArticles[cacheKey].timestamp && 
      (now - cache.guardianArticles[cacheKey].timestamp) < 1800000) {
    console.log(`✓ Guardian cache hit: ${query}`);
    return cache.guardianArticles[cacheKey].data;
  }
  
  const params = {
    q: query,
    section: 'football',
    'page-size': options.pageSize || 5,
    ...options
  };
  
  const data = await fetchGuardianData('/search', params);
  
  if (data && data.response) {
    cache.guardianArticles[cacheKey] = {
      data: data.response,
      timestamp: now
    };
    return data.response;
  }
  
  return null;
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Premier League API Backend (Football-Data.org + Guardian)',
    timestamp: new Date().toISOString(),
    cache: {
      standings: isCacheValid('standings'),
      matches: isCacheValid('matches'),
      scorers: isCacheValid('scorers'),
      teams: isCacheValid('teams'),
      competition: isCacheValid('competition')
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

// Get all matches
app.get('/api/matches', async (req, res) => {
  try {
    const data = await getCachedOrFetch('matches', '/competitions/PL/matches');
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch matches', details: error.message });
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

// Get Guardian articles for a match
app.get('/api/guardian/match', async (req, res) => {
  try {
    const { homeTeam, awayTeam, type } = req.query; // type: 'preview' or 'report'
    
    if (!homeTeam || !awayTeam) {
      return res.status(400).json({ error: 'homeTeam and awayTeam parameters required' });
    }
    
    // Build search query
    let query = `"${homeTeam}" AND "${awayTeam}"`;
    let tag = type === 'preview' ? 'tone/minutebyminute,football/series/match-previews' : 'tone/matchreports';
    
    const articles = await searchGuardianArticles(query, {
      tag: tag,
      'page-size': 3,
      'order-by': 'newest'
    });
    
    if (articles && articles.results && articles.results.length > 0) {
      res.json({ 
        success: true,
        articles: articles.results,
        total: articles.total
      });
    } else {
      // Try a broader search if no exact match
      query = `${homeTeam} OR ${awayTeam}`;
      const broadArticles = await searchGuardianArticles(query, {
        tag: tag,
        'page-size': 3,
        'order-by': 'newest'
      });
      
      res.json({ 
        success: true,
        articles: broadArticles?.results || [],
        total: broadArticles?.total || 0,
        broadSearch: true
      });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch Guardian articles', details: error.message });
  }
});

// Get Guardian articles for a team
app.get('/api/guardian/team', async (req, res) => {
  try {
    const { team } = req.query;
    
    if (!team) {
      return res.status(400).json({ error: 'team parameter required' });
    }
    
    const articles = await searchGuardianArticles(`"${team}"`, {
      'page-size': 5,
      'order-by': 'newest'
    });
    
    res.json({ 
      success: true,
      articles: articles?.results || [],
      total: articles?.total || 0
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch Guardian articles', details: error.message });
  }
});

// Clear cache endpoint (useful for testing)
app.post('/api/cache/clear', (req, res) => {
  Object.keys(cache).forEach(key => {
    if (key === 'guardianArticles') {
      cache[key] = {};
    } else {
      cache[key].data = null;
      cache[key].timestamp = null;
    }
  });
  res.json({ message: 'Cache cleared successfully' });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Premier League API Backend`);
  console.log(`📡 Server running on port ${PORT}`);
  console.log(`🌐 Health check: http://localhost:${PORT}/api/health`);
  console.log(`⚽ Using Football-Data.org API`);
  console.log(`📰 Using The Guardian API`);
  console.log(`💾 Caching enabled\n`);
});
