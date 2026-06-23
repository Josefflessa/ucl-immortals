import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import { Server } from "socket.io";
import { networkInterfaces } from "os";

// Single source of truth for all multiplayer socket logic. The dev server
// (vite.config.ts) wires the same module, so dev and prod run identical code.
import { registerSocketHandlers } from "./handlers.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to get local network IP address
function getLocalIpAddress(): string {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
      if (net.family === "IPv4" && !net.internal) {
        return net.address;
      }
    }
  }
  return "localhost";
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  const localIp = getLocalIpAddress();
  const port = process.env.PORT || 3000;

  // Serve static files from dist/public in production
  const staticPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "public")
      : path.resolve(__dirname, "..", "dist", "public");

  app.use(express.static(staticPath));

  // Serve server IP config endpoint so client knows where to connect
  app.get("/api/server-info", (_req, res) => {
    res.json({ ip: localIp, port });
  });

  // Handle client-side routing - serve index.html for all routes
  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });

  registerSocketHandlers(io);

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    console.log(`Network access on http://${localIp}:${port}/`);
  });
}

startServer().catch(console.error);
