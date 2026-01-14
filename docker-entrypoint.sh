#!/bin/sh
set -e

# Ensure Claude CLI config directory exists with correct permissions
if [ ! -d "/home/automaker/.claude" ]; then
    mkdir -p /home/automaker/.claude
fi

# If CLAUDE_OAUTH_CREDENTIALS is set, write it to the credentials file
# This allows passing OAuth tokens from host (especially macOS where they're in Keychain)
if [ -n "$CLAUDE_OAUTH_CREDENTIALS" ]; then
    echo "$CLAUDE_OAUTH_CREDENTIALS" > /home/automaker/.claude/.credentials.json
    chmod 600 /home/automaker/.claude/.credentials.json
fi

# Fix permissions on Claude CLI config directory
chown -R automaker:automaker /home/automaker/.claude
chmod 700 /home/automaker/.claude

# Ensure Cursor CLI config directory exists with correct permissions
# This handles both: mounted volumes (owned by root) and empty directories
if [ ! -d "/home/automaker/.cursor" ]; then
    mkdir -p /home/automaker/.cursor
fi
chown -R automaker:automaker /home/automaker/.cursor
chmod -R 700 /home/automaker/.cursor

# If CURSOR_AUTH_TOKEN is set, write it to the cursor auth file
# On Linux, cursor-agent uses ~/.config/cursor/auth.json for file-based credential storage
# The env var CURSOR_AUTH_TOKEN is also checked directly by cursor-agent
if [ -n "$CURSOR_AUTH_TOKEN" ]; then
    CURSOR_CONFIG_DIR="/home/automaker/.config/cursor"
    mkdir -p "$CURSOR_CONFIG_DIR"
    # Write auth.json with the access token
    cat > "$CURSOR_CONFIG_DIR/auth.json" << EOF
{
  "accessToken": "$CURSOR_AUTH_TOKEN"
}
EOF
    chmod 600 "$CURSOR_CONFIG_DIR/auth.json"
    chown -R automaker:automaker /home/automaker/.config
fi

# Update/Create Claude settings using Node.js for safe JSON handling
node -e '
const fs = require("fs");
const targetPath = "/home/automaker/.claude/settings.json";

// Map of env vars to settings.json env keys
const envMap = {
  "ANTHROPIC_AUTH_TOKEN": "ANTHROPIC_AUTH_TOKEN",
  "ANTHROPIC_BASE_URL": "ANTHROPIC_BASE_URL",
  "API_TIMEOUT_MS": "API_TIMEOUT_MS",
  "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC"
};

let settings = {};
if (fs.existsSync(targetPath)) {
  try {
    settings = JSON.parse(fs.readFileSync(targetPath, "utf8"));
  } catch (e) {
    console.error("Failed to parse existing settings.json, starting fresh");
  }
}

if (!settings.env) settings.env = {};

let updated = false;
for (const [envVar, jsonKey] of Object.entries(envMap)) {
  if (process.env[envVar]) {
    settings.env[jsonKey] = process.env[envVar];
    updated = true;
  }
}

// Only write if we have something to write (updated or new file)
// Check if file exists to decide if we need to forcefully create it even if not updated (in case of empty map but logic required)
// But here we rely on "updated". If file exists and no updates, we do nothing.
// If file does NOT exist and we have updates, we write.
if (updated) {
  // Ensure directory exists
  const dir = require("path").dirname(targetPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  
  fs.writeFileSync(targetPath, JSON.stringify(settings, null, 2));
  fs.chmodSync(targetPath, 0o600);
}
'

# Ensure the automaker user owns the settings file and directory
# This is critical because the node script above runs as root
chown -R automaker:automaker /home/automaker/.claude

# Switch to automaker user and execute the command
exec gosu automaker "$@"
