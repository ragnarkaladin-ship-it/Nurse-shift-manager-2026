import { createServer } from "vite";
console.log("Vite imported successfully");
const vite = await createServer({
  server: { middlewareMode: true },
  appType: "spa",
});
console.log("Vite server created successfully");
await vite.close();
console.log("Vite server closed successfully");
