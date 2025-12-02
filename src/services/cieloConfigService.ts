// Serviço para gerenciar configurações da API Cielo
export interface CieloConfig {
  merchantId: string;
  merchantKey: string;
  apiUrl?: string;
}

const STORAGE_KEY = 'cielo_api_config';

// URL padrão da API Cielo
const DEFAULT_API_URL = 'https://api.cieloecommerce.cielo.com.br';

export const getCieloConfig = (): CieloConfig | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const config = JSON.parse(stored);
      return {
        ...config,
        apiUrl: config.apiUrl || DEFAULT_API_URL,
      };
    }
  } catch (error) {
    console.error('Erro ao recuperar configuração Cielo:', error);
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

export const saveCieloConfig = (config: CieloConfig): void => {
  try {
    const configToSave = {
      merchantId: config.merchantId.trim(),
      merchantKey: config.merchantKey.trim(),
      apiUrl: config.apiUrl?.trim() || DEFAULT_API_URL,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(configToSave));
  } catch (error) {
    console.error('Erro ao salvar configuração Cielo:', error);
    throw new Error('Erro ao salvar configuração');
  }
};

export const deleteCieloConfig = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Erro ao remover configuração Cielo:', error);
  }
};

export const hasCieloConfig = (): boolean => {
  const config = getCieloConfig();
  return !!(config?.merchantId && config?.merchantKey);
};

