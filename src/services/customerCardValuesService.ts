// Serviço para gerenciar valores customizados dos cards dos clientes

const STORAGE_KEY = 'customer_card_values';

export interface CustomerCardValues {
  customerId: string;
  terminalId?: string; // ID da conta (opcional - se não fornecido, é valor geral do cliente)
  referenceMonth?: string; // Mês de referência para planilhas mensais (YYYY-MM)
  referenceDate?: string; // Data de referência para planilhas diárias (YYYY-MM-DD)
  type?: 'monthly' | 'daily'; // Tipo de planilha
  quantidadeVendas?: number;
  valorBruto?: number;
  taxa?: number;
  valorLiquido?: number;
  updatedAt: string;
  updatedBy?: string; // ID do admin que atualizou
}

// Gerar chave única para armazenamento por planilha específica
const getStorageKey = (
  customerId: string, 
  terminalId?: string, 
  referenceMonth?: string, 
  referenceDate?: string,
  type?: 'monthly' | 'daily'
): string => {
  const parts = [customerId];
  if (terminalId) parts.push(`term_${terminalId}`);
  if (type === 'monthly' && referenceMonth) {
    parts.push(`month_${referenceMonth}`);
  } else if (type === 'daily' && referenceDate) {
    parts.push(`date_${referenceDate}`);
  }
  return parts.join('_');
};

// Obter valores customizados de uma planilha específica
export const getCustomerCardValues = (
  customerId: string, 
  terminalId?: string,
  referenceMonth?: string,
  referenceDate?: string,
  type?: 'monthly' | 'daily'
): CustomerCardValues | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const allValues = stored ? JSON.parse(stored) : {};
    
    // Tentar buscar com os parâmetros específicos primeiro
    const specificKey = getStorageKey(customerId, terminalId, referenceMonth, referenceDate, type);
    let value = allValues[specificKey];
    
    // Se não encontrou com parâmetros específicos, tentar buscar valores gerais do mesmo tipo
    // (sem referenceMonth/referenceDate, mas mantendo o tipo para não misturar monthly com daily)
    if (!value && type) {
      const generalKeySameType = getStorageKey(customerId, terminalId, undefined, undefined, type);
      value = allValues[generalKeySameType];
    }
    
    // Se ainda não encontrou, tentar buscar valores gerais sem tipo (último recurso)
    if (!value) {
      const generalKey = getStorageKey(customerId, terminalId, undefined, undefined, undefined);
      value = allValues[generalKey];
    }
    
    if (value) {
      return {
        ...value,
        customerId,
        terminalId: terminalId || value.terminalId || undefined,
        referenceMonth: referenceMonth || value.referenceMonth || undefined,
        referenceDate: referenceDate || value.referenceDate || undefined,
        type: type || value.type || undefined,
      };
    }
    
    return null;
  } catch (error) {
    console.error('Erro ao carregar valores dos cards:', error);
    return null;
  }
};

// Salvar valores customizados dos cards para uma planilha específica
export const saveCustomerCardValues = (
  customerId: string,
  values: {
    quantidadeVendas?: number;
    valorBruto?: number;
    taxa?: number;
    valorLiquido?: number;
  },
  updatedBy?: string,
  terminalId?: string,
  referenceMonth?: string,
  referenceDate?: string,
  type?: 'monthly' | 'daily'
): void => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const allValues = stored ? JSON.parse(stored) : {};
    const key = getStorageKey(customerId, terminalId, referenceMonth, referenceDate, type);
    
    allValues[key] = {
      customerId,
      terminalId: terminalId || undefined,
      referenceMonth: referenceMonth || undefined,
      referenceDate: referenceDate || undefined,
      type: type || undefined,
      ...values,
      updatedAt: new Date().toISOString(),
      updatedBy,
    };
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allValues));
    
    // Disparar evento para atualizar dashboards
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('cardValuesUpdated', { 
        detail: { customerId, terminalId, referenceMonth, referenceDate, type } 
      }));
    }, 50);
  } catch (error) {
    console.error('Erro ao salvar valores dos cards:', error);
    throw error;
  }
};

// Deletar valores customizados de uma planilha específica (voltar a usar valores da planilha)
export const deleteCustomerCardValues = (
  customerId: string, 
  terminalId?: string,
  referenceMonth?: string,
  referenceDate?: string,
  type?: 'monthly' | 'daily'
): void => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const allValues = stored ? JSON.parse(stored) : {};
    const key = getStorageKey(customerId, terminalId, referenceMonth, referenceDate, type);
    delete allValues[key];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allValues));
    
    // Disparar evento para atualizar dashboards
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('cardValuesUpdated', { 
        detail: { customerId, terminalId, referenceMonth, referenceDate, type } 
      }));
    }, 50);
  } catch (error) {
    console.error('Erro ao deletar valores dos cards:', error);
    throw error;
  }
};

