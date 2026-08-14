import type { NextConfig } from "next";
import path from "path";
import fs from "fs";

// Automatically load single root .env into Next.js process environment
try {
  const rootEnvCandidates = [
    path.resolve(process.cwd(), "../.env"),
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), ".env.local"),
  ];

  for (const envPath of rootEnvCandidates) {
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, "utf8");
      for (const line of envContent.split("\n")) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
          const [key, ...values] = trimmed.split("=");
          const k = key.trim();
          const v = values.join("=").trim().replace(/^["']|["']$/g, "");
          if (!process.env[k]) {
            process.env[k] = v;
          }
        }
      }
    }
  }
} catch (e) {}

const nextConfig: NextConfig = {
  /* config options here */
  env: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    NEXT_PUBLIC_API_BASE: process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4400/api",
    NEXT_PUBLIC_GITHUB_CLIENT_ID: process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID || process.env.GITHUB_CLIENT_ID || "",
    NEXT_PUBLIC_GEMINI_API_KEY: process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY || "",
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || "",
  },
};

export default nextConfig;
