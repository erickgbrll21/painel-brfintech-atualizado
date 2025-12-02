// Serviço para gerenciar taxas dos clientes

const STORAGE_KEY = 'customer_taxes';

export interface CustomerTax {
  customerId: string;
  taxRate: number; // Taxa em porcentagem (ex: 2.5 para 2.5%)
  updatedAt: string;
  updatedBy?: string; // ID do admin que atualizou
}

// Obter todas as taxas
export const getAllCustomerTaxes = (): CustomerTax[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Erro ao carregar taxas:', error);
    return [];
  }
};

// Obter taxa de um cliente específico
export const getCustomerTax = (customerId: string): number | null => {
  const taxes = getAllCustomerTaxes();
  const customerTax = taxes.find(t => t.customerId === customerId);
  return customerTax ? customerTax.taxRate : null;
};

// Salvar ou atualizar taxa de um cliente
export const saveCustomerTax = (customerId: string, taxRate: number, updatedBy?: string): void => {
  try {
    const taxes = getAllCustomerTaxes();
    const existingIndex = taxes.findIndex(t => t.customerId === customerId);
    
    const taxData: CustomerTax = {
      customerId,
      taxRate,
      updatedAt: new Date().toISOString(),
      updatedBy,
    };
    
    if (existingIndex >= 0) {
      taxes[existingIndex] = taxData;
    } else {
      taxes.push(taxData);
    }
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(taxes));
    
    // Disparar evento para atualizar dashboards em tempo real
    window.dispatchEvent(new CustomEvent('spreadsheetUpdated', { 
      detail: { customerId } 
    }));
  } catch (error) {
    console.error('Erro ao salvar taxa:', error);
    throw error;
  }
};

// Deletar taxa de um cliente
export const deleteCustomerTax = (customerId: string): void => {
  try {
    const taxes = getAllCustomerTaxes();
    const filtered = taxes.filter(t => t.customerId !== customerId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Erro ao deletar taxa:', error);
    throw error;
  }
};

