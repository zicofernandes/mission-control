#!/usr/bin/env tsx

import path from "node:path";
import { fileURLToPath } from "node:url";

import { collectUsage } from "../lib/usage-collector";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, "..", "..", "data", "usage-tracking.db");

export async function main(): Promise<void> {
  console.log("Mission Control - Usage Collector");
  console.log(`Database: ${DB_PATH}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log();

  try {
    await collectUsage(DB_PATH);
    console.log("Usage data collected successfully");
  } catch (error) {
    console.error("Error collecting usage data:", error);
    process.exit(1);
  }
}

void main();
