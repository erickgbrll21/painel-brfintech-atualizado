# BR FINTECH - Dashboard de Vendas

Dashboard profissional para controle de vendas da empresa BR FINTECH.

## 🚀 Características

### Identidade Visual
- Paleta de cores: Preto e branco
- Design moderno, limpo e de alta legibilidade
- Layout minimalista e corporativo
- Interface intuitiva e fácil de navegar

### Funcionalidades Principais

#### Métricas de Vendas
- Total vendido
- Vendas por período
- Ticket médio
- Volume transacionado
- Número de clientes ativos
- Taxa de crescimento

#### Gráficos Dinâmicos
- Gráfico de linha (vendas por período)
- Gráfico de barras (vendas por produto)
- Gráfico de pizza (vendas por região)
- KPI cards interativos

#### Filtros
- Filtro por data (inicial e final)
- Filtro por produto
- Filtro por região
- Filtro por vendedor

### Gestão de Usuários
- Sistema de permissões (Admin/Usuário)
- Apenas administradores podem criar novos usuários
- Administradores podem organizar e classificar clientes
- Usuários comuns têm acesso apenas às funcionalidades essenciais

### Integrações
- Suporte para integração via API da Cielo
- Visualização de transações
- Status de pagamentos
- Relatórios financeiros em tempo real

### Design Responsivo
- Otimizado para desktop
- Compatível com tablet
- Adaptado para mobile

## 📦 Instalação

1. Clone o repositório ou navegue até a pasta do projeto
2. Instale as dependências:

```bash
npm install
```

3. Inicie o servidor de desenvolvimento:

```bash
npm run dev
```

4. Acesse o dashboard em `http://localhost:3000`

## 🔐 Credenciais de Acesso

### Administrador
- Email: `admin@brfintech.com`
- Senha: `123456`

### Usuário Comum
- Email: `user@brfintech.com`
- Senha: `123456`

## 🔧 Configuração da API Cielo

Para conectar com a API real da Cielo, crie um arquivo `.env` na raiz do projeto com as seguintes variáveis:

```env
VITE_CIELO_API_URL=https://api.cieloecommerce.cielo.com.br
VITE_CIELO_MERCHANT_ID=seu_merchant_id
VITE_CIELO_MERCHANT_KEY=sua_merchant_key
```

**Nota:** Sem essas configurações, o sistema utilizará dados mockados para demonstração.

## 📁 Estrutura do Projeto

```
src/
├── components/       # Componentes reutilizáveis
│   ├── Layout.tsx
│   ├── KPICard.tsx
│   └── FilterBar.tsx
├── context/          # Contextos React
│   └── AuthContext.tsx
├── pages/            # Páginas da aplicação
│   ├── Login.tsx
│   ├── Dashboard.tsx
│   ├── Users.tsx
│   ├── Customers.tsx
│   └── CieloTransactions.tsx
├── services/         # Serviços e APIs
│   ├── salesService.ts
│   ├── cieloService.ts
│   ├── customerService.ts
│   └── userService.ts
├── types/            # Definições TypeScript
│   └── index.ts
├── App.tsx
├── main.tsx
└── index.css
```

## 🛠️ Tecnologias Utilizadas

- **React 18** - Biblioteca JavaScript para interfaces
- **TypeScript** - Superset JavaScript com tipagem estática
- **Vite** - Build tool e dev server
- **React Router** - Roteamento
- **Recharts** - Biblioteca de gráficos
- **Tailwind CSS** - Framework CSS utilitário
- **Lucide React** - Ícones
- **Axios** - Cliente HTTP
- **date-fns** - Manipulação de datas

## 📝 Scripts Disponíveis

- `npm run dev` - Inicia o servidor de desenvolvimento
- `npm run build` - Cria build de produção (otimizado para deploy)
- `npm run preview` - Preview do build de produção
- `npm run lint` - Executa o linter
- `npm run deploy` - Alias para build (preparação para deploy)

## 🚀 Deploy na Hostinger

Para fazer deploy na Hostinger, consulte o arquivo **[DEPLOY.md](./DEPLOY.md)** que contém um guia completo passo a passo.

**Resumo rápido:**
1. Execute `npm run build` para criar a pasta `dist`
2. Acesse o File Manager da Hostinger
3. Faça upload de todos os arquivos da pasta `dist` para `public_html`
4. Certifique-se de que o arquivo `.htaccess` foi enviado
5. Acesse seu domínio e teste!

## 🎨 Personalização

### Logo
Substitua o arquivo `public/logo.svg` pela logo oficial da BR FINTECH.

### Cores
As cores podem ser personalizadas no arquivo `tailwind.config.js`.

## 📄 Licença

Este projeto foi desenvolvido para a BR FINTECH.

