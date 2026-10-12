import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";
import { siteOrigin } from "./scripts/build-context";

export default defineConfig({
  plugins: [reactRouter()],
  // Where this build is served: production, or a Preview's own subdomain.
  // See scripts/build-context.ts.
  define: {
    __SITE_ORIGIN__: JSON.stringify(siteOrigin(process.env)),
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: ["noook", "noook.tsl"],
  },
});
