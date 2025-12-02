import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  DollarSign, 
  ShoppingCart, 
  FileSpreadsheet,
  Percent
} from 'lucide-react';
import KPICard from '../components/KPICard';
import FilterBar from '../components/FilterBar';
import { useAuth } from '../context/AuthContext';
import { getSales } from '../services/salesService';
import { getCustomerById } from '../services/customerService';
import { getSpreadsheetByCustomerId, getSpreadsheetByTerminalId, getSpreadsheetsByCustomerId, SpreadsheetData, calculateSpreadsheetMetrics, calculateAggregatedMetrics } from '../services/spreadsheetService';
import CustomerSpreadsheet from '../components/CustomerSpreadsheet';
import { getCustomerTax } from '../services/customerTaxService';
import { getCustomerCardValues } from '../services/customerCardValuesService';
import { FilterOptions, Sale } from '../types';

const Dashboard = () => {
  const { user, isCustomer, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [recentSales, setRecentSales] = useState<Sale[]>([]);
  const [filters, setFilters] = useState<FilterOptions>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [customerTerminals, setCustomerTerminals] = useState<Array<{ id: string; terminalId: string; name?: string }>>([]);
  const [selectedTerminalId, setSelectedTerminalId] = useState<string>('all'); // 'all' para todas as maquininhas
  const [spreadsheetData, setSpreadsheetData] = useState<SpreadsheetData | null>(null);
  const [spreadsheetMetrics, setSpreadsheetMetrics] = useState<any>(null);
  const [showSpreadsheetModal, setShowSpreadsheetModal] = useState(false);
  const [selectedTerminalForUpload, setSelectedTerminalForUpload] = useState<string | null>(null);

  // Se for cliente, carregar suas maquininhas e planilha
  // Atualizar automaticamente quando a planilha for reimportada
  useEffect(() => {
    if (!isCustomer() || !user?.customerId) {
      return;
    }

    let isMounted = true;
    // Usar objeto para garantir que o hash seja compartilhado entre renderizações
    const hashRef = { current: '' };

    const loadCustomerData = async () => {
      if (!isCustomer() || !user?.customerId || !isMounted) return;
      
      try {
        const customer = await getCustomerById(user.customerId);
        if (!customer || !isMounted) return;
        
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
        
        setCustomerTerminals(prev => {
          // Só atualizar se mudou
          const prevStr = JSON.stringify(prev);
          const newStr = JSON.stringify(terminals);
          return prevStr === newStr ? prev : terminals;
        });
        
        // Carregar planilha baseado na seleção
        let spreadsheet: SpreadsheetData | null = null;
        let metrics: any = null;
        
        if (selectedTerminalId === 'all') {
          // Se "Todas" estiver selecionado, buscar todas as planilhas do cliente e agregar
          const allSpreadsheets = getSpreadsheetsByCustomerId(user.customerId);
          if (allSpreadsheets.length > 0) {
            // Se houver apenas uma planilha (sem terminalId), usar ela
            const generalSpreadsheet = allSpreadsheets.find(s => !s.terminalId);
            if (generalSpreadsheet) {
              spreadsheet = generalSpreadsheet;
              metrics = calculateSpreadsheetMetrics(generalSpreadsheet);
            } else {
              // Se houver múltiplas planilhas de terminais, agregar métricas
              metrics = calculateAggregatedMetrics(allSpreadsheets);
              // Usar a primeira planilha para exibição (ou criar uma planilha agregada)
              spreadsheet = allSpreadsheets[0];
            }
          }
        } else {
          // Se uma maquininha específica estiver selecionada, buscar sua planilha
          spreadsheet = getSpreadsheetByTerminalId(selectedTerminalId, user.customerId);
          if (!spreadsheet) {
            // Se não encontrar planilha da maquininha, tentar planilha geral do cliente
            spreadsheet = getSpreadsheetByCustomerId(user.customerId);
          }
          if (spreadsheet && spreadsheet.data && spreadsheet.data.length > 0) {
            metrics = calculateSpreadsheetMetrics(spreadsheet);
          }
        }
        
        // Obter taxa atual do cliente para incluir no hash
        const customerTax = getCustomerTax(user.customerId);
        
        // Criar hash simples que detecta mudanças essenciais
        // Hash inclui: data de upload, quantidade de linhas, taxa atual e terminal selecionado
        const currentHash = spreadsheet 
          ? `${spreadsheet.uploadedAt}-${spreadsheet.data?.length || 0}-${customerTax || 'null'}-${selectedTerminalId}` 
          : '';
        
        // SEMPRE atualizar dados e recalcular métricas para garantir sincronização 100%
        setSpreadsheetData(spreadsheet);
        if (metrics) {
          // Verificar se há valores customizados dos cards definidos pelo admin
          // Se uma maquininha específica estiver selecionada, buscar valores específicos dela
          const terminalIdForValues = selectedTerminalId !== 'all' ? selectedTerminalId : undefined;
          const customValues = getCustomerCardValues(user.customerId, terminalIdForValues);
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
        
        // Se tiver apenas uma maquininha e não estiver já na página do terminal, redirecionar
        if (terminals.length === 1 && !window.location.pathname.includes('/terminal/')) {
          navigate(`/terminal/${terminals[0].terminalId}`, { replace: true });
          return;
        }
      } catch (err) {
        console.error('Erro ao carregar dados do cliente:', err);
      }
    };
    
    // Carregar imediatamente
    loadCustomerData();
    
    // Atualizar automaticamente a cada 5 segundos (reduzido de 2 para melhor performance)
    const interval = setInterval(() => {
      if (isMounted) {
        loadCustomerData();
      }
    }, 5000);
    
    // Escutar evento de atualização da planilha para atualização imediata
    const handleSpreadsheetUpdate = (event: CustomEvent) => {
      const eventTerminalId = event.detail?.terminalId;
      const eventCustomerId = event.detail?.customerId;
      
      // Atualizar se for do mesmo cliente E (mesmo terminal OU não especificou terminal OU está em "all")
      if (eventCustomerId === user?.customerId && isMounted) {
        if (!eventTerminalId || eventTerminalId === selectedTerminalId || selectedTerminalId === 'all') {
          // Forçar atualização imediata, resetando o hash para garantir recálculo
          hashRef.current = '';
          loadCustomerData();
        }
      }
    };
    
    // Escutar evento de atualização dos valores dos cards
    const handleCardValuesUpdate = (event: CustomEvent) => {
      const eventTerminalId = event.detail?.terminalId;
      const eventCustomerId = event.detail?.customerId;
      
      // Atualizar se for do mesmo cliente E (mesmo terminal OU não especificou terminal OU está em "all")
      if (eventCustomerId === user?.customerId && isMounted) {
        if (!eventTerminalId || eventTerminalId === selectedTerminalId || selectedTerminalId === 'all') {
          // Forçar atualização imediata quando valores dos cards são alterados
          hashRef.current = '';
          loadCustomerData();
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
  }, [isCustomer, user?.customerId, selectedTerminalId]);

  const handleFilterChange = useCallback((newFilters: FilterOptions) => {
    setFilters(prevFilters => {
      // Comparação profunda para evitar atualizações desnecessárias
      const prevStr = JSON.stringify(prevFilters);
      const newStr = JSON.stringify(newFilters);
      if (prevStr === newStr) {
        return prevFilters;
      }
      return newFilters;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    
    const loadData = async () => {
      // Não carregar dados de vendas se for cliente (eles veem apenas a planilha)
      if (isCustomer()) {
        setIsLoading(false);
        return;
      }
      
      setIsLoading(true);
      setError(null);
      try {
        // Se for cliente, filtrar apenas vendas de suas maquininhas
        let effectiveFilters = { ...filters };
        
        if (isCustomer() && customerTerminals.length > 0) {
          // Filtrar vendas por todas as maquininhas do cliente
          // Como não temos filtro múltiplo, vamos filtrar depois
          effectiveFilters = filters;
        }
        
        const salesData = await getSales(effectiveFilters);

        // Se for cliente, filtrar vendas apenas das suas maquininhas
        let filteredSales = salesData;
        if (isCustomer() && customerTerminals.length > 0) {
          const terminalIds = customerTerminals.map(t => t.terminalId);
          
          // Se uma maquininha específica foi selecionada, filtrar por ela
          if (selectedTerminalId !== 'all') {
            filteredSales = salesData.filter(sale => 
              sale.customerId === user?.customerId && 
              sale.cieloTerminalId === selectedTerminalId
            );
          } else {
            // Se "todas" foi selecionado, mostrar todas as maquininhas do cliente
            filteredSales = salesData.filter(sale => 
              sale.customerId === user?.customerId || 
              (sale.cieloTerminalId && terminalIds.includes(sale.cieloTerminalId))
            );
          }
          
          if (!cancelled) {
            setRecentSales(filteredSales.slice(0, 10));
          }
          return;
        }

        if (!cancelled) {
          setRecentSales((salesData || []).slice(0, 10));
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Erro ao carregar dados do dashboard:', err);
          setError('Erro ao carregar dados. Tente novamente.');
          setRecentSales([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    // Só carregar dados de vendas se não for cliente
    if (!isCustomer()) {
      loadData();
    } else {
      setIsLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, [filters, isCustomer, customerTerminals, user, selectedTerminalId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-black"></div>
      </div>
    );
  }

  return (
    <div className="space-y-3 md:space-y-4 lg:space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-black mb-1 md:mb-2">
          {isCustomer() ? 'Meu Dashboard' : 'Dashboard de Vendas'}
        </h1>
        <p className="text-xs md:text-sm lg:text-base text-gray-600">
          {isCustomer() 
            ? 'Visão geral das suas vendas e métricas' 
            : 'Visão geral das vendas e métricas da BR FINTECH'}
        </p>
        {isCustomer() && customerTerminals.length > 0 && (
          <div className="mt-4 bg-gray-50 border-2 border-gray-200 rounded-lg p-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-black mb-2">
                  Selecionar Maquininha
                </label>
                <select
                  value={selectedTerminalId}
                  onChange={(e) => setSelectedTerminalId(e.target.value)}
                  className="w-full md:w-auto px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-black transition-colors bg-white"
                >
                  <option value="all">Todas as Maquininhas</option>
                  {customerTerminals.map((term) => (
                    <option key={term.id} value={term.terminalId}>
                      {term.name || term.terminalId}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-2">
                  Escolha qual maquininha deseja visualizar ou selecione "Todas" para ver dados agregados.
                </p>
              </div>
              {/* Botões de upload apenas para administradores */}
              {isAdmin() && (
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setSelectedTerminalForUpload(null);
                      setShowSpreadsheetModal(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-semibold text-sm"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    {spreadsheetData ? 'Gerenciar Planilha' : 'Enviar Planilha'}
                  </button>
                  {customerTerminals.length > 1 && (
                    <button
                      onClick={() => {
                        const terminal = customerTerminals.find(t => t.terminalId === selectedTerminalId && selectedTerminalId !== 'all');
                        if (terminal) {
                          setSelectedTerminalForUpload(terminal.terminalId);
                          setShowSpreadsheetModal(true);
                        }
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors font-semibold text-sm"
                      disabled={selectedTerminalId === 'all'}
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      Planilha da Maquininha
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
        {error && (
          <div className="mt-4 bg-red-50 border-2 border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}
      </div>

      {!isCustomer() && (
        <FilterBar
          onFilterChange={handleFilterChange}
        />
      )}


      {/* KPI Cards da Planilha - Apenas para Clientes */}
      {/* Ordem: Quantidade de Vendas, Valor Bruto, Taxa, Valor Líquido */}
      {isCustomer() && spreadsheetData && spreadsheetData.data && spreadsheetData.data.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 lg:gap-4">
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

      {/* Seção de Planilha - Apenas para Clientes */}
      {isCustomer() && spreadsheetData && spreadsheetData.data && spreadsheetData.data.length > 0 && (
        <div className="bg-white border-2 border-black rounded-lg p-3 md:p-4 lg:p-6 overflow-x-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="w-5 h-5 md:w-6 md:h-6 text-black" />
              <div>
                <h3 className="text-sm md:text-base lg:text-lg font-semibold text-black">Dados da Planilha</h3>
                <p className="text-xs md:text-sm text-gray-600">
                  {spreadsheetData.fileName} • {new Date(spreadsheetData.uploadedAt).toLocaleDateString('pt-BR')}
                </p>
              </div>
            </div>
            <span className="text-xs md:text-sm text-gray-500">
              {spreadsheetData.data.length} {spreadsheetData.data.length === 1 ? 'linha' : 'linhas'} • {spreadsheetData.headers.length} {spreadsheetData.headers.length === 1 ? 'coluna' : 'colunas'}
            </span>
          </div>
          
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
      )}

      {/* Tabela de Vendas Recentes */}
      <div className="bg-white border-2 border-black rounded-lg p-3 md:p-4 lg:p-6 overflow-x-auto">
        <h3 className="text-sm md:text-base lg:text-lg font-semibold text-black mb-2 md:mb-3 lg:mb-4">Vendas Recentes</h3>
        {recentSales.length === 0 ? (
          <div className="text-center py-8 md:py-12">
            <ShoppingCart className="w-12 h-12 md:w-16 md:h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 text-base md:text-lg font-medium mb-2">Nenhuma venda registrada</p>
            <p className="text-gray-500 text-xs md:text-sm px-4">O dashboard está pronto para uso. As vendas aparecerão aqui quando forem cadastradas.</p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-4 md:mx-0">
            <div className="inline-block min-w-full align-middle">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr className="border-b-2 border-black">
                    <th className="text-left py-2 md:py-3 px-2 md:px-4 text-xs md:text-sm font-semibold text-black whitespace-nowrap">Data</th>
                    <th className="text-left py-2 md:py-3 px-2 md:px-4 text-xs md:text-sm font-semibold text-black whitespace-nowrap">Cliente</th>
                    <th className="text-left py-2 md:py-3 px-2 md:px-4 text-xs md:text-sm font-semibold text-black whitespace-nowrap">Produto</th>
                    <th className="text-left py-2 md:py-3 px-2 md:px-4 text-xs md:text-sm font-semibold text-black whitespace-nowrap hidden md:table-cell">Região</th>
                    <th className="text-left py-2 md:py-3 px-2 md:px-4 text-xs md:text-sm font-semibold text-black whitespace-nowrap">Valor</th>
                    <th className="text-left py-2 md:py-3 px-2 md:px-4 text-xs md:text-sm font-semibold text-black whitespace-nowrap">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {recentSales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-2 md:py-3 px-2 md:px-4 text-xs md:text-sm text-gray-700 whitespace-nowrap">
                        {new Date(sale.date).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="py-2 md:py-3 px-2 md:px-4 text-xs md:text-sm text-gray-700 truncate max-w-[120px] md:max-w-none">
                        {sale.customerName}
                      </td>
                      <td className="py-2 md:py-3 px-2 md:px-4 text-xs md:text-sm text-gray-700 truncate max-w-[100px] md:max-w-none">
                        {sale.product}
                      </td>
                      <td className="py-2 md:py-3 px-2 md:px-4 text-xs md:text-sm text-gray-700 whitespace-nowrap hidden md:table-cell">
                        {sale.region}
                      </td>
                      <td className="py-2 md:py-3 px-2 md:px-4 text-xs md:text-sm font-semibold text-black whitespace-nowrap">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(sale.amount)}
                      </td>
                      <td className="py-2 md:py-3 px-2 md:px-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 rounded text-xs font-semibold ${
                            sale.status === 'completed'
                              ? 'bg-green-100 text-green-800'
                              : sale.status === 'pending'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {sale.status === 'completed' ? 'Concluída' : sale.status === 'pending' ? 'Pendente' : 'Cancelada'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Planilha - Apenas para Administradores */}
      {showSpreadsheetModal && isAdmin() && user?.customerId && (
        <CustomerSpreadsheet
          customerId={user.customerId}
          customerName={user.name || 'Cliente'}
          terminalId={selectedTerminalForUpload || undefined}
          terminalName={selectedTerminalForUpload 
            ? customerTerminals.find(t => t.terminalId === selectedTerminalForUpload)?.name || selectedTerminalForUpload
            : undefined}
          onClose={() => {
            setShowSpreadsheetModal(false);
            setSelectedTerminalForUpload(null);
            // Recarregar dados após fechar o modal
            if (isCustomer() && user?.customerId) {
              let spreadsheet: SpreadsheetData | null = null;
              let metrics: any = null;
              
              if (selectedTerminalId === 'all') {
                const allSpreadsheets = getSpreadsheetsByCustomerId(user.customerId);
                if (allSpreadsheets.length > 0) {
                  const generalSpreadsheet = allSpreadsheets.find(s => !s.terminalId);
                  if (generalSpreadsheet) {
                    spreadsheet = generalSpreadsheet;
                    metrics = calculateSpreadsheetMetrics(generalSpreadsheet);
                  } else {
                    metrics = calculateAggregatedMetrics(allSpreadsheets);
                    spreadsheet = allSpreadsheets[0];
                  }
                }
              } else {
                spreadsheet = getSpreadsheetByTerminalId(selectedTerminalId, user.customerId);
                if (!spreadsheet) {
                  spreadsheet = getSpreadsheetByCustomerId(user.customerId);
                }
                if (spreadsheet && spreadsheet.data && spreadsheet.data.length > 0) {
                  metrics = calculateSpreadsheetMetrics(spreadsheet);
                }
              }
              
              setSpreadsheetData(spreadsheet);
              if (metrics) {
                // Buscar valores customizados específicos da maquininha selecionada
                const terminalIdForValues = selectedTerminalId !== 'all' ? selectedTerminalId : undefined;
                const customValues = getCustomerCardValues(user.customerId, terminalIdForValues);
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

export default Dashboard;

