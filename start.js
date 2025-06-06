import 'dotenv/config';
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
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
  apiKey: process.env.OPENAI_API_KEY, // Make sure to set this environment variable
});

// Rate limiting configuration
const RATE_LIMIT_CONFIG = {
  batchSize: 30, // Requests per batch (adjust based on your tier)
  batchDelay: 500, // Delay between batches in ms
  maxRetries: 3, // Max retries for rate limit errors
  retryDelay: 1000, // Initial retry delay in ms
};

puppeteer.use(StealthPlugin());

let browser = null;
let page = null;

async function initializeBrowser(headless = false) {
  const randomUserAgent = getRandomUserAgent();

  let launchOptions = {
    headless: headless,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--start-maximized"],
  };

  try {
    browser = await puppeteer.launch(launchOptions);
    page = await browser.newPage();

    await page.setUserAgent(randomUserAgent);
    await page.setExtraHTTPHeaders({
      "accept-Language": "en-US,en;q=0.9",
      "accept-encoding": "gzip, deflate, br",
    });

    // Set viewport to ensure consistent dimensions
    await page.setViewport({
      width: 1366,
      height: 768,
      deviceScaleFactor: 1,
      hasTouch: false,
      isLandscape: true,
      isMobile: false,
    });

    return true;
  } catch (error) {
    console.error("❌ Browser initialization failed:", error.message);
    throw error;
  }
}

async function getEventData(url = null) {
  if (!url) {
    url = "https://stepoutbuffalo.com/all-events/";
  }

  console.log("🌐 Navigating to Step Out Buffalo events page...");
  await page.goto(url, {
    waitUntil: "networkidle2",
    timeout: 60000,
  });

  await getRandomDelay(6000, 8000);

  try {
    console.log("📜 Starting page scroll to load all content...");
    const scrollDuration = 4000;
    const scrollStep = 200;
    const scrollInterval = 100;

    const startTime = Date.now();
    while (Date.now() - startTime < scrollDuration) {
      await page.evaluate((step) => {
        window.scrollBy(0, step);
      }, scrollStep);
      await new Promise((resolve) => setTimeout(resolve, scrollInterval));
    }

    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });

    console.log("⏳ Waiting for content to settle...");
    await getRandomDelay(4000, 5000);

    console.log("🔍 Looking for event elements...");

    // Try multiple selectors to find events
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
        console.log(
          `✅ Found ${cardBoxElements.length} elements with selector: ${selector}`
        );
        break;
      }
    }

    if (cardBoxElements.length === 0) {
      console.log("❌ No event elements found with any selector");
      // Take a screenshot for debugging
      await page.screenshot({ path: "debug-screenshot.png" });
      console.log("📸 Debug screenshot saved as 'debug-screenshot.png'");
      return null;
    }

    console.log(`📦 Found ${cardBoxElements.length} event elements`);

    const mainElement = await page.$(selectors[0]);

    if (!mainElement) {
      console.log("❌ Main element not found");
      return null;
    }

    console.log("✅ Main element found, searching for cardBox elements...");

    const mainElementData = await page.evaluate((element) => {
      return {
        innerHTML: element.innerHTML,
        outerHTML: element.outerHTML,
        textContent: element.textContent.trim(),
        className: element.className,
        id: element.id,
        tagName: element.tagName,
      };
    }, mainElement);

    console.log("🤖 Starting GPT-4o processing for each event...");

    // Process events in parallel batches to maximize throughput
    const batchSize = RATE_LIMIT_CONFIG.batchSize; // Adjust based on your rate limits
    const cardBoxData = [];

    for (
      let batchStart = 0;
      batchStart < cardBoxElements.length;
      batchStart += batchSize
    ) {
      const batchEnd = Math.min(batchStart + batchSize, cardBoxElements.length);
      const batch = cardBoxElements.slice(batchStart, batchEnd);

      console.log(
        `🚀 Processing batch ${
          Math.floor(batchStart / batchSize) + 1
        }/${Math.ceil(cardBoxElements.length / batchSize)} (events ${
          batchStart + 1
        }-${batchEnd})`
      );

      // Process batch in parallel
      const batchPromises = batch.map(async (element, batchIndex) => {
        const globalIndex = batchStart + batchIndex;
        console.log(
          `🔄 Processing event ${globalIndex + 1}/${cardBoxElements.length}...`
        );

        const basicData = await page.evaluate(
          (el, idx) => {
            // Extract image URLs from img tags
            const imgTags = Array.from(el.querySelectorAll("img")).map(
              (img) => ({
                type: "img",
                src: img.src,
                alt: img.alt || "",
                title: img.title || "",
              })
            );

            // Extract background images from style attributes
            const backgroundImages = [];
            const elementsWithBg = Array.from(el.querySelectorAll("*")).filter(
              (element) => {
                const style = element.getAttribute("style");
                return style && style.includes("background-image");
              }
            );

            elementsWithBg.forEach((element) => {
              const style = element.getAttribute("style");
              const bgImageMatch = style.match(
                /background-image:\s*url\(['"]?([^'")\s]+)['"]?\)/
              );
              if (bgImageMatch) {
                backgroundImages.push({
                  type: "background",
                  src: bgImageMatch[1],
                  className: element.className || "",
                  element: element.tagName,
                });
              }
            });

            // Combine all images
            const allImages = [...imgTags, ...backgroundImages];

            return {
              index: idx + 1,
              innerHTML: el.innerHTML,
              outerHTML: el.outerHTML,
              textContent: el.textContent.trim(),
              className: el.className,
              id: el.id,
              tagName: el.tagName,
              images: allImages,
            };
          },
          element,
          globalIndex
        );

        console.log(
          `  📸 Found ${basicData.images.length} image(s) in event ${
            globalIndex + 1
          }:`
        );
        basicData.images.forEach((img, imgIndex) => {
          if (img.type === "background") {
            console.log(`    🎨 Background image: ${img.src}`);
          } else {
            console.log(`    🖼️ IMG tag: ${img.src}`);
          }
        });

        const eventData = await extractEventDataWithGPT(
          basicData.outerHTML,
          globalIndex + 1
        );

        return {
          ...basicData,
          eventDetails: eventData,
        };
      });

      // Wait for all batch requests to complete
      const batchResults = await Promise.all(batchPromises);
      cardBoxData.push(...batchResults);

      console.log(
        `✅ Batch ${Math.floor(batchStart / batchSize) + 1} completed (${
          batchResults.length
        } events processed)`
      );

      // Small delay between batches to avoid overwhelming the API
      if (batchEnd < cardBoxElements.length) {
        await getRandomDelay(
          RATE_LIMIT_CONFIG.batchDelay,
          RATE_LIMIT_CONFIG.batchDelay + 500
        );
      }
    }

    console.log("🎯 Filtering events for zip code 14075...");
    const eventsWithTargetZip = cardBoxData.filter(
      (event) => event.eventDetails.hasZipCode14075 === true
    );

    console.log(
      `✅ Processing complete! Found ${eventsWithTargetZip.length} events with zip code 14075`
    );

    return {
      mainElement: mainElementData,
      cardBoxElements: cardBoxData,
      eventsWithZip14075: eventsWithTargetZip,
      totalEvents: cardBoxData.length,
      eventsWithTargetZip: eventsWithTargetZip.length,
      url: url,
      scrapedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("❌ Error scraping elements:", error.message);
    return null;
  }
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
    if (browser) {
      await browser.close();
    }
  }
}

async function extractEventDataWithGPT(htmlContent, index) {
  let retries = 0;

  while (retries <= RATE_LIMIT_CONFIG.maxRetries) {
    try {
      console.log(
        `  🤖 Sending event ${index} to GPT-4o for analysis... ${
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
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        response_format: {
          type: "json_object",
        },
      });

      let responseText = response.choices[0].message.content.trim();

      // Remove markdown code block formatting if present
      if (responseText.startsWith("```json")) {
        responseText = responseText
          .replace(/```json\n?/, "")
          .replace(/\n?```$/, "");
      } else if (responseText.startsWith("```")) {
        responseText = responseText
          .replace(/```\n?/, "")
          .replace(/\n?```$/, "");
      }

      const result = JSON.parse(responseText);
      console.log(
        `  ✅ Event ${index} processed: "${result.eventName}" ${
          result.hasZipCode14075 ? "🎯" : ""
        }`
      );

      return result;
    } catch (error) {
      // Check if it's a rate limit error
      if (error.status === 429 && retries < RATE_LIMIT_CONFIG.maxRetries) {
        const delay = RATE_LIMIT_CONFIG.retryDelay * Math.pow(2, retries); // Exponential backoff
        console.log(
          `  ⏳ Rate limit hit for event ${index}, retrying in ${delay}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        retries++;
        continue;
      }

      console.error(
        `❌ Error processing event ${index} with GPT-4o:`,
        error.message
      );
      return {
        eventName: "Error extracting",
        date: "Unknown",
        location: "Unknown",
        generalArea: "Unknown",
        detailedPageLink: "Unknown",
        imageUrl: "Unknown",
        zipCode: "Unknown",
        hasZipCode14075: false,
        error: error.message,
      };
    }
  }
}

async function main() {
  try {
    console.log("🔍 Starting Step Out Buffalo event scraper...");
    const results = await scrapeStepoutBuffaloProperties();

    if (results) {
      console.log("\n📋 FINAL RESULTS:");
      console.log(`🎯 Total events found: ${results.totalEvents}`);
      console.log(
        `🎯 Events with zip code 14075: ${results.eventsWithTargetZip}`
      );

      // Take only the first 6 events
      const limitedEvents = results.eventsWithZip14075.slice(0, 6);

      // Prepare data for email template
      const emailData = {
        currentDateFormatted: new Date().toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        }),
        events: limitedEvents.map((event) => ({
          eventName: event.eventDetails.eventName,
          date: event.eventDetails.date,
          location: event.eventDetails.location,
          generalArea: event.eventDetails.generalArea,
          detailedPageLink: event.eventDetails.detailedPageLink,
          imageUrl: event.eventDetails.imageUrl,
          zipCode: event.eventDetails.zipCode,
        })),
      };

      // Read the email template
      const templateHtml = await fs.readFile("email-template.html", "utf-8");

      // Populate the template with event data
      let populatedHtml = templateHtml;

      // Replace current date
      populatedHtml = populatedHtml.replace(
        "{{current_date_formatted}}",
        emailData.currentDateFormatted
      );

      // Generate event items HTML
      let eventItemsHtml = "";
      for (const event of emailData.events) {
        eventItemsHtml += `
          <td align="center" valign="top" style="padding: 0 5px 20px 5px;" class="event-column">
              <table border="0" cellpadding="0" cellspacing="0" width="180" class="event-card">
                  <tr>
                      <td align="center" style="padding-bottom: 10px;">
                          <a href="${event.detailedPageLink}" target="_blank">
                              <img src="${event.imageUrl}" alt="${event.eventName}" width="180" height="223" style="display: block; border: 0; width:180px; height:223px;" class="responsive-image">
                          </a>
                      </td>
                  </tr>
                  <tr>
                      <td align="center" style="font-size: 16px; font-weight: bold; padding-bottom: 5px;">
                          <a href="${event.detailedPageLink}" target="_blank" style="color: #0066cc;">
                              ${event.eventName}
                          </a>
                      </td>
                  </tr>
                  <tr>
                      <td align="center" style="font-size: 14px; padding-bottom: 10px;" class="event-date-color">
                          ${event.date}
                      </td>
                  </tr>
              </table>
          </td>`;
      }

      // Add empty columns if needed to maintain 3-column layout
      const emptyColumnCount = 3 - (emailData.events.length % 3);
      if (emptyColumnCount < 3) {
        for (let i = 0; i < emptyColumnCount; i++) {
          eventItemsHtml += `
            <td align="center" valign="top" style="padding: 0 5px 20px 5px;" class="event-column">
                <!-- Empty column -->
            </td>`;
        }
      }

      // Replace event items placeholder
      populatedHtml = populatedHtml.replace(
        "<!-- {{EVENT_ITEMS_HTML}} -->",
        eventItemsHtml
      );

      // Save the populated email template
      const outputFileName = "populated-email.html";
      await fs.writeFile(outputFileName, populatedHtml, "utf8");
      console.log(
        `\n💌 Email template populated and saved to: ${outputFileName}`
      );

      // Send email via Buttondown
      console.log("\n📧 Sending email via Buttondown...");
      const emailSubject = `Step Out Buffalo Events - ${emailData.currentDateFormatted}`;
      const result = await sendEmail(emailSubject, populatedHtml);
      console.log("✅ Email sent successfully!", result);

      // Also save the raw JSON data for reference
      const jsonFileName = "eventsZip14075.json";
      await fs.writeFile(
        jsonFileName,
        JSON.stringify(
          {
            metadata: {
              totalEventsScraped: results.totalEvents,
              eventsWithZip14075: results.eventsWithTargetZip,
              scrapedAt: results.scrapedAt,
              sourceUrl: results.url,
            },
            events: limitedEvents.map((event) => ({
              eventName: event.eventDetails.eventName,
              date: event.eventDetails.date,
              location: event.eventDetails.location,
              generalArea: event.eventDetails.generalArea,
              detailedPageLink: event.eventDetails.detailedPageLink,
              imageUrl: event.eventDetails.imageUrl,
              zipCode: event.eventDetails.zipCode,
            })),
          },
          null,
          2
        ),
        "utf8"
      );
      console.log(`\n💾 Raw event data saved to: ${jsonFileName}`);

      console.log("\n✅ Scraping and email sending completed successfully!");
    } else {
      console.log("❌ No results found");
    }
  } catch (error) {
    console.error("\n💥 Process failed:", error.message);
    process.exit(1);
  }
}

console.log("📝 Checking if script is being run directly...");
console.log("✅ Starting main function...");
main().catch((error) => {
  console.error("❌ Error in main function:", error);
  process.exit(1);
});
