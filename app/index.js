const express = require('express');
const puppeteer = require('puppeteer');
const { SocksProxyAgent } = require('socks-proxy-agent');
const fetch = require('node-fetch');
const cheerio = require('cheerio');
const NodeCache = require('node-cache');

// Create a page cache with TTL of 5 minutes
const pageCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

const app = express();

// Run cleanup every 5 minutes
setInterval(() => {
  try {
    pageCache.prune();
    console.log('Cache pruned');
  } catch (error) {
    console.error('Error pruning cache:', error);
  }
}, 300000);

// Add Tor connection management
let torConnected = false;
const TOR_CHECK_INTERVAL = 30000; // Check every 30 seconds
const TOR_MAX_RETRIES = 5;
const TOR_TIMEOUT = 60000;
const TOR_INITIAL_WAIT = 15000; // Increased initial wait time
const TOR_PROXY_HOST = process.env.TOR_PROXY_HOST || 'tor-proxy';
const TOR_PROXY_PORT = parseInt(process.env.TOR_PROXY_PORT || '9050', 10);

// Function to test TCP connection
async function testTcpConnection(host, port, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const net = require('net');
    const socket = new net.Socket();
    let isConnected = false;

    socket.setTimeout(timeout);

    socket.on('connect', () => {
      isConnected = true;
      socket.end();
      resolve(true);
    });

    socket.on('timeout', () => {
      socket.destroy();
      reject(new Error('Connection timeout'));
    });

    socket.on('error', (err) => {
      if (!isConnected) {
        reject(err);
      }
    });

    socket.on('close', () => {
      if (!isConnected) {
        reject(new Error('Connection closed'));
      }
    });

    socket.connect(port, host);
  });
}

async function waitForTorProxy() {
  console.log('Waiting for Tor proxy to be ready...');
  const startTime = Date.now();
  const maxWaitTime = 120000; // 2 minutes

  while (Date.now() - startTime < maxWaitTime) {
    try {
      await testTcpConnection(TOR_PROXY_HOST, TOR_PROXY_PORT);
      console.log('Tor proxy is ready!');
      return true;
    } catch (error) {
      console.log('Tor proxy not ready yet:', error.message);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  throw new Error('Timeout waiting for Tor proxy');
}

async function checkTorConnection() {
  // Initial wait and proxy check
  if (!torConnected) {
    console.log(`Waiting ${TOR_INITIAL_WAIT/1000} seconds for initial setup...`);
    await new Promise(resolve => setTimeout(resolve, TOR_INITIAL_WAIT));
    
    try {
      await waitForTorProxy();
    } catch (error) {
      console.error('Failed to connect to Tor proxy after waiting:', error.message);
      return false;
    }
  }

  let retries = 0;
  while (retries < TOR_MAX_RETRIES) {
    try {
      console.log(`Testing Tor connection (attempt ${retries + 1}/${TOR_MAX_RETRIES})...`);
      console.log(`Using Tor proxy at ${TOR_PROXY_HOST}:${TOR_PROXY_PORT}`);
      
      // Verify proxy connection first
      await testTcpConnection(TOR_PROXY_HOST, TOR_PROXY_PORT);
      console.log('Successfully connected to Tor proxy');
      
      // Create a new proxy agent
      const proxyAgent = new SocksProxyAgent(`socks5h://${TOR_PROXY_HOST}:${TOR_PROXY_PORT}`);
      proxyAgent.timeout = TOR_TIMEOUT;

      // Try multiple test endpoints
      const testEndpoints = [
        'https://check.torproject.org/api/ip',
        'https://am.i.mullvad.net/json',
        'https://ident.me'
      ];

      for (const endpoint of testEndpoints) {
        try {
          console.log(`Trying endpoint: ${endpoint}`);
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), TOR_TIMEOUT);
          
          const response = await fetch(endpoint, { 
            agent: proxyAgent,
            signal: controller.signal,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/json,*/*',
              'Accept-Language': 'en-US,en;q=0.9'
            }
          });

          clearTimeout(timeoutId);

          if (response.ok) {
            const text = await response.text();
            console.log(`Response from ${endpoint}:`, text);
            torConnected = true;
            return true;
          }
        } catch (endpointError) {
          console.log(`Endpoint ${endpoint} failed:`, endpointError.message);
          continue;
        }
      }

      throw new Error('All test endpoints failed');
    } catch (error) {
      console.error(`Tor connection attempt ${retries + 1} failed:`, error.message);
      retries++;
      if (retries < TOR_MAX_RETRIES) {
        const waitTime = Math.min(5000 * Math.pow(2, retries), 30000);
        console.log(`Waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  
  torConnected = false;
  return false;
}

// Initialize Tor connection check with retry
(async function initializeTorCheck() {
  let initialized = false;
  while (!initialized) {
    try {
      console.log('Initializing Tor connection check...');
      await checkTorConnection();
      initialized = true;
    } catch (error) {
      console.error('Failed to initialize Tor connection check:', error);
      console.log('Retrying in 10 seconds...');
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }
})();

// Check Tor connection periodically
setInterval(async () => {
  if (!torConnected) {
    console.log('Periodic Tor connection check...');
    await checkTorConnection();
  }
}, TOR_CHECK_INTERVAL);

// Basic health check
app.get('/health', (req, res) => {
  res.send('OK');
});

// Update the /check-tor endpoint
app.get('/check-tor', async (req, res) => {
  try {
    const isConnected = await checkTorConnection();
    if (isConnected) {
      res.json({ 
        status: 'ok',
        message: 'Tor connection is working',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(503).json({
        status: 'error',
        message: 'Tor connection failed after multiple retries',
        suggestion: 'Please try again later or use direct access',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Tor check failed:', error);
    res.status(500).json({ 
      status: 'error',
      message: error.message,
      suggestion: 'Please try again later or use direct access',
      timestamp: new Date().toISOString()
    });
  }
});

// Browser instance pool
let browserPool = [];
const MAX_POOL_SIZE = 2;

async function getBrowser(useTor) {
  // Try to reuse an existing browser from the pool
  let browser = browserPool.pop();
  if (browser) {
    try {
      // Test if browser is still usable
      await browser.version();
      return browser;
    } catch (error) {
      console.log('Removing dead browser from pool');
      try { await browser.close(); } catch (e) { /* ignore */ }
    }
  }

  // Launch new browser with optimized settings
  const launchOptions = {
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--window-size=1920,1080',
      '--disable-extensions',
      '--disable-background-networking',
      '--disable-default-apps',
      '--disable-sync',
      '--disable-translate',
      '--hide-scrollbars',
      '--metrics-recording-only',
      '--mute-audio',
      '--no-first-run',
      '--disable-features=site-per-process',
      '--disable-blink-features=AutomationControlled'
    ],
    ignoreHTTPSErrors: true,
    defaultViewport: {
      width: 1366,
      height: 768,
      deviceScaleFactor: 1
    }
  };

  if (useTor) {
    launchOptions.args.push('--proxy-server=socks5://tor-proxy:9050');
  }

  return await puppeteer.launch(launchOptions);
}

async function releaseBrowser(browser) {
  if (browserPool.length < MAX_POOL_SIZE) {
    browserPool.push(browser);
  } else {
    try { await browser.close(); } catch (e) { /* ignore */ }
  }
}

// Function to resolve URLs
function resolveUrl(baseUrl, relativeUrl) {
  try {
    // Handle special cases
    if (!relativeUrl || relativeUrl.startsWith('#') || relativeUrl.startsWith('javascript:')) {
      return null;
    }
    
    // Handle already absolute URLs
    if (relativeUrl.match(/^https?:\/\//i)) {
      return relativeUrl;
    }
    
    // Handle protocol-relative URLs
    if (relativeUrl.startsWith('//')) {
      const parsedBase = new URL(baseUrl);
      return `${parsedBase.protocol}${relativeUrl}`;
    }

    // Handle root-relative URLs (starting with /)
    if (relativeUrl.startsWith('/')) {
      const parsedBase = new URL(baseUrl);
      return `${parsedBase.protocol}//${parsedBase.host}${relativeUrl}`;
    }
    
    // Use the URL constructor for proper URL resolution
    return new URL(relativeUrl, baseUrl).href;
  } catch (error) {
    console.error('Error resolving URL:', error, {baseUrl, relativeUrl});
    // If URL parsing fails, try to construct a reasonable URL
    if (relativeUrl.startsWith('/')) {
      try {
        const domain = getDomainFromUrl(baseUrl);
        return `${domain}${relativeUrl}`;
      } catch (e) {
        console.error('Fallback URL resolution failed:', e);
        return null;
      }
    }
    return null;
  }
}

// Function to get domain from URL
function getDomainFromUrl(url) {
  try {
    const parsedUrl = new URL(url);
    return `${parsedUrl.protocol}//${parsedUrl.host}`;
  } catch (error) {
    console.error('Error parsing URL:', error);
    return url;
  }
}

// Add URL interceptor middleware before other routes
app.use((req, res, next) => {
  // Skip if it's already a /browse request or the homepage
  if (req.path === '/' || req.path.startsWith('/browse') || req.path === '/health' || req.path === '/check-tor') {
    return next();
  }

  // Get the original URL that was requested
  const originalUrl = req.originalUrl;
  
  // Check if this is an attempt to access an external URL directly
  if (originalUrl.includes('://')) {
    // Already contains a protocol, redirect to browse with the full URL
    const redirectUrl = `/browse?url=${encodeURIComponent(originalUrl)}`;
    return res.redirect(redirectUrl);
  }
  
  // Handle cases where the URL is entered without protocol
  if (!originalUrl.startsWith('/browse')) {
    // Assume https:// if no protocol is specified
    const assumedUrl = `https://${originalUrl.startsWith('/') ? originalUrl.slice(1) : originalUrl}`;
    const redirectUrl = `/browse?url=${encodeURIComponent(assumedUrl)}`;
    return res.redirect(redirectUrl);
  }

  // If we couldn't resolve the URL, continue to next middleware
  next();
});

// Function to rewrite HTML content and fix all links
function rewriteLinks(html, baseUrl, useTor) {
  try {
    const $ = cheerio.load(html, {
      decodeEntities: false,
      _useHtmlParser2: true
    });

    // Store base URL in a meta tag
    $('head').prepend(`<meta name="base-url" content="${baseUrl}">`);
    
    // Add the client-side URL handling script
    $('body').append(`
      <script>
        (function() {
          // Get base URL from meta tag
          function getBaseUrl() {
            const meta = document.querySelector('meta[name="base-url"]');
            return meta ? meta.getAttribute('content') : null;
          }

          // Function to resolve URLs
          function resolveUrl(base, relative) {
            if (!relative) return null;
            try {
              // Handle absolute URLs
              if (relative.match(/^https?:\\/\\//i)) {
                return relative;
              }
              
              // Create base URL object
              const baseUrl = new URL(base);
              
              // Handle root-relative URLs
              if (relative.startsWith('/')) {
                return \`\${baseUrl.protocol}//\${baseUrl.host}\${relative}\`;
              }
              
              // Handle all other URLs
              return new URL(relative, base).href;
            } catch (e) {
              console.error('Error resolving URL:', e);
              return null;
            }
          }

          // Function to create proxied URL
          function createProxiedUrl(url) {
            return '/browse?url=' + encodeURIComponent(url) + ${useTor ? "'&tor=true'" : "''"};
          }

          // Intercept all clicks
          document.addEventListener('click', function(e) {
            // Find closest anchor tag
            const link = e.target.closest('a');
            if (!link) return;

            const href = link.getAttribute('href');
            // Skip special links
            if (!href || href.startsWith('javascript:') || href.startsWith('#') || href.startsWith('mailto:')) {
              return;
            }

            // Skip if already proxied
            if (href.startsWith('/browse')) {
              return;
            }

            e.preventDefault();
            e.stopPropagation();

            const baseUrl = getBaseUrl();
            if (!baseUrl) {
              console.error('Base URL not found');
              return;
            }

            const absoluteUrl = resolveUrl(baseUrl, href);
            if (absoluteUrl) {
              console.log('Navigating:', href, '->', absoluteUrl);
              window.location.href = createProxiedUrl(absoluteUrl);
            }
          }, true);

          // Intercept form submissions
          document.addEventListener('submit', function(e) {
            const form = e.target;
            if (form.tagName !== 'FORM') return;

            const action = form.getAttribute('action');
            if (!action || action.startsWith('/browse')) return;

            e.preventDefault();

            const baseUrl = getBaseUrl();
            if (!baseUrl) return;

            const absoluteUrl = resolveUrl(baseUrl, action);
            if (absoluteUrl) {
              form.action = createProxiedUrl(absoluteUrl);
              form.submit();
            }
          }, true);

          // Override window.open
          const originalOpen = window.open;
          window.open = function(url, ...args) {
            if (!url) return null;
            
            const baseUrl = getBaseUrl();
            if (!baseUrl) return null;

            const absoluteUrl = resolveUrl(baseUrl, url);
            if (absoluteUrl) {
              return originalOpen(createProxiedUrl(absoluteUrl), ...args);
            }
            return null;
          };

          // Initialize URL interception
          console.log('URL interceptor initialized');
        })();
      </script>
    `);

    // Pre-process all links
    $('a').each((i, el) => {
      const $el = $(el);
      const href = $el.attr('href');
      
      if (href && !href.startsWith('javascript:') && !href.startsWith('#') && !href.startsWith('mailto:')) {
        try {
          const absoluteUrl = resolveUrl(baseUrl, href);
          if (absoluteUrl) {
            const proxiedUrl = `/browse?url=${encodeURIComponent(absoluteUrl)}${useTor ? '&tor=true' : ''}`;
            $el.attr('href', proxiedUrl);
            $el.attr('data-original-url', href);
          }
        } catch (error) {
          console.error('Error processing link:', error, { href });
        }
      }
    });

    return $.html();
  } catch (error) {
    console.error('Error rewriting links:', error);
    return html;
  }
}

// Browse endpoint
app.get('/browse', async (req, res) => {
  let url = req.query.url;
  const useTor = req.query.tor === 'true';
  const bypassCache = req.query.bypass_cache === 'true';
  
  if (!url) {
    return res.status(400).send('Missing URL parameter');
  }

  console.log('Original requested URL:', url);

  // Handle special cases for certain news sites
  const specialDomains = {
    'themoscowtimes.com': 'https://www.themoscowtimes.com',
    'moscowtimes.com': 'https://www.themoscowtimes.com',
    'www.moscowtimes.com': 'https://www.themoscowtimes.com'
  };

  // Check if this is a special domain
  const domainMatch = url.match(/^(?:https?:\/\/)?(?:www\.)?([^\/]+)/i);
  if (domainMatch && specialDomains[domainMatch[1]]) {
    const originalDomain = domainMatch[1];
    url = url.replace(/^(?:https?:\/\/)?(?:www\.)?[^\/]+/, specialDomains[originalDomain]);
    console.log(`Special domain "${originalDomain}" detected, redirecting to:`, url);
  }

  // Ensure URL has a protocol
  if (!url.match(/^https?:\/\//i)) {
    url = 'https://' + url.replace(/^\/+/, '');
    console.log('Added https protocol:', url);
  }

  // Validate URL format
  try {
    const parsedUrl = new URL(url);
    console.log('Parsed URL:', {
      protocol: parsedUrl.protocol,
      hostname: parsedUrl.hostname,
      pathname: parsedUrl.pathname,
      search: parsedUrl.search
    });
  } catch (error) {
    console.error('URL parsing error:', error);
    return res.status(400).send(`Invalid URL format: ${error.message}`);
  }

  // Generate a cache key from URL and Tor usage
  const cacheKey = `${url}-${useTor ? 'tor' : 'direct'}`;
  
  // Check if we have a cached version and bypass_cache is not set
  if (!bypassCache && pageCache.has(cacheKey)) {
    console.log(`Serving cached version of ${url}`);
    return res.send(pageCache.get(cacheKey));
  }

  console.log(`Browsing ${url} ${useTor ? 'with' : 'without'} Tor`);

  let browser;
  try {
    console.log('Launching browser...');
    browser = await getBrowser(useTor);
    console.log('Browser launched successfully');
    
    const page = await browser.newPage();
    
    // Set permissions
    const context = browser.defaultBrowserContext();
    await context.overridePermissions(url, ['geolocation']);
    
    // Set more realistic browser fingerprinting
    await page.evaluateOnNewDocument(() => {
      // Override navigator properties
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
      
      // Add Chrome-specific properties
      window.chrome = {
        runtime: {},
        loadTimes: function() {},
        csi: function() {},
        app: {}
      };
    });

    // Set realistic headers
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
      'Accept-Encoding': 'gzip, deflate, br',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1'
    });

    // Navigate with optimized settings
    console.log(`Navigating to ${url}...`);
    const response = await page.goto(url, { 
      waitUntil: 'domcontentloaded',
      timeout: useTor ? 60000 : 30000
    });

    if (!response) {
      throw new Error('No response received from the page');
    }

    console.log('Response status:', response.status());
    if (response.status() >= 400) {
      throw new Error(`HTTP ${response.status()}: ${response.statusText()}`);
    }

    // Get the content
    console.log('Getting page content...');
    const content = await page.content();
    
    // Process the content
    console.log('Processing content...');
    const rewrittenContent = rewriteLinks(content, url, useTor);
    
    // Cache the result
    pageCache.set(cacheKey, rewrittenContent);
    
    // Send the response
    res.send(rewrittenContent);

  } catch (error) {
    console.error('Error during browsing:', error);
    console.error('Stack trace:', error.stack);
    
    if (error.message.includes('Navigation timeout') || 
        error.message.includes('net::ERR_TIMED_OUT')) {
      return res.status(504).send(`
        <h1>Page Load Timeout</h1>
        <p>The page took too long to load. This can happen when:</p>
        <ul>
          <li>The site is blocking automated browsers</li>
          <li>The site is experiencing high load</li>
          <li>There are network connectivity issues</li>
          ${useTor ? '<li>The Tor network is experiencing slowdowns</li>' : ''}
        </ul>
        <p>You can try:</p>
        <ul>
          <li><a href="/browse?url=${encodeURIComponent(url)}&bypass_cache=true">Refresh the page</a></li>
          <li><a href="/browse?url=${encodeURIComponent(url)}${useTor ? '' : '&tor=true'}">Try ${useTor ? 'without' : 'with'} Tor</a></li>
          <li><a href="/">Return to homepage</a></li>
        </ul>
        <p><small>Error details: ${error.message}</small></p>
      `);
    }
    
    res.status(500).send(`
      <h1>Error Loading Page</h1>
      <p>There was a problem loading the requested page.</p>
      <p>This might be because:</p>
      <ul>
        <li>The website is blocking our access</li>
        <li>The website requires JavaScript for core functionality</li>
        <li>There was a network error</li>
      </ul>
      <p>You can try:</p>
      <ul>
        <li><a href="/browse?url=${encodeURIComponent(url)}&bypass_cache=true">Refresh the page</a></li>
        <li><a href="/browse?url=${encodeURIComponent(url)}${useTor ? '' : '&tor=true'}">Try ${useTor ? 'without' : 'with'} Tor</a></li>
        <li><a href="/">Return to homepage</a></li>
      </ul>
      <p><small>Error details: ${error.message}</small></p>
    `);
  } finally {
    if (browser) {
      console.log('Releasing browser...');
      await releaseBrowser(browser);
    }
  }
});

// Replace just the home page route with this simpler version
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Privacy Browser</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          max-width: 1000px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f5f5f5;
          color: #333;
        }
        h1, h2, h3 {
          color: #2c3e50;
        }
        .search-box {
          background: white;
          padding: 20px;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          margin-bottom: 20px;
        }
        input[type="text"] {
          width: 100%;
          padding: 8px;
          margin-bottom: 10px;
          border: 1px solid #ddd;
          border-radius: 4px;
        }
        .btn {
          display: inline-block;
          padding: 8px 16px;
          background: #3498db;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          text-decoration: none;
          margin-right: 5px;
        }
        .btn-tor {
          background: #9b59b6;
        }
        .news-section {
          background: white;
          padding: 20px;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          margin-bottom: 20px;
        }
        .news-site {
          margin-bottom: 15px;
          padding-bottom: 15px;
          border-bottom: 1px solid #eee;
        }
        .news-site:last-child {
          border-bottom: none;
          margin-bottom: 0;
          padding-bottom: 0;
        }
      </style>
    </head>
    <body>
      <h1>Privacy-First News Browser</h1>
      
      <div class="search-box">
        <h3>Browse Any Website</h3>
        <form action="/browse" method="get">
          <input type="text" name="url" placeholder="https://example.com" required>
          <button type="submit" class="btn">Browse Directly</button>
          <button type="submit" class="btn btn-tor" name="tor" value="true">Browse via Tor</button>
        </form>
      </div>
      
      <div class="news-section">
        <h2>News Sources</h2>
        
        <div class="news-site">
          <h3>BBC News</h3>
          <a href="/browse?url=https://www.bbc.com/news" class="btn">Direct</a>
          <a href="/browse?url=https://www.bbc.com/news&tor=true" class="btn btn-tor">Via Tor</a>
        </div>
        
        <div class="news-site">
          <h3>Reuters</h3>
          <a href="/browse?url=https://www.reuters.com/" class="btn">Direct</a>
          <a href="/browse?url=https://www.reuters.com/&tor=true" class="btn btn-tor">Via Tor</a>
        </div>
        
        <div class="news-site">
          <h3>Associated Press</h3>
          <a href="/browse?url=https://apnews.com/" class="btn">Direct</a>
          <a href="/browse?url=https://apnews.com/&tor=true" class="btn btn-tor">Via Tor</a>
        </div>
        
        <div class="news-site">
          <h3>CNN</h3>
          <a href="/browse?url=https://www.cnn.com/" class="btn">Direct</a>
          <a href="/browse?url=https://www.cnn.com/&tor=true" class="btn btn-tor">Via Tor</a>
        </div>
        
        <div class="news-site">
          <h3>The Guardian</h3>
          <a href="/browse?url=https://www.theguardian.com/international" class="btn">Direct</a>
          <a href="/browse?url=https://www.theguardian.com/international&tor=true" class="btn btn-tor">Via Tor</a>
        </div>
        
        <div class="news-site">
          <h3>Wall Street Journal</h3>
          <a href="/browse?url=https://www.wsj.com/" class="btn">Direct</a>
          <a href="/browse?url=https://www.wsj.com/&tor=true" class="btn btn-tor">Via Tor</a>
        </div>

        <div class="news-site">
          <h3>Washington Post</h3>
          <a href="/browse?url=https://www.washingtonpost.com/" class="btn">Direct</a>
          <a href="/browse?url=https://www.washingtonpost.com/&tor=true" class="btn btn-tor">Via Tor</a>
        </div>
      </div>
      
      <div class="news-section">
        <h2>International News</h2>
        
        <div class="news-site">
          <h3>Al Jazeera (Middle East)</h3>
          <a href="/browse?url=https://www.aljazeera.com/" class="btn">Direct</a>
          <a href="/browse?url=https://www.aljazeera.com/&tor=true" class="btn btn-tor">Via Tor</a>
        </div>
        
        <div class="news-site">
          <h3>NDTV (India)</h3>
          <a href="/browse?url=https://www.ndtv.com/" class="btn">Direct</a>
          <a href="/browse?url=https://www.ndtv.com/&tor=true" class="btn btn-tor">Via Tor</a>
        </div>
        
        <div class="news-site">
          <h3>India.com</h3>
          <a href="/browse?url=https://www.india.com/" class="btn">Direct</a>
          <a href="/browse?url=https://www.india.com/&tor=true" class="btn btn-tor">Via Tor</a>
        </div>
        
        <div class="news-site">
          <h3>Ynet (Israel, English)</h3>
          <a href="/browse?url=https://www.ynetnews.com/" class="btn">Direct</a>
          <a href="/browse?url=https://www.ynetnews.com/&tor=true" class="btn btn-tor">Via Tor</a>
        </div>
        
        <div class="news-site">
          <h3>The Moscow Times (Russia, English)</h3>
          <a href="/browse?url=https://www.themoscowtimes.com/" class="btn">Direct</a>
          <a href="/browse?url=https://www.themoscowtimes.com/&tor=true" class="btn btn-tor">Via Tor</a>
        </div>
        
        <div class="news-site">
          <h3>Kyiv Post (Ukraine, English)</h3>
          <a href="/browse?url=https://www.kyivpost.com/" class="btn">Direct</a>
          <a href="/browse?url=https://www.kyivpost.com/&tor=true" class="btn btn-tor">Via Tor</a>
        </div>
        
        <div class="news-site">
          <h3>Deutsche Welle (Germany, English)</h3>
          <a href="/browse?url=https://www.dw.com/en/" class="btn">Direct</a>
          <a href="/browse?url=https://www.dw.com/en/&tor=true" class="btn btn-tor">Via Tor</a>
        </div>
        
        <div class="news-site">
          <h3>The Local (Sweden, English)</h3>
          <a href="/browse?url=https://www.thelocal.se/" class="btn">Direct</a>
          <a href="/browse?url=https://www.thelocal.se/&tor=true" class="btn btn-tor">Via Tor</a>
        </div>
        
        <div class="news-site">
          <h3>Buenos Aires Times (Latin America, English)</h3>
          <a href="/browse?url=https://www.batimes.com.ar/" class="btn">Direct</a>
          <a href="/browse?url=https://www.batimes.com.ar/&tor=true" class="btn btn-tor">Via Tor</a>
        </div>
        
        <div class="news-site">
          <h3>AllAfrica (Africa, English)</h3>
          <a href="/browse?url=https://allafrica.com/" class="btn">Direct</a>
          <a href="/browse?url=https://allafrica.com/&tor=true" class="btn btn-tor">Via Tor</a>
        </div>
        
        <div class="news-site">
          <h3>The National (UAE, English)</h3>
          <a href="/browse?url=https://www.thenationalnews.com/" class="btn">Direct</a>
          <a href="/browse?url=https://www.thenationalnews.com/&tor=true" class="btn btn-tor">Via Tor</a>
        </div>
      </div>
      
      <div class="news-section">
        <h2>Technology News</h2>
        
        <div class="news-site">
          <h3>The Verge</h3>
          <a href="/browse?url=https://www.theverge.com/" class="btn">Direct</a>
          <a href="/browse?url=https://www.theverge.com/&tor=true" class="btn btn-tor">Via Tor</a>
        </div>
        
        <div class="news-site">
          <h3>Wired</h3>
          <a href="/browse?url=https://www.wired.com/" class="btn">Direct</a>
          <a href="/browse?url=https://www.wired.com/&tor=true" class="btn btn-tor">Via Tor</a>
        </div>
        
        <div class="news-site">
          <h3>Ars Technica</h3>
          <a href="/browse?url=https://arstechnica.com/" class="btn">Direct</a>
          <a href="/browse?url=https://arstechnica.com/&tor=true" class="btn btn-tor">Via Tor</a>
        </div>
      </div>
      
      <div class="news-section">
        <h2>Tools</h2>
        <div class="news-site">
          <h3>Check Tor Connection</h3>
          <a href="/check-tor" class="btn btn-tor">Check Tor Status</a>
        </div>
        
        <div class="news-site">
          <h3>DuckDuckGo Search</h3>
          <a href="/browse?url=https://duckduckgo.com/" class="btn">Direct</a>
          <a href="/browse?url=https://duckduckgo.com/&tor=true" class="btn btn-tor">Via Tor</a>
        </div>
      </div>
      
      <div style="text-align: center; margin-top: 20px; color: #777;">
        Privacy-First Browser &copy; ${new Date().getFullYear()}
      </div>
    </body>
    </html>
  `);
});

app.listen(3000, '0.0.0.0', () => {
  console.log('Server running on port 3000');
});
