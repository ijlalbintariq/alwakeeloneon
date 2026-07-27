import React, { useState } from 'react';
import { 
  makeStyles, 
  shorthands, 
  Input, 
  Button, 
  Spinner, 
  Text,
  MessageBar,
  MessageBarBody
} from '@fluentui/react-components';
import { login as apiLogin, User } from '../services/api';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    width: '100%',
    ...shorthands.padding('24px', '20px'),
    boxSizing: 'border-box',
    background: 'linear-gradient(180deg, #0F141C 0%, #1A2234 100%)',
    color: '#ffffff',
  },
  card: {
    width: '100%',
    backgroundColor: '#ffffff',
    ...shorthands.borderRadius('12px'),
    ...shorthands.padding('24px', '20px'),
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.gap('16px'),
    boxShadow: '0 12px 32px rgba(0, 0, 0, 0.3)',
    color: '#1F2937',
  },
  logoContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: '8px',
  },
  emblem: {
    width: '48px',
    height: '48px',
    borderRadius: '12px',
    background: 'linear-gradient(135deg, #D4AF37 0%, #AA7C11 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
    color: '#ffffff',
    boxShadow: '0 6px 16px rgba(201, 168, 76, 0.4)',
    marginBottom: '10px',
  },
  title: {
    color: '#C9A84C',
    fontSize: '20px',
    fontWeight: '800',
    letterSpacing: '1px',
  },
  subtitle: {
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: '4px',
    letterSpacing: '0.5px',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.gap('6px'),
  },
  label: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#374151',
  },
  input: {
    width: '100%',
  },
  submitButton: {
    backgroundColor: '#C9A84C',
    color: '#ffffff',
    fontWeight: '700',
    height: '40px',
    fontSize: '14px',
    borderRadius: '6px',
    marginTop: '8px',
    ':hover': {
      backgroundColor: '#B59338',
    }
  },
  footer: {
    textAlign: 'center',
    fontSize: '11px',
    color: 'rgba(255, 255, 255, 0.5)',
    marginTop: '16px',
  }
});

interface LoginProps {
  onLogin: (user: User) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const styles = useStyles();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const user = await apiLogin(email, password);
      onLogin(user);
    } catch (err: any) {
      setError(err?.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.logoContainer}>
        <img 
          src="assets/logo.svg" 
          alt="AL WAKEELO Logo" 
          style={{ 
            width: '56px', 
            height: '56px', 
            borderRadius: '12px', 
            boxShadow: '0 6px 20px rgba(201, 168, 76, 0.4)', 
            marginBottom: '12px' 
          }} 
        />
        <Text className={styles.title}>AL WAKEELO</Text>
        <Text className={styles.subtitle}>Pakistan's AI Legal Assistant</Text>
      </div>

      <form className={styles.card} onSubmit={handleSubmit}>
        {error && (
          <MessageBar intent="error">
            <MessageBarBody>{error}</MessageBarBody>
          </MessageBar>
        )}

        <div className={styles.formGroup}>
          <Text className={styles.label}>Email Address</Text>
          <Input 
            className={styles.input}
            type="email" 
            placeholder="advocate@chamber.com"
            value={email}
            onChange={(e, d) => setEmail(d.value)}
            required 
          />
        </div>

        <div className={styles.formGroup}>
          <Text className={styles.label}>Password</Text>
          <Input 
            className={styles.input}
            type="password" 
            placeholder="••••••••"
            value={password}
            onChange={(e, d) => setPassword(d.value)}
            required 
          />
        </div>

        <Button 
          type="submit" 
          appearance="primary" 
          className={styles.submitButton}
          disabled={isLoading}
        >
          {isLoading ? <Spinner size="tiny" label="Signing in..." /> : 'Sign In to Chamber'}
        </Button>
      </form>

      <Text className={styles.footer}>
        AL WAKEELO Legal AI Platform v1.0 • Secure Session
      </Text>
    </div>
  );
};
