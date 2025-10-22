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
  standingsLast: { data: null, timestamp: null, ttl: 3600000 }, // 1 hour (last season changes rarely)
  matchesLast: { data: null, timestamp: null, ttl: 3600000 },    // 1 hour  
  guardianArticles: {} // Dynamic cache for Guardian articles by query
};

// Helper function to check if cache is valid
function isCacheValid(cacheKey) {
  const cacheEntry = cache[cacheKey];
  if (!cacheEntry || !cacheEntry.data || !cacheEntry.timestamp) return false;
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

  // Initialize cache entry if it doesn't exist (for dynamic keys like head2head)
  if (!cache[cacheKey]) {
    cache[cacheKey] = { data: null, timestamp: null, ttl: 300000 }; // Default 5 minute TTL
  }

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

// Team name normalization map - maps short names to variations Guardian might use
const TEAM_NAME_VARIATIONS = {
  'Man City': ['Manchester City', 'Man City'],
  'Man Utd': ['Manchester United', 'Man Utd', 'Manchester Utd'],
  'Spurs': ['Tottenham', 'Spurs', 'Tottenham Hotspur'],
  'Newcastle': ['Newcastle', 'Newcastle United'],
  'West Ham': ['West Ham', 'West Ham United'],
  'Wolves': ['Wolves', 'Wolverhampton', 'Wolverhampton Wanderers'],
  'Brighton': ['Brighton', 'Brighton & Hove Albion', 'Brighton and Hove Albion'],
  'Nott\'m Forest': ['Nottingham Forest', 'Nott\'m Forest', 'Forest'],
  'Leicester': ['Leicester', 'Leicester City'],
  'Bournemouth': ['Bournemouth', 'AFC Bournemouth'],
  'Crystal Palace': ['Crystal Palace', 'Palace'],
  'Ipswich': ['Ipswich', 'Ipswich Town'],
  'Everton': ['Everton'],
  'Arsenal': ['Arsenal'],
  'Liverpool': ['Liverpool'],
  'Chelsea': ['Chelsea'],
  'Aston Villa': ['Aston Villa', 'Villa'],
  'Fulham': ['Fulham'],
  'Brentford': ['Brentford'],
  'Southampton': ['Southampton']
};

// Helper function to get team name variations
function getTeamVariations(teamName) {
  // Check if team name exists in our map
  if (TEAM_NAME_VARIATIONS[teamName]) {
    return TEAM_NAME_VARIATIONS[teamName];
  }

  // Otherwise return the original name
  return [teamName];
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
      competition: isCacheValid('competition'),
      standingsLast: isCacheValid('standingsLast'),
      matchesLast: isCacheValid('matchesLast'),	  
      competition: isCacheValid('competition')
    }
  });
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

// Get Guardian articles for a match
app.get('/api/guardian/match', async (req, res) => {
  try {
    const { homeTeam, awayTeam, type } = req.query; // type: 'preview' or 'report'

    if (!homeTeam || !awayTeam) {
      return res.status(400).json({ error: 'homeTeam and awayTeam parameters required' });
    }

    const tag = type === 'preview' ? 'tone/minutebyminute,football/series/match-previews' : 'tone/matchreports';
    const searchOptions = {
      tag: tag,
      'page-size': 5,
      'order-by': 'newest'
    };

    console.log(`🔍 Searching for match: ${homeTeam} vs ${awayTeam} (${type || 'report'})`);

    // Get all possible variations of team names
    const homeVariations = getTeamVariations(homeTeam);
    const awayVariations = getTeamVariations(awayTeam);

    // Strategy 1: Try exact match with original names (quoted for exact phrase)
    let query = `"${homeTeam}" AND "${awayTeam}"`;
    console.log(`  Strategy 1: Exact match - ${query}`);
    let articles = await searchGuardianArticles(query, searchOptions);

    if (articles && articles.results && articles.results.length > 0) {
      console.log(`  ✓ Found ${articles.results.length} articles with exact match`);
      return res.json({
        success: true,
        articles: articles.results,
        total: articles.total,
        searchStrategy: 'exact'
      });
    }

    // Strategy 2: Try full team names if different from short names
    if (homeVariations.length > 1 || awayVariations.length > 1) {
      const fullHomeName = homeVariations[0]; // First variation is usually the full name
      const fullAwayName = awayVariations[0];

      if (fullHomeName !== homeTeam || fullAwayName !== awayTeam) {
        query = `"${fullHomeName}" AND "${fullAwayName}"`;
        console.log(`  Strategy 2: Full names - ${query}`);
        articles = await searchGuardianArticles(query, searchOptions);

        if (articles && articles.results && articles.results.length > 0) {
          console.log(`  ✓ Found ${articles.results.length} articles with full names`);
          return res.json({
            success: true,
            articles: articles.results,
            total: articles.total,
            searchStrategy: 'full-names'
          });
        }
      }
    }

    // Strategy 3: Try without quotes (less strict matching)
    query = `${homeVariations[0]} ${awayVariations[0]}`;
    console.log(`  Strategy 3: Unquoted search - ${query}`);
    articles = await searchGuardianArticles(query, searchOptions);

    if (articles && articles.results && articles.results.length > 0) {
      console.log(`  ✓ Found ${articles.results.length} articles with unquoted search`);
      return res.json({
        success: true,
        articles: articles.results,
        total: articles.total,
        searchStrategy: 'unquoted'
      });
    }

    // Strategy 4: Try alternative variations (e.g., "Spurs" instead of "Tottenham")
    for (let i = 1; i < Math.max(homeVariations.length, awayVariations.length); i++) {
      const homeAlt = homeVariations[i] || homeVariations[0];
      const awayAlt = awayVariations[i] || awayVariations[0];

      query = `"${homeAlt}" AND "${awayAlt}"`;
      console.log(`  Strategy 4.${i}: Alternative variation - ${query}`);
      articles = await searchGuardianArticles(query, searchOptions);

      if (articles && articles.results && articles.results.length > 0) {
        console.log(`  ✓ Found ${articles.results.length} articles with variation ${i}`);
        return res.json({
          success: true,
          articles: articles.results,
          total: articles.total,
          searchStrategy: `variation-${i}`
        });
      }
    }

    // No results found with any strategy
    console.log(`  ✗ No articles found for ${homeTeam} vs ${awayTeam}`);
    res.json({
      success: true,
      articles: [],
      total: 0,
      searchStrategy: 'none',
      message: 'No match articles found. The match may not have coverage yet, or try checking later.'
    });

  } catch (error) {
    console.error('Error in /api/guardian/match:', error);
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

// Get head-to-head stats for a match
app.get('/api/head2head/:matchId', async (req, res) => {
  try {
    const { matchId } = req.params;
    const limit = req.query.limit || 10; // Default to last 10 meetings

    if (!matchId) {
      return res.status(400).json({ error: 'matchId parameter required' });
    }

    console.log(`📊 Fetching head-to-head for match ${matchId}`);

    const data = await getCachedOrFetch(
      `head2head-${matchId}`,
      `/matches/${matchId}/head2head?limit=${limit}`
    );

    if (data && data.matches) {
      // Calculate aggregated stats
      const homeTeam = data.aggregates?.homeTeam?.name;
      const awayTeam = data.aggregates?.awayTeam?.name;

      const stats = {
        homeTeam: {
          name: homeTeam,
          wins: data.aggregates?.homeTeam?.wins || 0,
          draws: data.aggregates?.draws || 0,
          losses: data.aggregates?.awayTeam?.wins || 0
        },
        awayTeam: {
          name: awayTeam,
          wins: data.aggregates?.awayTeam?.wins || 0,
          draws: data.aggregates?.draws || 0,
          losses: data.aggregates?.homeTeam?.wins || 0
        },
        totalMatches: data.aggregates?.numberOfMatches || 0,
        recentMatches: data.matches.slice(0, 5).map(m => ({
          date: m.utcDate,
          homeTeam: m.homeTeam.shortName || m.homeTeam.name,
          awayTeam: m.awayTeam.shortName || m.awayTeam.name,
          homeScore: m.score.fullTime.home,
          awayScore: m.score.fullTime.away,
          winner: m.score.winner
        }))
      };

      console.log(`✓ Found ${stats.totalMatches} previous meetings`);

      res.json({
        success: true,
        stats: stats,
        allMatches: data.matches
      });
    } else {
      res.json({
        success: true,
        stats: null,
        message: 'No previous meetings found between these teams'
      });
    }
  } catch (error) {
    console.error('Error fetching head-to-head:', error);
    res.status(500).json({ error: 'Failed to fetch head-to-head data', details: error.message });
  }
});

// Clear cache endpoint (useful for testing)
app.post('/api/cache/clear', (req, res) => {
  Object.keys(cache).forEach(key => {
	cache[key].data = null;
    cache[key].timestamp = null;
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
