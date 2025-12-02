import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, UserRole } from '../types';
import { getUsers, getUserPasswordByEmail } from '../services/userService';
import { getCustomers, getCustomerPassword } from '../services/customerService';

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
    // Verificar se há usuário salvo no localStorage
    const savedUser = localStorage.getItem('brfintech_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setIsLoading(false);
  }, []);

  const login = async (emailOrUsername: string, password: string): Promise<boolean> => {
    try {
      // Primeiro, tentar login como usuário administrativo (email)
      const users = await getUsers();
      const foundUser = users.find(u => u.email === emailOrUsername);
      
      if (foundUser) {
        // Verificar senha do usuário administrativo
        const userPassword = getUserPasswordByEmail(emailOrUsername);
        
        // Se não houver senha cadastrada, usar senha padrão para usuários antigos
        const isValidPassword = userPassword 
          ? userPassword === password 
          : password === '123456';
        
        if (isValidPassword) {
          setUser(foundUser);
          localStorage.setItem('brfintech_user', JSON.stringify(foundUser));
          return true;
        }
        
        return false;
      }
      
      // Se não encontrou como usuário administrativo, tentar como cliente (username)
      const customers = await getCustomers();
      const foundCustomer = customers.find(c => c.username === emailOrUsername);
      
      if (foundCustomer) {
        // Verificar senha do cliente
        const customerPassword = getCustomerPassword(foundCustomer.id);
        
        if (customerPassword && customerPassword === password) {
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
          localStorage.setItem('brfintech_user', JSON.stringify(customerAsUser));
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

