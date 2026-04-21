import type { NextConfig } from "next";
import path from "path";

// Set outputFileTracingRoot to the dashboard directory to prevent Next.js from
// incorrectly inferring the parent Dashboard-Project/ as the workspace root
// (which happens because Dashboard-Project/ also has a package-lock.json).
const nextConfig: NextConfig = {
  outputFileTracingRoot: path.resolve(__dirname),
};

export default nextConfig;
