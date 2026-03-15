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
    'soccer': 'soccer_epl', 'epl': 'soccer_epl', 'mls': 'soccer_usa_mls',
    'la_liga': 'soccer_spain_la_liga', 'serie_a': 'soccer_italy_serie_a',
    'bundesliga': 'soccer_germany_bundesliga', 'ligue_1': 'soccer_france_ligue_one',
  };
  const sportKey = sportKeyMap[sport.toLowerCase()] || sport.toLowerCase();

  try {
    // Simple URL — no date filters, just get all upcoming odds
    const url = `https://api.the-odds-api.com/v4/sports/${sportKey}/odds?apiKey=${key}&regions=us&markets=h2h,spreads,totals&oddsFormat=american`;
    
    console.log(`Odds API calling: ${sportKey}`);
    const res = await fetch(url);
    
    if (!res.ok) {
      const errText = await res.text().catch(() => 'unknown');
      console.log(`Odds API error ${res.status}: ${errText.substring(0, 200)}`);
      
      // If the sport key failed and it's soccer, try EPL as fallback
      if (sport.toLowerCase() === 'soccer' || sport.toLowerCase() === 'mls') {
        console.log('Trying EPL as soccer fallback...');
        const fallbackUrl = `https://api.the-odds-api.com/v4/sports/soccer_epl/odds?apiKey=${key}&regions=us,uk&markets=h2h,spreads,totals&oddsFormat=american`;
        const fallbackRes = await fetch(fallbackUrl);
        if (!fallbackRes.ok) return null;
        const fallbackGames = await fallbackRes.json();
        if (!fallbackGames || fallbackGames.length === 0) return null;
        return formatOddsData(fallbackGames, 'EPL');
      }
      return null;
    }

    const games = await res.json();
    if (!games || games.length === 0) return null;

    // Filter to only games in the next 24 hours
    const now = new Date();
    const cutoff = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const todayGames = games.filter(g => {
      const t = new Date(g.commence_time);
      return t <= cutoff;
    });

    if (todayGames.length === 0) {
      // If no games today, just use the next few upcoming
      return formatOddsData(games.slice(0, 8), sport.toUpperCase());
    }

    return formatOddsData(todayGames, sport.toUpperCase());
  } catch (err) {
    console.log(`Odds API error: ${err.message}`);
    return null;
  }
}

function formatOddsData(games, sportLabel) {
  const now = new Date();
  const todayStr = now.toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  let block = `\n=== ${sportLabel} GAMES & ODDS — ${todayStr} ===\n${games.length} games found.\n\n`;

  games.forEach((game, i) => {
    block += `GAME ${i + 1}: ${game.away_team} @ ${game.home_team}\n`;
    block += `Start: ${new Date(game.commence_time).toLocaleString('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} ET\n`;
    if (game.bookmakers && game.bookmakers.length > 0) {
      // Only show first 3 bookmakers to save tokens
      game.bookmakers.slice(0, 3).forEach(book => {
        block += `  ${book.title}:\n`;
        book.markets.forEach(market => {
          if (market.key === 'h2h') {
            block += `    ML: `;
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
}

// ============ BALLDONTLIE — standings + recent games ============
async function fetchStandings(sport) {
  const key = process.env.BALLDONTLIE_API_KEY;
  if (!key) return null;

  const bdlSportMap = { 'nba': 'nba', 'nfl': 'nfl', 'mlb': 'mlb', 'nhl': 'nhl' };
  const bdlSport = bdlSportMap[sport.toLowerCase()];
  if (!bdlSport) return null;

  try {
    let block = `\n=== ${sport.toUpperCase()} STANDINGS & RECENT RESULTS ===\n\n`;
    let hasData = false;

    // Fetch standings — try the correct endpoint format
    try {
      const standingsRes = await fetch(`https://api.balldontlie.io/${bdlSport}/v1/standings`, {
        headers: { 'Authorization': key }
      });
      console.log(`BDL standings status: ${standingsRes.status}`);
      
      if (standingsRes.ok) {
        const standingsData = await standingsRes.json();
        if (standingsData.data && standingsData.data.length > 0) {
          block += `CURRENT STANDINGS:\n`;
          const teams = standingsData.data.sort((a, b) => (a.rank || 99) - (b.rank || 99));
          teams.forEach(t => {
            const team = t.team || t;
            const name = team.full_name || team.name || 'Unknown';
            block += `  ${name}: ${t.wins ?? '?'}-${t.losses ?? '?'}${t.conference ? ` (${t.conference})` : ''}\n`;
          });
          block += '\n';
          hasData = true;
        }
      }
    } catch(e) { console.log(`BDL standings error: ${e.message}`); }

    // Fetch recent games
    try {
      const today = new Date();
      const threeDaysAgo = new Date(today);
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      const dateStr = threeDaysAgo.toISOString().split('T')[0];

      const gamesRes = await fetch(`https://api.balldontlie.io/${bdlSport}/v1/games?start_date=${dateStr}`, {
        headers: { 'Authorization': key }
      });
      console.log(`BDL games status: ${gamesRes.status}`);

      if (gamesRes.ok) {
        const gamesData = await gamesRes.json();
        if (gamesData.data && gamesData.data.length > 0) {
          const completed = gamesData.data.filter(g =>
            g.status === 'Final' || g.status === 'final' ||
            (g.home_team_score > 0 && g.visitor_team_score > 0)
          );
          if (completed.length > 0) {
            block += `RECENT RESULTS (last 3 days):\n`;
            completed.slice(0, 15).forEach(g => {
              const home = g.home_team?.full_name || g.home_team?.name || 'Home';
              const away = g.visitor_team?.full_name || g.visitor_team?.name || 'Away';
              block += `  ${away} ${g.visitor_team_score ?? g.away_score ?? '?'} @ ${home} ${g.home_team_score ?? g.home_score ?? '?'}\n`;
            });
            block += '\n';
            hasData = true;
          }
        }
      }
    } catch(e) { console.log(`BDL games error: ${e.message}`); }

    return hasData ? block : null;
  } catch (err) {
    console.log(`BallDontLie error: ${err.message}`);
    return null;
  }
}

// ============ SPORT DETECTION ============
function detectSport(text) {
  const lower = text.toLowerCase();
  if (lower.includes('nba') || lower.includes('basketball')) return 'nba';
  if (lower.includes('nfl') || lower.includes('football') && !lower.includes('soccer')) return 'nfl';
  if (lower.includes('mlb') || lower.includes('baseball')) return 'mlb';
  if (lower.includes('nhl') || lower.includes('hockey')) return 'nhl';
  if (lower.includes('ncaab') || lower.includes('college basketball') || lower.includes('march madness')) return 'ncaab';
  if (lower.includes('ncaaf') || lower.includes('college football')) return 'ncaaf';
  if (lower.includes('soccer') || lower.includes('mls') || lower.includes('epl') || lower.includes('premier league') || lower.includes('la liga') || lower.includes('serie a') || lower.includes('bundesliga')) return 'soccer';
  return 'nba';
}

// ============ MAIN HANDLER ============
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  const timestamp = new Date().toISOString();
  const hasImage = JSON.stringify(req.body).includes('"type":"image"');
  
  // Extract tier info from request (frontend sends this based on logged-in user)
  const userTier = req.body.user_tier || 'free';
  const tierConfig = {
    free:  { model: 'claude-haiku-4-5-20251001', web_search: false, max_tokens: 2500 },
    pro:   { model: 'claude-haiku-4-5-20251001', web_search: true,  max_tokens: 3000 },
    ultra: { model: 'claude-sonnet-4-5-20250929', web_search: true,  max_tokens: 4000 }
  };
  const config = tierConfig[userTier] || tierConfig.free;

  let mode = 'unknown', sport = 'unknown';
  try {
    const bodyStr = JSON.stringify(req.body);
    if (bodyStr.includes('parlay') || bodyStr.includes('Build a ')) mode = 'parlay';
    else if (bodyStr.includes('single-pick') || bodyStr.includes('single pick')) mode = 'single';
    sport = detectSport(bodyStr);
  } catch(e) {}

  console.log(JSON.stringify({ event: 'request', timestamp, mode, sport, tier: userTier, has_image: hasImage }));

  try {
    let oddsData = null, standingsData = null;
    if (!hasImage && mode === 'parlay') {
      [oddsData, standingsData] = await Promise.all([
        fetchOdds(sport),
        fetchStandings(sport)
      ]);
    }

    const hasSportsData = oddsData || standingsData;
    const sportsDataBlock = [oddsData, standingsData].filter(Boolean).join('\n');

    const searchNote = config.web_search
      ? 'You may also use web search to look up current injuries and news.'
      : 'Do NOT use web search. Only use the data provided below.';

    const messages = req.body.messages.map(msg => {
      if (msg.role === 'user' && hasSportsData) {
        const content = Array.isArray(msg.content) ? msg.content : [{ type: 'text', text: msg.content }];
        const newContent = content.map(block => {
          if (block.type === 'text') {
            return {
              ...block,
              text: `HERE IS REAL-TIME SPORTS DATA. Use this for games, odds, and recent results. ${searchNote}\n\n${sportsDataBlock}\n---\n\n${block.text}`
            };
          }
          return block;
        });
        return { ...msg, content: newContent };
      }
      return msg;
    });

    // Build request — only add web search tool if tier allows it
    const requestBody = {
      ...req.body,
      model: config.model,
      max_tokens: config.max_tokens,
      messages: hasSportsData ? messages : req.body.messages,
    };
    
    // Remove user_tier from the request body (don't send to Anthropic)
    delete requestBody.user_tier;

    // Add web search only for pro/ultra or when no sports data available
    if (config.web_search || !hasSportsData) {
      requestBody.tools = [{ type: "web_search_20250305", name: "web_search" }];
    }

    console.log(JSON.stringify({
      event: 'sending_to_claude',
      has_odds: !!oddsData,
      has_standings: !!standingsData,
      model: config.model,
      web_search: !!requestBody.tools,
      tier: userTier,
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
      mode, sport, tier: userTier,
      model: config.model,
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
