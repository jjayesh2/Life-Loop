import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { fetchDemoUsers, setActiveUserHeaders } from '../services/api';
import { soundService } from '../services/soundService';

interface AuthContextType {
  currentUser: User | null;
  demoUsers: User[];
  switchUser: (user: User) => void;
  soundEnabled: boolean;
  toggleSound: () => void;
  voiceEnabled: boolean;
  toggleVoice: () => void;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  demoUsers: [],
  switchUser: () => {},
  soundEnabled: true,
  toggleSound: () => {},
  voiceEnabled: true,
  toggleVoice: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [demoUsers, setDemoUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(true);

  useEffect(() => {
    fetchDemoUsers()
      .then((users) => {
        setDemoUsers(users);
        if (users && users.length > 0) {
          const savedId = localStorage.getItem('lifeloop_user_id');
          const matched = savedId ? users.find(u => u.id === Number(savedId)) : null;
          const initialUser = matched || users[0];
          setCurrentUser(initialUser);
          setActiveUserHeaders({
            'X-User-Id': initialUser.id.toString(),
            'X-User-Role': initialUser.role,
            ...(initialUser.facility_id ? { 'X-Facility-Id': initialUser.facility_id.toString() } : {})
          });
        }
      })
      .catch((err) => console.error("Error loading demo users:", err));
  }, []);

  const switchUser = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('lifeloop_user_id', user.id.toString());
    setActiveUserHeaders({
      'X-User-Id': user.id.toString(),
      'X-User-Role': user.role,
      ...(user.facility_id ? { 'X-Facility-Id': user.facility_id.toString() } : {})
    });
    soundService.playAlertPing();
    soundService.speak(`Switched profile to ${user.name}, role ${user.role.replace('_', ' ')}.`);
  };

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    soundService.setSoundEnabled(next);
  };

  const toggleVoice = () => {
    const next = !voiceEnabled;
    setVoiceEnabled(next);
    soundService.setVoiceEnabled(next);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        demoUsers,
        switchUser,
        soundEnabled,
        toggleSound,
        voiceEnabled,
        toggleVoice
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
