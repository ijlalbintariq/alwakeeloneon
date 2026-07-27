import React, { useState, useEffect } from 'react';
import { 
  FluentProvider, 
  webLightTheme, 
  makeStyles,
  Spinner
} from '@fluentui/react-components';
import { 
  HomeRegular, 
  SearchRegular, 
  ChatRegular, 
  DocumentEditRegular,
  ShieldCheckmarkRegular,
  SettingsRegular
} from '@fluentui/react-icons';
import { getUser, User } from '../services/api';
import { Login } from './Login';
import { Home } from './Home';
import { Settings } from './Settings';
import Research from './Research';
import AIChat from './AIChat';
import ContractDrafting from './ContractDrafting';
import Review from './Review';

const useStyles = makeStyles({
  appContainer: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    width: '100%',
    overflow: 'hidden',
    backgroundColor: '#FAF9F6',
  },
  header: {
    height: '50px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: '16px',
    paddingRight: '16px',
    background: 'linear-gradient(135deg, #0F141C 0%, #1A2234 100%)',
    borderBottom: '2px solid #C9A84C',
    color: '#ffffff',
    flexShrink: 0,
    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.15)',
  },
  logoContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  logoText: {
    color: '#C9A84C',
    fontWeight: '700',
    fontSize: '15px',
    letterSpacing: '1px',
  },
  subTag: {
    fontSize: '9px',
    color: 'rgba(255, 255, 255, 0.6)',
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
  },
  mainContent: {
    flexGrow: 1,
    overflowY: 'auto',
    backgroundColor: '#FAF9F6',
  },
  bottomNav: {
    display: 'flex',
    justifyContent: 'space-around',
    alignItems: 'center',
    height: '58px',
    borderTop: '1px solid rgba(201, 168, 76, 0.25)',
    backgroundColor: '#ffffff',
    flexShrink: 0,
    boxShadow: '0 -4px 12px rgba(0, 0, 0, 0.04)',
    paddingLeft: '2px',
    paddingRight: '2px',
  },
  navItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: '#6B7280',
    width: '50px',
    paddingTop: '6px',
    paddingBottom: '4px',
    borderRadius: '8px',
    transition: 'all 0.2s ease',
  },
  navItemActive: {
    color: '#C9A84C',
    backgroundColor: '#F9F5EC',
    transform: 'translateY(-1px)',
  },
  navLabel: {
    fontSize: '9px',
    marginTop: '3px',
    fontWeight: '600',
  },
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    width: '100%',
    backgroundColor: '#0F141C',
  }
});

const App: React.FC = () => {
  const styles = useStyles();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('home');

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const u = await getUser();
        setUser(u);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  const handleLogin = (u: User) => {
    setUser(u);
    setActiveTab('home');
  };

  const handleLogout = () => {
    setUser(null);
  };

  if (loading) {
    return (
      <FluentProvider theme={webLightTheme}>
        <div className={styles.loadingContainer}>
          <Spinner label="Loading AL WAKEELO AI..." labelPosition="below" style={{ color: '#C9A84C' }} />
        </div>
      </FluentProvider>
    );
  }

  if (!user) {
    return (
      <FluentProvider theme={webLightTheme}>
        <Login onLogin={handleLogin} />
      </FluentProvider>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        return <Home user={user} onNavigate={setActiveTab} />;
      case 'research':
        return <Research />;
      case 'chat':
        return <AIChat />;
      case 'contract':
        return <ContractDrafting />;
      case 'review':
        return <Review />;
      case 'settings':
        return <Settings user={user} onLogout={handleLogout} />;
      default:
        return <Home user={user} onNavigate={setActiveTab} />;
    }
  };

  const navItems = [
    { id: 'home', label: 'Home', icon: <HomeRegular fontSize={20} /> },
    { id: 'research', label: 'Research', icon: <SearchRegular fontSize={20} /> },
    { id: 'chat', label: 'Chat', icon: <ChatRegular fontSize={20} /> },
    { id: 'contract', label: 'Draft', icon: <DocumentEditRegular fontSize={20} /> },
    { id: 'review', label: 'Review', icon: <ShieldCheckmarkRegular fontSize={20} /> },
    { id: 'settings', label: 'Settings', icon: <SettingsRegular fontSize={20} /> },
  ];

  return (
    <FluentProvider theme={webLightTheme}>
      <div className={styles.appContainer}>
        <div className={styles.header}>
          <div className={styles.logoContainer}>
            <img src="assets/logo.svg" alt="AL WAKEELO Logo" style={{ width: '26px', height: '26px', borderRadius: '5px' }} />
            <span className={styles.logoText}>AL WAKEELO</span>
          </div>
          <span className={styles.subTag}>PRO LEGAL AI</span>
        </div>

        <div className={styles.mainContent}>
          {renderContent()}
        </div>

        <div className={styles.bottomNav}>
          {navItems.map((item) => (
            <div 
              key={item.id}
              className={`${styles.navItem} ${activeTab === item.id ? styles.navItemActive : ''}`}
              onClick={() => setActiveTab(item.id)}
            >
              {item.icon}
              <span className={styles.navLabel}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </FluentProvider>
  );
};

export default App;
