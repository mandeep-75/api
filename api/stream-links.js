import fetch from 'node-fetch';
const Link = 'YXV0b2VtYmVkLmNj';

function decodeBase64(encoded) {
  return atob(encoded);
}

async function fetchHTML(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch URL: ${url}, Status: ${res.status}`);
  }
  return res.text();
}

async function extractLinks(url) {
  try {
    const html = await fetchHTML(url);
    const links = [];
    const regex = /"title":\s*"([^"]+)",\s*"file":\s*"([^"]+)"/g;

    let match;
    while ((match = regex.exec(html))) {
      const [, lang, url] = match;
      links.push({ lang, url });
    }
    return links;
  } catch (err) {
    console.error('Error extracting links:', err);
    return [];
  }
}

async function getStreamingLinks(imdbId, type, season = null, episode = null) {
  try {
    const streams = [];

    const seasonQuery = season ? `&s=${season}` : '';
    const episodeQuery = episode ? `&e=${episode}` : season ? '&e=1' : '';

    // Server 1
    const server1Url =
      type === 'movie'
        ? `https://${decodeBase64(Link)}/embed/oplayer.php?id=${imdbId}`
        : `https://${decodeBase64(Link)}/embed/oplayer.php?id=${imdbId}${seasonQuery}${episodeQuery}`;
    const links1 = await extractLinks(server1Url);
    links1.forEach(({ lang, url }) => {
      streams.push({
        server: 'Server 1' + (lang ? ` - ${lang}` : ''),
        link: url,
        type: 'm3u8',
      });
    });

    // Server 4
    const server4Url =
      type === 'movie'
        ? `https://${decodeBase64(Link)}/embed/player.php?id=${imdbId}`
        : `https://${decodeBase64(Link)}/embed/player.php?id=${imdbId}${seasonQuery}${episodeQuery}`;
    const links4 = await extractLinks(server4Url);
    links4.forEach(({ lang, url }) => {
      streams.push({
        server: 'Server 4' + (lang ? ` - ${lang}` : ''),
        link: url,
        type: 'm3u8',
      });
    });

    // Server 3
    const server3Url =
      type === 'movie'
        ? `https://viet.${decodeBase64(Link)}/movie/${imdbId}`
        : `https://viet.${decodeBase64(Link)}/tv/${imdbId}/${season || 1}/${episode || 1}`;
    const links3 = await extractLinks(server3Url);
    links3.forEach(({ lang, url }) => {
      streams.push({
        server: 'Server 3' + (lang ? ` - ${lang}` : ''),
        link: url,
        type: 'm3u8',
      });
    });

    // Server 5
    const server5Url =
      type === 'movie'
        ? `https://tom.${decodeBase64(Link)}/api/getVideoSource?type=movie&id=${imdbId}`
        : `https://tom.${decodeBase64(Link)}/api/getVideoSource?type=tv&id=${imdbId}${seasonQuery}/${episode || 1}`;
    try {
      const res = await fetch(server5Url, {
        headers: {
          'user-agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:101.0) Gecko/20100101 Firefox/101.0',
          Referer: `https://${decodeBase64(Link)}/`,
        },
      });
      const data = await res.json();
      if (data.videoSource) {
        streams.push({
          server: 'Server 5',
          link: data.videoSource,
          type: 'm3u8',
        });
      }
    } catch (err) {
      console.error('Error fetching server 5 links:', err);
    }

    return streams;
  } catch (err) {
    console.error('Error in getStreamingLinks:', err);
    return [];
  }
}

export default async function handler(req, res) {
  const { imdbId, type, season, episode } = req.query;

  if (!imdbId || !type) {
    return res.status(400).json({ error: 'IMDb ID and type are required.' });
  }

  // Handle CORS for multiple origins: https://movies-react.vercel.app/ and localhost
  const allowedOrigins = ['https://movies-react.vercel.app', 'http://localhost:5173']; // Add other localhost ports if necessary
  const origin = req.headers.origin;

  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin); // Allow only the specific origin
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  } else {
    res.setHeader('Access-Control-Allow-Origin', ''); // Deny access to others
  }

  try {
    const streams = await getStreamingLinks(imdbId, type, season, episode);
    res.json({ streams });
  } catch (err) {
    console.error('Error fetching streaming links:', err);
    res.status(500).json({ error: 'Failed to fetch streaming links.' });
  }
}
