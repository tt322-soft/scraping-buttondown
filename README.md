# Step Out Buffalo Event Scraper

This project scrapes events from Step Out Buffalo website and generates a formatted email template with the events.

## Prerequisites

- Node.js (v14 or higher)
- npm (Node Package Manager)
- Buttondown API key

## Setup

1. Install dependencies:

```bash
npm install
```

2. Set up your API keys:
   - Create a `.env` file in the project root
   - Add your Buttondown API key:
   ```
   BUTTONDOWN_API_KEY=your-buttondown-api-key-here
   ```
   - Replace the OpenAI API key in `start.js` with your own key:
   ```javascript
   const openai = new OpenAI({
     apiKey: "your-api-key-here",
   });
   ```

## Usage

Run the scraper:

```bash
npm start
```

This will:

1. Scrape events from Step Out Buffalo
2. Filter for events with zip code 14075
3. Take the first 6 events
4. Generate a formatted email template
5. Send the email via Buttondown API
6. Save two files:
   - `populated-email.html`: The formatted email
   - `eventsZip14075.json`: The raw event data

## Output Files

- `populated-email.html`: The final formatted email
- `eventsZip14075.json`: Raw event data in JSON format

## Notes

- The script uses Puppeteer with stealth plugin to avoid detection
- Events are filtered for zip code 14075
- The email template is responsive and works on both desktop and mobile
- The script includes rate limiting to avoid overwhelming the target website
- Emails are sent via Buttondown API (initially as drafts for testing)
