import { User } from '../types';
import { hashPassword, verifyPassword, encryptObject, decryptObject } from '../utils/encryption';

const STORAGE_KEY = 'brfintech_users';
const PASSWORDS_STORAGE_KEY = 'brfintech_user_passwords_encrypted';

// Armazenamento de senhas com hash (protegido)
let USER_PASSWORDS: { [userId: string]: string } = {};

// Dados de usuários - apenas usuários administrativos básicos
const DEFAULT_USERS: User[] = [
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

// Carregar usuários do localStorage ou usar padrão
const loadUsersFromStorage = (): User[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const users = JSON.parse(stored);
      // Garantir que usuários padrão existam
      const defaultUserIds = DEFAULT_USERS.map(u => u.id);
      const existingUsers = users.filter((u: User) => !defaultUserIds.includes(u.id));
      return [...DEFAULT_USERS, ...existingUsers];
    }
  } catch (error) {
    console.error('Erro ao carregar usuários do localStorage:', error);
  }
  return [...DEFAULT_USERS];
};

// Salvar usuários no localStorage
const saveUsersToStorage = (users: User[]): void => {
  try {
    // Não salvar usuários padrão, apenas os criados pelo usuário
    const defaultUserIds = DEFAULT_USERS.map(u => u.id);
    const customUsers = users.filter(u => !defaultUserIds.includes(u.id));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customUsers));
  } catch (error) {
    console.error('Erro ao salvar usuários no localStorage:', error);
  }
};

// Carregar senhas do localStorage (criptografadas)
const loadPasswordsFromStorage = async (): Promise<void> => {
  try {
    const stored = localStorage.getItem(PASSWORDS_STORAGE_KEY);
    if (stored) {
      USER_PASSWORDS = await decryptObject<{ [userId: string]: string }>(stored);
      // Garantir que senhas padrão existam
      if (!USER_PASSWORDS['1']) {
        USER_PASSWORDS['1'] = await hashPassword('123456');
      }
      if (!USER_PASSWORDS['2']) {
        USER_PASSWORDS['2'] = await hashPassword('123456');
      }
      await savePasswordsToStorage();
    } else {
      // Inicializar senhas padrão com hash
      USER_PASSWORDS['1'] = await hashPassword('123456'); // admin@brfintech.com
      USER_PASSWORDS['2'] = await hashPassword('123456'); // user@brfintech.com
      await savePasswordsToStorage();
    }
  } catch (error) {
    console.error('Erro ao carregar senhas do localStorage:', error);
    // Inicializar senhas padrão em caso de erro
    try {
      USER_PASSWORDS['1'] = await hashPassword('123456');
      USER_PASSWORDS['2'] = await hashPassword('123456');
    } catch (hashError) {
      console.error('Erro ao criar hash de senha padrão:', hashError);
    }
  }
};

// Salvar senhas no localStorage (criptografadas)
const savePasswordsToStorage = async (): Promise<void> => {
  try {
    const encrypted = await encryptObject(USER_PASSWORDS);
    localStorage.setItem(PASSWORDS_STORAGE_KEY, encrypted);
  } catch (error) {
    console.error('Erro ao salvar senhas no localStorage:', error);
  }
};

// Inicializar dados
let ALL_USERS = loadUsersFromStorage();
// Inicializar senhas (não bloqueia, será carregado quando necessário)
let passwordsInitialized = false;
loadPasswordsFromStorage().then(() => {
  passwordsInitialized = true;
}).catch(() => {
  passwordsInitialized = true;
});

export const getUsers = async (): Promise<User[]> => {
  await new Promise(resolve => setTimeout(resolve, 300));
  // Garantir que senhas estejam inicializadas
  if (!passwordsInitialized) {
    await loadPasswordsFromStorage();
  }
  // Recarregar do storage para garantir dados atualizados
  ALL_USERS = loadUsersFromStorage();
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
  
  // Validar senha obrigatória
  if (!password || password.trim() === '') {
    throw new Error('Senha é obrigatória para criar um novo usuário');
  }
  
  // Garantir que senhas estejam inicializadas
  if (!passwordsInitialized) {
    await loadPasswordsFromStorage();
  }
  
  // Recarregar usuários atualizados
  ALL_USERS = loadUsersFromStorage();
  
  // Gerar ID único baseado no timestamp
  const newId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const newUser: User = {
    ...user,
    id: newId,
    createdAt: new Date().toISOString(),
  };
  
  ALL_USERS.push(newUser);
  
  // Armazenar senha com hash
  try {
    const hashedPassword = await hashPassword(password);
    USER_PASSWORDS[newUser.id] = hashedPassword;
    await savePasswordsToStorage();
    console.log('Senha salva com sucesso para usuário:', newUser.id, newUser.email);
  } catch (error) {
    console.error('Erro ao salvar senha:', error);
    throw new Error('Erro ao salvar senha do usuário');
  }
  
  // Salvar no localStorage
  saveUsersToStorage(ALL_USERS);
  
  return newUser;
};

export const updateUser = async (
  id: string,
  updates: Partial<User>,
  password?: string
): Promise<User | null> => {
  await new Promise(resolve => setTimeout(resolve, 300));
  
  // Garantir que senhas estejam inicializadas
  if (!passwordsInitialized) {
    await loadPasswordsFromStorage();
  }
  
  // Recarregar usuários atualizados
  ALL_USERS = loadUsersFromStorage();
  
  const user = ALL_USERS.find(u => u.id === id);
  if (user) {
    Object.assign(user, updates);
    
    // Atualizar senha com hash se fornecida e não vazia
    if (password && password.trim() !== '') {
      try {
        const hashedPassword = await hashPassword(password);
        USER_PASSWORDS[id] = hashedPassword;
        await savePasswordsToStorage();
        console.log('Senha atualizada com sucesso para usuário:', id, user.email);
      } catch (error) {
        console.error('Erro ao atualizar senha:', error);
        throw new Error('Erro ao atualizar senha do usuário');
      }
    }
    
    // Salvar no localStorage
    saveUsersToStorage(ALL_USERS);
    
    return { ...user };
  }
  return null;
};

// Função para verificar senha do usuário (retorna hash)
export const getUserPasswordHash = (userId: string): string | undefined => {
  return USER_PASSWORDS[userId];
};

// Função para verificar senha por email (retorna hash)
export const getUserPasswordHashByEmail = (email: string): string | undefined => {
  const user = ALL_USERS.find(u => u.email === email);
  if (user) {
    return USER_PASSWORDS[user.id];
  }
  return undefined;
};

// Função para verificar se a senha está correta
export const verifyUserPassword = async (
  userId: string,
  password: string
): Promise<boolean> => {
  // Garantir que senhas estejam inicializadas
  if (!passwordsInitialized) {
    await loadPasswordsFromStorage();
  }
  const hashedPassword = USER_PASSWORDS[userId];
  if (!hashedPassword) return false;
  return verifyPassword(password, hashedPassword);
};

// Função para verificar senha por email
export const verifyUserPasswordByEmail = async (
  email: string,
  password: string
): Promise<boolean> => {
  const user = ALL_USERS.find(u => u.email === email);
  if (!user) return false;
  return verifyUserPassword(user.id, password);
};

// Mantido para compatibilidade (deprecated - usar verifyUserPassword)
export const getUserPassword = (_userId: string): string | undefined => {
  console.warn('getUserPassword está deprecated. Use verifyUserPassword.');
  return undefined;
};

export const getUserPasswordByEmail = (_email: string): string | undefined => {
  console.warn('getUserPasswordByEmail está deprecated. Use verifyUserPasswordByEmail.');
  return undefined;
};

export const deleteUser = async (id: string): Promise<boolean> => {
  await new Promise(resolve => setTimeout(resolve, 300));
  
  // Não permitir deletar usuários padrão
  const defaultUserIds = DEFAULT_USERS.map(u => u.id);
  if (defaultUserIds.includes(id)) {
    return false;
  }
  
  // Recarregar usuários atualizados
  ALL_USERS = loadUsersFromStorage();
  
  const index = ALL_USERS.findIndex(u => u.id === id);
  if (index !== -1) {
    ALL_USERS.splice(index, 1);
    // Remover senha também
    delete USER_PASSWORDS[id];
    await savePasswordsToStorage();
    
    // Salvar no localStorage
    saveUsersToStorage(ALL_USERS);
    
    return true;
  }
  return false;
};

