const { createClient } = require('@libsql/client');
const fs = require('fs');
const path = require('path');

const envFile = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf-8');
const envVars = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    let val = match[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    envVars[match[1].trim()] = val;
  }
});

async function testMatch() {
  const client = createClient({ url: envVars.TURSO_DATABASE_URL, authToken: envVars.TURSO_AUTH_TOKEN });
  const dbStudents = await client.execute('SELECT id, name, roll_number, email, phone, college_id FROM students');
  console.log('Local DB students count:', dbStudents.rows.length);

  const res = await fetch('https://hire-score-fawn.vercel.app/api/students');
  const hireStudents = await res.json();
  console.log('HireScore API students count:', hireStudents.length);

  let matched = 0;
  for (const s of dbStudents.rows) {
    const sId = (s.id || '').toLowerCase().trim();
    const sRoll = (s.roll_number || '').toLowerCase().trim();
    const sEmail = (s.email || '').toLowerCase().trim();
    const sPhone = (s.phone || '').replace(/\D/g, '');

    const found = hireStudents.find(h => {
      const hReg = (h.registrationNumber || '').toLowerCase().trim();
      const hEmail = (h.email || '').toLowerCase().trim();
      const hPhone = (h.phone || '').replace(/\D/g, '');
      return (hReg && (hReg === sId || hReg === sRoll)) ||
             (hEmail && sEmail && hEmail === sEmail) ||
             (hPhone && sPhone && hPhone.length >= 10 && (sPhone === hPhone || sPhone.endsWith(hPhone) || hPhone.endsWith(sPhone)));
    });

    if (found) {
      matched++;
      if (matched <= 10) {
        console.log(`Match ${matched}: ${s.name} (${s.id}) -> Hire: ${found.hireScore}, Comm: ${found.communicationTotal}, Quants: ${found.quantsScore}`);
      }
    }
  }
  console.log(`\nTotal matched: ${matched} / ${dbStudents.rows.length}`);
}
testMatch().catch(console.error);
