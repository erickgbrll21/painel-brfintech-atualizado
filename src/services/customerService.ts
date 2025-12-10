import { Customer, CieloTerminal } from '../types';
import { hashPassword, verifyPassword, encryptObject, decryptObject } from '../utils/encryption';

const STORAGE_KEY = 'brfintech_customers';
const PASSWORDS_STORAGE_KEY = 'brfintech_customer_passwords_encrypted';

// Armazenamento de senhas de clientes com hash (protegido)
let CUSTOMER_PASSWORDS: { [customerId: string]: string } = {};

// Carregar clientes do localStorage
const loadCustomersFromStorage = (): Customer[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Erro ao carregar clientes do localStorage:', error);
  }
  return [];
};

// Salvar clientes no localStorage
const saveCustomersToStorage = (customers: Customer[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customers));
  } catch (error) {
    console.error('Erro ao salvar clientes no localStorage:', error);
  }
};

// Carregar senhas do localStorage (criptografadas)
const loadPasswordsFromStorage = async (): Promise<void> => {
  try {
    const stored = localStorage.getItem(PASSWORDS_STORAGE_KEY);
    if (stored) {
      CUSTOMER_PASSWORDS = await decryptObject<{ [customerId: string]: string }>(stored);
    }
  } catch (error) {
    console.error('Erro ao carregar senhas de clientes do localStorage:', error);
    CUSTOMER_PASSWORDS = {};
  }
};

// Salvar senhas no localStorage (criptografadas)
const savePasswordsToStorage = async (): Promise<void> => {
  try {
    const encrypted = await encryptObject(CUSTOMER_PASSWORDS);
    localStorage.setItem(PASSWORDS_STORAGE_KEY, encrypted);
  } catch (error) {
    console.error('Erro ao salvar senhas de clientes no localStorage:', error);
  }
};

// Inicializar dados
let ALL_CUSTOMERS = loadCustomersFromStorage();
// Inicializar senhas (não bloqueia, será carregado quando necessário)
let passwordsInitialized = false;
loadPasswordsFromStorage().then(() => {
  passwordsInitialized = true;
}).catch(() => {
  passwordsInitialized = true;
});

// Função para migrar cliente antigo (com cieloTerminalId) para novo formato (com cieloTerminals)
const migrateCustomer = (customer: Customer): Customer => {
  if (customer.cieloTerminalId && (!customer.cieloTerminals || customer.cieloTerminals.length === 0)) {
    const terminal: CieloTerminal = {
      id: `term_${customer.id}_${Date.now()}`,
      terminalId: customer.cieloTerminalId,
      name: `Conta ${customer.name}`,
      createdAt: new Date().toISOString(),
    };
    return {
      ...customer,
      cieloTerminals: [terminal],
      cieloTerminalId: undefined, // Remover campo antigo após migração
    };
  }
  return customer;
};

export const getCustomers = async (): Promise<Customer[]> => {
  await new Promise(resolve => setTimeout(resolve, 300));
  // Garantir que senhas estejam inicializadas
  if (!passwordsInitialized) {
    await loadPasswordsFromStorage();
  }
  // Recarregar do storage para garantir dados atualizados
  ALL_CUSTOMERS = loadCustomersFromStorage();
  // Migrar clientes antigos ao retornar
  return ALL_CUSTOMERS.map(migrateCustomer);
};

export const getCustomerById = async (id: string): Promise<Customer | null> => {
  await new Promise(resolve => setTimeout(resolve, 200));
  // Recarregar do storage
  ALL_CUSTOMERS = loadCustomersFromStorage();
  const customer = ALL_CUSTOMERS.find(c => c.id === id);
  return customer ? migrateCustomer(customer) : null;
};

// Função para obter todas as contas de todos os clientes
export const getAllTerminals = async (): Promise<CieloTerminal[]> => {
  const customers = await getCustomers();
  const terminals: CieloTerminal[] = [];
  
  customers.forEach(customer => {
    if (customer.cieloTerminals && customer.cieloTerminals.length > 0) {
      terminals.push(...customer.cieloTerminals);
    }
  });
  
  return terminals;
};

// Função para obter cliente por terminal ID
export const getCustomerByTerminalId = async (terminalId: string): Promise<Customer | null> => {
  const customers = await getCustomers();
  return customers.find(c => 
    c.cieloTerminals?.some(t => t.terminalId === terminalId) ||
    c.cieloTerminalId === terminalId
  ) || null;
};

export const updateCustomer = async (
  id: string,
  updates: Partial<Customer>,
  password?: string
): Promise<Customer | null> => {
  await new Promise(resolve => setTimeout(resolve, 300));
  
  // Garantir que senhas estejam inicializadas
  if (!passwordsInitialized) {
    await loadPasswordsFromStorage();
  }
  
  // Recarregar do storage
  ALL_CUSTOMERS = loadCustomersFromStorage();
  
  const customer = ALL_CUSTOMERS.find(c => c.id === id);
  if (customer) {
    // Migrar antes de atualizar
    const migratedCustomer = migrateCustomer(customer);
    Object.assign(customer, migratedCustomer);
    Object.assign(customer, updates);
    
    // Remover cieloTerminalId se cieloTerminals foi atualizado
    if (updates.cieloTerminals) {
      delete customer.cieloTerminalId;
    }
    
    // Atualizar senha com hash se fornecida
    if (password) {
      CUSTOMER_PASSWORDS[id] = await hashPassword(password);
      await savePasswordsToStorage();
    }
    
    // Salvar no localStorage
    saveCustomersToStorage(ALL_CUSTOMERS);
    
    return migrateCustomer({ ...customer });
  }
  return null;
};

// Função para obter hash da senha do cliente
export const getCustomerPasswordHash = (customerId: string): string | undefined => {
  return CUSTOMER_PASSWORDS[customerId];
};

// Função para verificar senha do cliente
export const verifyCustomerPassword = async (
  customerId: string,
  password: string
): Promise<boolean> => {
  // Garantir que senhas estejam inicializadas
  if (!passwordsInitialized) {
    await loadPasswordsFromStorage();
  }
  const hashedPassword = CUSTOMER_PASSWORDS[customerId];
  if (!hashedPassword) return false;
  return verifyPassword(password, hashedPassword);
};

// Mantido para compatibilidade (deprecated - usar verifyCustomerPassword)
export const getCustomerPassword = (_customerId: string): string | undefined => {
  console.warn('getCustomerPassword está deprecated. Use verifyCustomerPassword.');
  return undefined;
};

export const createCustomer = async (
  customer: Omit<Customer, 'id' | 'totalPurchases' | 'lastPurchase'> & Partial<Pick<Customer, 'totalPurchases' | 'lastPurchase'>>,
  password?: string
): Promise<Customer> => {
  await new Promise(resolve => setTimeout(resolve, 300));
  
  // Garantir que senhas estejam inicializadas
  if (!passwordsInitialized) {
    await loadPasswordsFromStorage();
  }
  
  // Recarregar clientes atualizados
  ALL_CUSTOMERS = loadCustomersFromStorage();
  
  // Migrar cieloTerminalId para cieloTerminals se necessário
  let cieloTerminals = customer.cieloTerminals;
  if (customer.cieloTerminalId && (!cieloTerminals || cieloTerminals.length === 0)) {
    cieloTerminals = [{
      id: `term_${Date.now()}`,
      terminalId: customer.cieloTerminalId,
      name: `Conta ${customer.name}`,
      createdAt: new Date().toISOString(),
    }];
  }
  
  // Gerar ID único baseado no timestamp
  const newId = `c${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const newCustomer: Customer = {
    ...customer,
    id: newId,
    totalPurchases: customer.totalPurchases ?? 0,
    lastPurchase: customer.lastPurchase ?? new Date().toISOString().split('T')[0],
    cieloTerminals,
    cieloTerminalId: undefined, // Não usar campo antigo
  };
  
  ALL_CUSTOMERS.push(newCustomer);
  
  // Armazenar senha com hash se fornecida
  if (password) {
    CUSTOMER_PASSWORDS[newCustomer.id] = await hashPassword(password);
    await savePasswordsToStorage();
  }
  
  // Salvar no localStorage
  saveCustomersToStorage(ALL_CUSTOMERS);
  
  return migrateCustomer(newCustomer);
};

export const deleteCustomer = async (id: string): Promise<boolean> => {
  await new Promise(resolve => setTimeout(resolve, 300));
  
  // Garantir que senhas estejam inicializadas
  if (!passwordsInitialized) {
    await loadPasswordsFromStorage();
  }
  
  // Recarregar clientes atualizados
  ALL_CUSTOMERS = loadCustomersFromStorage();
  
  const index = ALL_CUSTOMERS.findIndex(c => c.id === id);
  if (index !== -1) {
    ALL_CUSTOMERS.splice(index, 1);
    // Remover senha também
    delete CUSTOMER_PASSWORDS[id];
    await savePasswordsToStorage();
    
    // Salvar no localStorage
    saveCustomersToStorage(ALL_CUSTOMERS);
    
    return true;
  }
  return false;
};

