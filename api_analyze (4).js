export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb'
    },
    responseLimit: false
  },
  maxDuration: 300
};

// Fetch today's games and odds from The Odds API
async function fetchSportsData(sport) {
  const oddsApiKey = process.env.ODDS_API_KEY;
  if (!oddsApiKey) return null;

  const sportKeyMap = {
    'nba': 'basketball_nba',
    'nfl': 'americanfootball_nfl',
    'mlb': 'baseball_mlb',
    'nhl': 'icehockey_nhl',
    'ncaab': 'basketball_ncaab',
    'ncaaf': 'americanfootball_ncaaf',
    'mls': 'soccer_usa_mls',
    'epl': 'soccer_epl',
  };

  const sportKey = sportKeyMap[sport.toLowerCase()] || sport.toLowerCase();

  try {
    const url = `https://api.the-odds-api.com/v4/sports/${sportKey}/odds?apiKey=${oddsApiKey}&regions=us&markets=h2h,spreads,totals&oddsFormat=american`;
    const res = await fetch(url);
    
    if (!res.ok) return null;

    const games = await res.json();
    if (!games || games.length === 0) return null;

    let dataBlock = `TODAY'S ${sport.toUpperCase()} GAMES AND ODDS (live from major US sportsbooks):\n\n`;
    
    games.forEach((game, i) => {
      dataBlock += `GAME ${i + 1}: ${game.away_team} @ ${game.home_team}\n`;
      dataBlock += `Start: ${new Date(game.commence_time).toLocaleString('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} ET\n`;
      
      if (game.bookmakers && game.bookmakers.length > 0) {
        game.bookmakers.forEach(book => {
          dataBlock += `  ${book.title}:\n`;
          book.markets.forEach(market => {
            if (market.key === 'h2h') {
              dataBlock += `    Moneyline: `;
              market.outcomes.forEach(o => {
                dataBlock += `${o.name} ${o.price > 0 ? '+' : ''}${o.price}  `;
              });
              dataBlock += '\n';
            } else if (market.key === 'spreads') {
              dataBlock += `    Spread: `;
              market.outcomes.forEach(o => {
                dataBlock += `${o.name} ${o.point > 0 ? '+' : ''}${o.point} (${o.price > 0 ? '+' : ''}${o.price})  `;
              });
              dataBlock += '\n';
            } else if (market.key === 'totals') {
              dataBlock += `    Total: `;
              market.outcomes.forEach(o => {
                dataBlock += `${o.name} ${o.point} (${o.price > 0 ? '+' : ''}${o.price})  `;
              });
              dataBlock += '\n';
            }
          });
        });
      }
      dataBlock += '\n';
    });

    return dataBlock;
  } catch (err) {
    console.log(`Odds API error: ${err.message}`);
    return null;
  }
}

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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  // --- USAGE TRACKING ---
  const timestamp = new Date().toISOString();
  const hasImage = JSON.stringify(req.body).includes('"type":"image"');
  let mode = 'unknown';
  let sport = 'unknown';
  try {
    const bodyStr = JSON.stringify(req.body);
    if (bodyStr.includes('parlay') || bodyStr.includes('Build a ')) mode = 'parlay';
    else if (bodyStr.includes('single-pick') || bodyStr.includes('single pick')) mode = 'single';
    sport = detectSport(bodyStr);
  } catch(e) {}

  console.log(JSON.stringify({ event: 'analysis_request', timestamp, mode, sport, has_image: hasImage }));

  try {
    // Try to fetch live sports data (only for text-based parlay requests)
    let sportsData = null;
    if (!hasImage && mode === 'parlay') {
      sportsData = await fetchSportsData(sport);
    }

    let requestBody;

    if (sportsData) {
      // Inject sports data into the prompt — NO web search needed
      const messages = req.body.messages.map(msg => {
        if (msg.role === 'user') {
          const content = Array.isArray(msg.content) ? msg.content : [{ type: 'text', text: msg.content }];
          const newContent = content.map(block => {
            if (block.type === 'text') {
              return {
                ...block,
                text: `HERE IS REAL-TIME ODDS DATA. Use ONLY this data to build the parlay. Do NOT search the web.\n\n${sportsData}\n---\n\n${block.text}`
              };
            }
            return block;
          });
          return { ...msg, content: newContent };
        }
        return msg;
      });

      requestBody = { ...req.body, messages };
      console.log(JSON.stringify({ event: 'using_odds_api', sport }));
    } else {
      // Fallback to web search (image uploads or if odds API fails)
      requestBody = {
        ...req.body,
        tools: [{ type: "web_search_20250305", name: "web_search" }]
      };
      console.log(JSON.stringify({ event: 'using_web_search', reason: hasImage ? 'image' : 'no_odds_data' }));
    }

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
      event: 'analysis_response',
      timestamp: new Date().toISOString(),
      mode,
      used_odds_api: !!sportsData,
      success: !data.error,
      input_tokens: data.usage?.input_tokens || 0,
      output_tokens: data.usage?.output_tokens || 0,
    }));

    return res.status(200).json(data);
  } catch (error) {
    console.log(JSON.stringify({ event: 'analysis_error', error: error.message }));
    return res.status(500).json({ error: error.message });
  }
}
