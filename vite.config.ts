import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig, type Plugin } from "vite";
import { Server as SocketIOServer } from "socket.io";
import { registerSocketHandlers } from "./server/handlers";
import type { RealtimeServer } from "./server/realtime";

// Em dev o multiplayer roda via Socket.IO embutido no servidor do Vite, usando
// os mesmos handlers que o Durable Object executa em produção.
function vitePluginSocketIO(): Plugin {
  return {
    name: "vite-plugin-socket-io",
    configureServer(server) {
      if (!server.httpServer) return;
      const io = new SocketIOServer(server.httpServer, {
        cors: {
          origin: "*",
          methods: ["GET", "POST"]
        },
        perMessageDeflate: true,
        httpCompression: true,
      });
      registerSocketHandlers(io as unknown as RealtimeServer);
      console.log("🔌 [Vite] Socket.io server integrated successfully!");
    }
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), vitePluginSocketIO()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port: 3000,
    strictPort: false, // Will find next available port if 3000 is busy
    host: true,
    // A UI local deve conversar com o Worker local, que mantém o D1 e os
    // Durable Objects separados da produção. Assim o cadastro/login pode ser
    // testado sem publicar cada alteração.
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8787",
        changeOrigin: false,
        ws: true,
      },
    },
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
