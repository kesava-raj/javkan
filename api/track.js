export default function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (_) {}
    }
    body = body || {};

    const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    const requestCookies = req.headers['cookie'] || '';

    const visitorId = body.visitorId || (requestCookies.match(/javkan_vid=([^;]+)/)?.[1]) || 'anonymous';

    // Ensure first-party visitor cookie is set
    if (!requestCookies.includes('javkan_vid=')) {
      res.setHeader('Set-Cookie', `javkan_vid=${visitorId}; Path=/; Max-Age=31536000; SameSite=Lax`);
    }

    const logEntry = {
      timestamp: new Date().toISOString(),
      event: body.event || 'click',
      target: body.target || 'unknown',
      visitorId,
      path: body.path || '/',
      referrer: body.referrer || '',
      ip: clientIp,
      userAgent,
      cookies: body.cookies || requestCookies,
      details: body.details || {}
    };

    // Logged to Vercel Runtime Logs / Function Dashboard
    console.log('[JAVKAN_ANALYTICS]', JSON.stringify(logEntry));

    return res.status(200).json({ status: 'ok', recorded: true });
  } catch (error) {
    console.error('[JAVKAN_ANALYTICS_ERROR]', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
