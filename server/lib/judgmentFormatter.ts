/**
 * Pakistani Legal Judgment Text Formatter
 * ========================================
 * Multi-signal deterministic pipeline for fixing OCR-extracted text.
 * Zero API cost. Pure string operations.
 */

// ── Patterns ────────────────────────────────────────────────────────────────

const PAGE_ARTIFACT_RE = /^(?:\s*-{3,}\s*|#{1,3}\s*Page\s*\d+\s*|\s*-+\s*Page\s*\d+\s*-+\s*|\f)$/i;
const METADATA_RE = /^\s*(Court\s*Name|Judge\(?s?\)?|Title|Case\s*No\.?|Date\s*of\s*(Judgment|Hearing|Decision|Order)|Reported\s*As|Result|Citation|Bench|Before)\s*:/i;

const HEADING_PATTERNS = [
  /^\s*(JUDGMENT|ORDER|HELD|DECREE|SHORT ORDER|DETAILED JUDGMENT)\s*$/i,
  /^\s*(BACKGROUND|FACTS|ISSUES?|ARGUMENTS?|FINDINGS?|DISCUSSION|CONCLUSION|RELIEF|PRAYER|ANALYSIS)\s*$/i,
  /^\s*(PER CURIAM|DISSENTING NOTE|SEPARATE NOTE|MINORITY JUDGMENT|MAJORITY JUDGMENT)\s*$/i,
];

const NUMBERED_PARA_RE = /^\s*(?:\d{1,3}\.\s|\(\d{1,3}\)\s|\([ivxlc]+\)\s|\([a-z]\)\s|[a-z]\)\s)/i;
const CITATION_LINE_RE = /^\s*(?:P\s*L\s*D|SCMR|PLD|CLC|PCrLJ|PCRLJ|YLR|MLD|PTD|NLR|PSC|PLJ|KLR|ALD)\s*\d{4}/i;
const JUDGE_LINE_RE = /^\s*(?:Mr\.\s*Justice|Mrs\.\s*Justice|Justice|Hon['']?ble|Chief Justice|J\.\s*[-—])/i;
const TERMINAL_PUNCT_RE = /[.;:?!'")\]]\s*$/;
const SHORT_STRUCTURAL_THRESHOLD = 40;

// ── Helpers ─────────────────────────────────────────────────────────────────

function isHeading(line: string): boolean {
  if (HEADING_PATTERNS.some(p => p.test(line))) return true;
  const trimmed = line.trim();
  if (trimmed.length > 3 && trimmed.length < 60 && trimmed === trimmed.toUpperCase() && /[A-Z]{3,}/.test(trimmed)) return true;
  return false;
}

function isNumberedParagraph(line: string): boolean { return NUMBERED_PARA_RE.test(line); }
function isCitationLine(line: string): boolean { return CITATION_LINE_RE.test(line); }
function isJudgeLine(line: string): boolean { return JUDGE_LINE_RE.test(line); }
function endsWithTerminalPunct(line: string): boolean { return TERMINAL_PUNCT_RE.test(line.trimEnd()); }

const INCOMPLETE_CITATION_RE = /(?:P\s*L\s*D|SCMR|CLC|PCrLJ|PCRLJ|YLR|MLD|PTD|NLR|PSC|PLJ|KLR|ALD|SBLR)\s+(?:19|20)\d{2}(?:\s+[A-Za-z.]+)?\s*$/i;
function isIncompleteCitation(line: string): boolean { return INCOMPLETE_CITATION_RE.test(line.trimEnd()); }
function isLikelyOCRWrap(line: string): boolean { return line.trimEnd().length > 55; }
function startsNewBlock(line: string): boolean { return isHeading(line) || isNumberedParagraph(line) || isCitationLine(line) || isJudgeLine(line); }

// ── Hyphenation ─────────────────────────────────────────────────────────────

const HYPHENATED_WORDS = new Set([
  'well-known', 'above-mentioned', 'above-said', 'above-named', 'above-referred',
  'co-accused', 'co-owner', 'co-sharers', 'co-sharer', 'co-respondent',
  'cross-examination', 'cross-examined', 'cross-examine', 'cross-objection',
  'ex-parte', 'ex-officio', 'non-applicant', 'non-compliance', 'non-payment',
  'pre-arrest', 'pre-trial', 'post-arrest', 'post-mortem',
  'self-incrimination', 'self-defence', 'self-defense',
  'sub-section', 'sub-clause', 'sub-inspector', 'sub-divisional',
  'anti-terrorism', 'anti-narcotics', 'counter-affidavit',
  'eye-witness', 'eye-witnesses', 'so-called', 'above-stated',
  'non-reading', 'non-consideration', 'ad-interim', 'intra-court', 'inter-court',
]);

function handleHyphenation(currentLine: string, nextLine: string): { merged: string; consumed: boolean } {
  const trimCurrent = currentLine.trimEnd();
  if (!trimCurrent.endsWith('-')) return { merged: currentLine, consumed: false };
  const nextTrimmed = nextLine.trimStart();
  if (!nextTrimmed) return { merged: currentLine, consumed: false };
  const beforeHyphen = trimCurrent.slice(0, -1);
  const lastWordPartMatch = beforeHyphen.match(/(\w+)$/);
  if (!lastWordPartMatch) return { merged: currentLine, consumed: false };
  const nextWordMatch = nextTrimmed.match(/^(\w+)/);
  if (!nextWordMatch) return { merged: currentLine, consumed: false };
  const partBefore = lastWordPartMatch[1].toLowerCase();
  const partAfter = nextWordMatch[1].toLowerCase();
  const hyphenated = partBefore + '-' + partAfter;
  if (HYPHENATED_WORDS.has(hyphenated)) {
    return { merged: trimCurrent + nextTrimmed, consumed: true };
  }
  const prefix = beforeHyphen.slice(0, -lastWordPartMatch[1].length);
  const combined = partBefore + partAfter;
  const rest = nextTrimmed.slice(nextWordMatch[1].length);
  return { merged: prefix + combined + rest, consumed: true };
}

// ── Main Formatter ──────────────────────────────────────────────────────────

export function formatJudgmentText(rawText: string): string {
  if (!rawText || rawText.trim().length === 0) return '';
  
  let text = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  let lines = text.split('\n').map(l => l.trimEnd());
  
  // Remove page artifacts
  lines = lines.filter(line => !PAGE_ARTIFACT_RE.test(line));
  while (lines.length > 0 && lines[0].trim() === '') lines.shift();
  while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop();
  
  // Separate metadata header
  const metadataLines: string[] = [];
  let bodyStartIndex = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (METADATA_RE.test(line) || (i < 10 && line.trim() === '')) {
      metadataLines.push(line);
      bodyStartIndex = i + 1;
    } else { break; }
  }
  
  const bodyLines = lines.slice(bodyStartIndex);
  const outputParagraphs: string[] = [];
  let currentParagraph = '';
  
  let i = 0;
  while (i < bodyLines.length) {
    const line = bodyLines[i];
    const trimmed = line.trim();
    
    if (trimmed === '') {
      if (currentParagraph.trim()) { outputParagraphs.push(currentParagraph.trim()); currentParagraph = ''; }
      i++; continue;
    }
    
    const cleanLine = trimmed.replace(/^[''`]\s*/, '');
    
    // If the previous line is an incomplete citation (like "PLD 1981 Pesh."), 
    // the next line might start with a page number (like "57. ").
    // We MUST merge it and skip all block-level checks.
    if (currentParagraph && isIncompleteCitation(currentParagraph)) {
      currentParagraph += ' ' + cleanLine;
      i++;
      continue;
    }
    
    if (isHeading(cleanLine)) {
      if (currentParagraph.trim()) { outputParagraphs.push(currentParagraph.trim()); currentParagraph = ''; }
      outputParagraphs.push(cleanLine);
      i++; continue;
    }
    
    if (isNumberedParagraph(cleanLine) || isCitationLine(cleanLine) || isJudgeLine(cleanLine)) {
      if (currentParagraph.trim()) { outputParagraphs.push(currentParagraph.trim()); currentParagraph = ''; }
      currentParagraph = cleanLine;
      i++; continue;
    }
    
    // Hyphenation
    if (i + 1 < bodyLines.length && cleanLine.endsWith('-')) {
      const nextLine = bodyLines[i + 1].trim();
      if (nextLine) {
        const hyphenResult = handleHyphenation(cleanLine, nextLine);
        if (hyphenResult.consumed) {
          currentParagraph = currentParagraph ? currentParagraph + ' ' + hyphenResult.merged : hyphenResult.merged;
          i += 2; continue;
        }
      }
    }
    
    // Merge or new paragraph decision
    if (currentParagraph === '') {
      currentParagraph = cleanLine;
    } else {
      const prevEndsWithPunct = endsWithTerminalPunct(currentParagraph);
      const nextIsNewBlock = startsNewBlock(cleanLine);
      
      if (prevEndsWithPunct && nextIsNewBlock) {
        outputParagraphs.push(currentParagraph.trim());
        currentParagraph = cleanLine;
      } else if (prevEndsWithPunct && cleanLine.length < SHORT_STRUCTURAL_THRESHOLD && !isLikelyOCRWrap(cleanLine)) {
        outputParagraphs.push(currentParagraph.trim());
        currentParagraph = cleanLine;
      } else {
        currentParagraph += ' ' + cleanLine;
      }
    }
    i++;
  }
  
  if (currentParagraph.trim()) outputParagraphs.push(currentParagraph.trim());
  
  // Assemble
  const parts: string[] = [];
  if (metadataLines.length > 0) {
    parts.push(metadataLines.map(l => l.trim()).filter(Boolean).join('\n'));
    parts.push('');
  }
  for (const para of outputParagraphs) { parts.push(para); parts.push(''); }
  
  return parts.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** Verify word integrity before/after formatting */
export function verifyWordIntegrity(original: string, formatted: string): {
  originalWords: number; formattedWords: number; match: boolean; diffPercent: number;
} {
  const countWords = (text: string) => {
    const cleaned = text.replace(/---/g, '').replace(/#{1,3}\s*Page\s*\d+/gi, '').replace(/\s+/g, ' ').trim();
    return cleaned.split(/\s+/).filter(w => w.length > 0).length;
  };
  const originalWords = countWords(original);
  const formattedWords = countWords(formatted);
  const diff = Math.abs(originalWords - formattedWords);
  const diffPercent = originalWords > 0 ? (diff / originalWords) * 100 : 0;
  return { originalWords, formattedWords, match: diffPercent < 1, diffPercent: Math.round(diffPercent * 100) / 100 };
}
