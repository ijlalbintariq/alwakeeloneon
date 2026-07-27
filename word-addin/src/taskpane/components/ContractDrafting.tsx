import React, { useState } from 'react';
import { 
  makeStyles, 
  shorthands, 
  TabList,
  Tab,
  Button, 
  Spinner, 
  Text,
  Textarea,
  Input,
  Card,
  Dropdown,
  Option,
  tokens
} from '@fluentui/react-components';
import { DocumentEditRegular, SearchRegular, AddRegular, GavelRegular, CheckmarkCircleRegular, FlashRegular, EditRegular, ArrowLeftRegular } from '@fluentui/react-icons';
import { streamAIChat } from '../services/api';
import { insertFormattedContent, getDocumentText, getSelectedText, applyCourtFormatting, insertContractClause } from '../services/word';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    width: '100%',
    boxSizing: 'border-box',
    overflowX: 'hidden',
    overflowY: 'auto',
    backgroundColor: '#FAF9F6',
  },
  headerNav: {
    ...shorthands.padding('6px', '4px', '0', '4px'),
    backgroundColor: '#ffffff',
    borderBottom: '1px solid rgba(201, 168, 76, 0.25)',
    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.02)',
    width: '100%',
    boxSizing: 'border-box',
    overflowX: 'hidden',
  },
  tabList: {
    width: '100%',
    display: 'flex',
    justifyContent: 'space-between',
  },
  tabItem: {
    flex: 1,
    minWidth: '0',
    fontSize: '11px',
    ...shorthands.padding('6px', '2px'),
  },
  contentArea: {
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.gap('14px'),
    ...shorthands.padding('14px', '12px', '16px', '12px'),
    width: '100%',
    boxSizing: 'border-box',
  },
  sectionTitle: {
    fontSize: '15px',
    fontWeight: '700',
    color: '#1F2937',
    letterSpacing: '0.3px',
    marginTop: '2px',
    marginBottom: '2px',
  },
  templateGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '8px',
    width: '100%',
  },
  templateCard: {
    cursor: 'pointer',
    ...shorthands.padding('10px', '8px'),
    textAlign: 'center',
    backgroundColor: '#ffffff',
    border: '1px solid #E8E5DE',
    ...shorthands.borderRadius('8px'),
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    position: 'relative',
    boxSizing: 'border-box',
    width: '100%',
    ':hover': {
      backgroundColor: '#FAF7EF',
      ...shorthands.borderColor('#C9A84C'),
      transform: 'translateY(-1px)',
    }
  },
  selectedCard: {
    backgroundColor: '#F9F5EC',
    ...shorthands.borderColor('#C9A84C'),
    boxShadow: '0 4px 12px rgba(201, 168, 76, 0.15)',
  },
  cardLabel: {
    fontSize: '11.5px',
    lineHeight: '1.35',
    fontWeight: '500',
    color: '#374151',
  },
  selectedCheck: {
    position: 'absolute',
    top: '4px',
    right: '4px',
    color: '#C9A84C',
    fontSize: '13px',
  },
  clauseCard: {
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.gap('6px'),
    ...shorthands.padding('12px'),
    backgroundColor: '#ffffff',
    ...shorthands.borderRadius('8px'),
    border: '1px solid #E8E5DE',
    boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
  },
  clauseTitle: {
    fontWeight: '700',
    fontSize: '12px',
    color: tokens.colorNeutralForeground1,
  },
  clauseBody: {
    fontSize: '11px',
    color: '#4B5563',
    lineHeight: '1.4',
    textAlign: 'justify',
  },
  resultBox: {
    ...shorthands.padding('14px'),
    backgroundColor: '#ffffff',
    ...shorthands.borderRadius('8px'),
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    whiteSpace: 'pre-wrap',
    minHeight: '120px',
    fontSize: '12px',
    lineHeight: '1.5',
    boxShadow: tokens.shadow2,
  },
  statusText: {
    fontSize: '12px',
    color: tokens.colorNeutralForeground3,
    fontStyle: 'italic',
    marginBottom: '8px',
  }
});

// Categorized Commercial Contracts
const CONTRACT_CATEGORIES = {
  'Corporate & Commercial': [
    'Partnership Deed',
    'Share Purchase Agreement',
    'Joint Venture Agreement',
    'Service Level Agreement (SLA)',
    '✨ Custom / Other Contract'
  ],
  'Employment & HR': [
    'Executive Employment Contract',
    'Independent Contractor Agreement',
    'Non-Disclosure Agreement (NDA)',
    'Non-Compete Agreement',
    '✨ Custom / Other Contract'
  ],
  'Real Estate & Property': [
    'Lease / Tenancy Agreement',
    'Sale Deed / Property Conveyance',
    'Commercial Rent Agreement',
    'Mortgage Deed',
    '✨ Custom / Other Contract'
  ],
  'IP & Technology': [
    'SaaS Subscription Agreement',
    'Software Licensing Agreement',
    'IP Assignment Agreement',
    'Tech Transfer Agreement',
    '✨ Custom / Other Contract'
  ]
};

// Comprehensive Pakistani Court Petitions List
const COURT_PETITIONS = [
  'Post-Arrest Bail (Sec 497 CrPC)',
  'Pre-Arrest Bail (Sec 498 CrPC)',
  'Civil Suit / Plaint (CPC Order VII)',
  'Constitutional Writ Petition (Art 199)',
  'Legal Notice & Reply',
  'Stay Application (Order 39 CPC)',
  'Family Suit (Khula / Maintenance)',
  'Criminal Appeal / Revision',
  'Rent Ejectment Petition',
  'Execution Petition (Order XXI)',
  'Service Tribunal Appeal',
  '✨ Custom / Other Petition'
];

// Pre-built Commercial Clauses (15 High-Enforceability Clauses)
const STANDARD_CLAUSES = [
  {
    id: 'indemnity',
    title: 'INDEMNIFICATION & HOLD HARMLESS',
    content: 'Each Party agrees to defend, indemnify, and hold harmless the other Party, its directors, officers, and employees from and against any third-party claims, liabilities, losses, or damages arising out of a material breach of this Agreement or willful misconduct.'
  },
  {
    id: 'jurisdiction',
    title: 'GOVERNING LAW & EXCLUSIVE JURISDICTION',
    content: 'This Agreement shall be governed by, construed, and enforced in accordance with the Laws of the Islamic Republic of Pakistan. The Parties irrevocably submit to the exclusive jurisdiction of the competent Courts at Lahore, Pakistan.'
  },
  {
    id: 'arbitration',
    title: 'ARBITRATION & DISPUTE RESOLUTION',
    content: 'Any dispute, controversy, or claim arising out of or relating to this Agreement shall be referred to arbitration under the Arbitration Act, 1940. The arbitration tribunal shall consist of a sole arbitrator appointed mutually, and the seat of arbitration shall be Lahore, Pakistan.'
  },
  {
    id: 'limitation',
    title: 'LIMITATION OF LIABILITY',
    content: 'Neither Party shall be liable to the other for any indirect, incidental, consequential, or punitive damages. Total aggregate liability under this Agreement shall not exceed the total fees paid under this Agreement in the twelve (12) months preceding the claim.'
  },
  {
    id: 'force_majeure',
    title: 'FORCE MAJEURE (SEC 56 CONTRACT ACT)',
    content: 'Neither Party shall be held liable for failure or delay in performance caused by events beyond its reasonable control, including acts of God, war, strikes, government restrictions, epidemic, or national emergency.'
  },
  {
    id: 'termination_convenience',
    title: 'TERMINATION FOR CONVENIENCE',
    content: 'Either Party may terminate this Agreement at any time without cause by providing thirty (30) days prior written notice to the other Party, whereupon accrued payment obligations through the termination date shall remain payable.'
  },
  {
    id: 'termination_default',
    title: 'TERMINATION FOR MATERIAL BREACH',
    content: 'Either Party may terminate this Agreement immediately upon written notice if the other Party materially breaches any term hereof and fails to cure such breach within fourteen (14) calendar days of receiving written notice specifying the breach.'
  },
  {
    id: 'confidentiality',
    title: 'CONFIDENTIALITY & NON-DISCLOSURE',
    content: 'Each Party agrees to maintain in strict confidence all proprietary, financial, and technical information received from the Disclosing Party. Confidential Information shall not be disclosed to any third party for a period of three (3) years following termination without prior written consent.'
  },
  {
    id: 'non_solicit',
    title: 'NON-SOLICITATION & NON-COMPETE',
    content: 'During the term of this Agreement and for a period of twelve (12) months thereafter, neither Party shall directly or indirectly solicit, induce, hire, or engage any employee or client of the other Party without express written consent.'
  },
  {
    id: 'ip_assignment',
    title: 'INTELLECTUAL PROPERTY ASSIGNMENT',
    content: 'All intellectual property, work product, deliverables, trade secrets, software code, and inventions created or developed under this Agreement shall belong exclusively to the Client, and the Contractor hereby assigns all rights, title, and interest therein.'
  },
  {
    id: 'payment_terms',
    title: 'PAYMENT TERMS & LATE PENALTY',
    content: 'Invoices shall be payable within thirty (30) days of receipt. Late payments shall accrue interest at the rate of KIBOR plus two percent (2%) per annum calculated daily from the due date until paid in full.'
  },
  {
    id: 'severability',
    title: 'SEVERABILITY & SAVINGS CLAUSE',
    content: 'If any provision of this Agreement is held by a court of competent jurisdiction to be invalid, illegal, or unenforceable, such provision shall be severed, and the remaining provisions shall remain in full force and effect.'
  },
  {
    id: 'entire_agreement',
    title: 'ENTIRE AGREEMENT & INTEGRATION',
    content: 'This Agreement constitutes the complete and exclusive understanding between the Parties regarding its subject matter and supersedes all prior oral or written agreements, negotiations, representations, or understandings.'
  },
  {
    id: 'notices',
    title: 'FORMAL NOTICES & SERVICE OF COMMUNICATIONS',
    content: 'All formal notices required hereunder shall be in writing and deemed served when delivered by hand, registered mail with acknowledgment due, or sent by confirmed email to the designated address of the receiving Party.'
  },
  {
    id: 'waiver',
    title: 'NO IMPLIED WAIVER',
    content: 'No failure or delay by either Party in exercising any right or remedy hereunder shall operate as a waiver thereof, nor shall any single or partial exercise preclude any further exercise of any other right or remedy.'
  }
];

const Drafting: React.FC = () => {
  const styles = useStyles();
  const [draftCategory, setDraftCategory] = useState<'contracts' | 'clauses' | 'petitions'>('contracts');
  
  // Contract State
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>('Corporate & Commercial');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [customDocumentName, setCustomDocumentName] = useState<string>('');
  
  // Custom Form Fields
  const [partyA, setPartyA] = useState('');
  const [partyB, setPartyB] = useState('');
  const [jurisdiction, setJurisdiction] = useState('Lahore');
  const [requirements, setRequirements] = useState('');
  
  // Output State
  const [isProcessing, setIsProcessing] = useState(false);
  const [output, setOutput] = useState('');
  const [status, setStatus] = useState('');
  const [insertingClauseId, setInsertingClauseId] = useState<string | null>(null);

  const runStream = async (prompt: string, moduleType: 'draft' | 'contract-drafting') => {
    setIsProcessing(true);
    setOutput('');
    setStatus('Drafting document...');

    let fullResult = '';

    try {
      const stream = streamAIChat(prompt, moduleType);
      for await (const chunk of stream) {
        if (chunk.type === 'text') {
          fullResult += chunk.text;
          setOutput(prev => prev + chunk.text);
          setStatus('');
        } else if (chunk.type === 'thinking') {
          setStatus('Structuring legal clauses & formatting...');
        } else if (chunk.type === 'done') {
          setStatus('');
        }
      }

      // Automatically insert generated draft into MS Word document upon completion
      if (fullResult.trim()) {
        try {
          await insertFormattedContent(fullResult);
          if (moduleType === 'draft') {
            await applyCourtFormatting().catch(() => {});
          }
        } catch (insertError) {
          console.error('Auto-insert into Word failed:', insertError);
        }
      }
    } catch (e) {
      console.error(e);
      setStatus('An error occurred during generation.');
    } finally {
      setIsProcessing(false);
    }
  };

  const getEffectiveTitle = () => {
    if (selectedTemplate?.includes('Custom')) {
      return customDocumentName.trim() || 'Custom Agreement';
    }
    return selectedTemplate || 'Document';
  };

  const handleGenerateContract = () => {
    const docTitle = getEffectiveTitle();
    if (!docTitle) return;
    
    let prompt = `Draft a comprehensive, highly enforceable ${docTitle}.\n`;
    if (partyA) prompt += `Party A (First Party): ${partyA}\n`;
    if (partyB) prompt += `Party B (Second Party): ${partyB}\n`;
    prompt += `Governing Law & Jurisdiction: Courts at ${jurisdiction}, Pakistan\n`;
    prompt += `Specific Terms & Considerations: ${requirements || 'Standard commercial terms, limitation of liability, indemnity, arbitration clause, confidentiality, and termination terms.'}`;

    runStream(prompt, 'contract-drafting');
  };

  const handleGeneratePetition = () => {
    const docTitle = getEffectiveTitle();
    if (!docTitle) return;
    const prompt = `Draft a formal court petition/pleading for Pakistani court: ${docTitle}.\nDetails & Grounds: ${requirements || 'Standard legal court format'}`;
    runStream(prompt, 'draft');
  };

  const handleInsertClause = async (clause: { id: string; title: string; content: string }) => {
    setInsertingClauseId(clause.id);
    try {
      await insertContractClause(clause.title, clause.content);
    } catch (e) {
      console.error(e);
    } finally {
      setInsertingClauseId(null);
    }
  };

  const handleManualInsert = async () => {
    try {
      await insertFormattedContent(output);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.headerNav}>
        <TabList 
          className={styles.tabList}
          selectedValue={draftCategory} 
          onTabSelect={(e, d) => {
            setDraftCategory(d.value as 'contracts' | 'clauses' | 'petitions');
            setSelectedTemplate(null);
            setCustomDocumentName('');
            setOutput('');
            setStatus('');
          }}
        >
          <Tab className={styles.tabItem} value="contracts" icon={<DocumentEditRegular />}>Contracts</Tab>
          <Tab className={styles.tabItem} value="clauses" icon={<FlashRegular />}>Clauses</Tab>
          <Tab className={styles.tabItem} value="petitions" icon={<GavelRegular />}>Petitions</Tab>
        </TabList>
      </div>

      <div className={styles.contentArea}>
        {/* CONTRACT DRAFTING MODULE */}
        {draftCategory === 'contracts' && (
          <>
            <Text className={styles.sectionTitle}>Select Category</Text>
            <Dropdown
              placeholder="Category"
              size="small"
              style={{ width: '100%' }}
              onOptionSelect={(e, d) => {
                setSelectedSubCategory(d.optionValue || 'Corporate & Commercial');
                setSelectedTemplate(null);
              }}
              value={selectedSubCategory}
            >
              {Object.keys(CONTRACT_CATEGORIES).map(cat => <Option key={cat} value={cat}>{cat}</Option>)}
            </Dropdown>

            <Text className={styles.sectionTitle}>Select Contract Agreement</Text>
            <div className={styles.templateGrid}>
              {(CONTRACT_CATEGORIES as any)[selectedSubCategory]?.map((t: string) => (
                <Card 
                  key={t}
                  appearance="subtle"
                  className={`${styles.templateCard} ${selectedTemplate === t ? styles.selectedCard : ''}`}
                  onClick={() => setSelectedTemplate(t)}
                >
                  {selectedTemplate === t && <CheckmarkCircleRegular className={styles.selectedCheck} />}
                  <Text className={styles.cardLabel} weight={selectedTemplate === t ? "semibold" : "regular"}>{t}</Text>
                </Card>
              ))}
            </div>

            {selectedTemplate?.includes('Custom') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                <Text weight="semibold" size={200}>Input Your Contract Type</Text>
                <Input 
                  size="small" 
                  placeholder="E.g. Franchise Agreement, Software Maintenance Contract..."
                  value={customDocumentName}
                  onChange={(e, d) => setCustomDocumentName(d.value)}
                />
              </div>
            )}

            {selectedTemplate && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
                <Text weight="semibold" size={200}>Contract Customization</Text>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <Input 
                    size="small" 
                    placeholder="Party A (First Party)" 
                    style={{ flex: 1, minWidth: '0' }}
                    value={partyA}
                    onChange={(e, d) => setPartyA(d.value)}
                  />
                  <Input 
                    size="small" 
                    placeholder="Party B (Second Party)" 
                    style={{ flex: 1, minWidth: '0' }}
                    value={partyB}
                    onChange={(e, d) => setPartyB(d.value)}
                  />
                </div>
                <Dropdown
                  size="small"
                  placeholder="Jurisdiction"
                  style={{ width: '100%' }}
                  onOptionSelect={(e, d) => setJurisdiction(d.optionValue || 'Lahore')}
                  value={jurisdiction}
                >
                  <Option value="Lahore">Lahore, Punjab</Option>
                  <Option value="Karachi">Karachi, Sindh</Option>
                  <Option value="Islamabad">Islamabad Capital Territory</Option>
                  <Option value="Peshawar">Peshawar, KP</Option>
                  <Option value="Quetta">Quetta, Balochistan</Option>
                </Dropdown>
                <Textarea 
                  placeholder="Specific requirements, payment terms, duration, non-compete period..."
                  value={requirements}
                  onChange={(e, d) => setRequirements(d.value)}
                  resize="vertical"
                  style={{ minHeight: '70px' }}
                />
                <Button 
                  appearance="primary"
                  onClick={handleGenerateContract}
                  disabled={isProcessing}
                  style={{ backgroundColor: '#C9A84C', fontWeight: '700' }}
                  icon={isProcessing ? <Spinner size="tiny" /> : <DocumentEditRegular />}
                >
                  Draft {getEffectiveTitle()}
                </Button>
              </div>
            )}
          </>
        )}

        {/* CLAUSE LIBRARY MODULE */}
        {draftCategory === 'clauses' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <Button 
              appearance="subtle"
              icon={<ArrowLeftRegular />}
              size="small"
              onClick={() => setDraftCategory('contracts')}
              style={{ alignSelf: 'flex-start', color: '#C9A84C', fontWeight: '600', paddingLeft: 0 }}
            >
              Back to Contracts
            </Button>
            <Text className={styles.sectionTitle}>Standard Commercial Clauses</Text>
            <Text size={100} style={{ color: '#6B7280' }}>
              One-click insertion of enforceability clauses into your open MS Word contract.
            </Text>
            {STANDARD_CLAUSES.map((c) => (
              <div key={c.id} className={styles.clauseCard}>
                <Text className={styles.clauseTitle}>{c.title}</Text>
                <Text className={styles.clauseBody}>{c.content}</Text>
                <Button 
                  appearance="primary"
                  size="small"
                  onClick={() => handleInsertClause(c)}
                  disabled={insertingClauseId === c.id}
                  style={{ backgroundColor: '#C9A84C', alignSelf: 'flex-end', marginTop: '4px', fontWeight: '600' }}
                  icon={insertingClauseId === c.id ? <Spinner size="tiny" /> : <AddRegular />}
                >
                  Insert Clause into MS Word
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* COURT PETITIONS MODULE */}
        {draftCategory === 'petitions' && (
          <>
            <Text className={styles.sectionTitle}>Select Court Document Type</Text>
            <div className={styles.templateGrid}>
              {COURT_PETITIONS.map(t => (
                <Card 
                  key={t}
                  appearance="subtle"
                  className={`${styles.templateCard} ${selectedTemplate === t ? styles.selectedCard : ''}`}
                  onClick={() => setSelectedTemplate(t)}
                >
                  {selectedTemplate === t && <CheckmarkCircleRegular className={styles.selectedCheck} />}
                  <Text className={styles.cardLabel} weight={selectedTemplate === t ? "semibold" : "regular"}>{t}</Text>
                </Card>
              ))}
            </div>

            {selectedTemplate?.includes('Custom') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                <Text weight="semibold" size={200}>Input Your Document / Petition Type</Text>
                <Input 
                  size="small" 
                  placeholder="E.g. Arbitration Application under Sec 20, Child Custody Petition..."
                  value={customDocumentName}
                  onChange={(e, d) => setCustomDocumentName(d.value)}
                />
              </div>
            )}

            {selectedTemplate && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
                <Text weight="semibold" size={200}>Case Details & Grounds</Text>
                <Textarea 
                  placeholder="Petitioner/Respondent names, Court name, FIR No., Sec 302 PPC, grounds..."
                  value={requirements}
                  onChange={(e, d) => setRequirements(d.value)}
                  resize="vertical"
                  style={{ minHeight: '80px' }}
                />
                <Button 
                  appearance="primary"
                  onClick={handleGeneratePetition}
                  disabled={isProcessing}
                  style={{ backgroundColor: '#C9A84C', fontWeight: '700' }}
                  icon={isProcessing ? <Spinner size="tiny" /> : <GavelRegular />}
                >
                  Draft {getEffectiveTitle()}
                </Button>
              </div>
            )}
          </>
        )}

        {/* OUTPUT PREVIEW */}
        {(output || status) && (
          <div style={{ marginTop: '12px' }}>
            <Text weight="semibold" style={{ marginBottom: '6px', display: 'block' }}>Draft Preview</Text>
            <div className={styles.resultBox}>
              {status && <div className={styles.statusText}>{status}</div>}
              {output}
            </div>
            {output && !isProcessing && (
              <Button 
                appearance="primary"
                onClick={handleManualInsert}
                style={{ marginTop: '12px', backgroundColor: '#C9A84C', width: '100%', fontWeight: '700' }}
                icon={<AddRegular />}
              >
                Insert into MS Word
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Drafting;
