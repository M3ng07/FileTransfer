import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// clearScreen:false e la porta fissa sono le impostazioni che Tauri si
// aspetta durante "tauri dev", per non perdere i log del suo processo.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true
  }
});
