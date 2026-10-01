import { defineConfig, minimal2023Preset } from "@vite-pwa/assets-generator/config";

export default defineConfig({
  preset: minimal2023Preset, // Pass 'all' as a string here
  images: ["public/logo.svg"],
});
