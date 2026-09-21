import { getDb } from './src/lib/db.ts';

async function check() {
  const db = await getDb();
  try {
    const setting = await db.get("SELECT * FROM system_settings WHERE key = 'mailing_enabled'");
    console.log("Setting from DB:", setting);
    
  } catch (err) {
    console.error(err);
  }
}

check();
