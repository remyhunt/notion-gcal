import "dotenv/config";
import { runSync } from "./lib/sync";

runSync()
  .then((result) => console.log(JSON.stringify(result, null, 2)))
  .catch((err) => console.error("Sync failed:", err));
