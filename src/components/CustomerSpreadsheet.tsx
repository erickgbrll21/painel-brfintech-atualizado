import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, X, Download, Trash2, Check, Eye } from 'lucide-react';
import { getSpreadsheetByCustomerId, getSpreadsheetByTerminalId, saveSpreadsheet, deleteSpreadsheet, SpreadsheetData, parseSpreadsheetToSales } from '../services/spreadsheetService';
import { useAuth } from '../context/AuthContext';

interface CustomerSpreadsheetProps {
  customerId: string;
  customerName: string;
  terminalId?: string; // ID da maquininha (opcional)
  terminalName?: string; // Nome da maquininha (opcional)
  onClose: () => void;
}

const CustomerSpreadsheet = ({ customerId, customerName, terminalId, terminalName, onClose }: CustomerSpreadsheetProps) => {
  const { isAdmin } = useAuth();
  const [spreadsheetData, setSpreadsheetData] = useState<SpreadsheetData | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<SpreadsheetData | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const loadSpreadsheet = () => {
    const data = terminalId 
      ? getSpreadsheetByTerminalId(terminalId, customerId)
      : getSpreadsheetByCustomerId(customerId);
    setSpreadsheetData(data);
  };

  useEffect(() => {
    let lastHash = '';
    
    const checkAndLoadSpreadsheet = () => {
      const data = terminalId 
        ? getSpreadsheetByTerminalId(terminalId, customerId)
        : getSpreadsheetByCustomerId(customerId);
      const currentHash = data 
        ? `${data.uploadedAt}-${data.data?.length || 0}` 
        : '';
      
      // Só atualizar se mudou
      if (currentHash !== lastHash) {
        setSpreadsheetData(data);
        lastHash = currentHash;
      }
    };
    
    checkAndLoadSpreadsheet();
    
    // Recarregar a cada 5 segundos (reduzido de 2 para melhor performance)
    const interval = setInterval(() => {
      checkAndLoadSpreadsheet();
    }, 5000);
    
    return () => clearInterval(interval);
  }, [customerId]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    // Verificar se é administrador antes de permitir upload
    if (!isAdmin()) {
      setError('Apenas administradores podem fazer upload de planilhas.');
      return;
    }
    const file = event.target.files?.[0];
    if (!file) return;

    // Verificar se é um arquivo Excel
    const validExtensions = ['.xlsx', '.xls'];
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    
    if (!validExtensions.includes(fileExtension)) {
      setError('Por favor, selecione um arquivo Excel (.xlsx ou .xls)');
      return;
    }

    // Validar tamanho máximo (5MB)
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB em bytes
    if (file.size > MAX_FILE_SIZE) {
      setError('O arquivo excede o tamanho máximo permitido de 5MB');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          
          // Pegar a primeira planilha
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          
          // Converter para JSON - LER TODA A ESTRUTURA COMPLETA DA PLANILHA
          // Usar range completo da planilha para garantir que nenhuma célula seja ignorada
          let maxRangeColumns = 0;
          try {
            if (worksheet['!ref']) {
              const range = XLSX.utils.decode_range(worksheet['!ref']);
              maxRangeColumns = range.e.c + 1; // Número de colunas do range da planilha
            }
          } catch (e) {
            // Se não conseguir decodificar o range, continuar sem ele
            console.warn('Não foi possível decodificar o range da planilha:', e);
          }
          
          // Usar defval: '' para garantir que todas as células sejam lidas
          // raw: true para preservar valores numéricos exatos da planilha
          // blankrows: true para não pular linhas vazias
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
            header: 1, 
            defval: '',
            raw: true, // Preservar valores numéricos originais da planilha
            blankrows: true // NÃO pular linhas vazias - manter TODAS as linhas
          });
          
          if (jsonData.length === 0) {
            setError('A planilha está vazia');
            setIsUploading(false);
            return;
          }

          // Primeira linha são os cabeçalhos
          const headerRow = jsonData[0] as any[] || [];
          
          // Definir APENAS as 12 colunas permitidas (estas são as únicas que serão lidas)
          // Mapeamento exato das colunas permitidas com suas variações possíveis
          // Expandido para cobrir mais variações de formatação
          const colunasPermitidasMap: Record<string, string[]> = {
            // 1. Data da venda
            'dataVenda': [
              'data da venda', 'data venda', 'data de venda', 'data venda', 
              'data_da_venda', 'data_venda', 'data_de_venda',
              'datavenda', 'datadavenda'
            ],
            // 2. Hora da venda
            'horaVenda': [
              'hora da venda', 'hora venda', 'hora de venda', 
              'horario', 'horário', 'hora', 'hora venda',
              'hora_da_venda', 'hora_venda', 'hora_de_venda',
              'horavenda', 'horadavenda'
            ],
            // 3. Estabelecimento
            'estabelecimento': [
              'estabelecimento', 'nome estabelecimento', 'estabelecimento nome',
              'estabelecimento_nome', 'nome_estabelecimento',
              'estabelecimentonome'
            ],
            // 4. CPF/CNPJ do estabelecimento
            'cpfCnpj': [
              'cpf/cnpj do estabelecimento', 'cpf cnpj estabelecimento', 
              'cpf/cnpj', 'cpf cnpj', 'cpfcnpj', 'cpf_cnpj',
              'cpf/cnpj do estabelecimento', 'cpfcnpj estabelecimento',
              'cpf_cnpj_estabelecimento', 'cpfcnpjestabelecimento'
            ],
            // 5. Forma de pagamento
            'formaPagamento': [
              'forma de pagamento', 'forma pagamento', 'formapagamento',
              'forma_de_pagamento', 'forma_pagamento',
              'tipo pagamento', 'tipo de pagamento', 'tipopagamento'
            ],
            // 6. Quantidade total de parcelas
            'quantidadeParcelas': [
              'quantidade total de parcelas', 'quantidade parcelas', 
              'total parcelas', 'qtd parcelas', 'qtd total parcelas',
              'quantidade_total_de_parcelas', 'quantidade_parcelas',
              'total_parcelas', 'qtd_parcelas', 'parcelas'
            ],
            // 7. Bandeira
            'bandeira': [
              'bandeira', 'bandeira cartão', 'bandeira cartao', 
              'bandeira_cartao', 'bandeira_cartão',
              'bandeiracartao', 'bandeiracartão'
            ],
            // 8. Valor bruto
            'valorBruto': [
              'valor bruto', 'valor_bruto', 'valorbruto',
              'valor bruto total', 'valor_bruto_total'
            ],
            // 9. Status da venda
            'statusVenda': [
              'status da venda', 'status venda', 'status de venda',
              'status_da_venda', 'status_venda', 'status_de_venda',
              'statusvenda', 'statusdavenda',
              'situação', 'situacao', 'situação da venda'
            ],
            // 10. Tipo de lançamento
            'tipoLancamento': [
              'tipo de lançamento', 'tipo lançamento', 'tipo lancamento', 
              'tipo de lancamento', 'tipolancamento',
              'tipo_de_lancamento', 'tipo_lancamento',
              'lançamento', 'lancamento', 'tipo lancamento'
            ],
            // 11. Data do lançamento
            'dataLancamento': [
              'data do lançamento', 'data lançamento', 'data lancamento', 
              'data de lançamento', 'data de lancamento',
              'data_do_lancamento', 'data_lancamento', 'data_de_lancamento',
              'datalancamento', 'datadolancamento'
            ],
            // 12. Número da máquina
            'numeroMaquina': [
              'número da máquina', 'numero da maquina', 'número máquina', 
              'numero maquina', 'num máquina', 'num maquina',
              'numero_da_maquina', 'numero_maquina', 'num_maquina',
              'numeromaquina', 'numerodamaquina',
              'máquina', 'maquina', 'numero maquina'
            ]
          };
          
          // Criar lista plana de todas as variações para matching
          const colunasPermitidas: string[] = [];
          Object.values(colunasPermitidasMap).forEach(variacoes => {
            colunasPermitidas.push(...variacoes);
          });
          
          // Função para normalizar nome da coluna (remove acentos, caracteres especiais, espaços extras)
          const normalizeColName = (name: string): string => {
            return String(name || '').toLowerCase().trim()
              .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
              .replace(/[^\w\s]/g, ' ')
              .replace(/\s+/g, ' ')
              .trim();
          };
          
          // Criar conjunto de nomes normalizados permitidos para comparação rápida
          const colunasPermitidasNormalizadas = new Set(
            colunasPermitidas.map(c => normalizeColName(c))
          );
          
          // Definir palavras-chave para matching flexível
          const palavrasChave: Record<string, string[][]> = {
            'dataVenda': [['data'], ['venda']],
            'horaVenda': [['hora'], ['venda']],
            'estabelecimento': [['estabelecimento']],
            'cpfCnpj': [['cpf'], ['cnpj'], ['cpf', 'cnpj']],
            'formaPagamento': [['forma'], ['pagamento']],
            'quantidadeParcelas': [['quantidade'], ['parcelas'], ['parcela']],
            'bandeira': [['bandeira']],
            'valorBruto': [['valor'], ['bruto']],
            'statusVenda': [['status'], ['venda']],
            'tipoLancamento': [['tipo'], ['lancamento'], ['lançamento']],
            'dataLancamento': [['data'], ['lancamento'], ['lançamento']],
            'numeroMaquina': [['numero'], ['maquina'], ['máquina'], ['num'], ['maquina']]
          };
          
          // Mapear índices das colunas permitidas
          // Usar Map para garantir ordem e evitar duplicatas
          const colunasMap: Map<number, { headerName: string; key: string }> = new Map();
          const headersPermitidos: string[] = [];
          const colunasEncontradas = new Set<string>(); // Para evitar duplicatas
          
          console.log('=== PROCESSAMENTO DE COLUNAS ===');
          console.log('Total de colunas na planilha:', headerRow.length);
          console.log('Colunas encontradas na planilha:', headerRow.map((h, i) => `${i}: "${String(h || '').trim()}"`));
          console.log('Colunas esperadas (12):', Object.keys(colunasPermitidasMap));
          
          // Processar cada coluna da planilha
          headerRow.forEach((headerValue, index) => {
            if (headerValue !== undefined && headerValue !== null) {
              const headerName = String(headerValue).trim();
              if (!headerName) return;
              
              const normalized = normalizeColName(headerName);
              
              // Verificar se corresponde a alguma das 12 colunas permitidas
              let colunaEncontrada: { key: string; variacao: string } | null = null;
              
              // Buscar em cada uma das 12 colunas permitidas
              for (const [key, variacoes] of Object.entries(colunasPermitidasMap)) {
                for (const variacao of variacoes) {
                  const normalizedVariacao = normalizeColName(variacao);
                  
                  // 1. Match exato (mais preciso)
                  if (normalized === normalizedVariacao) {
                    colunaEncontrada = { key, variacao };
                    break;
                  }
                  
                  // 2. Match parcial: verificar se todas as palavras principais estão presentes
                  const palavrasVariacao = normalizedVariacao.split(' ').filter(p => p.length > 2);
                  const palavrasHeader = normalized.split(' ').filter(p => p.length > 2);
                  
                  // Aceitar se todas as palavras principais estiverem presentes
                  if (palavrasVariacao.length > 0 && palavrasVariacao.every(p => palavrasHeader.includes(p))) {
                    colunaEncontrada = { key, variacao };
                    break;
                  }
                  
                  // 3. Match por palavras-chave importantes (mais flexível)
                  const chavesEsperadas = palavrasChave[key];
                  if (chavesEsperadas) {
                    // Verificar se pelo menos um conjunto de palavras-chave está presente
                    const matchChaves = chavesEsperadas.some(conjunto => 
                      conjunto.every(palavra => normalized.includes(normalizeColName(palavra)))
                    );
                    
                    if (matchChaves) {
                      colunaEncontrada = { key, variacao };
                      break;
                    }
                  }
                }
                
                if (colunaEncontrada) break;
              }
              
              if (colunaEncontrada && !colunasEncontradas.has(colunaEncontrada.key)) {
                // Coluna permitida encontrada e ainda não foi mapeada
                colunasMap.set(index, { headerName, key: colunaEncontrada.key });
                headersPermitidos.push(headerName);
                colunasEncontradas.add(colunaEncontrada.key);
                console.log(`✓ Coluna permitida encontrada: "${headerName}" → ${colunaEncontrada.key}`);
              } else if (colunaEncontrada && colunasEncontradas.has(colunaEncontrada.key)) {
                // Coluna já foi encontrada antes (duplicata)
                console.log(`⚠ Coluna duplicada IGNORADA: "${headerName}" (já existe ${colunaEncontrada.key})`);
              } else {
                // Coluna não permitida - IGNORAR
                console.log(`✗ Coluna IGNORADA: "${headerName}" (normalizada: "${normalized}")`);
                // Mostrar sugestões de colunas próximas para debug
                const palavrasHeader = normalized.split(' ').filter(p => p.length > 2);
                const colunasProximas = Object.keys(colunasPermitidasMap).filter(key => {
                  const chaves = palavrasChave[key];
                  if (!chaves) return false;
                  return chaves.some(conjunto => 
                    conjunto.some(palavra => palavrasHeader.includes(normalizeColName(palavra)))
                  );
                });
                if (colunasProximas.length > 0) {
                  console.log(`   Sugestão: pode ser uma das colunas: ${colunasProximas.join(', ')}`);
                }
              }
            }
          });
          
          console.log(`=== RESULTADO ===`);
          console.log(`Total de colunas permitidas encontradas: ${headersPermitidos.length} de 12 esperadas`);
          console.log('Colunas encontradas:', Array.from(colunasEncontradas));
          console.log('Headers mapeados:', headersPermitidos);
          
          // Validar que encontramos pelo menos algumas colunas essenciais
          if (headersPermitidos.length === 0) {
            setError('Nenhuma coluna permitida encontrada na planilha. O sistema deve ler APENAS as seguintes 12 colunas: 1) Data da venda, 2) Hora da venda, 3) Estabelecimento, 4) CPF/CNPJ do estabelecimento, 5) Forma de pagamento, 6) Quantidade total de parcelas, 7) Bandeira, 8) Valor bruto, 9) Status da venda, 10) Tipo de lançamento, 11) Data do lançamento, 12) Número da máquina. Qualquer outra coluna será ignorada.');
            setIsUploading(false);
            return;
          }
          
          // Processar TODAS as linhas (sem pular nenhuma)
          // Garantir que todas as linhas sejam processadas, mesmo as vazias
          const rows = jsonData.slice(1)
            .map((row: any[], rowIndex: number) => {
            const obj: Record<string, any> = {};
              // Processar APENAS colunas permitidas (ignorar todas as outras)
              colunasMap.forEach(({ headerName }, colIndex) => {
                // Ler valor da célula - preservar valor original (não converter)
                const value = row && row[colIndex] !== undefined ? row[colIndex] : '';
                // Preservar valor exato da planilha (não converter tipos)
                obj[headerName] = value !== undefined && value !== null ? value : '';
            });
            return obj;
          });
          
          // NÃO filtrar linhas vazias - manter TODAS as linhas da planilha
          // Isso garante que nenhuma linha seja ignorada
          console.log(`Total de linhas processadas: ${rows.length} (incluindo linhas vazias)`);
          
          // Usar APENAS os headers permitidos (ignorar todas as outras colunas)
          const headers = headersPermitidos;
          
          console.log(`Planilha processada: ${rows.length} linhas, ${headers.length} colunas permitidas`);

          // Processar vendas estruturadas
          const sales = parseSpreadsheetToSales(rows, headers, customerId);

          const spreadsheet: SpreadsheetData = {
            customerId,
            terminalId: terminalId || undefined,
            fileName: file.name,
            uploadedAt: new Date().toISOString(),
            data: rows,
            headers,
            sales,
          };

          // Mostrar prévia antes de salvar
          setPreviewData(spreadsheet);
          setShowPreview(true);
          setIsUploading(false);
        } catch (err) {
          console.error('Erro ao processar planilha:', err);
          setError('Erro ao processar a planilha. Verifique se o arquivo está no formato correto.');
          setIsUploading(false);
        }
      };

      reader.onerror = () => {
        setError('Erro ao ler o arquivo');
        setIsUploading(false);
      };

      reader.readAsBinaryString(file);
    } catch (err) {
      console.error('Erro ao fazer upload:', err);
      setError('Erro ao fazer upload do arquivo');
      setIsUploading(false);
    }
  };

  const handleDelete = () => {
    // Verificar se é administrador antes de permitir exclusão
    if (!isAdmin()) {
      setError('Apenas administradores podem excluir planilhas.');
      return;
    }
    
    if (window.confirm('Tem certeza que deseja excluir esta planilha?')) {
      deleteSpreadsheet(customerId, terminalId);
      setSpreadsheetData(null);
    }
  };

  const handleConfirmSave = () => {
    if (!previewData) return;
    
    try {
      saveSpreadsheet(previewData);
      setSpreadsheetData(previewData);
      setPreviewData(null);
      setShowPreview(false);
      
      // Disparar evento customizado para atualizar dashboards em tempo real
      // Usar setTimeout para garantir que o localStorage foi atualizado
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('spreadsheetUpdated', { 
          detail: { 
            customerId: previewData.customerId, 
            terminalId: previewData.terminalId,
            forceUpdate: true 
          } 
        }));
      }, 100);
    } catch (error) {
      console.error('Erro ao salvar planilha:', error);
      setError('Erro ao salvar a planilha. Tente novamente.');
    }
  };

  const handleCancelPreview = () => {
    setPreviewData(null);
    setShowPreview(false);
    setIsUploading(false);
  };

  const handleDownload = () => {
    if (!spreadsheetData) return;

    // Criar workbook
    const wb = XLSX.utils.book_new();
    const wsData = [
      spreadsheetData.headers,
      ...spreadsheetData.data.map(row => spreadsheetData.headers.map(header => row[header] || ''))
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, 'Planilha');

    // Download
    XLSX.writeFile(wb, spreadsheetData.fileName || `planilha_${customerName}.xlsx`);
  };

  return (
    <>
      {/* Modal de Prévia */}
      {showPreview && previewData && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg border-2 border-black w-full max-w-5xl max-h-[85vh] flex flex-col">
            {/* Header da Prévia */}
            <div className="flex items-center justify-between p-4 md:p-6 border-b-2 border-black">
              <div className="flex items-center gap-3">
                <Eye className="w-6 h-6 md:w-8 md:h-8 text-black" />
                <div>
                  <h2 className="text-lg md:text-xl font-bold text-black">Prévia dos Dados</h2>
                  <p className="text-sm text-gray-600">
                    {previewData.fileName} • {previewData.data.length} linhas • {previewData.headers.length} colunas
                  </p>
                </div>
              </div>
              <button
                onClick={handleCancelPreview}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 md:w-6 md:h-6 text-black" />
              </button>
            </div>

            {/* Conteúdo da Prévia */}
            <div className="flex-1 overflow-auto p-4 md:p-6">
              <div className="mb-4 p-3 bg-blue-50 border-2 border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800 font-medium">
                  Revise os dados abaixo antes de salvar. Esta planilha será vinculada ao cliente <strong>{customerName}</strong>.
                </p>
              </div>

              {/* Tabela de Prévia - Todas as Colunas */}
              <div className="overflow-x-auto border-2 border-black rounded-lg mb-4">
                <table className="w-full min-w-full">
                  <thead>
                    <tr className="bg-black text-white">
                      {previewData.headers.map((header, index) => (
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
                    {previewData.data.slice(0, 10).map((row, rowIndex) => (
                      <tr
                        key={rowIndex}
                        className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                      >
                        {previewData.headers.map((header, colIndex) => (
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

              {previewData.data.length > 10 && (
                <p className="text-sm text-gray-600 mb-4 text-center">
                  Mostrando as primeiras 10 linhas de {previewData.data.length} totais
                </p>
              )}

              {/* Botões de Ação */}
              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={handleConfirmSave}
                  className="flex-1 flex items-center justify-center gap-2 bg-black text-white py-3 rounded-lg font-semibold hover:bg-gray-800 transition-colors"
                >
                  <Check className="w-5 h-5" />
                  Confirmar e Salvar
                </button>
                <button
                  onClick={handleCancelPreview}
                  className="flex-1 bg-gray-200 text-black py-3 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Principal */}
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg border-2 border-black w-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 md:p-6 border-b-2 border-black">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="w-6 h-6 md:w-8 md:h-8 text-black" />
            <div>
              <h2 className="text-lg md:text-xl font-bold text-black">
                Planilha - {terminalName ? `${terminalName} (${customerName})` : customerName}
              </h2>
              {spreadsheetData && (
                <p className="text-sm text-gray-600">
                  {spreadsheetData.fileName} • {new Date(spreadsheetData.uploadedAt).toLocaleDateString('pt-BR')}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 md:w-6 md:h-6 text-black" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 md:p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-100 border-2 border-red-300 rounded-lg text-red-700">
              {error}
            </div>
          )}

          {!spreadsheetData ? (
            <div className="flex flex-col items-center justify-center py-12">
              <FileSpreadsheet className="w-16 h-16 md:w-20 md:h-20 text-gray-400 mb-4" />
              <p className="text-gray-600 mb-2 text-center font-medium">Nenhuma planilha carregada para este cliente</p>
              <p className="text-gray-500 mb-6 text-center text-sm">Envie uma planilha Excel (.xlsx ou .xls) com tamanho máximo de 5MB</p>
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={isUploading}
                />
                <div className="flex items-center gap-2 px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-semibold">
                  <Upload className="w-5 h-5" />
                  <span>{isUploading ? 'Carregando...' : 'Enviar Planilha Excel'}</span>
                </div>
              </label>
            </div>
          ) : (
            <div>
              {/* Actions - Apenas para Administradores */}
              {isAdmin() && (
                <div className="flex flex-wrap gap-2 mb-4">
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleFileUpload}
                      className="hidden"
                      disabled={isUploading}
                    />
                    <div className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-semibold">
                      <Upload className="w-4 h-4" />
                      <span>{isUploading ? 'Carregando...' : 'Substituir Planilha'}</span>
                    </div>
                  </label>
                  <button
                    onClick={handleDelete}
                    className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-sm"
                  >
                    <Trash2 className="w-4 h-4" />
                    Excluir
                  </button>
                </div>
              )}
              {/* Botão de Download disponível para todos */}
              <div className="flex flex-wrap gap-2 mb-4">
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-black rounded-lg hover:bg-gray-300 transition-colors text-sm"
                >
                  <Download className="w-4 h-4" />
                  Baixar
                </button>
              </div>

              {/* Table - Todas as Colunas da Planilha */}
              <div className="overflow-x-auto border-2 border-black rounded-lg">
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
                    {spreadsheetData.data.length === 0 ? (
                      <tr>
                        <td
                          colSpan={spreadsheetData.headers.length}
                          className="py-8 text-center text-gray-500"
                        >
                          Nenhum dado encontrado
                        </td>
                      </tr>
                    ) : (
                      spreadsheetData.data.map((row, rowIndex) => (
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
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Info */}
              <div className="mt-4 text-sm text-gray-600">
                Total de linhas: {spreadsheetData.data.length} | Total de colunas: {spreadsheetData.headers.length}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  );
};

export default CustomerSpreadsheet;

