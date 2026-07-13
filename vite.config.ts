import { defineConfig } from "vite";

export default defineConfig({
  base: "/kunekune-escape/",
  server: {
    // トンネル(trycloudflare等)経由のデモアクセスを許可する
    allowedHosts: true,
  },
});
