import 'dotenv/config';
import { chromium } from '@playwright/test';
import {
  getRandomUserAgent,
  getRandomDelay,
  sanitizeHtml,
} from "./utils/utils.js";
import { promises as fs } from "fs";
import OpenAI from "openai";
import { sendEmail } from "./utils/buttondown.js";

console.log("🚀 Script starting...");

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Rate limiting configuration
const RATE_LIMIT_CONFIG = {
  batchSize: 30,
  batchDelay: 500,
  maxRetries: 3,
  retryDelay: 1000,
};

let browser = null;
let context = null;
let page = null;

async function initializeBrowser(headless = false) {
  const randomUserAgent = getRandomUserAgent();

  try {
    console.log("🚀 Launching browser...");
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-zygote',
        '--single-process',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process'
      ]
    });
    console.log("✅ Browser launched successfully");
    
    context = await browser.newContext({
      userAgent: randomUserAgent,
      viewport: { width: 1366, height: 768 },
      extraHTTPHeaders: {
        "accept-Language": "en-US,en;q=0.9",
        "accept-encoding": "gzip, deflate, br",
      },
      // Add geolocation to appear more like a real user
      geolocation: { longitude: -78.8784, latitude: 42.8864 }, // Buffalo, NY coordinates
      permissions: ['geolocation'],
      // Add timezone to appear more like a local user
      timezoneId: 'America/New_York',
      // Add locale
      locale: 'en-US',
    });

    page = await context.newPage();
    
    // Add event listeners for better debugging
    page.on('console', msg => console.log('Browser console:', msg.text()));
    page.on('pageerror', err => console.error('Browser page error:', err));
    page.on('requestfailed', request => 
      console.error('Request failed:', request.url(), request.failure().errorText)
    );

    console.log("✅ Browser initialization completed successfully");
    return true;
  } catch (error) {
    console.error("❌ Browser initialization failed:", error.message);
    console.error("Error details:", error);
    throw error;
  }
}

async function getEventData(url = null) {
  if (!url) {
    url = "https://stepoutbuffalo.com/all-events/";
  }

  try {
    console.log("🌐 Navigating to Step Out Buffalo events page...");
    await page.goto(url, {
      waitUntil: "networkidle",
      timeout: 60000,
    });

    // Wait for the main content to be visible
    await page.waitForSelector('body', { state: 'visible' });
    await getRandomDelay(6000, 8000);

    console.log("📜 Starting page scroll to load all content...");
    await autoScroll(page);

    console.log("⏳ Waiting for content to settle...");
    await getRandomDelay(4000, 5000);

    console.log("🔍 Looking for event elements...");
    const events = await extractEvents();

    return {
      metadata: {
        totalEventsScraped: events.totalEvents,
        eventsWithZip14075: events.filteredEvents.length,
        scrapedAt: new Date().toISOString(),
        sourceUrl: url
      },
      events: events.filteredEvents
    };

  } catch (error) {
    console.error("❌ Error scraping elements:", error.message);
    await page.screenshot({ path: "error-screenshot.png" });
    console.log("📸 Error screenshot saved as 'error-screenshot.png'");
    return null;
  }
}

async function autoScroll(page) {
  const scrollDuration = 4000;
  const scrollStep = 200;
  const scrollInterval = 100;

  const startTime = Date.now();
  while (Date.now() - startTime < scrollDuration) {
    await page.evaluate((step) => {
      window.scrollBy(0, step);
    }, scrollStep);
    await page.waitForTimeout(scrollInterval);
  }

  await page.evaluate(() => {
    window.scrollTo(0, document.body.scrollHeight);
  });
}

async function extractEvents() {
  const selectors = [
    '[class*="FourCol  cardBox"]',
    '[class*="cardBox"]',
    ".event-card",
    ".event-item",
  ];

  let cardBoxElements = [];
  for (const selector of selectors) {
    console.log(`Trying selector: ${selector}`);
    cardBoxElements = await page.$$(selector);
    if (cardBoxElements.length > 0) {
      console.log(`✅ Found ${cardBoxElements.length} elements with selector: ${selector}`);
      break;
    }
  }

  if (cardBoxElements.length === 0) {
    console.log("❌ No event elements found with any selector");
    await page.screenshot({ path: "debug-screenshot.png" });
    console.log("📸 Debug screenshot saved as 'debug-screenshot.png'");
    return { totalEvents: 0, filteredEvents: [] };
  }

  console.log(`📦 Found ${cardBoxElements.length} event elements`);

  const events = [];
  for (const element of cardBoxElements) {
    const eventData = await element.evaluate((el) => {
      const eventName = el.querySelector('h3')?.textContent?.trim() || '';
      const date = el.querySelector('.event-date')?.textContent?.trim() || '';
      const location = el.querySelector('.event-location')?.textContent?.trim() || '';
      const generalArea = el.querySelector('.event-area')?.textContent?.trim() || '';
      const detailedPageLink = el.querySelector('a')?.href || '';
      const imageUrl = el.querySelector('img')?.src || '';
      const zipCode = location.includes('14075') ? '14075' : '';

      return {
        eventName,
        date,
        location,
        generalArea,
        detailedPageLink,
        imageUrl,
        zipCode
      };
    });

    if (eventData.zipCode === '14075') {
      events.push(eventData);
    }
  }

  return {
    totalEvents: cardBoxElements.length,
    filteredEvents: events
  };
}

async function scrapeStepoutBuffaloProperties() {
  try {
    console.log("🚀 Initializing browser...");
    await initializeBrowser(false);

    console.log("📊 Starting data extraction...");
    const data = await getEventData(null);

    if (data) {
      console.log("✅ Data extraction completed successfully!");
      return data;
    } else {
      console.log("❌ No data was extracted");
      return null;
    }
  } catch (error) {
    console.error("❌ Scraping error:", error.message);
    throw error;
  } finally {
    console.log("🧹 Closing browser...");
    if (context) await context.close();
    if (browser) await browser.close();
  }
}

async function extractEventDataWithGPT(htmlContent, index) {
  let retries = 0;

  while (retries <= RATE_LIMIT_CONFIG.maxRetries) {
    try {
      console.log(
        `  🤖 Sending event ${index} to GPT-4 for analysis... ${
          retries > 0 ? `(retry ${retries})` : ""
        }`
      );

      const prompt = `
Extract event information from this HTML content. Return a JSON object with the following structure:
{
  "eventName": "string",
  "date": "string", 
  "location": "string",
  "generalArea": "string",
  "detailedPageLink": "string (full URL if available)",
  "imageUrl": "string (primary event image URL if available)",
  "zipCode": "string (if mentioned)",
  "hasZipCode14075": boolean
}

Look for:
- Event name/title
- Date and time information
- Specific location/venue
- General area/neighborhood
- Any links to detailed event pages
- Primary event image URL (look for both img src attributes AND CSS background-image properties in style attributes)
- Zip code 14075 specifically or any zip codes
- Set hasZipCode14075 to true if zip code 14075 is found anywhere in the content

HTML Content:
${htmlContent}

Return only valid JSON, no additional text or markdown formatting.
      `;

      const response = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant that extracts event information from HTML content and returns it in a structured JSON format.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 500,
      });

      const content = response.choices[0].message.content;
      return JSON.parse(content);
    } catch (error) {
      console.error(`  ❌ Error processing event ${index}:`, error.message);
      retries++;
      if (retries <= RATE_LIMIT_CONFIG.maxRetries) {
        console.log(`  ⏳ Retrying in ${RATE_LIMIT_CONFIG.retryDelay}ms...`);
        await new Promise((resolve) =>
          setTimeout(resolve, RATE_LIMIT_CONFIG.retryDelay)
        );
      } else {
        console.error(`  ❌ Max retries reached for event ${index}`);
        return null;
      }
    }
  }
}

// Export the main scraping function
export { scrapeStepoutBuffaloProperties };
