import { Customer, CieloTerminal } from '../types';

// Armazenamento de senhas de clientes (em produção, isso seria criptografado)
const CUSTOMER_PASSWORDS: { [customerId: string]: string } = {};

// Dados de clientes - zerado e pronto para uso
const ALL_CUSTOMERS: Customer[] = [];

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
  // Migrar clientes antigos ao retornar
  return ALL_CUSTOMERS.map(migrateCustomer);
};

export const getCustomerById = async (id: string): Promise<Customer | null> => {
  await new Promise(resolve => setTimeout(resolve, 200));
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
    
    // Atualizar senha se fornecida
    if (password) {
      CUSTOMER_PASSWORDS[id] = password;
    }
    
    return migrateCustomer({ ...customer });
  }
  return null;
};

// Função para obter senha do cliente
export const getCustomerPassword = (customerId: string): string | undefined => {
  return CUSTOMER_PASSWORDS[customerId];
};

export const createCustomer = async (
  customer: Omit<Customer, 'id' | 'totalPurchases' | 'lastPurchase'> & Partial<Pick<Customer, 'totalPurchases' | 'lastPurchase'>>,
  password?: string
): Promise<Customer> => {
  await new Promise(resolve => setTimeout(resolve, 300));
  
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
  
  const newCustomer: Customer = {
    ...customer,
    id: `c${ALL_CUSTOMERS.length + 1}`,
    totalPurchases: customer.totalPurchases ?? 0,
    lastPurchase: customer.lastPurchase ?? new Date().toISOString().split('T')[0],
    cieloTerminals,
    cieloTerminalId: undefined, // Não usar campo antigo
  };
  ALL_CUSTOMERS.push(newCustomer);
  
  // Armazenar senha se fornecida
  if (password) {
    CUSTOMER_PASSWORDS[newCustomer.id] = password;
  }
  
  return migrateCustomer(newCustomer);
};

export const deleteCustomer = async (id: string): Promise<boolean> => {
  await new Promise(resolve => setTimeout(resolve, 300));
  const index = ALL_CUSTOMERS.findIndex(c => c.id === id);
  if (index !== -1) {
    ALL_CUSTOMERS.splice(index, 1);
    // Remover senha também
    delete CUSTOMER_PASSWORDS[id];
    return true;
  }
  return false;
};

