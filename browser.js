import { chromium } from 'playwright';
import { getRandomUserAgent } from './utils/utils.js';

let browser = null;
let context = null;
let page = null;

export async function initializeBrowser(headless = true) {
  try {
    console.log('🔍 Initializing browser...');
    
    // Get the path to the installed Chromium browser
    const chromiumPath = '/opt/render/.cache/ms-playwright/chromium-1178/chrome-linux/chrome';
    console.log('Using Chromium path:', chromiumPath);

    browser = await chromium.launch({
      headless: headless,
      executablePath: chromiumPath,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-software-rasterizer",
        "--disable-extensions",
        "--single-process",
        "--no-zygote"
      ]
    });

    context = await browser.newContext({
      userAgent: getRandomUserAgent(),
      viewport: {
        width: 1366,
        height: 768,
      },
      deviceScaleFactor: 1,
      hasTouch: false,
      isMobile: false,
      locale: "en-US",
      timezoneId: "America/New_York",
    });

    page = await context.newPage();

    // Set extra headers
    await page.setExtraHTTPHeaders({
      "accept-Language": "en-US,en;q=0.9",
      "accept-encoding": "gzip, deflate, br",
    });

    return { browser, context, page };
  } catch (error) {
    console.error("❌ Browser initialization failed:", error);
    throw error;
  }
}

export async function closeBrowser() {
  if (browser) {
    await browser.close();
    browser = null;
    context = null;
    page = null;
  }
} 