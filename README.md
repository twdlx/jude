# Jude's Studio order bot

Discord order panel bot built with `discord.js`.

## Run locally

1. Install Node.js 20 or newer.
2. Run `npm ci`.
3. Copy `.env.example` to `.env` and replace the placeholder with your Discord bot token.
4. Run `npm start`.

Keep `.env` private. It is excluded from Git.

## Host from GitHub

Use a Node.js hosting plan that runs a long-lived process. Set the main file to `index.js` and add `TOKEN` as a secret environment variable in the host's settings. The host should install dependencies with `npm ci` (or its standard Node.js install step) and start the bot with `npm start`.

The bot uses the hardcoded Discord category, admin role, and allowed-user IDs in `src/index.js`. It also needs the corresponding Discord permissions to create and manage order channels, threads, and messages. Enable the Message Content intent in the Discord Developer Portal so the `-orderpanel` command works.
