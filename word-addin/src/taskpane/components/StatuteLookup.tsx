import React, { useState } from 'react';
import { 
  makeStyles, 
  shorthands, 
  Input, 
  Button, 
  Spinner, 
  Text,
  Card,
  tokens
} from '@fluentui/react-components';
import { SearchRegular, AddRegular, BookRegular } from '@fluentui/react-icons';
import { searchStatutes, StatuteResult } from '../services/api';
import { insertParagraph, insertTextAtCursor } from '../services/word';

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
  searchBox: {
    display: 'flex',
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
    ...shorthands.borderRadius('8px'),
    border: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  cardTitle: {
    fontWeight: '700',
    fontSize: '13px',
    lineHeight: '1.4',
    color: tokens.colorNeutralForeground1,
  },
  categoryBadge: {
    fontSize: '11px',
    color: '#C9A84C',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  contentPreview: {
    fontSize: '12px',
    color: tokens.colorNeutralForeground1,
    lineHeight: '1.5',
    textAlign: 'justify',
  },
  actions: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '8px',
    marginTop: '4px',
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

const ResultCard: React.FC<{ result: StatuteResult }> = ({ result }) => {
  const styles = useStyles();
  const [insertingContent, setInsertingContent] = useState(false);
  const [insertingRef, setInsertingRef] = useState(false);

  const handleInsertContent = async () => {
    setInsertingContent(true);
    try {
      await insertParagraph(result.content);
    } catch (e) {
      console.error(e);
    } finally {
      setInsertingContent(false);
    }
  };

  const handleInsertReference = async () => {
    setInsertingRef(true);
    try {
      await insertTextAtCursor(result.title);
    } catch (e) {
      console.error(e);
    } finally {
      setInsertingRef(false);
    }
  };

  return (
    <Card className={styles.card}>
      <Text className={styles.cardTitle}>{result.title}</Text>
      {result.category && <Text className={styles.categoryBadge}>{result.category}</Text>}
      
      <Text className={styles.contentPreview}>
        {result.content}
      </Text>
      
      <div className={styles.actions}>
        <Button 
          appearance="subtle" 
          size="small"
          onClick={handleInsertReference}
          disabled={insertingRef || insertingContent}
        >
          {insertingRef ? <Spinner size="tiny" /> : 'Copy Ref'}
        </Button>
        <Button 
          appearance="primary" 
          icon={insertingContent ? <Spinner size="tiny" /> : <AddRegular />}
          size="small"
          onClick={handleInsertContent}
          disabled={insertingContent || insertingRef}
          style={{ backgroundColor: '#C9A84C' }}
        >
          Insert Section
        </Button>
      </div>
    </Card>
  );
};

const StatuteLookup: React.FC = () => {
  const styles = useStyles();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<StatuteResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (!query) return;
    setLoading(true);
    setSearched(true);
    try {
      const res = await searchStatutes(query);
      setResults(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.searchBox}>
        <Input 
          style={{ flexGrow: 1 }}
          placeholder="Search statutes, PPC, CrPC, CPC..."
          value={query}
          onChange={(e, d) => setQuery(d.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <Button 
          icon={<SearchRegular />} 
          appearance="primary" 
          onClick={handleSearch}
          disabled={loading || !query}
          style={{ backgroundColor: '#C9A84C' }}
        />
      </div>

      <div className={styles.resultsContainer}>
        {loading && <Spinner style={{ margin: '20px 0' }} label="Searching 5,900+ statutes..." />}
        
        {!loading && !searched && (
          <div className={styles.emptyState}>
            📜 Search 5,900+ Pakistani statutes, acts, and procedural codes (PPC, CrPC, CPC, QSO, Constitution).
          </div>
        )}
        
        {!loading && searched && results.length === 0 && (
          <div className={styles.emptyState}>
            No statutes found. Try searching by section number or law title.
          </div>
        )}

        {!loading && results.map(r => (
          <ResultCard key={r.id} result={r} />
        ))}
      </div>
    </div>
  );
};

export default StatuteLookup;
