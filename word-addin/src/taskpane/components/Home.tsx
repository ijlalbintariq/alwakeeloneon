import React, { useState } from 'react';
import { 
  makeStyles, 
  shorthands, 
  Text,
  Card,
  Badge,
  MessageBar,
  MessageBarBody,
  tokens
} from '@fluentui/react-components';
import { 
  SearchRegular, 
  BookRegular, 
  ChatRegular, 
  DocumentEditRegular,
  TextClearFormattingRegular,
  BookmarkRegular,
  ShieldCheckmarkRegular
} from '@fluentui/react-icons';
import { User } from '../services/api';
import { applyCourtFormatting } from '../services/word';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.padding('16px'),
    ...shorthands.gap('16px'),
    height: '100%',
    width: '100%',
    boxSizing: 'border-box',
    overflowY: 'auto',
  },
  welcomeCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...shorthands.padding('14px', '16px'),
    background: 'linear-gradient(135deg, #ffffff 0%, #FAF6EB 100%)',
    border: '1px solid rgba(201, 168, 76, 0.3)',
    ...shorthands.borderRadius('10px'),
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.04)',
  },
  userInfo: {
    display: 'flex',
    flexDirection: 'column',
  },
  welcomeText: {
    fontSize: '16px',
    fontWeight: '700',
    color: tokens.colorNeutralForeground1,
  },
  userSubtext: {
    fontSize: '11px',
    color: tokens.colorNeutralForeground3,
    marginTop: '2px',
  },
  badge: {
    backgroundColor: '#C9A84C',
    color: '#ffffff',
    textTransform: 'uppercase',
    fontWeight: '700',
    fontSize: '10px',
    letterSpacing: '0.5px',
    ...shorthands.padding('4px', '8px'),
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    ...shorthands.padding('18px', '12px'),
    cursor: 'pointer',
    backgroundColor: '#ffffff',
    border: '1px solid #E8E5DE',
    ...shorthands.borderRadius('10px'),
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    ':hover': {
      backgroundColor: '#FAF7EF',
      ...shorthands.borderColor('#C9A84C'),
      transform: 'translateY(-2px)',
      boxShadow: '0 6px 16px rgba(201, 168, 76, 0.15)',
    },
  },
  iconBox: {
    width: '42px',
    height: '42px',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '22px',
    marginBottom: '10px',
  },
  iconGold: {
    backgroundColor: 'rgba(201, 168, 76, 0.12)',
    color: '#C9A84C',
  },
  iconBlue: {
    backgroundColor: 'rgba(37, 99, 235, 0.12)',
    color: '#2563EB',
  },
  iconGreen: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    color: '#10B981',
  },
  iconPurple: {
    backgroundColor: 'rgba(139, 92, 246, 0.12)',
    color: '#8B5CF6',
  },
  cardLabel: {
    fontSize: '12px',
    fontWeight: '600',
    textAlign: 'center',
    color: '#374151',
  }
});

interface HomeProps {
  user: User;
  onNavigate: (tab: string) => void;
}

export const Home: React.FC<HomeProps> = ({ user, onNavigate }) => {
  const styles = useStyles();
  const [formatMessage, setFormatMessage] = useState<string | null>(null);

  const handleCourtFormatting = async () => {
    try {
      setFormatMessage(null);
      await applyCourtFormatting();
      setFormatMessage('✅ Court Formatting Applied! (1.5" Left Margin, 14pt Times New Roman, Double Spacing, Justified)');
      setTimeout(() => setFormatMessage(null), 5000);
    } catch (error) {
      console.error('Error applying court formatting:', error);
      setFormatMessage('❌ Could not apply formatting. Please click inside your Word document.');
      setTimeout(() => setFormatMessage(null), 5000);
    }
  };

  const actions = [
    { id: 'research', label: 'Search Case Law', iconBoxClass: styles.iconBlue, icon: <SearchRegular />, action: () => onNavigate('research') },
    { id: 'statutes', label: 'Search Statutes', iconBoxClass: styles.iconGreen, icon: <BookRegular />, action: () => onNavigate('research') },
    { id: 'chat', label: 'AI Legal Chat', iconBoxClass: styles.iconPurple, icon: <ChatRegular />, action: () => onNavigate('chat') },
    { id: 'contract', label: 'Draft Petition & Contract', iconBoxClass: styles.iconGold, icon: <DocumentEditRegular />, action: () => onNavigate('contract') },
    { id: 'review', label: 'Review & Risk Audit', iconBoxClass: styles.iconPurple, icon: <ShieldCheckmarkRegular />, action: () => onNavigate('review') },
    { id: 'format', label: 'Court Format', iconBoxClass: styles.iconGold, icon: <TextClearFormattingRegular />, action: handleCourtFormatting },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.welcomeCard}>
        <div className={styles.userInfo}>
          <Text className={styles.welcomeText}>Welcome, {user.firstName || 'Advocate'}</Text>
          <Text className={styles.userSubtext}>{user.email}</Text>
        </div>
        <Badge className={styles.badge} appearance="filled">
          {user.subscriptionTier || 'CHAMBER'}
        </Badge>
      </div>

      {formatMessage && (
        <MessageBar intent={formatMessage.startsWith('✅') ? "success" : "error"}>
          <MessageBarBody>{formatMessage}</MessageBarBody>
        </MessageBar>
      )}

      <div className={styles.grid}>
        {actions.map((item) => (
          <Card 
            key={item.id} 
            className={styles.card} 
            onClick={item.action}
          >
            <div className={`${styles.iconBox} ${item.iconBoxClass}`}>
              {item.icon}
            </div>
            <Text className={styles.cardLabel}>{item.label}</Text>
          </Card>
        ))}
      </div>
    </div>
  );
};
