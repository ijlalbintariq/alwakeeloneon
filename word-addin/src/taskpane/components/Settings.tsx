import React from 'react';
import { 
  makeStyles, 
  shorthands, 
  Text,
  Button,
  Avatar,
  Badge,
  tokens
} from '@fluentui/react-components';
import { SignOutRegular } from '@fluentui/react-icons';
import { logout, User } from '../services/api';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.padding('20px'),
    ...shorthands.gap('24px'),
    width: '100%',
    boxSizing: 'border-box',
  },
  profileSection: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    ...shorthands.gap('12px'),
    ...shorthands.padding('24px', '16px'),
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.borderRadius('8px'),
    boxShadow: tokens.shadow2,
  },
  nameText: {
    fontSize: '18px',
    fontWeight: '600',
  },
  emailText: {
    fontSize: '14px',
    color: tokens.colorNeutralForeground2,
  },
  badge: {
    backgroundColor: '#C9A84C',
    color: 'white',
    textTransform: 'capitalize',
  },
  signOutButton: {
    width: '100%',
    color: tokens.colorStatusDangerForeground1,
  }
});

interface SettingsProps {
  user: User;
  onLogout: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ user, onLogout }) => {
  const styles = useStyles();

  const handleLogout = async () => {
    try {
      await logout();
      onLogout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.profileSection}>
        <Avatar 
          name={`${user.firstName} ${user.lastName}`} 
          size={72} 
          image={{ src: user.profileImageUrl || undefined }}
          color="brand"
        />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          <Text className={styles.nameText}>{`${user.firstName} ${user.lastName}`}</Text>
          <Text className={styles.emailText}>{user.email}</Text>
        </div>
        <Badge className={styles.badge} appearance="filled">
          {user.subscriptionTier} Tier
        </Badge>
      </div>

      <Button 
        appearance="secondary" 
        icon={<SignOutRegular />} 
        onClick={handleLogout}
        className={styles.signOutButton}
      >
        Sign Out
      </Button>
    </div>
  );
};
