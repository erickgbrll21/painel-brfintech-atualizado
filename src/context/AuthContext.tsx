import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import { supabase } from '../lib/supabase';
import { getCustomers, verifyCustomerPassword } from '../services/customerService';
import type { Session, User as SupabaseUser } from '@supabase/supabase-js';

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
  const [supabaseSession, setSupabaseSession] = useState<Session | null>(null);

  // Função para sincronizar dados do usuário do Supabase Auth com a tabela users
  const syncUserData = async (supabaseUser: SupabaseUser): Promise<User | null> => {
    try {
      console.log('Sincronizando dados do usuário:', supabaseUser.email);
      
      // Buscar dados do usuário na tabela users usando o ID do Supabase Auth
      // Primeiro tentar por ID (que deve ser o UUID do Supabase Auth)
      let { data: userData, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', supabaseUser.id)
        .single();

      // Se não encontrou por ID, tentar por email
      if (error && error.code === 'PGRST116') {
        console.log('Usuário não encontrado por ID, tentando por email...');
        const { data: userByEmail, error: emailError } = await supabase
          .from('users')
          .select('*')
          .eq('email', supabaseUser.email || '')
          .single();
        
        if (!emailError && userByEmail) {
          userData = userByEmail;
          error = null;
        }
      }

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Erro ao buscar dados do usuário:', error);
        return null;
      }

      // Se o usuário não existe na tabela users, criar
      if (!userData) {
        console.log('Usuário não existe na tabela, criando...');
        // Verificar role no app_metadata ou buscar da tabela users existente por email
        let role = supabaseUser.app_metadata?.role || 'user';
        
        // Se não tem role no metadata, tentar buscar de usuário existente por email
        if (role === 'user') {
          const { data: existingUserByEmail } = await supabase
            .from('users')
            .select('role')
            .eq('email', supabaseUser.email || '')
            .single();
          
          if (existingUserByEmail) {
            role = existingUserByEmail.role;
          }
        }
        
        const newUser = {
          id: supabaseUser.id, // Usar o UUID do Supabase Auth como string
          name: supabaseUser.user_metadata?.name || supabaseUser.email?.split('@')[0] || 'Usuário',
          email: supabaseUser.email || '',
          role: role as 'admin' | 'user' | 'customer',
          created_at: supabaseUser.created_at || new Date().toISOString(),
        };

        console.log('Inserindo novo usuário:', newUser);
        const { data: createdUser, error: createError } = await supabase
          .from('users')
          .insert(newUser)
          .select()
          .single();

        if (createError) {
          console.error('Erro ao criar usuário na tabela:', createError);
          // Se o erro for de duplicata, tentar buscar novamente
          if (createError.code === '23505') { // Unique violation
            const { data: retryUser } = await supabase
              .from('users')
              .select('*')
              .eq('email', supabaseUser.email || '')
              .single();
            
            if (retryUser) {
              return {
                id: retryUser.id,
                name: retryUser.name,
                email: retryUser.email,
                role: retryUser.role,
                createdAt: retryUser.created_at || retryUser.createdAt || new Date().toISOString(),
                customerId: retryUser.customer_id || retryUser.customerId,
              };
            }
          }
          return null;
        }

        console.log('Usuário criado com sucesso:', createdUser);
        return {
          id: createdUser.id,
          name: createdUser.name,
          email: createdUser.email,
          role: createdUser.role,
          createdAt: createdUser.created_at || createdUser.createdAt || new Date().toISOString(),
          customerId: createdUser.customer_id || createdUser.customerId,
        };
      }

      console.log('Usuário encontrado na tabela:', userData);
      // Retornar dados do usuário da tabela
      // Converter created_at para createdAt (camelCase)
      return {
        id: userData.id,
        name: userData.name,
        email: userData.email,
        role: userData.role,
        createdAt: userData.created_at || userData.createdAt || new Date().toISOString(),
        customerId: userData.customer_id || userData.customerId,
      };
    } catch (error) {
      console.error('Erro ao sincronizar dados do usuário:', error);
      return null;
    }
  };

  useEffect(() => {
    // Verificar sessão atual do Supabase
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSupabaseSession(session);
      if (session?.user) {
        syncUserData(session.user).then(setUser);
      } else {
        setUser(null);
      }
      setIsLoading(false);
    });

    // Ouvir mudanças na autenticação
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSupabaseSession(session);
      if (session?.user) {
        const userData = await syncUserData(session.user);
        setUser(userData);
      } else {
        setUser(null);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Função auxiliar para verificar se é um email válido
  const isValidEmail = (str: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(str);
  };

  const login = async (emailOrUsername: string, password: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      console.log('Tentando login com:', emailOrUsername);
      
      // Verificar se é um email válido
      const isEmail = isValidEmail(emailOrUsername);
      
      if (isEmail) {
        // Se for email, tentar login com Supabase Auth (para usuários administrativos)
        console.log('Detectado como email, tentando Supabase Auth...');
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email: emailOrUsername,
          password: password,
        });

        if (!authError && authData?.user) {
          console.log('Login bem-sucedido no Supabase Auth:', authData.user.email);
          // Login bem-sucedido com Supabase Auth
          const userData = await syncUserData(authData.user);
          if (userData) {
            console.log('Dados do usuário sincronizados:', userData);
            setUser(userData);
            setIsLoading(false);
            return true;
          } else {
            console.error('Falha ao sincronizar dados do usuário');
            setIsLoading(false);
            return false;
          }
        }

        // Se deu erro no Supabase Auth, não tentar como cliente (é um email inválido)
        if (authError) {
          console.log('Erro no Supabase Auth:', authError.message);
          setIsLoading(false);
          return false;
        }
      }

      // Se não for email ou não funcionou como email, tentar como cliente (username)
      console.log('Tentando login como cliente...');
      const customers = await getCustomers();
      const foundCustomer = customers.find(c => c.username === emailOrUsername);
      
      if (foundCustomer) {
        console.log('Cliente encontrado:', foundCustomer.username);
        // Verificar senha do cliente usando hash
        const isValidPassword = await verifyCustomerPassword(foundCustomer.id, password);
        
        if (isValidPassword) {
          console.log('Login como cliente bem-sucedido');
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
          setIsLoading(false);
          return true;
        } else {
          console.log('Senha do cliente inválida');
        }
      } else {
        console.log('Cliente não encontrado com username:', emailOrUsername);
      }
      
      setIsLoading(false);
      return false;
    } catch (error) {
      console.error('Erro ao fazer login:', error);
      setIsLoading(false);
      return false;
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSupabaseSession(null);
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

