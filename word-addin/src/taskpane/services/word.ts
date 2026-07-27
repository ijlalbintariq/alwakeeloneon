export async function insertTextAtCursor(text: string): Promise<void> {
  await Word.run(async (context) => {
    const selection = context.document.getSelection();
    selection.insertText(text, Word.InsertLocation.end);
    await context.sync();
  });
}

export async function insertCitation(citation: string, caseTitle: string): Promise<void> {
  await Word.run(async (context) => {
    const selection = context.document.getSelection();
    const formattedText = `(${citation}, ${caseTitle})`;
    const insertedRange = selection.insertText(formattedText, Word.InsertLocation.end);
    insertedRange.font.italic = true;
    await context.sync();
  });
}

export async function insertFootnote(text: string): Promise<void> {
  await Word.run(async (context) => {
    const selection = context.document.getSelection();
    selection.insertFootnote(text);
    await context.sync();
  });
}

export async function insertParagraph(text: string, style?: string): Promise<void> {
  await Word.run(async (context) => {
    const selection = context.document.getSelection();
    const paragraph = selection.insertParagraph(text, Word.InsertLocation.after);
    if (style) {
      paragraph.style = style;
    }
    await context.sync();
  });
}

export async function insertFormattedContent(content: string): Promise<void> {
  await Word.run(async (context) => {
    const selection = context.document.getSelection();
    
    // Clean markdown syntax for clear Word document formatting
    const cleanedText = content
      .replace(/^#{1,6}\s+/gm, '') // Remove markdown headers #
      .replace(/\*\*(.*?)\*\*/g, '$1') // Strip bold markers for clean text or format
      .replace(/\*(.*?)\*/g, '$1') // Strip italic markers
      .replace(/`{1,3}.*?`{1,3}/gs, (match) => match.replace(/`/g, '')); // Clean code blocks

    const paragraphs = cleanedText.split(/\n\n+/);
    
    for (let i = 0; i < paragraphs.length; i++) {
      const pText = paragraphs[i].trim();
      if (!pText) continue;
      
      const isHeader = content.split(/\n\n+/)[i]?.trim().startsWith('#') || false;
      const paragraph = selection.insertParagraph(pText, Word.InsertLocation.after);
      
      if (isHeader) {
        paragraph.font.bold = true;
        paragraph.font.size = 14;
        paragraph.font.color = '#111111';
      } else {
        paragraph.font.size = 12;
        paragraph.lineSpacing = 18; // 1.25 line spacing
      }
    }
    
    await context.sync();
  });
}

export async function getSelectedText(): Promise<string> {
  return await Word.run(async (context) => {
    const selection = context.document.getSelection();
    selection.load('text');
    await context.sync();
    return selection.text;
  });
}

export async function applyCourtFormatting(): Promise<void> {
  await Word.run(async (context) => {
    const body = context.document.body;
    body.font.name = 'Times New Roman';
    body.font.size = 14;
    
    const paragraphs = body.paragraphs;
    paragraphs.load('items');
    await context.sync();
    
    for (let i = 0; i < paragraphs.items.length; i++) {
      const p = paragraphs.items[i];
      p.leftIndent = 0;
      p.lineSpacing = 28.8; // Double spacing in pt
      p.alignment = Word.Alignment.justified;
    }
    
    // Set margins - Word API takes points (1 inch = 72 points)
    const sections = context.document.sections;
    sections.load('items');
    await context.sync();
    
    for (let i = 0; i < sections.items.length; i++) {
      const pageSetup = sections.items[i].pageSetup;
      pageSetup.leftMargin = 108; // 1.5 inch (Court Binding Margin)
      pageSetup.topMargin = 72;   // 1.0 inch
      pageSetup.rightMargin = 72; // 1.0 inch
      pageSetup.bottomMargin = 72;// 1.0 inch
    }
    
    await context.sync();
  });
}

export async function insertContractClause(title: string, content: string): Promise<void> {
  await Word.run(async (context) => {
    const selection = context.document.getSelection();
    
    const contentPara = selection.insertParagraph(content, Word.InsertLocation.after);
    const titlePara = selection.insertParagraph(title, Word.InsertLocation.after);
    
    titlePara.font.bold = true;
    
    await context.sync();
  });
}

export async function getDocumentText(): Promise<string> {
  return await Word.run(async (context) => {
    const body = context.document.body;
    body.load('text');
    await context.sync();
    return body.text;
  });
}
