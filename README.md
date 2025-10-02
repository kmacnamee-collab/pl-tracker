# ⚽ Premier League Tracker Pro

A modern, full-featured Premier League tracking application with live standings, fixtures, top scorers, match previews, and summaries powered by The Guardian.

![Premier League Tracker](https://img.shields.io/badge/Premier%20League-Tracker-purple)
![Node.js](https://img.shields.io/badge/Node.js-Express-green)
![React](https://img.shields.io/badge/React-18-blue)

## ✨ Features

- **📊 Live Standings** - Real-time league table with team form and detailed stats
- **📅 Fixtures View** - Organized by week with match previews and summaries
- **🏆 Top Scorers** - Leaderboard with player statistics
- **📈 Points Visualization** - Interactive chart showing team progression
- **📰 Match Previews** - Professional analysis from The Guardian for upcoming matches
- **📝 Match Summaries** - Detailed reports from The Guardian for completed matches

## 🚀 Quick Start

### Prerequisites

- Node.js (v14 or higher)
- Two free API keys (instructions below)

### 1. Get Your API Keys

#### Football-Data.org
1. Visit https://www.football-data.org/client/register
2. Sign up for a free account
3. Copy your API key (10 requests/minute free tier)

#### The Guardian
1. Visit https://open-platform.theguardian.com/access/
2. Register for a developer key
3. Copy your API key (12 requests/second free tier - very generous!)

### 2. Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/premier-league-tracker.git
cd premier-league-tracker

# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Edit .env and add your API keys
# FOOTBALL_API_KEY=your_key_here
# GUARDIAN_API_KEY=your_key_here
```

### 3. Run Locally

```bash
# Start the backend server
npm start

# Open index.html in your browser
# Or use a simple server:
python -m http.server 8000
# Then visit: http://localhost:8000
```

## 📁 Project Structure

```
premier-league-tracker/
├── .env                 # Your API keys (DO NOT COMMIT!)
├── .env.example         # Template for .env
├── .gitignore          # Git ignore rules
├── README.md           # This file
├── package.json        # Dependencies
├── server.js           # Backend API server
├── index.html          # Frontend application
└── node_modules/       # Dependencies (auto-generated)
```

## 🔌 API Endpoints

### Football Data
- `GET /api/health` - Health check and cache status
- `GET /api/standings` - Premier League standings
- `GET /api/matches` - All matches (past and upcoming)
- `GET /api/scorers` - Top goal scorers
- `GET /api/teams` - All Premier League teams
- `GET /api/competition` - Competition information

### Guardian Content
- `GET /api/guardian/match?homeTeam=Arsenal&awayTeam=Chelsea&type=preview` - Match preview/report
- `GET /api/guardian/team?team=Liverpool` - Latest team news

### Cache
- `POST /api/cache/clear` - Clear all caches (useful for testing)

## 🎨 Features in Detail

### Match Previews & Summaries

The app integrates with The Guardian's Open Platform API to provide professional football journalism:

- **Upcoming Matches**: Click "Match Preview" to read expert tactical analysis
- **Finished Matches**: Click "Match Summary" to read detailed match reports
- **Content Includes**: 
  - Professional headlines
  - Expert journalists (e.g., Barney Ronay, Jonathan Wilson)
  - Match analysis and quotes
  - Links to full articles

### Smart Caching

- **Football Data**: 3-10 minute cache (reduces API calls)
- **Guardian Articles**: 30 minute cache
- Automatically refreshes when needed
- Respects API rate limits

### Responsive Design

- Mobile-friendly interface
- Tailwind CSS styling
- Smooth animations and transitions
- Dark theme with purple accents

## 🚀 Deployment

### Backend (Render.com)

1. Create account at https://render.com
2. Create new "Web Service"
3. Connect your GitHub repository
4. Set environment variables:
   - `FOOTBALL_API_KEY`
   - `GUARDIAN_API_KEY`
5. Deploy!

### Frontend (Netlify/Vercel)

1. Update `BACKEND_URL` in `index.html` to your Render backend URL
2. Deploy `index.html` to any static hosting:
   - Netlify
   - Vercel
   - GitHub Pages
   - Cloudflare Pages

## 🛠️ Technologies Used

### Backend
- **Node.js** + **Express** - Server framework
- **node-fetch** - HTTP requests
- **cors** - Cross-origin resource sharing
- **Football-Data.org API** - Match data
- **The Guardian API** - Articles and journalism

### Frontend
- **React 18** - UI framework
- **Tailwind CSS** - Styling
- **Chart.js** - Data visualization
- **Vanilla JavaScript** - No build step needed

## 📊 Data Sources

- **Match Data**: [Football-Data.org](https://www.football-data.org/)
- **Articles**: [The Guardian Open Platform](https://open-platform.theguardian.com/)

Both APIs offer generous free tiers perfect for personal projects!

## 🔧 Troubleshooting

### No Guardian articles showing
- Guardian focuses on bigger matches (top 6 teams, derbies)
- Check your API key is correct in `.env`
- Try Arsenal, Liverpool, Chelsea, Man City matches
- Check browser console for errors

### Backend not starting
- Ensure `.env` file exists with both API keys
- Check port 3001 is not in use
- Verify Node.js is installed: `node --version`

### Rate limiting
- Free tier has limits (10 req/min for Football-Data)
- Caching helps reduce API calls
- Wait a minute and try again

## 📝 License

MIT License - feel free to use this project however you'd like!

## 🤝 Contributing

Pull requests are welcome! For major changes, please open an issue first.

## 📧 Contact

Questions? Open an issue on GitHub!

---

**Built with ⚽ for Premier League fans everywhere**
