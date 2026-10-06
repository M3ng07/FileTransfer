import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Config minima: build in un'unica cartella "dist" pronta da aprire
// dall'iPad, oppure da servire (in futuro) direttamente dal server in C.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist"
  }
});
