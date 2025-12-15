import { Transfer } from '../types';

const STORAGE_KEY = 'brfintech_transfers';

// Carregar repasses do localStorage
const loadTransfersFromStorage = (): Transfer[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const transfers = JSON.parse(stored);
      // Migração: garantir que repasses antigos tenham customerId
      return transfers.map((transfer: Transfer) => {
        if (!transfer.customerId) {
          // Se não tem customerId, adicionar um valor padrão (migração)
          return {
            ...transfer,
            customerId: 'migrated',
            customerName: transfer.customerName || 'Cliente não especificado',
          };
        }
        return transfer;
      });
    }
  } catch (error) {
    console.error('Erro ao carregar repasses do localStorage:', error);
  }
  return [];
};

// Salvar repasses no localStorage
const saveTransfersToStorage = (transfers: Transfer[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transfers));
  } catch (error) {
    console.error('Erro ao salvar repasses no localStorage:', error);
  }
};

// Inicializar dados
let ALL_TRANSFERS = loadTransfersFromStorage();

export const getTransfers = async (): Promise<Transfer[]> => {
  await new Promise(resolve => setTimeout(resolve, 300));
  // Recarregar do storage para garantir dados atualizados
  ALL_TRANSFERS = loadTransfersFromStorage();
  return [...ALL_TRANSFERS].sort((a, b) => {
    // Ordenar por data de envio (mais recente primeiro)
    // Se dataEnvio estiver vazia, considerar como muito antiga para aparecer no final
    const dateA = a.dataEnvio ? new Date(a.dataEnvio).getTime() : 0;
    const dateB = b.dataEnvio ? new Date(b.dataEnvio).getTime() : 0;
    return dateB - dateA;
  });
};

export const getTransferById = async (id: string): Promise<Transfer | null> => {
  await new Promise(resolve => setTimeout(resolve, 200));
  ALL_TRANSFERS = loadTransfersFromStorage();
  return ALL_TRANSFERS.find(t => t.id === id) || null;
};

export const createTransfer = async (
  transfer: Omit<Transfer, 'id' | 'createdAt'>
): Promise<Transfer> => {
  await new Promise(resolve => setTimeout(resolve, 300));
  
  // Recarregar repasses atualizados
  ALL_TRANSFERS = loadTransfersFromStorage();
  
  // Gerar ID único baseado no timestamp
  const newId = `transfer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const newTransfer: Transfer = {
    ...transfer,
    id: newId,
    createdAt: new Date().toISOString(),
  };
  
  ALL_TRANSFERS.push(newTransfer);
  
  // Salvar no localStorage
  saveTransfersToStorage(ALL_TRANSFERS);
  
  return newTransfer;
};

export const updateTransfer = async (
  id: string,
  updates: Partial<Transfer>
): Promise<Transfer | null> => {
  await new Promise(resolve => setTimeout(resolve, 300));
  
  // Recarregar repasses atualizados
  ALL_TRANSFERS = loadTransfersFromStorage();
  
  const transfer = ALL_TRANSFERS.find(t => t.id === id);
  if (transfer) {
    Object.assign(transfer, updates);
    
    // Salvar no localStorage
    saveTransfersToStorage(ALL_TRANSFERS);
    
    return { ...transfer };
  }
  return null;
};

export const deleteTransfer = async (id: string): Promise<boolean> => {
  await new Promise(resolve => setTimeout(resolve, 300));
  
  // Recarregar repasses atualizados
  ALL_TRANSFERS = loadTransfersFromStorage();
  
  const index = ALL_TRANSFERS.findIndex(t => t.id === id);
  if (index !== -1) {
    ALL_TRANSFERS.splice(index, 1);
    
    // Salvar no localStorage
    saveTransfersToStorage(ALL_TRANSFERS);
    
    return true;
  }
  return false;
};


