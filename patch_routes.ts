import fs from 'fs';

let content = fs.readFileSync('server/routes.ts', 'utf8');

const oldDirectoryBlock = `      const conditions = [
        sql\`j.is_active = true\`,
        sql\`j.bench IS NOT NULL\`,
        sql\`j.bench != ''\`,
      ];
      if (search) {
        conditions.push(sql\`j.bench ILIKE \${'%' + search + '%'}\`);
      }
      if (court) {
        conditions.push(sql\`(c.name ILIKE \${'%' + court + '%'} OR j.court_name_snapshot ILIKE \${'%' + court + '%'})\`);
      }
      const whereClause = sql.join(conditions, sql\` AND \`);

      // Sort mapping (safe: only static strings)
      const sortMap: Record<string, ReturnType<typeof sql.raw>> = {
        cases_desc: sql.raw("case_count DESC"),
        cases_asc: sql.raw("case_count ASC"),
        name_asc: sql.raw("judge_name ASC"),
        name_desc: sql.raw("judge_name DESC"),
        recent: sql.raw("latest_year DESC"),
      };
      const orderBy = sortMap[sort] || sql.raw("case_count DESC");

      const [dataResult, countResult, courtsResult] = await Promise.all([
        db.execute(sql\`
          SELECT
            j.bench as judge_name,
            count(*)::int as case_count,
            array_agg(DISTINCT COALESCE(c.name, j.court_name_snapshot)) FILTER (WHERE COALESCE(c.name, j.court_name_snapshot) IS NOT NULL) as courts,
            min(j.year)::int as earliest_year,
            max(j.year)::int as latest_year
          FROM judgments j
          LEFT JOIN courts_ref c ON j.court_id = c.id
          WHERE \${whereClause}
          GROUP BY j.bench
          ORDER BY \${orderBy}
          LIMIT \${limit} OFFSET \${offset}
        \`),
        db.execute(sql\`
          SELECT count(DISTINCT j.bench)::int as total
          FROM judgments j
          LEFT JOIN courts_ref c ON j.court_id = c.id
          WHERE \${whereClause}
        \`),
        db.execute(sql\`
          SELECT DISTINCT COALESCE(c.name, j.court_name_snapshot) as court_name
          FROM judgments j
          LEFT JOIN courts_ref c ON j.court_id = c.id
          WHERE j.is_active = true AND j.bench IS NOT NULL
          AND COALESCE(c.name, j.court_name_snapshot) IS NOT NULL
          ORDER BY court_name ASC
        \`),
      ]);`;

const newDirectoryBlock = `      const conditions = [
        sql\`l.judge_name != ''\`
      ];
      if (search) {
        conditions.push(sql\`l.judge_name ILIKE \${'%' + search + '%'}\`);
      }
      if (court) {
        conditions.push(sql\`l.court_name ILIKE \${'%' + court + '%'}\`);
      }
      const whereClause = sql.join(conditions, sql\` AND \`);

      // Sort mapping (safe: only static strings)
      const sortMap: Record<string, ReturnType<typeof sql.raw>> = {
        cases_desc: sql.raw("case_count DESC"),
        cases_asc: sql.raw("case_count ASC"),
        name_asc: sql.raw("judge_name ASC"),
        name_desc: sql.raw("judge_name DESC"),
        recent: sql.raw("latest_year DESC"),
      };
      const orderBy = sortMap[sort] || sql.raw("case_count DESC");

      const [dataResult, countResult, courtsResult] = await Promise.all([
        db.execute(sql\`
          SELECT
            l.judge_name as judge_name,
            count(*)::int as case_count,
            array_agg(DISTINCT l.court_name) FILTER (WHERE l.court_name IS NOT NULL) as courts,
            min(l.year)::int as earliest_year,
            max(l.year)::int as latest_year
          FROM judge_case_links l
          WHERE \${whereClause}
          GROUP BY l.judge_name
          ORDER BY \${orderBy}
          LIMIT \${limit} OFFSET \${offset}
        \`),
        db.execute(sql\`
          SELECT count(DISTINCT l.judge_name)::int as total
          FROM judge_case_links l
          WHERE \${whereClause}
        \`),
        db.execute(sql\`
          SELECT DISTINCT l.court_name as court_name
          FROM judge_case_links l
          WHERE l.court_name IS NOT NULL
          ORDER BY court_name ASC
        \`),
      ]);`;

const oldDetailBlock = `      const [statsResult, casesResult] = await Promise.all([
        db.execute(sql\`
          SELECT
            \${sql.raw(\`'\${name.replace(/'/g, "''")}'\`)} as judge_name,
            count(*)::int as case_count,
            array_agg(DISTINCT COALESCE(\${courtsRef.name}, \${judgments.courtNameSnapshot})) FILTER (WHERE COALESCE(\${courtsRef.name}, \${judgments.courtNameSnapshot}) IS NOT NULL) as courts,
            min(\${judgments.year})::int as earliest_year,
            max(\${judgments.year})::int as latest_year
          FROM \${judgments}
          LEFT JOIN \${courtsRef} ON \${judgments.courtId} = \${courtsRef.id}
          WHERE \${judgments.isActive} = true
          AND \${judgments.bench} = \${name}
        \`),
        db.execute(sql\`
          SELECT
            \${judgments.id},
            \${judgments.citationString} as citation,
            \${judgments.title},
            COALESCE(\${courtsRef.name}, \${judgments.courtNameSnapshot}) as court,
            \${judgments.year}
          FROM \${judgments}
          LEFT JOIN \${courtsRef} ON \${judgments.courtId} = \${courtsRef.id}
          WHERE \${judgments.isActive} = true
          AND \${judgments.bench} = \${name}
          ORDER BY \${judgments.year} DESC, \${judgments.id} DESC
          LIMIT 50
        \`)
      ]);`;

const newDetailBlock = `      const [statsResult, casesResult] = await Promise.all([
        db.execute(sql\`
          SELECT
            \${sql.raw(\`'\${name.replace(/'/g, "''")}'\`)} as judge_name,
            count(*)::int as case_count,
            array_agg(DISTINCT l.court_name) FILTER (WHERE l.court_name IS NOT NULL) as courts,
            min(l.year)::int as earliest_year,
            max(l.year)::int as latest_year
          FROM judge_case_links l
          WHERE l.judge_name = \${name}
        \`),
        db.execute(sql\`
          SELECT
            j.id,
            j.citation_string as citation,
            j.title,
            l.court_name as court,
            j.year
          FROM judge_case_links l
          JOIN judgments j ON l.judgment_id = j.id
          WHERE l.judge_name = \${name}
          ORDER BY j.year DESC, j.id DESC
          LIMIT 50
        \`)
      ]);`;

let updated = content.replace(oldDirectoryBlock, newDirectoryBlock);
updated = updated.replace(oldDetailBlock, newDetailBlock);
fs.writeFileSync('server/routes.ts', updated);
console.log(content.length, '->', updated.length);
