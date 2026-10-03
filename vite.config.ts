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

// Catalogue and game-rule modules (client/src/lib and shared/game) grouped into the "catalog" and "engine" chunks.
const CATALOG_FILES = new Set([
  "gameData", "crests", "clubCatalog",
  "playerCatalog", "playerPhotoCatalog", "rarity",
]);
const ENGINE_FILES = new Set([
  "gameEngine", "missions", "matchNarrative", "discipline", "traits", "bets", "shop",
  "clubProjects", "coachPrime", "stadium", "market", "onlineReadiness", "historySnapshot", "random",
]);

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
    rollupOptions: {
      output: {
        // Separate chunks download in parallel and stay cached independently:
        // third-party code rarely changes, the card catalogue and the game rules
        // change on their own schedules.
        manualChunks(id) {
          const file = id.split(path.sep).join("/");
          const inModule = (...names: string[]) => names.some(name => file.includes(`/node_modules/${name}/`));
          const libFile = file.match(/\/(?:client\/src\/lib|shared\/game)\/([^/]+)\.ts$/)?.[1];
          if (inModule("react", "react-dom", "scheduler")) return "react";
          if (inModule("framer-motion", "motion-dom", "motion-utils", "lucide-react", "sonner") || file.includes("/node_modules/@radix-ui/")) return "ui";
          if (inModule("socket.io-client", "engine.io-client", "socket.io-parser", "engine.io-parser")) return "realtime";
          if (file.includes("/shared/game/players/")) return "catalog";
          if (file.includes("/shared/game/engine/")) return "engine";
          if (!libFile) return undefined;
          if (CATALOG_FILES.has(libFile)) return "catalog";
          if (ENGINE_FILES.has(libFile) || libFile.startsWith("competition")) return "engine";
          return undefined;
        },
      },
    },
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
