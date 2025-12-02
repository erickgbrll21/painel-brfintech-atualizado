// Serviço para gerenciar valores customizados dos cards dos clientes

const STORAGE_KEY = 'customer_card_values';

export interface CustomerCardValues {
  customerId: string;
  terminalId?: string; // ID da maquininha (opcional - se não fornecido, é valor geral do cliente)
  quantidadeVendas?: number;
  valorBruto?: number;
  taxa?: number;
  valorLiquido?: number;
  updatedAt: string;
  updatedBy?: string; // ID do admin que atualizou
}

// Gerar chave única para armazenamento (customerId + terminalId)
const getStorageKey = (customerId: string, terminalId?: string): string => {
  return terminalId ? `${customerId}_${terminalId}` : customerId;
};

// Obter valores customizados de um cliente ou maquininha específica
export const getCustomerCardValues = (customerId: string, terminalId?: string): CustomerCardValues | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const allValues = stored ? JSON.parse(stored) : {};
    const key = getStorageKey(customerId, terminalId);
    const value = allValues[key];
    
    if (value) {
      return {
        ...value,
        customerId,
        terminalId: terminalId || undefined,
      };
    }
    
    return null;
  } catch (error) {
    console.error('Erro ao carregar valores dos cards:', error);
    return null;
  }
};

// Salvar valores customizados dos cards
export const saveCustomerCardValues = (
  customerId: string,
  values: {
    quantidadeVendas?: number;
    valorBruto?: number;
    taxa?: number;
    valorLiquido?: number;
  },
  updatedBy?: string,
  terminalId?: string
): void => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const allValues = stored ? JSON.parse(stored) : {};
    const key = getStorageKey(customerId, terminalId);
    
    allValues[key] = {
      customerId,
      terminalId: terminalId || undefined,
      ...values,
      updatedAt: new Date().toISOString(),
      updatedBy,
    };
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allValues));
    
    // Disparar evento para atualizar dashboards
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('cardValuesUpdated', { 
        detail: { customerId, terminalId } 
      }));
    }, 50);
  } catch (error) {
    console.error('Erro ao salvar valores dos cards:', error);
    throw error;
  }
};

// Deletar valores customizados (voltar a usar valores da planilha)
export const deleteCustomerCardValues = (customerId: string, terminalId?: string): void => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const allValues = stored ? JSON.parse(stored) : {};
    const key = getStorageKey(customerId, terminalId);
    delete allValues[key];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allValues));
    
    // Disparar evento para atualizar dashboards
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('cardValuesUpdated', { 
        detail: { customerId, terminalId } 
      }));
    }, 50);
  } catch (error) {
    console.error('Erro ao deletar valores dos cards:', error);
    throw error;
  }
};

