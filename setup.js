import { chromium } from "playwright";
import { execSync } from "child_process";

async function setup() {
  try {
    console.log("🔧 Setting up Playwright...");

    // Install Playwright browsers
    console.log("📥 Installing Playwright browsers...");
    execSync("npx playwright install chromium", { stdio: "inherit" });

    // Test browser launch
    console.log("🧪 Testing browser launch...");
    const browser = await chromium.launch({
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-software-rasterizer",
        "--disable-extensions",
        "--single-process",
        "--no-zygote",
      ],
    });
    await browser.close();

    console.log("✅ Setup completed successfully!");
  } catch (error) {
    console.error("❌ Setup failed:", error);
    process.exit(1);
  }
}

setup();
