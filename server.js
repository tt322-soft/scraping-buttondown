import express from "express";
import { main } from "./start.js";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.get("/scrape", async (req, res) => {
  // try {
  console.log("🚀 Starting scrape process...");
  const result = await main();
  // if (!result) {
  //   throw new Error("No data was scraped");
  // }
  // res.json(result);
  // } catch (error) {
  //   console.error("❌ Scrape error:", error.message);
  //   res.status(500).json({
  //     error: error.message,
  //     details: error.stack,
  //     timestamp: new Date().toISOString(),
  //   });
  // }
});

app.get("/", (req, res) => {
  res.send("✅ Scraper is running. Use /scrape to trigger.");
});

app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});
