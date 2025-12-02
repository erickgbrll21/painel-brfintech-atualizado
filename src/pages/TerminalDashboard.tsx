import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  DollarSign, 
  ShoppingCart, 
  CreditCard,
  ArrowLeft,
  FileSpreadsheet,
  Building2,
  Wallet,
  CheckCircle,
  Clock,
  XCircle,
  Percent
} from 'lucide-react';
import KPICard from '../components/KPICard';
import FilterBar from '../components/FilterBar';
import { useAuth } from '../context/AuthContext';
import { getSales } from '../services/salesService';
import { getCustomerByTerminalId, getAllTerminals, getCustomerById } from '../services/customerService';
import { getSpreadsheetByCustomerId, getSpreadsheetByTerminalId, SpreadsheetData, calculateSpreadsheetMetrics } from '../services/spreadsheetService';
import CustomerSpreadsheet from '../components/CustomerSpreadsheet';
import { getCustomerTax } from '../services/customerTaxService';
import { getCustomerCardValues } from '../services/customerCardValuesService';
import { FilterOptions, Sale, CieloTerminal } from '../types';

const TerminalDashboard = () => {
  const { terminalId } = useParams<{ terminalId: string }>();
  const navigate = useNavigate();
  const { user, isCustomer, isAdmin } = useAuth();
  const [terminal, setTerminal] = useState<CieloTerminal | null>(null);
  const [customerName, setCustomerName] = useState<string>('');
  const [recentSales, setRecentSales] = useState<Sale[]>([]);
  const [filters, setFilters] = useState<FilterOptions>({ terminalId });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [customerTerminals, setCustomerTerminals] = useState<Array<{ id: string; terminalId: string; name?: string }>>([]);
  const [spreadsheetData, setSpreadsheetData] = useState<SpreadsheetData | null>(null);
  const [spreadsheetMetrics, setSpreadsheetMetrics] = useState<any>(null);
  const [showSpreadsheetModal, setShowSpreadsheetModal] = useState(false);

  // Carregar informações da maquininha
  // Atualizar automaticamente quando a planilha for reimportada
  useEffect(() => {
    const loadTerminalInfo = async () => {
      if (!terminalId) {
        setError('ID da maquininha não fornecido');
        setIsLoading(false);
        return;
      }

      try {
        // Se for cliente, verificar se a maquininha pertence a ele e carregar todas as maquininhas
        if (isCustomer() && user?.customerId) {
          const customer = await getCustomerById(user.customerId);
          if (customer) {
            const terminals = customer.cieloTerminals?.map(t => ({
              id: t.id,
              terminalId: t.terminalId,
              name: t.name,
            })) || 
            (customer.cieloTerminalId ? [{
              id: `temp_${customer.cieloTerminalId}`,
              terminalId: customer.cieloTerminalId,
              name: `Maquininha ${customer.name}`,
            }] : []);
            
            setCustomerTerminals(terminals);
            
            // Carregar planilha da maquininha específica (prioridade) ou do cliente
            let spreadsheet = getSpreadsheetByTerminalId(terminalId, user.customerId);
            if (!spreadsheet) {
              spreadsheet = getSpreadsheetByCustomerId(user.customerId);
            }
            setSpreadsheetData(spreadsheet);
            if (spreadsheet && spreadsheet.data && spreadsheet.data.length > 0) {
              const metrics = calculateSpreadsheetMetrics(spreadsheet);
              
              // Verificar se há valores customizados dos cards definidos pelo admin
              // Buscar valores específicos desta maquininha
              const customValues = getCustomerCardValues(user.customerId, terminalId);
              if (customValues) {
                if (customValues.quantidadeVendas !== undefined) {
                  metrics.totalVendas = customValues.quantidadeVendas;
                }
                if (customValues.valorBruto !== undefined) {
                  metrics.valorBrutoTotal = customValues.valorBruto;
                }
                if (customValues.taxa !== undefined) {
                  metrics.taxaMedia = customValues.taxa;
                }
                if (customValues.valorLiquido !== undefined) {
                  metrics.valorLiquidoTotal = customValues.valorLiquido;
                }
              }
              
              setSpreadsheetMetrics(metrics);
            } else {
              setSpreadsheetMetrics(null);
            }
            
            const terminalIds = terminals.map(t => t.terminalId);
            if (!terminalIds.includes(terminalId)) {
              setError('Você não tem permissão para acessar esta maquininha');
              setIsLoading(false);
              return;
            }
          }
        }
        
        // Buscar cliente associado primeiro (mais direto)
        const customer = await getCustomerByTerminalId(terminalId);
        
        if (customer) {
          setCustomerName(customer.name);
          
          // Buscar a maquininha específica
          if (customer.cieloTerminals && customer.cieloTerminals.length > 0) {
            const foundTerminal = customer.cieloTerminals.find(t => t.terminalId === terminalId);
            if (foundTerminal) {
              setTerminal(foundTerminal);
            } else {
              // Criar terminal temporário se não encontrado
              setTerminal({
                id: `temp_${terminalId}`,
                terminalId,
                name: `Maquininha ${customer.name}`,
                createdAt: new Date().toISOString(),
              });
            }
          } else if (customer.cieloTerminalId === terminalId) {
            // Compatibilidade com formato antigo
            setTerminal({
              id: `temp_${terminalId}`,
              terminalId,
              name: `Maquininha ${customer.name}`,
              createdAt: new Date().toISOString(),
            });
          }
        } else {
          // Se não encontrou cliente, tentar buscar todas as maquininhas
          const terminals = await getAllTerminals();
          const foundTerminal = terminals.find(t => t.terminalId === terminalId);
          
          if (foundTerminal) {
            setTerminal(foundTerminal);
          } else {
            setError('Maquininha não encontrada');
          }
        }
      } catch (err) {
        console.error('Erro ao carregar informações da maquininha:', err);
        setError('Erro ao carregar informações da maquininha');
      } finally {
        setIsLoading(false);
      }
    };

    // Carregar imediatamente
    loadTerminalInfo();
    
    let isMounted = true;
    // Usar objeto para garantir que o hash seja compartilhado
    const hashRef = { current: '' };
    
    // Função para recarregar dados da planilha (otimizada)
    const reloadSpreadsheetData = () => {
      if (!isMounted || !isCustomer() || !user?.customerId || !terminalId) return;
      
      // Priorizar planilha da maquininha, senão buscar do cliente
      let spreadsheet = getSpreadsheetByTerminalId(terminalId, user.customerId);
      if (!spreadsheet) {
        spreadsheet = getSpreadsheetByCustomerId(user.customerId);
      }
      
      // Obter taxa atual do cliente para incluir no hash
      const customerTax = getCustomerTax(user.customerId);
      
      // Criar hash simples que detecta mudanças essenciais
      // Hash inclui: data de upload, quantidade de linhas e taxa atual
      const currentHash = spreadsheet 
        ? `${spreadsheet.uploadedAt}-${spreadsheet.data?.length || 0}-${customerTax || 'null'}` 
        : '';
      
      // SEMPRE atualizar dados e recalcular métricas para garantir sincronização 100%
      setSpreadsheetData(spreadsheet);
      if (spreadsheet && spreadsheet.data && spreadsheet.data.length > 0) {
        // SEMPRE recalcular métricas para garantir sincronização perfeita
        // Recalcular sempre para garantir que valores estejam sempre atualizados
        const metrics = calculateSpreadsheetMetrics(spreadsheet);
        
        // Verificar se há valores customizados dos cards definidos pelo admin
        // Buscar valores específicos desta maquininha
        const customValues = getCustomerCardValues(user.customerId, terminalId);
        if (customValues) {
          // Usar valores customizados se disponíveis, senão usar valores da planilha
          if (customValues.quantidadeVendas !== undefined) {
            metrics.totalVendas = customValues.quantidadeVendas;
          }
          if (customValues.valorBruto !== undefined) {
            metrics.valorBrutoTotal = customValues.valorBruto;
          }
          if (customValues.taxa !== undefined) {
            metrics.taxaMedia = customValues.taxa;
          }
          if (customValues.valorLiquido !== undefined) {
            metrics.valorLiquidoTotal = customValues.valorLiquido;
          }
        }
        
        setSpreadsheetMetrics(metrics);
        hashRef.current = currentHash;
      } else {
        setSpreadsheetMetrics(null);
        hashRef.current = '';
      }
    };
    
    // Carregar planilha inicialmente
    reloadSpreadsheetData();
    
    // Atualizar automaticamente a cada 5 segundos (reduzido de 2 para melhor performance)
    const interval = setInterval(() => {
      if (isMounted) {
        reloadSpreadsheetData();
      }
    }, 5000);
    
    // Escutar evento de atualização da planilha para atualização imediata
    const handleSpreadsheetUpdate = (event: CustomEvent) => {
      const eventTerminalId = event.detail?.terminalId;
      const eventCustomerId = event.detail?.customerId;
      
      // Atualizar se for do mesmo cliente E (mesmo terminal OU não especificou terminal)
      if (eventCustomerId === user?.customerId && isMounted) {
        if (!eventTerminalId || eventTerminalId === terminalId) {
          // Forçar atualização imediata, resetando o hash para garantir recálculo
          hashRef.current = '';
          reloadSpreadsheetData();
        }
      }
    };
    
    // Escutar evento de atualização dos valores dos cards
    const handleCardValuesUpdate = (event: CustomEvent) => {
      const eventTerminalId = event.detail?.terminalId;
      const eventCustomerId = event.detail?.customerId;
      
      // Atualizar se for do mesmo cliente E (mesmo terminal OU não especificou terminal)
      if (eventCustomerId === user?.customerId && isMounted) {
        if (!eventTerminalId || eventTerminalId === terminalId) {
          // Forçar atualização imediata quando valores dos cards são alterados
          hashRef.current = '';
          reloadSpreadsheetData();
        }
      }
    };
    
    window.addEventListener('spreadsheetUpdated', handleSpreadsheetUpdate as EventListener);
    window.addEventListener('cardValuesUpdated', handleCardValuesUpdate as EventListener);
    
    return () => {
      isMounted = false;
      clearInterval(interval);
      window.removeEventListener('spreadsheetUpdated', handleSpreadsheetUpdate as EventListener);
      window.removeEventListener('cardValuesUpdated', handleCardValuesUpdate as EventListener);
    };
  }, [terminalId, isCustomer, user?.customerId]);

  const handleFilterChange = useCallback((newFilters: FilterOptions) => {
    setFilters(prevFilters => {
      const updatedFilters = { ...newFilters, terminalId };
      const prevStr = JSON.stringify(prevFilters);
      const newStr = JSON.stringify(updatedFilters);
      if (prevStr === newStr) {
        return prevFilters;
      }
      return updatedFilters;
    });
  }, [terminalId]);

  const loadDashboardData = useCallback(async () => {
    if (!terminalId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const cancelled = { current: false };
      
      const filtersWithTerminal = { ...filters, terminalId };
      
      const salesData = await getSales(filtersWithTerminal);

      if (cancelled.current) return;

      setRecentSales(salesData.slice(0, 10));
    } catch (err) {
      console.error('Erro ao carregar dados do dashboard:', err);
      setError('Erro ao carregar dados. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  }, [filters, terminalId]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  if (isLoading && !terminal) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-black"></div>
      </div>
    );
  }

  if (error && !terminal) {
    return (
      <div className="bg-white border-2 border-red-200 rounded-lg p-8 text-center">
        <CreditCard className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-black mb-2">Erro</h2>
        <p className="text-gray-600 mb-4">{error}</p>
        <button
          onClick={() => navigate('/customers')}
          className="bg-black text-white px-6 py-2 rounded-lg font-semibold hover:bg-gray-800 transition-colors"
        >
          Voltar para Clientes
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3 md:space-y-4 lg:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(isCustomer() ? '/' : '/customers')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Voltar"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-black mb-1">
              {isCustomer() ? 'Meu Dashboard' : `Dashboard - ${terminal?.name || terminalId}`}
            </h1>
            {customerName && !isCustomer() && (
              <p className="text-sm md:text-base text-gray-600">
                Cliente: <span className="font-semibold">{customerName}</span>
              </p>
            )}
            {terminal && (
              <p className="text-xs md:text-sm text-gray-500">
                Terminal ID: <span className="font-mono">{terminal.terminalId}</span>
              </p>
            )}
          </div>
        </div>
        
        {/* Seletor de maquininha para clientes com múltiplas */}
        {isCustomer() && customerTerminals.length > 1 && terminalId && (
          <div className="w-full md:w-auto">
            <label className="block text-sm font-medium text-black mb-2">
              Trocar Maquininha
            </label>
            <select
              value={terminalId}
              onChange={(e) => navigate(`/terminal/${e.target.value}`, { replace: true })}
              className="w-full md:w-auto px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-black transition-colors bg-white"
            >
              {customerTerminals.map((term) => (
                <option key={term.id} value={term.terminalId}>
                  {term.name || term.terminalId}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Filtros - apenas para administradores */}
      {!isCustomer() && (
        <FilterBar
          onFilterChange={handleFilterChange}
        />
      )}

      {/* Mensagem de erro */}
      {error && (
        <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}


      {/* KPI Cards da Planilha - Apenas para Clientes */}
      {/* Ordem: Quantidade de Vendas, Valor Bruto, Taxa, Valor Líquido */}
      {isCustomer() && spreadsheetData && spreadsheetData.data && spreadsheetData.data.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <KPICard
            title="Quantidade de Vendas"
            value={spreadsheetMetrics?.totalVendas ?? 0}
            icon={ShoppingCart}
            format="number"
          />
          <KPICard
            title="Valor Bruto"
            value={spreadsheetMetrics?.valorBrutoTotal ?? 0}
            icon={DollarSign}
            format="currency"
          />
          <KPICard
            title="Taxa"
            value={spreadsheetMetrics?.taxaMedia ?? 0}
            icon={Percent}
            format="percentage"
          />
          <KPICard
            title="Valor Líquido"
            value={spreadsheetMetrics?.valorLiquidoTotal ?? 0}
            icon={DollarSign}
            format="currency"
          />
        </div>
      )}

      {/* Botão para Gerenciar Planilha - Apenas para Administradores */}
      {isAdmin() && user?.customerId && (
        <div className="flex justify-end">
          <button
            onClick={() => setShowSpreadsheetModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-semibold"
          >
            <FileSpreadsheet className="w-5 h-5" />
            {spreadsheetData ? 'Gerenciar Planilha' : 'Enviar Planilha'}
          </button>
        </div>
      )}

      {/* Seção de Planilha - Apenas para Clientes */}
      {isCustomer() && spreadsheetData && spreadsheetData.data && spreadsheetData.data.length > 0 && (
        <div className="bg-white border-2 border-black rounded-lg overflow-hidden">
          <div className="p-4 md:p-6 border-b-2 border-black">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="w-5 h-5 md:w-6 md:h-6 text-black" />
                <div>
                  <h2 className="text-lg md:text-xl font-bold text-black">Dados da Planilha</h2>
                  <p className="text-xs md:text-sm text-gray-600">
                    {spreadsheetData.fileName} • {new Date(spreadsheetData.uploadedAt).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </div>
              <span className="text-xs md:text-sm text-gray-500">
                {spreadsheetData.data.length} {spreadsheetData.data.length === 1 ? 'linha' : 'linhas'} • {spreadsheetData.headers.length} {spreadsheetData.headers.length === 1 ? 'coluna' : 'colunas'}
              </span>
            </div>
          </div>
          <div className="overflow-x-auto p-4 md:p-6">
            <div className="overflow-x-auto border-2 border-gray-200 rounded-lg">
              <table className="w-full min-w-full">
                <thead>
                  <tr className="bg-black text-white">
                    {spreadsheetData.headers.map((header, index) => (
                      <th
                        key={index}
                        className="text-left py-3 px-4 font-semibold text-sm whitespace-nowrap"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {spreadsheetData.data.map((row, rowIndex) => (
                    <tr
                      key={rowIndex}
                      className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50 hover:bg-gray-100'}
                    >
                      {spreadsheetData.headers.map((header, colIndex) => (
                        <td
                          key={colIndex}
                          className="py-3 px-4 text-sm text-gray-700 border-b border-gray-200"
                        >
                          {row[header] !== null && row[header] !== undefined
                            ? String(row[header])
                            : '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Vendas Recentes */}
      <div className="bg-white border-2 border-black rounded-lg overflow-hidden">
        <div className="p-4 md:p-6 border-b-2 border-black">
          <h2 className="text-lg md:text-xl font-bold text-black">Vendas Recentes</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-black text-white">
                <th className="text-left py-3 px-4 md:px-6 font-semibold text-sm md:text-base">Data</th>
                <th className="text-left py-3 px-4 md:px-6 font-semibold text-sm md:text-base">Produto</th>
                <th className="text-left py-3 px-4 md:px-6 font-semibold text-sm md:text-base">Cliente</th>
                <th className="text-left py-3 px-4 md:px-6 font-semibold text-sm md:text-base">Valor</th>
                <th className="text-left py-3 px-4 md:px-6 font-semibold text-sm md:text-base">Status</th>
              </tr>
            </thead>
            <tbody>
              {recentSales.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-500">
                    Nenhuma venda encontrada para esta maquininha
                  </td>
                </tr>
              ) : (
                recentSales.map((sale) => (
                  <tr key={sale.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="py-3 px-4 md:px-6 text-sm md:text-base text-gray-700">
                      {new Date(sale.date).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="py-3 px-4 md:px-6 text-sm md:text-base text-gray-700">{sale.product}</td>
                    <td className="py-3 px-4 md:px-6 text-sm md:text-base text-gray-700">{sale.customerName}</td>
                    <td className="py-3 px-4 md:px-6 text-sm md:text-base font-semibold text-black">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(sale.amount)}
                    </td>
                    <td className="py-3 px-4 md:px-6">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          sale.status === 'completed'
                            ? 'bg-green-100 text-green-800'
                            : sale.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {sale.status === 'completed'
                          ? 'Concluída'
                          : sale.status === 'pending'
                          ? 'Pendente'
                          : 'Cancelada'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Planilha - Apenas para Administradores */}
      {showSpreadsheetModal && isAdmin() && user?.customerId && (
        <CustomerSpreadsheet
          customerId={user.customerId}
          customerName={customerName || user.name || 'Cliente'}
          terminalId={terminalId}
          terminalName={terminal?.name || terminalId}
          onClose={() => {
            setShowSpreadsheetModal(false);
            // Recarregar dados após fechar o modal
            if (isCustomer() && user?.customerId && terminalId) {
              let spreadsheet = getSpreadsheetByTerminalId(terminalId, user.customerId);
              if (!spreadsheet) {
                spreadsheet = getSpreadsheetByCustomerId(user.customerId);
              }
              setSpreadsheetData(spreadsheet);
              if (spreadsheet && spreadsheet.data && spreadsheet.data.length > 0) {
                const metrics = calculateSpreadsheetMetrics(spreadsheet);
                // Buscar valores customizados específicos desta maquininha
                const customValues = getCustomerCardValues(user.customerId, terminalId);
                if (customValues) {
                  if (customValues.quantidadeVendas !== undefined) metrics.totalVendas = customValues.quantidadeVendas;
                  if (customValues.valorBruto !== undefined) metrics.valorBrutoTotal = customValues.valorBruto;
                  if (customValues.taxa !== undefined) metrics.taxaMedia = customValues.taxa;
                  if (customValues.valorLiquido !== undefined) metrics.valorLiquidoTotal = customValues.valorLiquido;
                }
                setSpreadsheetMetrics(metrics);
              } else {
                setSpreadsheetMetrics(null);
              }
            }
          }}
        />
      )}
    </div>
  );
};

export default TerminalDashboard;

