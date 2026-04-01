import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function test() {
  const firebaseConfigPath = path.resolve(__dirname, "firebase-applet-config.json");
  const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, "utf-8"));

  console.log("Config Project ID:", firebaseConfig.projectId);
  console.log("Config Database ID:", firebaseConfig.firestoreDatabaseId);

  process.env.GOOGLE_CLOUD_PROJECT = firebaseConfig.projectId;

  admin.initializeApp({
    projectId: firebaseConfig.projectId
  });

  const dbs = [firebaseConfig.firestoreDatabaseId, '(default)'];
  
  for (const dbId of dbs) {
    console.log(`\nTesting database: ${dbId}`);
    const db = getFirestore(admin.app(), dbId);
    try {
      const collections = await db.listCollections();
      console.log(`Success! Found ${collections.length} collections.`);
    } catch (err: any) {
      console.error(`Error for ${dbId}:`, err.message);
    }
  }
}

test().catch(console.error);
