import express from 'express';
import { scrapeStepoutBuffaloProperties } from './start.js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/scrape', async (req, res) => {
  try {
    const result = await scrapeStepoutBuffaloProperties();
    res.json(result); // Send scraped JSON
  } catch (error) {
    console.error('❌ Scrape error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/', (req, res) => {
  res.send('✅ Scraper is running. Use /scrape to trigger.');
});      

app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});