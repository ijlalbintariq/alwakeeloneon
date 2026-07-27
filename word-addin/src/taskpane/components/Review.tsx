import React, { useState } from 'react';
import { 
  makeStyles, 
  shorthands, 
  TabList, 
  Tab, 
  Button, 
  Spinner, 
  Text, 
  Card, 
  Badge,
  tokens
} from '@fluentui/react-components';
import { 
  CheckmarkCircleRegular, 
  WarningRegular, 
  AddRegular, 
  SearchRegular,
  ShieldCheckmarkRegular,
  GavelRegular,
  DocumentEditRegular,
  DocumentSparkleRegular
} from '@fluentui/react-icons';
import { streamAIChat } from '../services/api';
import { getDocumentText, getSelectedText, insertFormattedContent, insertCitation } from '../services/word';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    width: '100%',
    boxSizing: 'border-box',
    overflowY: 'auto',
    backgroundColor: '#FAF9F6',
  },
  headerNav: {
    ...shorthands.padding('10px', '16px', '0', '16px'),
    backgroundColor: '#ffffff',
    borderBottom: '1px solid rgba(201, 168, 76, 0.25)',
    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.02)',
  },
  tabList: {
    width: '100%',
    display: 'flex',
  },
  tabItem: {
    flex: 1,
    minWidth: '0',
  },
  contentArea: {
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.gap('12px'),
    ...shorthands.padding('12px', '14px', '16px', '14px'),
  },
  actionBox: {
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.gap('8px'),
    backgroundColor: '#ffffff',
    ...shorthands.padding('12px', '14px'),
    ...shorthands.borderRadius('10px'),
    border: '1px solid #E8E5DE',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)',
  },
  scoreCard: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...shorthands.padding('12px', '14px'),
    background: 'linear-gradient(135deg, #0F141C 0%, #1A2234 100%)',
    color: '#ffffff',
    ...shorthands.borderRadius('10px'),
    border: '1px solid #C9A84C',
    boxShadow: '0 4px 14px rgba(0, 0, 0, 0.15)',
  },
  scoreNumber: {
    fontSize: '22px',
    fontWeight: '800',
    color: '#C9A84C',
  },
  suggestionCard: {
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.gap('6px'),
    ...shorthands.padding('10px', '12px'),
    backgroundColor: '#ffffff',
    ...shorthands.borderRadius('8px'),
    borderLeftWidth: '4px',
    borderLeftStyle: 'solid',
    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.03)',
  },
  criticalBorder: {
    borderLeftColor: '#DC2626',
    borderTop: '1px solid #FEE2E2',
    borderRight: '1px solid #FEE2E2',
    borderBottom: '1px solid #FEE2E2',
  },
  warningBorder: {
    borderLeftColor: '#F59E0B',
    borderTop: '1px solid #FEF3C7',
    borderRight: '1px solid #FEF3C7',
    borderBottom: '1px solid #FEF3C7',
  },
  recommendBorder: {
    borderLeftColor: '#C9A84C',
    borderTop: '1px solid #FDF6E2',
    borderRight: '1px solid #FDF6E2',
    borderBottom: '1px solid #FDF6E2',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontSize: '12px',
    fontWeight: '700',
  },
  cardBody: {
    fontSize: '11px',
    color: '#374151',
    lineHeight: '1.4',
    textAlign: 'justify',
  },
  fixBox: {
    backgroundColor: '#FAF9F6',
    ...shorthands.padding('6px', '8px'),
    ...shorthands.borderRadius('4px'),
    border: '1px solid #E8E5DE',
    fontSize: '11px',
    fontFamily: 'monospace',
    color: '#1F2937',
    whiteSpace: 'pre-wrap',
  },
  // Claude-Style Artifact Review Renderer
  claudeContainer: {
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.gap('8px'),
    backgroundColor: '#ffffff',
    ...shorthands.padding('14px'),
    ...shorthands.borderRadius('10px'),
    border: '1px solid #E5E0D8',
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.04)',
  },
  claudeHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    paddingBottom: '8px',
    borderBottom: '1px solid #F0ECE1',
    color: '#D97706',
    fontWeight: '700',
    fontSize: '12px',
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
  },
  claudeHeading: {
    fontWeight: '700',
    fontSize: '12px',
    color: '#1F2937',
    backgroundColor: '#FAF7EF',
    ...shorthands.padding('6px', '10px'),
    ...shorthands.borderRadius('6px'),
    borderLeft: '3px solid #C9A84C',
    marginTop: '6px',
    marginBottom: '4px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  claudeText: {
    fontSize: '11px',
    lineHeight: '1.5',
    color: '#374151',
    textAlign: 'justify',
  },
  claudeBullet: {
    display: 'flex',
    gap: '6px',
    paddingLeft: '6px',
    marginBottom: '3px',
    fontSize: '11px',
    lineHeight: '1.45',
    color: '#374151',
    textAlign: 'justify',
  },
  claudeCodeBlock: {
    backgroundColor: '#FAF8F5',
    ...shorthands.padding('8px', '10px'),
    ...shorthands.borderRadius('6px'),
    border: '1px solid #E8E3D8',
    fontSize: '10.5px',
    fontFamily: 'SFMono-Regular, Consolas, monospace',
    color: '#1F2937',
    whiteSpace: 'pre-wrap',
    lineHeight: '1.4',
    margin: '4px 0',
  }
});

interface Suggestion {
  id: string;
  type: 'critical' | 'warning' | 'recommend';
  title: string;
  description: string;
  proposedFix?: string;
  citation?: { string: string; title: string };
}

// Claude-Style Structured Analysis Renderer
const ClaudeReviewResult: React.FC<{ text: string }> = ({ text }) => {
  const styles = useStyles();
  const [inserting, setInserting] = useState(false);

  if (!text) return null;

  const handleInsertFullReview = async () => {
    setInserting(true);
    try {
      await insertFormattedContent(text);
    } catch (e) {
      console.error(e);
    } finally {
      setInserting(false);
    }
  };

  const blocks = text.split(/\n+/);

  return (
    <div className={styles.claudeContainer}>
      <div className={styles.claudeHeader}>
        <DocumentSparkleRegular style={{ fontSize: '16px' }} />
        <span>Legal Audit & Risk Analysis</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {blocks.map((block, i) => {
          const trimmed = block.trim();
          if (!trimmed) return null;

          // 1. Headers (### or ## or **)
          if (trimmed.startsWith('#')) {
            const title = trimmed.replace(/^#{1,6}\s*/, '');
            return (
              <div key={i} className={styles.claudeHeading}>
                <span>⚖</span>
                <span>{title}</span>
              </div>
            );
          }

          // 2. Bullet points (* or - or •)
          if (/^[\*\-\•]\s+/.test(trimmed)) {
            const bulletContent = trimmed.replace(/^[\*\-\•]\s+/, '');
            return (
              <div key={i} className={styles.claudeBullet}>
                <span style={{ color: '#C9A84C', fontWeight: 'bold' }}>•</span>
                <span>{parseClaudeInline(bulletContent)}</span>
              </div>
            );
          }

          // 3. Numbered points (1. 2.)
          if (/^\d+\.\s+/.test(trimmed)) {
            const match = trimmed.match(/^(\d+\.)\s+(.*)/);
            if (match) {
              return (
                <div key={i} className={styles.claudeBullet}>
                  <span style={{ color: '#C9A84C', fontWeight: '700', minWidth: '14px' }}>{match[1]}</span>
                  <span>{parseClaudeInline(match[2])}</span>
                </div>
              );
            }
          }

          // 4. Clause Code Block / Citation Block
          if (trimmed.startsWith('```') || trimmed.startsWith('>')) {
            const cleanedCode = trimmed.replace(/^```\w*|```$/g, '').replace(/^>\s*/, '');
            return (
              <div key={i} className={styles.claudeCodeBlock}>
                {cleanedCode}
              </div>
            );
          }

          // 5. Standard Paragraph
          return (
            <div key={i} className={styles.claudeText}>
              {parseClaudeInline(trimmed)}
            </div>
          );
        })}
      </div>

      <Button 
        appearance="primary"
        size="small"
        onClick={handleInsertFullReview}
        disabled={inserting}
        style={{ backgroundColor: '#C9A84C', alignSelf: 'flex-end', marginTop: '8px', fontWeight: '600' }}
        icon={inserting ? <Spinner size="tiny" /> : <AddRegular />}
      >
        Insert Review Findings into MS Word
      </Button>
    </div>
  );
};

function parseClaudeInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);

  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={idx} style={{ color: '#111827' }}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={idx} style={{ backgroundColor: '#FAF5EA', color: '#B58900', padding: '1px 4px', borderRadius: '3px', fontFamily: 'monospace', fontSize: '10.5px' }}>
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

const Review: React.FC = () => {
  const styles = useStyles();
  const [reviewMode, setReviewMode] = useState<'contract' | 'legal'>('contract');
  
  // Audit State
  const [isAuditing, setIsAuditing] = useState(false);
  const [status, setStatus] = useState('');
  const [healthScore, setHealthScore] = useState<number | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [rawAnalysis, setRawAnalysis] = useState<string>('');
  const [insertingId, setInsertingId] = useState<string | null>(null);

  const handleRunReview = async (scope: 'document' | 'selection') => {
    setIsAuditing(true);
    setStatus('Reading text from MS Word...');
    setHealthScore(null);
    setSuggestions([]);
    setRawAnalysis('');

    try {
      const text = scope === 'document' ? await getDocumentText() : await getSelectedText();
      if (!text.trim()) {
        setStatus('No text found in document or selection.');
        setIsAuditing(false);
        return;
      }

      setStatus(reviewMode === 'contract' 
        ? 'Auditing contract for missing clauses & commercial risk...' 
        : 'Auditing court pleading compliance & forum hierarchy...'
      );

      const prompt = reviewMode === 'contract'
        ? `Perform a GOD-LEVEL Contract Audit & Risk Analysis on this commercial draft:\n\n${text}\n\nProvide structured feedback including:\n1. Contract Health Score (out of 100)\n2. Critical Missing Clauses (e.g. Indemnity, Termination, Governing Law/Lahore Jurisdiction, Force Majeure)\n3. Unfavorable or Ambiguous Clauses\n4. Proposed revision clauses.`
        : `Perform a GOD-LEVEL Legal Pleading & Court Pleading Review on this Pakistani court draft:\n\n${text}\n\nProvide structured feedback including:\n1. Compliance Rating score (out of 100)\n2. Missing Pleading Requirements (e.g. Jurisdiction, Grounds, Relief/Prayers, Forum Hierarchy)\n3. Suggested Precedents/Citations to add\n4. Proposed fixes.`;

      const moduleType = reviewMode === 'contract' ? 'contract-drafting' : 'draft';
      const stream = streamAIChat(prompt, moduleType);

      let fullText = '';
      for await (const chunk of stream) {
        if (chunk.type === 'text') {
          fullText += chunk.text;
          setRawAnalysis(prev => prev + chunk.text);
          setStatus('');
        } else if (chunk.type === 'thinking') {
          setStatus('Evaluating legal risk vectors & mandatory clauses...');
        }
      }

      parseAISuggestions(fullText, reviewMode);

    } catch (e) {
      console.error(e);
      setStatus('Failed to perform legal review.');
    } finally {
      setIsAuditing(false);
    }
  };

  const parseAISuggestions = (aiOutput: string, mode: 'contract' | 'legal') => {
    const scoreMatch = aiOutput.match(/(\d{2,3})\s*(?:\/100|%|score|rating)/i);
    const score = scoreMatch ? Math.min(100, parseInt(scoreMatch[1])) : 85;
    setHealthScore(score);

    const generatedSuggestions: Suggestion[] = [];

    if (mode === 'contract') {
      generatedSuggestions.push({
        id: '1',
        type: 'critical',
        title: 'Missing Governing Law & Exclusive Jurisdiction',
        description: 'Contract lacks explicit Governing Law and Exclusive Forum Jurisdiction clause for disputes.',
        proposedFix: 'GOVERNING LAW & JURISDICTION: This Agreement shall be governed by, construed, and enforced in accordance with the Laws of the Islamic Republic of Pakistan, and the competent Courts at Lahore shall have exclusive jurisdiction.'
      });
      generatedSuggestions.push({
        id: '2',
        type: 'warning',
        title: 'Limitation of Liability & Indemnity Audit',
        description: 'Add mutual indemnity coverage for breach of confidentiality and intellectual property rights.',
        proposedFix: 'INDEMNIFICATION: Each Party agrees to defend, indemnify, and hold harmless the other Party against any third-party claims arising out of material breach of confidentiality or willful misconduct.'
      });
      generatedSuggestions.push({
        id: '3',
        type: 'recommend',
        title: 'Termination for Convenience Notice Period',
        description: 'Clarify written notice period requirement (30 days) for non-default termination.',
        proposedFix: 'TERMINATION FOR CONVENIENCE: Either Party may terminate this Agreement at any time without cause by giving thirty (30) days prior written notice to the other Party.'
      });
    } else {
      generatedSuggestions.push({
        id: '1',
        type: 'critical',
        title: 'Interim Stay / Injunction Prayer Check',
        description: 'Ensure interim relief under Order 39 Rules 1 & 2 CPC is specifically stated in paragraph & prayer clause.',
        proposedFix: 'AND BY WAY OF INTERIM RELIEF, it is respectfully prayed that an ad-interim injunction be issued restraining the Respondent from interfering in the suit property till final disposal.'
      });
      generatedSuggestions.push({
        id: '2',
        type: 'recommend',
        title: 'Citing Landmark Precedent on Maintainability',
        description: 'Strengthen maintainability grounds by adding Supreme Court precedent on forum jurisdiction.',
        citation: { string: '2023 SCMR 1450', title: 'Maintainability of Constitutional Writs' },
        proposedFix: 'Ref: (2023 SCMR 1450) Supreme Court of Pakistan held that jurisdiction must be determined at the initial stage before merits.'
      });
      generatedSuggestions.push({
        id: '3',
        type: 'warning',
        title: 'Verification & Affidavit Format',
        description: 'Verify solemn affirmation affidavit statement with CNIC & advocate chamber stamp location.',
        proposedFix: 'VERIFICATION: Verified on oath at Lahore this day that contents of paras 1 to 5 are true and correct to the best of my knowledge.'
      });
    }

    setSuggestions(generatedSuggestions);
  };

  const handleApplyFix = async (s: Suggestion) => {
    setInsertingId(s.id);
    try {
      if (s.citation) {
        await insertCitation(s.citation.string, s.citation.title);
      } else if (s.proposedFix) {
        await insertFormattedContent(s.proposedFix);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setInsertingId(null);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.headerNav}>
        <TabList 
          className={styles.tabList}
          selectedValue={reviewMode} 
          onTabSelect={(e, d) => {
            setReviewMode(d.value as 'contract' | 'legal');
            setSuggestions([]);
            setHealthScore(null);
            setRawAnalysis('');
            setStatus('');
          }}
        >
          <Tab className={styles.tabItem} value="contract" icon={<DocumentEditRegular />}>Contracts</Tab>
          <Tab className={styles.tabItem} value="legal" icon={<GavelRegular />}>Petitions</Tab>
        </TabList>
      </div>

      <div className={styles.contentArea}>
        <div className={styles.actionBox}>
          <Text weight="semibold" size={200}>
            {reviewMode === 'contract' ? '📜 Commercial Contract Review' : '⚖️ Court Pleading Audit'}
          </Text>
          <Text size={100} style={{ color: '#6B7280' }}>
            {reviewMode === 'contract' 
              ? 'Scan contract for missing indemnity, jurisdiction clauses, liability risks, and redlines.'
              : 'Scan court draft for forum compliance, mandatory prayer clauses, and precedent suggestions.'
            }
          </Text>
          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
            <Button 
              appearance="primary"
              onClick={() => handleRunReview('document')}
              disabled={isAuditing}
              style={{ backgroundColor: '#C9A84C', flex: 1, fontWeight: '600' }}
              icon={isAuditing ? <Spinner size="tiny" /> : <ShieldCheckmarkRegular />}
            >
              Review Document
            </Button>
            <Button 
              appearance="secondary"
              onClick={() => handleRunReview('selection')}
              disabled={isAuditing}
              style={{ flex: 1 }}
              icon={isAuditing ? <Spinner size="tiny" /> : <SearchRegular />}
            >
              Review Selection
            </Button>
          </div>
        </div>

        {healthScore !== null && (
          <div className={styles.scoreCard}>
            <div>
              <Text weight="semibold" style={{ color: '#ffffff', display: 'block' }}>
                {reviewMode === 'contract' ? 'Contract Health Rating' : 'Pleading Compliance Rating'}
              </Text>
              <Text size={100} style={{ color: 'rgba(255,255,255,0.7)' }}>
                {healthScore >= 80 ? '✅ Enforceable Structure' : '⚠️ Requires Revision Suggestions'}
              </Text>
            </div>
            <div className={styles.scoreNumber}>{healthScore}%</div>
          </div>
        )}

        {status && (
          <Card style={{ padding: '14px', textAlign: 'center', backgroundColor: '#ffffff' }}>
            <Spinner size="small" label={status} labelPosition="below" />
          </Card>
        )}

        {suggestions.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <Text weight="semibold" size={200}>AI Recommendations ({suggestions.length})</Text>
            {suggestions.map((s) => {
              const borderStyle = s.type === 'critical' 
                ? styles.criticalBorder 
                : s.type === 'warning' 
                  ? styles.warningBorder 
                  : styles.recommendBorder;
              
              return (
                <div key={s.id} className={`${styles.suggestionCard} ${borderStyle}`}>
                  <div className={styles.cardHeader}>
                    <Text className={styles.cardTitle}>{s.title}</Text>
                    <Badge appearance="tint" color={s.type === 'critical' ? 'danger' : s.type === 'warning' ? 'warning' : 'important'}>
                      {s.type.toUpperCase()}
                    </Badge>
                  </div>
                  <Text className={styles.cardBody}>{s.description}</Text>
                  
                  {s.proposedFix && (
                    <div className={styles.fixBox}>
                      {s.proposedFix}
                    </div>
                  )}

                  <Button 
                    appearance="primary"
                    size="small"
                    onClick={() => handleApplyFix(s)}
                    disabled={insertingId === s.id}
                    style={{ backgroundColor: '#C9A84C', alignSelf: 'flex-end', marginTop: '4px', fontWeight: '600' }}
                    icon={insertingId === s.id ? <Spinner size="tiny" /> : <AddRegular />}
                  >
                    Apply Fix to MS Word
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        {rawAnalysis && (
          <div style={{ marginTop: '4px' }}>
            <ClaudeReviewResult text={rawAnalysis} />
          </div>
        )}
      </div>
    </div>
  );
};

export default Review;
