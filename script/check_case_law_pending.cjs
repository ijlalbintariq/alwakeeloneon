const { Client } = require('pg');

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const totalRes = await client.query(`
    select count(*)::int as total
    from admin_knowledge
    where category = 'case-law'
  `);

  const pendingRes = await client.query(`
    select count(*)::int as pending
    from admin_knowledge ak
    where ak.category = 'case-law'
      and coalesce(ak.case_law_process_status, 'pending') in ('pending', 'retry', 'processing')
  `);

  const legacyPendingRes = await client.query(`
    select count(*)::int as pending_legacy
    from (
      select ak.id
      from admin_knowledge ak
      left join case_law cl
        on cl.source_doc_id = ak.id
       and cl.source_type = 'admin'
      where ak.category = 'case-law'
      group by ak.id
      having count(cl.id) = 0
    ) t
  `);

  const extractedRes = await client.query(`
    select count(*)::int as extracted
    from (
      select distinct cl.source_doc_id
      from case_law cl
      join admin_knowledge ak
        on ak.id = cl.source_doc_id
      where cl.source_type = 'admin'
        and ak.category = 'case-law'
        and cl.source_doc_id is not null
    ) t
  `);

  console.log(JSON.stringify({
    total: totalRes.rows[0].total,
    pending: pendingRes.rows[0].pending,
    pendingLegacy: legacyPendingRes.rows[0].pending_legacy,
    extracted: extractedRes.rows[0].extracted,
  }));

  await client.end();
}

run().catch((err) => {
  console.error(err?.stack || err?.message || String(err));
  process.exit(1);
});
