import React, { useState } from 'react';
import { makeStyles, shorthands, TabList, Tab } from '@fluentui/react-components';
import { SearchRegular, BookRegular } from '@fluentui/react-icons';
import CaseLawSearch from './CaseLawSearch';
import StatuteLookup from './StatuteLookup';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    width: '100%',
    boxSizing: 'border-box',
    overflowX: 'hidden',
    backgroundColor: '#FAF9F6',
  },
  headerNav: {
    ...shorthands.padding('6px', '8px', '0', '8px'),
    backgroundColor: '#ffffff',
    borderBottom: '1px solid rgba(201, 168, 76, 0.25)',
    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.02)',
    width: '100%',
    boxSizing: 'border-box',
  },
  tabList: {
    width: '100%',
    display: 'flex',
    justifyContent: 'space-around',
  },
  tabItem: {
    flex: 1,
    minWidth: '0',
  },
  contentArea: {
    flexGrow: 1,
    overflowY: 'hidden',
    width: '100%',
    boxSizing: 'border-box',
  }
});

interface ResearchProps {
  defaultTab?: 'caselaw' | 'statutes';
}

const Research: React.FC<ResearchProps> = ({ defaultTab = 'caselaw' }) => {
  const styles = useStyles();
  const [activeTab, setActiveTab] = useState<'caselaw' | 'statutes'>(defaultTab);

  return (
    <div className={styles.container}>
      <div className={styles.headerNav}>
        <TabList 
          className={styles.tabList}
          selectedValue={activeTab} 
          onTabSelect={(e, d) => setActiveTab(d.value as 'caselaw' | 'statutes')}
        >
          <Tab className={styles.tabItem} value="caselaw" icon={<SearchRegular />}>Judgments</Tab>
          <Tab className={styles.tabItem} value="statutes" icon={<BookRegular />}>Statutes</Tab>
        </TabList>
      </div>

      <div className={styles.contentArea}>
        {activeTab === 'caselaw' ? <CaseLawSearch /> : <StatuteLookup />}
      </div>
    </div>
  );
};

export default Research;
