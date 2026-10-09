import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { fetchDemoUsers } from '../services/api';
import { soundService } from '../services/soundService';

interface AuthContextType {
  currentUser: User | null;
  demoUsers: User[];
  switchUser: (user: User) => void;
  soundSettings: {
    soundEnabled: boolean;
    voiceEnabled: boolean;
    isMuted: boolean;
  };
  toggleSound: () => void;
  toggleVoice: () => void;
  toggleMute: () => void;
  speak: (text: string, priority?: 'normal' | 'urgent') => void;
  playSuccess: () => void;
  playAlarm: () => void;
  playPing: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [demoUsers, setDemoUsers] = useState<User[]>([]);
  const [soundSettings, setSoundSettings] = useState(soundService.getSettings());

  useEffect(() => {
    // Subscribe to sound settings updates
    const unsubscribe = soundService.subscribe(() => {
      setSoundSettings(soundService.getSettings());
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    // Load demo users from API
    fetchDemoUsers()
      .then(users => {
        setDemoUsers(users);
        // Default to Admin or saved user
        const savedEmail = localStorage.getItem('lifeloop_demo_user_email');
        const match = users.find(u => u.email === savedEmail) || users[0];
        if (match) {
          setCurrentUser(match);
        }
      })
      .catch(err => {
        console.warn('Could not load demo users:', err);
        // Fallback default admin
        const fallbackUser: User = {
          id: 1,
          name: 'Nashik District Health Admin',
          email: 'admin@lifeloop.in',
          role: 'network_admin'
        };
        setCurrentUser(fallbackUser);
      });
  }, []);

  const switchUser = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('lifeloop_demo_user_email', user.email);
    soundService.playPing();
    soundService.speak(`Switched role to ${user.name}`);
  };

  const toggleSound = () => soundService.toggleSound();
  const toggleVoice = () => soundService.toggleVoice();
  const toggleMute = () => soundService.toggleMute();

  const speak = (text: string, priority?: 'normal' | 'urgent') => soundService.speak(text, priority);
  const playSuccess = () => soundService.playSuccessChime();
  const playAlarm = () => soundService.playEmergencyAlarm();
  const playPing = () => soundService.playNoticePing();

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        demoUsers,
        switchUser,
        soundSettings,
        toggleSound,
        toggleVoice,
        toggleMute,
        speak,
        playSuccess,
        playAlarm,
        playPing
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
