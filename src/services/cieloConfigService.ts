// Serviço para gerenciar configurações da API Cielo
import { encryptObject, decryptObject } from '../utils/encryption';

export interface CieloConfig {
  merchantId: string;
  merchantKey: string;
  apiUrl?: string;
}

const STORAGE_KEY = 'cielo_api_config_encrypted';
const STORAGE_KEY_LEGACY = 'cielo_api_config'; // Para migração

// URL padrão da API Cielo
const DEFAULT_API_URL = 'https://api.cieloecommerce.cielo.com.br';

export const getCieloConfig = async (): Promise<CieloConfig | null> => {
  try {
    // Tentar carregar configuração criptografada
    const encrypted = localStorage.getItem(STORAGE_KEY);
    if (encrypted) {
      const config = await decryptObject<CieloConfig>(encrypted);
      return {
        ...config,
        apiUrl: config.apiUrl || DEFAULT_API_URL,
      };
    }
    
    // Migração: tentar carregar configuração antiga não criptografada
    const legacyStored = localStorage.getItem(STORAGE_KEY_LEGACY);
    if (legacyStored) {
      const config = JSON.parse(legacyStored);
      const configToSave = {
        ...config,
        apiUrl: config.apiUrl || DEFAULT_API_URL,
      };
      // Criptografar e migrar
      await saveCieloConfig(configToSave);
      localStorage.removeItem(STORAGE_KEY_LEGACY);
      return configToSave;
    }
  } catch (error) {
    console.error('Erro ao recuperar configuração Cielo:', error);
    // Limpar dados corrompidos
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY_LEGACY);
  }
  
  // Fallback para variáveis de ambiente
  const envMerchantId = import.meta.env.VITE_CIELO_MERCHANT_ID;
  const envMerchantKey = import.meta.env.VITE_CIELO_MERCHANT_KEY;
  
  if (envMerchantId && envMerchantKey) {
    return {
      merchantId: envMerchantId,
      merchantKey: envMerchantKey,
      apiUrl: import.meta.env.VITE_CIELO_API_URL || DEFAULT_API_URL,
    };
  }
  
  return null;
};

export const saveCieloConfig = async (config: CieloConfig): Promise<void> => {
  try {
    const configToSave = {
      merchantId: config.merchantId.trim(),
      merchantKey: config.merchantKey.trim(),
      apiUrl: config.apiUrl?.trim() || DEFAULT_API_URL,
    };
    // Criptografar antes de salvar
    const encrypted = await encryptObject(configToSave);
    localStorage.setItem(STORAGE_KEY, encrypted);
    // Remover versão antiga se existir
    localStorage.removeItem(STORAGE_KEY_LEGACY);
  } catch (error) {
    console.error('Erro ao salvar configuração Cielo:', error);
    throw new Error('Erro ao salvar configuração');
  }
};

export const deleteCieloConfig = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY_LEGACY);
  } catch (error) {
    console.error('Erro ao remover configuração Cielo:', error);
  }
};

export const hasCieloConfig = async (): Promise<boolean> => {
  const config = await getCieloConfig();
  return !!(config?.merchantId && config?.merchantKey);
};

