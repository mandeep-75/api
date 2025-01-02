import { VercelRequest, VercelResponse } from '@vercel/node';
import fetch from 'node-fetch';

type Links = {
  lang: string;
  url: string;
};

type Stream = {
  server: string;
  link: string;
  type: string;
  subtitles?: any[];
  headers?: Record<string, string>;
};

const autoembed = 'YXV0b2VtYmVkLmNj';

function decodeBase64(encoded: string): string {
  return Buffer.from(encoded, 'base64').toString('utf-8');
}

async function fetchHTML(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch URL: ${url}, Status: ${res.status}`);
  }
  return res.text();
}

async function extractLinks(url: string): Promise<Links[]> {
  try {
    const html = await fetchHTML(url);
    const links: Links[] = [];
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

async function getStreamingLinks(imdbId: string, type: string): Promise<Stream[]> {
  try {
    const streams: Stream[] = [];

    // Server 1
    const server1Url =
      type === 'movie'
        ? `https://${decodeBase64(autoembed)}/embed/oplayer.php?id=${imdbId}`
        : `https://${decodeBase64(autoembed)}/embed/oplayer.php?id=${imdbId}&s=1&e=1`;
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
        ? `https://${decodeBase64(autoembed)}/embed/player.php?id=${imdbId}`
        : `https://${decodeBase64(autoembed)}/embed/player.php?id=${imdbId}&s=1&e=1`;
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
        ? `https://viet.${decodeBase64(autoembed)}/movie/${imdbId}`
        : `https://viet.${decodeBase64(autoembed)}/tv/${imdbId}/1/1`;
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
        ? `https://tom.${decodeBase64(autoembed)}/api/getVideoSource?type=movie&id=${imdbId}`
        : `https://tom.${decodeBase64(autoembed)}/api/getVideoSource?type=tv&id=${imdbId}/1/1`;
    try {
      const res = await fetch(server5Url, {
        headers: {
          'user-agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:101.0) Gecko/20100101 Firefox/101.0',
          Referer: `https://${decodeBase64(autoembed)}/`,
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { imdbId, type } = req.query;

  if (!imdbId || !type) {
    return res.status(400).json({ error: 'IMDb ID and type are required.' });
  }

  try {
    const streams = await getStreamingLinks(imdbId as string, type as string);
    res.json({ streams });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch streaming links.' });
  }
}