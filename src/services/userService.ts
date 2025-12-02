import { User } from '../types';

// Armazenamento de senhas (em produção, isso seria criptografado)
const USER_PASSWORDS: { [userId: string]: string } = {
  '1': '123456', // admin@brfintech.com
  '2': '123456', // user@brfintech.com
};

// Dados de usuários - apenas usuários administrativos básicos
const MOCK_USERS: User[] = [
  {
    id: '1',
    name: 'Administrador',
    email: 'admin@brfintech.com',
    role: 'admin',
    createdAt: new Date().toISOString(),
  },
  {
    id: '2',
    name: 'Usuário Comum',
    email: 'user@brfintech.com',
    role: 'user',
    createdAt: new Date().toISOString(),
  },
];

const ALL_USERS = [...MOCK_USERS];

export const getUsers = async (): Promise<User[]> => {
  await new Promise(resolve => setTimeout(resolve, 300));
  return [...ALL_USERS];
};

export const getUserById = async (id: string): Promise<User | null> => {
  await new Promise(resolve => setTimeout(resolve, 200));
  return ALL_USERS.find(u => u.id === id) || null;
};

export const createUser = async (
  user: Omit<User, 'id' | 'createdAt'>,
  password?: string
): Promise<User> => {
  await new Promise(resolve => setTimeout(resolve, 300));
  const newUser: User = {
    ...user,
    id: String(ALL_USERS.length + 1),
    createdAt: new Date().toISOString(),
  };
  ALL_USERS.push(newUser);
  
  // Armazenar senha se fornecida
  if (password) {
    USER_PASSWORDS[newUser.id] = password;
  }
  
  return newUser;
};

export const updateUser = async (
  id: string,
  updates: Partial<User>,
  password?: string
): Promise<User | null> => {
  await new Promise(resolve => setTimeout(resolve, 300));
  const user = ALL_USERS.find(u => u.id === id);
  if (user) {
    Object.assign(user, updates);
    
    // Atualizar senha se fornecida
    if (password) {
      USER_PASSWORDS[id] = password;
    }
    
    return { ...user };
  }
  return null;
};

// Função para verificar senha do usuário
export const getUserPassword = (userId: string): string | undefined => {
  return USER_PASSWORDS[userId];
};

// Função para verificar senha por email
export const getUserPasswordByEmail = (email: string): string | undefined => {
  const user = ALL_USERS.find(u => u.email === email);
  if (user) {
    return USER_PASSWORDS[user.id];
  }
  return undefined;
};

export const deleteUser = async (id: string): Promise<boolean> => {
  await new Promise(resolve => setTimeout(resolve, 300));
  const index = ALL_USERS.findIndex(u => u.id === id);
  if (index !== -1) {
    ALL_USERS.splice(index, 1);
    // Remover senha também
    delete USER_PASSWORDS[id];
    return true;
  }
  return false;
};

