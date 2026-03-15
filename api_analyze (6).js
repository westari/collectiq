export const config = {
  api: {
    bodyParser: { sizeLimit: '10mb' },
    responseLimit: false
  },
  maxDuration: 300
};

// ============ ODDS API — games + lines ============
async function fetchOdds(sport) {
  const key = process.env.ODDS_API_KEY;
  if (!key) return null;

  const sportKeyMap = {
    'nba': 'basketball_nba', 'nfl': 'americanfootball_nfl',
    'mlb': 'baseball_mlb', 'nhl': 'icehockey_nhl',
    'ncaab': 'basketball_ncaab', 'ncaaf': 'americanfootball_ncaaf',
    'mls': 'soccer_usa_mls', 'epl': 'soccer_epl',
  };
  const sportKey = sportKeyMap[sport.toLowerCase()] || sport.toLowerCase();

  try {
    const now = new Date();
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const tomorrowEnd = new Date(now); tomorrowEnd.setDate(tomorrowEnd.getDate() + 1); tomorrowEnd.setHours(12, 0, 0, 0);

    const url = `https://api.the-odds-api.com/v4/sports/${sportKey}/odds?apiKey=${key}&regions=us&markets=h2h,spreads,totals&oddsFormat=american&commenceTimeFrom=${todayStart.toISOString()}&commenceTimeTo=${tomorrowEnd.toISOString()}`;
    const res = await fetch(url);
    if (!res.ok) return null;

    const allGames = await res.json();
    if (!allGames || allGames.length === 0) return null;

    const cutoff = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const games = allGames.filter(g => {
      const t = new Date(g.commence_time);
      return t >= todayStart && t <= cutoff;
    });
    if (games.length === 0) return null;

    const todayStr = now.toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    let block = `\n=== TODAY'S ${sport.toUpperCase()} GAMES & ODDS — ${todayStr} ===\nONLY these ${games.length} games are playing today.\n\n`;

    games.forEach((game, i) => {
      block += `GAME ${i + 1}: ${game.away_team} @ ${game.home_team}\n`;
      block += `Start: ${new Date(game.commence_time).toLocaleString('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} ET\n`;
      if (game.bookmakers && game.bookmakers.length > 0) {
        game.bookmakers.forEach(book => {
          block += `  ${book.title}:\n`;
          book.markets.forEach(market => {
            if (market.key === 'h2h') {
              block += `    Moneyline: `;
              market.outcomes.forEach(o => { block += `${o.name} ${o.price > 0 ? '+' : ''}${o.price}  `; });
              block += '\n';
            } else if (market.key === 'spreads') {
              block += `    Spread: `;
              market.outcomes.forEach(o => { block += `${o.name} ${o.point > 0 ? '+' : ''}${o.point} (${o.price > 0 ? '+' : ''}${o.price})  `; });
              block += '\n';
            } else if (market.key === 'totals') {
              block += `    Total: `;
              market.outcomes.forEach(o => { block += `${o.name} ${o.point} (${o.price > 0 ? '+' : ''}${o.price})  `; });
              block += '\n';
            }
          });
        });
      }
      block += '\n';
    });
    return block;
  } catch (err) {
    console.log(`Odds API error: ${err.message}`);
    return null;
  }
}

// ============ BALLDONTLIE — standings + recent games ============
async function fetchStandings(sport) {
  const key = process.env.BALLDONTLIE_API_KEY;
  if (!key) return null;

  // BallDontLie free tier: teams, players, games, standings (NBA/NFL/MLB/NHL)
  const bdlSportMap = {
    'nba': 'nba', 'nfl': 'nfl', 'mlb': 'mlb', 'nhl': 'nhl',
  };
  const bdlSport = bdlSportMap[sport.toLowerCase()];
  if (!bdlSport) return null; // BDL free tier doesn't cover soccer/college

  try {
    let block = `\n=== ${sport.toUpperCase()} STANDINGS & RECENT RESULTS ===\n\n`;

    // Fetch standings
    const standingsRes = await fetch(`https://api.balldontlie.io/${bdlSport}/v1/standings`, {
      headers: { 'Authorization': key }
    });

    if (standingsRes.ok) {
      const standingsData = await standingsRes.json();
      if (standingsData.data && standingsData.data.length > 0) {
        block += `CURRENT STANDINGS:\n`;

        // Group by conference/division if available
        const teams = standingsData.data.sort((a, b) => (a.rank || 99) - (b.rank || 99));
        teams.forEach(t => {
          const team = t.team || t;
          const name = team.full_name || team.name || 'Unknown';
          const wins = t.wins ?? '?';
          const losses = t.losses ?? '?';
          const conf = t.conference || team.conference || '';
          block += `  ${name}: ${wins}-${losses}${conf ? ` (${conf})` : ''}\n`;
        });
        block += '\n';
      }
    }

    // Fetch recent games (last 3 days)
    const today = new Date();
    const threeDaysAgo = new Date(today);
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const dateStr = threeDaysAgo.toISOString().split('T')[0];

    const gamesRes = await fetch(`https://api.balldontlie.io/${bdlSport}/v1/games?start_date=${dateStr}`, {
      headers: { 'Authorization': key }
    });

    if (gamesRes.ok) {
      const gamesData = await gamesRes.json();
      if (gamesData.data && gamesData.data.length > 0) {
        const completed = gamesData.data.filter(g =>
          g.status === 'Final' || g.status === 'final' || g.status === 'STATUS_FULL_TIME' ||
          (g.home_team_score > 0 && g.visitor_team_score > 0 && g.period >= 4)
        );

        if (completed.length > 0) {
          block += `RECENT RESULTS (last 3 days):\n`;
          completed.slice(0, 15).forEach(g => {
            const home = g.home_team?.full_name || g.home_team?.name || 'Home';
            const away = g.visitor_team?.full_name || g.visitor_team?.name || 'Away';
            const hs = g.home_team_score ?? g.home_score ?? '?';
            const as = g.visitor_team_score ?? g.away_score ?? '?';
            block += `  ${away} ${as} @ ${home} ${hs} (${g.status || 'Final'})\n`;
          });
          block += '\n';
        }
      }
    }

    return block;
  } catch (err) {
    console.log(`BallDontLie error: ${err.message}`);
    return null;
  }
}

// ============ SPORT DETECTION ============
function detectSport(text) {
  const lower = text.toLowerCase();
  if (lower.includes('nba') || lower.includes('basketball')) return 'nba';
  if (lower.includes('nfl') || lower.includes('football')) return 'nfl';
  if (lower.includes('mlb') || lower.includes('baseball')) return 'mlb';
  if (lower.includes('nhl') || lower.includes('hockey')) return 'nhl';
  if (lower.includes('ncaab') || lower.includes('college basketball') || lower.includes('march madness')) return 'ncaab';
  if (lower.includes('ncaaf') || lower.includes('college football')) return 'ncaaf';
  if (lower.includes('soccer') || lower.includes('mls')) return 'mls';
  if (lower.includes('epl') || lower.includes('premier league')) return 'epl';
  return 'nba';
}

// ============ MAIN HANDLER ============
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  const timestamp = new Date().toISOString();
  const hasImage = JSON.stringify(req.body).includes('"type":"image"');
  let mode = 'unknown', sport = 'unknown';
  try {
    const bodyStr = JSON.stringify(req.body);
    if (bodyStr.includes('parlay') || bodyStr.includes('Build a ')) mode = 'parlay';
    else if (bodyStr.includes('single-pick') || bodyStr.includes('single pick')) mode = 'single';
    sport = detectSport(bodyStr);
  } catch(e) {}

  console.log(JSON.stringify({ event: 'request', timestamp, mode, sport, has_image: hasImage }));

  try {
    // Fetch data from both APIs in parallel (only for text-based parlay requests)
    let oddsData = null, standingsData = null;
    if (!hasImage && mode === 'parlay') {
      [oddsData, standingsData] = await Promise.all([
        fetchOdds(sport),
        fetchStandings(sport)
      ]);
    }

    const hasSportsData = oddsData || standingsData;
    const sportsDataBlock = [oddsData, standingsData].filter(Boolean).join('\n');

    // Build the request
    const messages = req.body.messages.map(msg => {
      if (msg.role === 'user' && hasSportsData) {
        const content = Array.isArray(msg.content) ? msg.content : [{ type: 'text', text: msg.content }];
        const newContent = content.map(block => {
          if (block.type === 'text') {
            return {
              ...block,
              text: `HERE IS REAL-TIME SPORTS DATA. Use this data for games, odds, standings, and recent results. You may also use web search to look up current injuries and news.\n\n${sportsDataBlock}\n---\n\n${block.text}`
            };
          }
          return block;
        });
        return { ...msg, content: newContent };
      }
      return msg;
    });

    // Always include web search — for injuries and extra context
    const requestBody = {
      ...req.body,
      messages: hasSportsData ? messages : req.body.messages,
      tools: [{ type: "web_search_20250305", name: "web_search" }]
    };

    console.log(JSON.stringify({
      event: 'sending_to_claude',
      has_odds: !!oddsData,
      has_standings: !!standingsData,
      has_web_search: true,
      sport
    }));

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(requestBody)
    });

    const responseText = await response.text();
    const data = JSON.parse(responseText);

    console.log(JSON.stringify({
      event: 'response',
      timestamp: new Date().toISOString(),
      mode, sport,
      has_odds: !!oddsData,
      has_standings: !!standingsData,
      success: !data.error,
      input_tokens: data.usage?.input_tokens || 0,
      output_tokens: data.usage?.output_tokens || 0,
    }));

    return res.status(200).json(data);
  } catch (error) {
    console.log(JSON.stringify({ event: 'error', error: error.message }));
    return res.status(500).json({ error: error.message });
  }
}
