import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { config } from "dotenv";
import { networkInterfaces } from "os";

// Load environment variables from .env.local FIRST before any other imports
config({ path: ".env.local" });

// Helper to get local network IP
function getLocalIP(): string {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      // Skip internal and non-IPv4 addresses
      if (net.family === "IPv4" && !net.internal) {
        return net.address;
      }
    }
  }
  return "localhost";
}

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOST || "0.0.0.0"; // Bind to all interfaces for network access
const port = parseInt(process.env.PORT || "3000", 10);
const socketPort = parseInt(process.env.SOCKET_PORT || "3001", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(async () => {
  // Dynamically import modules that depend on environment variables (db.ts)
  const { initializeSocketServer } = await import("./src/lib/socket-io");
  
  // Create Next.js HTTP server
  const nextServer = createServer((req, res) => {
    // Note: url.parse is deprecated but Next.js handle() requires UrlWithParsedQuery
    // The new URL() API returns incompatible types. Using parse() is safe here.
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    const parsedUrl = parse(req.url || "", true);
    handle(req, res, parsedUrl);
  });

  // Create separate HTTP server for Socket.io
  const socketServer = createServer();
  initializeSocketServer(socketServer);
  
  // Start Next.js server on all interfaces
  nextServer.listen(port, hostname, () => {
    console.log(`> Next.js ready on http://${hostname}:${port}`);
    console.log(`> Network: http://${getLocalIP()}:${port}`);
  });

  // Start Socket.io server on separate port
  socketServer.listen(socketPort, hostname, () => {
    console.log(`> Socket.io server running on ws://${hostname}:${socketPort}`);
  });

  // Dynamically import and start the tournament scheduler
  // This ensures environment variables are loaded before db.ts is imported
  const { startTournamentScheduler } = await import("./src/lib/tournament-scheduler");
  startTournamentScheduler();
});
