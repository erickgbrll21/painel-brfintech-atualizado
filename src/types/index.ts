export type UserRole = 'admin' | 'user' | 'customer';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
  customerId?: string; // ID do cliente se for um cliente fazendo login
}

export interface Sale {
  id: string;
  date: string;
  amount: number;
  product: string;
  region: string;
  seller: string;
  customerId: string;
  customerName: string;
  status: 'completed' | 'pending' | 'cancelled';
  paymentMethod: string;
  cieloTransactionId?: string;
  cieloTerminalId?: string; // ID da maquininha que gerou a venda
}

export interface CieloTerminal {
  id: string; // ID único da maquininha
  terminalId: string; // ID da maquininha Cielo/Terminal
  name?: string; // Nome descritivo da maquininha (opcional)
  createdAt: string;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  region: string;
  totalPurchases: number;
  lastPurchase: string;
  status: 'active' | 'inactive';
  category?: string;
  username?: string;
  cieloTerminals?: CieloTerminal[]; // Array de maquininhas Cielo associadas ao cliente
  cieloTerminalId?: string; // Mantido para compatibilidade com versões antigas
}

export interface SalesMetrics {
  totalSales: number;
  totalRevenue: number;
  averageTicket: number;
  activeCustomers: number;
  transactionsVolume: number;
  growthRate: number;
}

export interface FilterOptions {
  startDate?: string;
  endDate?: string;
  product?: string;
  region?: string;
  seller?: string;
  terminalId?: string; // Filtrar por maquininha específica
}

export interface CieloTransaction {
  PaymentId: string;
  MerchantOrderId: string;
  Customer: {
    Name: string;
  };
  Payment: {
    Type: string;
    Amount: number;
    Currency: string;
    Status: number;
    ReturnCode: string;
    ReturnMessage: string;
    Provider: string;
    Installments: number;
    CreditCard?: {
      Brand: string;
      Number: string;
    };
  };
  CreatedDate: string;
}

// Interface para dados estruturados de vendas da planilha
export interface SpreadsheetSale {
  quantidadeVendas: number;
  valorBruto: number;
  taxaTotal: number;
  valorLiquido: number;
  dataVenda: string;
  horaVenda: string;
  estabelecimento: string;
  cpfCnpj: string;
  formaPagamento: string;
  quantidadeParcelas: number;
  bandeira: string;
  statusVenda: string;
  tipoLancamento: string;
  dataLancamento: string;
  numeroMaquina: string;
}

