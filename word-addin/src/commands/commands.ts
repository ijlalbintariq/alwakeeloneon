Office.onReady(() => {
  Office.actions.associate('courtFormat', courtFormat);
  Office.actions.associate('checkCitations', checkCitations);
  Office.actions.associate('findPrecedent', findPrecedent);
  Office.actions.associate('explainThis', explainThis);
  Office.actions.associate('analyzeClauses', analyzeClauses);
});

async function courtFormat(event: Office.AddinCommands.Event) {
  try {
    await Word.run(async (context) => {
      const body = context.document.body;
      body.font.name = 'Times New Roman';
      body.font.size = 14;
      
      const paragraphs = body.paragraphs;
      paragraphs.load('items');
      await context.sync();
      
      paragraphs.items.forEach(p => { 
        p.leftIndent = 0; 
        p.lineSpacing = 28.8; // Double line spacing
        p.alignment = Word.Alignment.justified; 
      });
      
      const sections = context.document.sections;
      sections.load('items');
      await context.sync();
      
      sections.items.forEach(section => {
        const pageSetup = section.pageSetup;
        pageSetup.leftMargin = 108; // 1.5 in (Court Binding Margin)
        pageSetup.topMargin = 72;   // 1.0 in
        pageSetup.rightMargin = 72; // 1.0 in
        pageSetup.bottomMargin = 72;// 1.0 in
      });

      await context.sync();
    });
  } catch (error) {
    console.error('Error applying court format:', error);
  }
  event.completed();
}

async function checkCitations(event: Office.AddinCommands.Event) {
  console.log('Checking citations...');
  event.completed();
}

async function findPrecedent(event: Office.AddinCommands.Event) {
  try {
    await Word.run(async (context) => {
      const selection = context.document.getSelection();
      selection.load('text');
      await context.sync();
      
      Office.context.document.settings.set('selectedAction', 'findPrecedent');
      Office.context.document.settings.set('selectedText', selection.text);
      Office.context.document.settings.saveAsync();
      
      Office.addin.showAsTaskpane();
    });
  } catch (error) {
    console.error(error);
  }
  event.completed();
}

async function explainThis(event: Office.AddinCommands.Event) {
  try {
    await Word.run(async (context) => {
      const selection = context.document.getSelection();
      selection.load('text');
      await context.sync();
      
      Office.context.document.settings.set('selectedAction', 'explainThis');
      Office.context.document.settings.set('selectedText', selection.text);
      Office.context.document.settings.saveAsync();
      
      Office.addin.showAsTaskpane();
    });
  } catch (error) {
    console.error(error);
  }
  event.completed();
}

async function analyzeClauses(event: Office.AddinCommands.Event) {
  try {
    await Word.run(async (context) => {
      const selection = context.document.getSelection();
      selection.load('text');
      await context.sync();
      
      Office.context.document.settings.set('selectedAction', 'analyzeClauses');
      Office.context.document.settings.set('selectedText', selection.text);
      Office.context.document.settings.saveAsync();
      
      Office.addin.showAsTaskpane();
    });
  } catch (error) {
    console.error(error);
  }
  event.completed();
}
