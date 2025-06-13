import { chromium } from 'playwright';
import { getRandomUserAgent } from './utils/utils.js';

let browser = null;
let context = null;
let page = null;

export async function initializeBrowser(headless = true) {
  try {
    console.log('🔍 Initializing browser...');
    
    // Launch browser with specific configuration
    browser = await chromium.launch({
      headless: headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1366,768'
      ]
    });

    // Create a new context with random user agent
    context = await browser.newContext({
      userAgent: getRandomUserAgent(),
      viewport: { width: 1366, height: 768 },
      extraHTTPHeaders: {
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Cache-Control': 'max-age=0'
      }
    });

    // Create a new page
    page = await context.newPage();
    
    return { browser, context, page };
  } catch (error) {
    console.error('❌ Browser initialization failed:', error);
    throw error;
  }
}

export async function closeBrowser() {
  try {
    if (page) await page.close();
    if (context) await context.close();
    if (browser) await browser.close();
  } catch (error) {
    console.error('❌ Error closing browser:', error);
  }
} 