import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import { getUsers, verifyUserPasswordByEmail } from '../services/userService';
import { getCustomers, verifyCustomerPassword } from '../services/customerService';
import { encryptObject, decryptObject } from '../utils/encryption';

interface AuthContextType {
  user: User | null;
  login: (emailOrUsername: string, password: string) => Promise<boolean>;
  logout: () => void;
  isAdmin: () => boolean;
  isCustomer: () => boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Verificar se há usuário salvo no localStorage (criptografado)
    const loadUser = async () => {
      try {
        const encryptedUser = localStorage.getItem('brfintech_user_encrypted');
        if (encryptedUser) {
          const decryptedUser = await decryptObject<User>(encryptedUser);
          setUser(decryptedUser);
        } else {
          // Migração: tentar carregar usuário antigo não criptografado
          const savedUser = localStorage.getItem('brfintech_user');
          if (savedUser) {
            const user = JSON.parse(savedUser);
            setUser(user);
            // Criptografar e migrar
            const encrypted = await encryptObject(user);
            localStorage.setItem('brfintech_user_encrypted', encrypted);
            localStorage.removeItem('brfintech_user');
          }
        }
      } catch (error) {
        console.error('Erro ao carregar usuário:', error);
        localStorage.removeItem('brfintech_user');
        localStorage.removeItem('brfintech_user_encrypted');
      }
      setIsLoading(false);
    };
    loadUser();
  }, []);

  const login = async (emailOrUsername: string, password: string): Promise<boolean> => {
    try {
      // Primeiro, tentar login como usuário administrativo (email)
      const users = await getUsers();
      const foundUser = users.find(u => u.email === emailOrUsername);
      
      if (foundUser) {
        // Verificar senha do usuário administrativo usando hash
        const isValidPassword = await verifyUserPasswordByEmail(emailOrUsername, password);
        
        if (isValidPassword) {
          setUser(foundUser);
          // Criptografar dados do usuário antes de salvar
          const encryptedUser = await encryptObject(foundUser);
          localStorage.setItem('brfintech_user_encrypted', encryptedUser);
          // Remover versão antiga se existir
          localStorage.removeItem('brfintech_user');
          return true;
        }
        
        return false;
      }
      
      // Se não encontrou como usuário administrativo, tentar como cliente (username)
      const customers = await getCustomers();
      const foundCustomer = customers.find(c => c.username === emailOrUsername);
      
      if (foundCustomer) {
        // Verificar senha do cliente usando hash
        const isValidPassword = await verifyCustomerPassword(foundCustomer.id, password);
        
        if (isValidPassword) {
          // Criar objeto User temporário para o cliente
          const customerAsUser: User = {
            id: `customer_${foundCustomer.id}`,
            name: foundCustomer.name,
            email: foundCustomer.email,
            role: 'customer',
            createdAt: foundCustomer.lastPurchase || new Date().toISOString(),
            customerId: foundCustomer.id,
          };
          
          setUser(customerAsUser);
          // Criptografar dados do usuário antes de salvar
          const encryptedUser = await encryptObject(customerAsUser);
          localStorage.setItem('brfintech_user_encrypted', encryptedUser);
          // Remover versão antiga se existir
          localStorage.removeItem('brfintech_user');
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.error('Erro ao fazer login:', error);
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('brfintech_user');
    localStorage.removeItem('brfintech_user_encrypted');
  };

  const isAdmin = (): boolean => {
    return user?.role === 'admin';
  };

  const isCustomer = (): boolean => {
    return user?.role === 'customer';
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isAdmin, isCustomer, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

