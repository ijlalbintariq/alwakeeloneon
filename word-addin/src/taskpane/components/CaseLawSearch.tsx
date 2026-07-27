import React, { useState, useEffect } from 'react';
import { 
  makeStyles, 
  shorthands, 
  Input, 
  Button, 
  Spinner, 
  Text,
  Dropdown,
  Option,
  Card,
  TabList,
  Tab,
  tokens
} from '@fluentui/react-components';
import { SearchRegular, AddRegular, ChevronDownRegular, ChevronUpRegular, BookOpenRegular } from '@fluentui/react-icons';
import { searchCaseLaw, searchCitations, getLawJournals, CaseLawResult } from '../services/api';
import { insertCitation } from '../services/word';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.padding('12px'),
    ...shorthands.gap('12px'),
    height: '100%',
    width: '100%',
    boxSizing: 'border-box',
    overflowY: 'auto',
  },
  tabList: {
    width: '100%',
    marginBottom: '4px',
  },
  searchBox: {
    display: 'flex',
    ...shorthands.gap('8px'),
    width: '100%',
  },
  filtersRow: {
    display: 'flex',
    ...shorthands.gap('8px'),
    width: '100%',
  },
  filtersColumn: {
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.gap('8px'),
    width: '100%',
  },
  resultsContainer: {
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.gap('12px'),
    marginTop: '4px',
    width: '100%',
  },
  card: {
    ...shorthands.padding('12px'),
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.gap('8px'),
    width: '100%',
    boxSizing: 'border-box',
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow2,
    ...shorthands.borderRadius('6px'),
  },
  cardHeader: {
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.gap('4px'),
  },
  cardTitle: {
    fontWeight: '600',
    fontSize: '13px',
    lineHeight: '1.4',
    textAlign: 'justify',
    color: tokens.colorNeutralForeground1,
  },
  metaRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginTop: '2px',
  },
  citation: {
    color: '#C9A84C',
    fontWeight: '600',
    fontSize: '12px',
    letterSpacing: '0.3px',
  },
  court: {
    fontSize: '11px',
    color: tokens.colorNeutralForeground2,
    fontWeight: '500',
  },
  summary: {
    fontSize: '12px',
    color: tokens.colorNeutralForeground1,
    lineHeight: '1.5',
    textAlign: 'justify',
  },
  summaryTruncated: {
    display: '-webkit-box',
    WebkitLineClamp: 3,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  actions: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '6px',
    paddingTop: '6px',
    borderTop: `1px dashed ${tokens.colorNeutralStroke2}`,
  },
  emptyState: {
    textAlign: 'center',
    color: tokens.colorNeutralForeground3,
    marginTop: '24px',
    ...shorthands.padding('16px'),
    fontSize: '13px',
    lineHeight: '1.5',
  }
});

const COURTS = [
  'Supreme Court', 'Lahore HC', 'Sindh HC', 'Peshawar HC', 
  'Islamabad HC', 'Balochistan HC', 'FSC'
];

const DEFAULT_JOURNALS = [
  'PLD', 'SCMR', 'YLR', 'MLD', 'CLC', 'PCrLJ', 'CLD', 
  'PLC', 'PLJ', 'NLR', 'PTD', 'PSC', 'KLR', 'BLJ', 'SBLR', 'GBLR'
];

const ResultCard: React.FC<{ result: CaseLawResult }> = ({ result }) => {
  const styles = useStyles();
  const [expanded, setExpanded] = useState(false);
  const [inserting, setInserting] = useState(false);

  const handleInsert = async () => {
    setInserting(true);
    try {
      await insertCitation(result.citation || 'Citation', result.title);
    } catch (e) {
      console.error(e);
    } finally {
      setInserting(false);
    }
  };

  return (
    <Card className={styles.card}>
      <div className={styles.cardHeader}>
        <Text className={styles.cardTitle}>{result.title}</Text>
        <div className={styles.metaRow}>
          <Text className={styles.citation}>{result.citation}</Text>
          <Text className={styles.court}>{result.court}</Text>
        </div>
      </div>
      
      <Text className={`${styles.summary} ${!expanded ? styles.summaryTruncated : ''}`}>
        {result.summary}
      </Text>
      
      <div className={styles.actions}>
        <Button 
          appearance="subtle" 
          icon={expanded ? <ChevronUpRegular /> : <ChevronDownRegular />}
          size="small"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? 'Hide Summary' : 'View Headnote'}
        </Button>
        <Button 
          appearance="primary" 
          icon={inserting ? <Spinner size="tiny" /> : <AddRegular />}
          size="small"
          onClick={handleInsert}
          disabled={inserting}
          style={{ backgroundColor: '#C9A84C' }}
        >
          Insert Citation
        </Button>
      </div>
    </Card>
  );
};

const CaseLawSearch: React.FC = () => {
  const styles = useStyles();
  const [searchMode, setSearchMode] = useState<'keyword' | 'citation'>('keyword');
  const [journals, setJournals] = useState<string[]>(DEFAULT_JOURNALS);

  // Keyword Search State
  const [query, setQuery] = useState('');
  const [court, setCourt] = useState<string>('');
  const [journal, setJournal] = useState<string>('');
  const [year, setYear] = useState<string>('');

  // Pinpoint Citation Search State
  const [citeYear, setCiteYear] = useState<string>('2023');
  const [citeJournal, setCiteJournal] = useState<string>('SCMR');
  const [citePage, setCitePage] = useState<string>('');

  // Shared State
  const [results, setResults] = useState<CaseLawResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    getLawJournals().then(res => {
      if (res && res.length > 0) {
        const fetchedCodes = res.map(j => j.code.toUpperCase());
        const combined = Array.from(new Set([...DEFAULT_JOURNALS, ...fetchedCodes]));
        setJournals(combined);
      }
    }).catch(() => {});
  }, []);

  const handleKeywordSearch = async () => {
    if (!query && !court && !journal && !year) return;

    const citationRegex = /^(\d{4})\s+([a-zA-Z]+)\s+(\d+)$/i;
    const match = query.trim().match(citationRegex);
    if (match) {
      const y = parseInt(match[1]);
      const j = match[2].toUpperCase();
      const p = parseInt(match[3]);
      handlePinpointSearch(y, j, p);
      return;
    }

    setLoading(true);
    setSearched(true);
    try {
      const filters: any = {};
      if (court) filters.court = court;
      if (journal) filters.journal = journal;
      if (year) filters.year = parseInt(year);
      
      const res = await searchCaseLaw(query, filters);
      setResults(res);
    } catch (e) {
      console.error(e);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handlePinpointSearch = async (yOverride?: number, jOverride?: string, pOverride?: number) => {
    const targetYear = yOverride || parseInt(citeYear);
    const targetJournal = jOverride || citeJournal;
    const targetPage = pOverride || parseInt(citePage);

    if (!targetYear || !targetJournal || !targetPage) return;

    setLoading(true);
    setSearched(true);
    try {
      const res = await searchCitations(targetYear, targetJournal, targetPage);
      setResults(res);
    } catch (e) {
      console.error(e);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <TabList 
        className={styles.tabList}
        selectedValue={searchMode} 
        onTabSelect={(e, d) => {
          setSearchMode(d.value as 'keyword' | 'citation');
          setResults([]);
          setSearched(false);
        }}
        style={{ width: '100%', display: 'flex' }}
      >
        <Tab style={{ flex: 1 }} value="keyword" icon={<SearchRegular />}>Topic</Tab>
        <Tab style={{ flex: 1 }} value="citation" icon={<BookOpenRegular />}>Citation</Tab>
      </TabList>

      {searchMode === 'keyword' && (
        <div className={styles.filtersColumn}>
          <div className={styles.searchBox}>
            <Input 
              style={{ flexGrow: 1 }}
              placeholder="Legal topic or query..."
              value={query}
              onChange={(e, d) => setQuery(d.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleKeywordSearch()}
            />
            <Button 
              icon={<SearchRegular />} 
              appearance="primary" 
              onClick={handleKeywordSearch}
              disabled={loading}
              style={{ backgroundColor: '#C9A84C' }}
            />
          </div>

          <div className={styles.filtersRow}>
            <Dropdown
              placeholder="Court"
              size="small"
              style={{ flex: 1, minWidth: '0' }}
              onOptionSelect={(e, d) => setCourt(d.optionValue || '')}
              value={court}
            >
              <Option value="">All Courts</Option>
              {COURTS.map(c => <Option key={c} value={c}>{c}</Option>)}
            </Dropdown>
            <Dropdown
              placeholder="Journal"
              size="small"
              style={{ flex: 1, minWidth: '0' }}
              onOptionSelect={(e, d) => setJournal(d.optionValue || '')}
              value={journal}
            >
              <Option value="">All Journals</Option>
              {journals.map(j => <Option key={j} value={j}>{j}</Option>)}
            </Dropdown>
          </div>

          <Input 
            size="small"
            placeholder="Year (e.g. 2023)"
            type="number"
            value={year}
            onChange={(e, d) => setYear(d.value)}
          />
        </div>
      )}

      {searchMode === 'citation' && (
        <div className={styles.filtersColumn}>
          <Text weight="semibold" size={200}>Pinpoint Citation Lookup</Text>
          <div className={styles.filtersRow}>
            <Input 
              size="small"
              placeholder="Year"
              type="number"
              style={{ flex: 1, minWidth: '0' }}
              value={citeYear}
              onChange={(e, d) => setCiteYear(d.value)}
            />
            <Dropdown
              placeholder="Journal"
              size="small"
              style={{ flex: 1.5, minWidth: '0' }}
              onOptionSelect={(e, d) => setCiteJournal(d.optionValue || 'SCMR')}
              value={citeJournal}
            >
              {journals.map(j => <Option key={j} value={j}>{j}</Option>)}
            </Dropdown>
            <Input 
              size="small"
              placeholder="Page #"
              type="number"
              style={{ flex: 1, minWidth: '0' }}
              value={citePage}
              onChange={(e, d) => setCitePage(d.value)}
              onKeyDown={(e) => e.key === 'Enter' && handlePinpointSearch()}
            />
          </div>
          <Button 
            appearance="primary"
            onClick={() => handlePinpointSearch()}
            disabled={loading || !citePage}
            style={{ backgroundColor: '#C9A84C', width: '100%' }}
            icon={loading ? <Spinner size="tiny" /> : <BookOpenRegular />}
          >
            Find ({citeYear} {citeJournal} {citePage || '...'})
          </Button>
        </div>
      )}

      <div className={styles.resultsContainer}>
        {loading && <Spinner style={{ margin: '20px 0' }} label="Searching 600,000+ judgments..." />}
        
        {!loading && !searched && (
          <div className={styles.emptyState}>
            🔍 Search 600,000+ Pakistani court judgments across all 16 Law Journals (<b>PLD, SCMR, YLR, MLD, CLC, PCrLJ, CLD, PLC, PLJ, NLR, PTD, PSC, KLR, BLJ, SBLR, GBLR</b>).
          </div>
        )}
        
        {!loading && searched && results.length === 0 && (
          <div className={styles.emptyState}>
            No judgments found. Try adjusting your query, year, or journal criteria.
          </div>
        )}

        {!loading && results.map(r => (
          <ResultCard key={r.id} result={r} />
        ))}
      </div>
    </div>
  );
};

export default CaseLawSearch;
