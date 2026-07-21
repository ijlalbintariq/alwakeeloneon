import fs from 'fs';
import path from 'path';

// Parse .env first
try {
  const envContent = fs.readFileSync(path.resolve('.env'), 'utf8');
  const lines = envContent.split('\n');
  for (const line of lines) {
    if (line.startsWith('DATABASE_URL=')) {
      let dbUrl = line.split('=')[1].trim().replace(/['"]/g, '');
      if (!dbUrl.includes('sslmode=')) {
        dbUrl += dbUrl.includes('?') ? '&sslmode=require' : '?sslmode=require';
      }
      process.env.DATABASE_URL = dbUrl;
    }
  }
} catch (err) {}

const { db } = await import('../server/db');

async function run() {
  console.log('Querying count of indexed RAG documents per user_id...');
  try {
    const res = await db.execute(`
      SELECT user_id, status, count(*), sum(chunk_count) as total_chunks
      FROM rag_documents
      GROUP BY user_id, status
    `);
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error('Failed:', err);
  }
  process.exit(0);
}
run();
