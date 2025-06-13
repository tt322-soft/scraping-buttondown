// server.js
import express from "express";
import Bull from "bull";
import { scrapeStepoutBuffaloProperties } from "./start.js"; // You already have this
import dotenv from "dotenv";
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
app.use(express.json());

// Create a Bull queue for scraping jobs
const scrapingQueue = new Bull("scraping-queue", {
  redis: {
    host: process.env.REDIS_HOST || "localhost",
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD,
  },
});

// Store job results in memory (in production, use Redis or a database)
const jobResults = new Map();

// Process jobs in the queue
scrapingQueue.process(async (job) => {
  try {
    console.log(`Starting scraping job ${job.id}`);
    const result = await scrapeStepoutBuffaloProperties();

    // Store the result
    jobResults.set(job.id, {
      status: "completed",
      result: result,
      completedAt: new Date().toISOString(),
    });

    // If webhook URL is provided, notify about completion
    if (job.data.webhookUrl) {
      try {
        await fetch(job.data.webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jobId: job.id,
            status: "completed",
            result: result,
          }),
        });
      } catch (error) {
        console.error("Webhook notification failed:", error);
      }
    }

    return result;
  } catch (error) {
    console.error(`Scraping job ${job.id} failed:`, error);
    jobResults.set(job.id, {
      status: "failed",
      error: error.message,
      failedAt: new Date().toISOString(),
    });
    throw error;
  }
});

// API Endpoints

// 1. Start scraping job
app.post("/api/scrape", async (req, res) => {
  try {
    const { webhookUrl } = req.body;

    // Add job to queue
    const job = await scrapingQueue.add(
      {
        webhookUrl,
      },
      {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
      }
    );

    // Store initial job status
    jobResults.set(job.id, {
      status: "processing",
      startedAt: new Date().toISOString(),
    });

    res.json({
      jobId: job.id,
      status: "processing",
      message: "Scraping job started",
      checkStatusUrl: `/api/status/${job.id}`,
    });
  } catch (error) {
    console.error("Failed to start scraping job:", error);
    res.status(500).json({
      error: "Failed to start scraping job",
      message: error.message,
    });
  }
});

// 2. Check job status
app.get("/api/status/:jobId", (req, res) => {
  const { jobId } = req.params;
  const jobResult = jobResults.get(jobId);

  if (!jobResult) {
    return res.status(404).json({
      error: "Job not found",
    });
  }

  res.json({
    jobId,
    ...jobResult,
  });
});

// 3. Get job results
app.get("/api/results/:jobId", (req, res) => {
  const { jobId } = req.params;
  const jobResult = jobResults.get(jobId);

  if (!jobResult) {
    return res.status(404).json({
      error: "Job not found",
    });
  }

  if (jobResult.status !== "completed") {
    return res.status(400).json({
      error: "Job not completed",
      status: jobResult.status,
    });
  }

  res.json(jobResult.result);
});

// 4. Cleanup old jobs (optional)
app.delete("/api/cleanup", async (req, res) => {
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    for (const [jobId, result] of jobResults.entries()) {
      const jobDate = new Date(
        result.completedAt || result.failedAt || result.startedAt
      );
      if (jobDate < oneDayAgo) {
        jobResults.delete(jobId);
      }
    }

    res.json({
      message: "Cleanup completed",
      remainingJobs: jobResults.size,
    });
  } catch (error) {
    res.status(500).json({
      error: "Cleanup failed",
      message: error.message,
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: "Internal server error",
    message: err.message,
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
