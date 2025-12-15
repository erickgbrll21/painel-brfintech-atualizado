// Serviço para gerenciar valores customizados dos cards dos clientes

import { getTransfers, updateTransfer } from './transferService';
import { Transfer } from '../types';

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
    
    // Atualizar repasses existentes com os valores customizados
    updateTransfersWithCustomValues(customerId, terminalId, referenceMonth, referenceDate, type, values).catch(err => {
      console.error('Erro ao atualizar repasses com valores customizados:', err);
    });
    
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

// Atualizar repasses existentes com valores customizados dos cards
const updateTransfersWithCustomValues = async (
  customerId: string,
  _terminalId: string | undefined,
  referenceMonth: string | undefined,
  referenceDate: string | undefined,
  type: 'monthly' | 'daily' | undefined,
  values: {
    quantidadeVendas?: number;
    valorBruto?: number;
    taxa?: number;
    valorLiquido?: number;
  }
): Promise<void> => {
  try {
    const transfers = await getTransfers();
    
    // Determinar período para buscar repasses correspondentes
    let periodoToMatch: string | undefined;
    if (type === 'daily' && referenceDate) {
      const date = new Date(referenceDate);
      periodoToMatch = date.toLocaleDateString('pt-BR');
    } else if (referenceMonth) {
      const [year, month] = referenceMonth.split('-');
      const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
                          'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
      periodoToMatch = `${monthNames[parseInt(month) - 1]}/${year}`;
    }
    
    // Buscar repasses do mesmo cliente e período
    const matchingTransfers = transfers.filter(t => 
      t.customerId === customerId && 
      t.periodo === periodoToMatch
    );
    
    if (matchingTransfers.length === 0) {
      return; // Não há repasses para atualizar
    }
    
    // Calcular valores atualizados usando os valores dos cards
    let valorBruto = values.valorBruto;
    let taxas: number | undefined;
    let valorLiquido = values.valorLiquido;
    
    // Taxa: usar valor absoluto dos cards se existir (já está em R$), senão calcular 5,10% do valor bruto
    if (values.taxa !== undefined && values.taxa > 0) {
      // Taxa nos cards já é valor absoluto em reais (R$), não porcentagem
      taxas = values.taxa;
    } else if (valorBruto !== undefined && valorBruto > 0) {
      // Se tem valor bruto mas não tem taxa customizada, calcular 5,10%
      taxas = valorBruto * 0.051;
    }
    
    // Calcular valor líquido se não estiver definido
    if ((!valorLiquido || valorLiquido <= 0) && valorBruto && taxas) {
      valorLiquido = valorBruto - taxas;
    }
    
    // Atualizar cada repasse encontrado com os valores dos cards
    for (const transfer of matchingTransfers) {
      const updates: Partial<Transfer> = {};
      
      // Sincronizar valor bruto
      if (valorBruto !== undefined && valorBruto > 0) {
        updates.valorBruto = valorBruto;
      }
      
      // Sincronizar taxas
      if (taxas !== undefined && taxas >= 0) {
        updates.taxas = taxas;
      }
      
      // Sincronizar valor líquido
      if (valorLiquido !== undefined && valorLiquido > 0) {
        updates.valorLiquido = valorLiquido;
      }
      
      // Atualizar o repasse com os valores dos cards
      if (Object.keys(updates).length > 0) {
        await updateTransfer(transfer.id, updates);
      }
    }
    
    console.log(`Repasses atualizados com valores customizados: ${matchingTransfers.length} repasse(s)`);
  } catch (error) {
    console.error('Erro ao atualizar repasses com valores customizados:', error);
    // Não lançar erro para não bloquear o salvamento dos valores dos cards
  }
};

