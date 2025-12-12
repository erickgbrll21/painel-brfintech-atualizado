// Utilitário para resetar todos os dados do localStorage

const STORAGE_KEYS = [
  'brfintech_user',           // Usuário logado
  'customer_spreadsheets',   // Planilhas dos clientes
  'customer_card_values',     // Valores dos cards KPI
  'customer_taxes',           // Taxas dos clientes
  'cielo_api_config'          // Configuração da API Cielo
];

export const resetDatabase = (): number => {
  console.log('🔄 Iniciando reset do banco de dados...');
  
  let clearedCount = 0;
  
  STORAGE_KEYS.forEach(key => {
    if (localStorage.getItem(key)) {
      localStorage.removeItem(key);
      console.log(`✅ Removido: ${key}`);
      clearedCount++;
    } else {
      console.log(`ℹ️  Não encontrado: ${key}`);
    }
  });
  
  // Limpar qualquer outra chave relacionada
  const allKeys = Object.keys(localStorage);
  allKeys.forEach(key => {
    if ((key.startsWith('brfintech_') || key.startsWith('customer_') || key.startsWith('cielo_')) 
        && !STORAGE_KEYS.includes(key)) {
      localStorage.removeItem(key);
      console.log(`✅ Removido (extra): ${key}`);
      clearedCount++;
    }
  });
  
  console.log(`\n✨ Reset concluído! ${clearedCount} chave(s) removida(s).`);
  
  return clearedCount;
};

// Adicionar ao window para acesso via console
if (typeof window !== 'undefined') {
  (window as any).resetDatabase = resetDatabase;
  console.log('💡 Dica: Execute resetDatabase() no console do navegador para resetar o banco de dados.');
}








