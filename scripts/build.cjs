#!/usr/bin/env node

const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const args = process.argv.slice(2);

// Load .env file if it exists
const envPath = path.join(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  const envLines = envContent.split("\n");
  envLines.forEach((line) => {
    const trimmedLine = line.trim();
    if (trimmedLine && !trimmedLine.startsWith("#")) {
      const [key, ...valueParts] = trimmedLine.split("=");
      if (key && valueParts.length > 0) {
        const value = valueParts.join("=").trim();
        // Remove quotes if present
        const cleanValue = value.replace(/^["']|["']$/g, "");
        process.env[key.trim()] = cleanValue;
        // If it's VITE_GITHUB_TOKEN or GITHUB_TOKEN, also set GH_TOKEN for electron-builder
        if (
          key.trim() === "VITE_GITHUB_TOKEN" ||
          key.trim() === "GITHUB_TOKEN"
        ) {
          process.env.GH_TOKEN = cleanValue;
        }
      }
    }
  });
}

// Check if --win, --mac, or --linux parameter is provided
const platformMap = {
  "--win": "make:win",
  "--mac": "make:mac",
  "--linux": "make:linux",
};

const platformArg = args.find((arg) => platformMap[arg]);
const npmScript = platformArg ? platformMap[platformArg] : null;

// First, run the standard build (this will also build electron files via vite-plugin-electron)
console.log("Building TypeScript and Vite (including Electron files)...");
execSync("tsc -b && vite build", {
  stdio: "inherit",
  cwd: path.join(__dirname, ".."),
});

// If platform is specified, run electron-builder
if (npmScript) {
  console.log(`Building Electron app...`);
  // Use electron-builder instead of electron-forge
  const platformMap2 = {
    "--win": "win",
    "--mac": "mac",
    "--linux": "linux",
  };
  const platform = platformMap2[platformArg];
  // For Windows, build for x64 architecture (Intel/AMD)
  // Pass environment variables to electron-builder
  const env = { ...process.env };
  if (platform === "win") {
    execSync(`npx electron-builder --${platform} --x64 --publish always`, {
      stdio: "inherit",
      cwd: path.join(__dirname, ".."),
      env: env,
    });
  } else {
    execSync(`npx electron-builder --${platform} --publish always`, {
      stdio: "inherit",
      cwd: path.join(__dirname, ".."),
      env: env,
    });
  }
} else {
  console.log(
    "Build complete. Use --win, --mac, or --linux to create installers."
  );
}
