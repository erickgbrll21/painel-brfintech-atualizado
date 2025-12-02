import axios from 'axios';
import { CieloTransaction } from '../types';
import { getCieloConfig } from './cieloConfigService';

// Função para obter configuração atual da Cielo
const getCurrentConfig = () => {
  const config = getCieloConfig();
  const defaultUrl = import.meta.env.VITE_CIELO_API_URL || 'https://api.cieloecommerce.cielo.com.br';
  
  return {
    apiUrl: config?.apiUrl || defaultUrl,
    merchantId: config?.merchantId || import.meta.env.VITE_CIELO_MERCHANT_ID || '',
    merchantKey: config?.merchantKey || import.meta.env.VITE_CIELO_MERCHANT_KEY || '',
  };
};

// Função para criar instância do axios com configuração atual
const createCieloApi = () => {
  const config = getCurrentConfig();
  
  return axios.create({
    baseURL: config.apiUrl,
    headers: {
      'Content-Type': 'application/json',
    },
    auth: {
      username: config.merchantId,
      password: config.merchantKey,
    },
  });
};

export const getCieloTransactions = async (
  startDate?: string,
  endDate?: string
): Promise<CieloTransaction[]> => {
  try {
    const config = getCurrentConfig();
    
    // Se não houver credenciais configuradas, retornar dados mockados
    if (!config.merchantId || !config.merchantKey) {
      return getMockCieloTransactions();
    }

    // Chamada real à API Cielo
    const cieloApi = createCieloApi();
    const response = await cieloApi.get('/1/sales', {
      params: {
        merchantOrderId: '',
        pageSize: 100,
        page: 1,
      },
    });
    
    return response.data;
  } catch (error) {
    console.error('Erro ao buscar transações Cielo:', error);
    // Em caso de erro, retornar dados mockados
    return getMockCieloTransactions();
  }
};

export const getCieloTransactionById = async (paymentId: string): Promise<CieloTransaction | null> => {
  try {
    const config = getCurrentConfig();
    
    if (!config.merchantId || !config.merchantKey) {
      const mockTransactions = getMockCieloTransactions();
      return mockTransactions.find(t => t.PaymentId === paymentId) || null;
    }

    // Chamada real à API Cielo
    const cieloApi = createCieloApi();
    const response = await cieloApi.get(`/1/sales/${paymentId}`);
    return response.data;
  } catch (error) {
    console.error('Erro ao buscar transação Cielo:', error);
    return null;
  }
};

export const getCieloPaymentStatus = (status: number): string => {
  const statusMap: { [key: number]: string } = {
    0: 'Não finalizada',
    1: 'Autorizada',
    2: 'Pagamento confirmado',
    3: 'Negada',
    10: 'Cancelada',
    11: 'Reembolsada',
    12: 'Pendente',
    13: 'Abortada',
    20: 'Agendada',
  };
  
  return statusMap[status] || 'Desconhecido';
};

// Dados mockados - zerado e pronto para uso
const getMockCieloTransactions = (): CieloTransaction[] => {
  return [];
};

