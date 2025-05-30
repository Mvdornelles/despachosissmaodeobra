# Regras e Melhores Práticas do Projeto

## 📋 Índice

1. [Segurança](#segurança)
2. [Variáveis de Ambiente](#variáveis-de-ambiente)
3. [Estrutura de Código](#estrutura-de-código)
4. [Documentação](#documentação)
5. [Performance](#performance)
6. [Testes](#testes)
7. [Controle de Versão](#controle-de-versão)
8. [Deployment](#deployment)

## 🔒 Segurança

### 1. Variáveis de Ambiente

**OBRIGATÓRIO:**
- ❌ **NUNCA** commitar chaves de API ou secrets no código
- ✅ Usar variáveis de ambiente para todas as credenciais
- ✅ Prefixar variáveis públicas com `VITE_` para exposição no cliente
- ✅ Manter arquivo `.env.example` com variáveis de exemplo

**Estrutura de variáveis:**
```bash
# .env (NUNCA commitar este arquivo)
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_GEMINI_API_KEY=your_gemini_api_key

# Variáveis privadas (apenas servidor)
SUPABASE_SERVICE_KEY=your_service_key
DATABASE_PASSWORD=your_db_password
```

### 2. Autenticação e Autorização

**OBRIGATÓRIO:**
- ✅ Implementar Row Level Security (RLS) no Supabase
- ✅ Validar sessões do usuário em todas as operações sensíveis
- ✅ Usar tokens JWT para autenticação
- ❌ **NUNCA** confiar apenas na validação do frontend

### 3. Sanitização de Dados

**OBRIGATÓRIO:**
- ✅ Validar todos os inputs do usuário
- ✅ Sanitizar dados antes de enviar para APIs
- ❌ **NUNCA** usar `dangerouslySetInnerHTML` sem sanitização
- ✅ Implementar validação tanto no frontend quanto no backend

## 🔧 Variáveis de Ambiente

### Configuração Obrigatória

**Arquivo `.env.example`:**
```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key

# Gemini AI Configuration
VITE_GEMINI_API_KEY=your_gemini_api_key

# Application Configuration
VITE_APP_NAME=Gerador de Despachos Inteligente
VITE_APP_VERSION=1.0.0
```

**Arquivo `.gitignore` deve incluir:**
```
# Environment variables
.env
.env.local
.env.production
.env.staging

# API Keys
*.key
*.pem
```

### Validação de Variáveis

**OBRIGATÓRIO:** Criar validador de variáveis de ambiente:

```typescript
// src/config/env.ts
interface EnvConfig {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  GEMINI_API_KEY: string;
}

function validateEnv(): EnvConfig {
  const requiredVars = {
    SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
    GEMINI_API_KEY: import.meta.env.VITE_GEMINI_API_KEY,
  };

  for (const [key, value] of Object.entries(requiredVars)) {
    if (!value) {
      throw new Error(`Missing required environment variable: VITE_${key}`);
    }
  }

  return requiredVars;
}

export const env = validateEnv();
```

## 🏗️ Estrutura de Código

### 1. Organização de Arquivos

**OBRIGATÓRIO:**
```
src/
├── components/          # Componentes reutilizáveis
│   ├── ui/             # Componentes básicos de UI
│   ├── forms/          # Componentes de formulário
│   └── layout/         # Componentes de layout
├── contexts/           # Contextos React
├── hooks/              # Hooks customizados
├── services/           # Serviços e APIs
├── utils/              # Funções utilitárias
├── types/              # Definições de tipos TypeScript
├── constants/          # Constantes da aplicação
├── validators/         # Esquemas de validação
├── config/             # Configurações
└── __tests__/          # Testes
```

### 2. Nomenclatura

**OBRIGATÓRIO:**
- ✅ **Componentes:** PascalCase (`FileUpload.tsx`)
- ✅ **Hooks:** camelCase com prefixo `use` (`useFileUpload.ts`)
- ✅ **Utilitários:** camelCase (`formatCurrency.ts`)
- ✅ **Constantes:** UPPER_SNAKE_CASE (`API_ENDPOINTS`)
- ✅ **Tipos:** PascalCase (`ExtractedData`)

### 3. Componentes React

**OBRIGATÓRIO:**
- ✅ Usar TypeScript para todos os componentes
- ✅ Definir interfaces para props
- ✅ Usar `memo` para componentes que não precisam re-renderizar
- ✅ Separar lógica complexa em hooks customizados

**Exemplo:**
```typescript
import { memo } from 'react';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  acceptedTypes: string[];
  maxSize: number;
}

export const FileUpload = memo<FileUploadProps>(({ 
  onFileSelect, 
  acceptedTypes, 
  maxSize 
}) => {
  // Implementação
});

FileUpload.displayName = 'FileUpload';
```

### 4. Hooks Customizados

**OBRIGATÓRIO:**
- ✅ Prefixar com `use`
- ✅ Retornar objetos com propriedades nomeadas
- ✅ Incluir estados de loading e error

**Exemplo:**
```typescript
export function useFileUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const uploadFile = useCallback(async (file: File) => {
    setIsUploading(true);
    setError(null);
    
    try {
      // Lógica de upload
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setIsUploading(false);
    }
  }, []);
  
  return {
    uploadFile,
    isUploading,
    error,
  };
}
```

## 📚 Documentação

### 1. Comentários de Código

**OBRIGATÓRIO:**
- ✅ Documentar funções complexas com JSDoc
- ✅ Explicar lógica de negócio não óbvia
- ✅ Documentar tipos TypeScript complexos

**Exemplo:**
```typescript
/**
 * Extrai dados estruturados de texto usando IA Gemini
 * @param text - Texto bruto extraído do documento
 * @param prompt - Prompt personalizado para extração
 * @returns Promise com dados estruturados ou erro
 */
export async function analyzeDocumentText(
  text: string, 
  prompt: string
): Promise<ExtractedData> {
  // Implementação
}
```

### 2. README.md

**OBRIGATÓRIO:**
- ✅ Instruções claras de instalação
- ✅ Configuração de variáveis de ambiente
- ✅ Comandos de desenvolvimento e build
- ✅ Arquitetura do projeto
- ✅ Guia de contribuição

### 3. Documentação de API

**OBRIGATÓRIO:**
- ✅ Documentar todas as funções de serviço
- ✅ Incluir exemplos de uso
- ✅ Documentar tipos de retorno e erros possíveis

## ⚡ Performance

### 1. Otimizações React

**OBRIGATÓRIO:**
- ✅ Usar `useMemo` para cálculos custosos
- ✅ Usar `useCallback` para funções passadas como props
- ✅ Usar `memo` para componentes que não precisam re-renderizar
- ✅ Lazy loading para componentes grandes

**Exemplo:**
```typescript
const ExpensiveComponent = lazy(() => import('./ExpensiveComponent'));

function App() {
  const expensiveValue = useMemo(() => {
    return heavyCalculation(data);
  }, [data]);
  
  const handleClick = useCallback((id: string) => {
    // Handler logic
  }, []);
  
  return (
    <Suspense fallback={<Loading />}>
      <ExpensiveComponent value={expensiveValue} onClick={handleClick} />
    </Suspense>
  );
}
```

### 2. Bundle Optimization

**OBRIGATÓRIO:**
- ✅ Code splitting por rotas
- ✅ Tree shaking habilitado
- ✅ Compressão de assets
- ✅ Análise de bundle size

## 🧪 Testes

### 1. Estrutura de Testes

**OBRIGATÓRIO:**
- ✅ Testes unitários para utilitários
- ✅ Testes de integração para componentes
- ✅ Testes de API para serviços
- ✅ Cobertura mínima de 80%

### 2. Nomenclatura de Testes

**OBRIGATÓRIO:**
```typescript
// ✅ Bom
describe('FileUpload', () => {
  it('should upload file successfully', () => {});
  it('should show error when file is too large', () => {});
  it('should validate file type', () => {});
});

// ❌ Ruim
describe('FileUpload', () => {
  it('test 1', () => {});
  it('upload', () => {});
});
```

## 📝 Controle de Versão

### 1. Commits

**OBRIGATÓRIO:**
- ✅ Usar Conventional Commits
- ✅ Mensagens em português
- ✅ Commits atômicos

**Formato:**
```
type(scope): description

feat(auth): adiciona autenticação com Supabase
fix(upload): corrige erro de validação de arquivo
docs(readme): atualiza instruções de instalação
refactor(components): reorganiza estrutura de componentes
```

### 2. Branches

**OBRIGATÓRIO:**
- ✅ `main` - código de produção
- ✅ `develop` - desenvolvimento
- ✅ `feature/nome-da-feature` - novas funcionalidades
- ✅ `fix/nome-do-bug` - correções
- ✅ `hotfix/nome-do-hotfix` - correções urgentes

## 🚀 Deployment

### 1. Ambientes

**OBRIGATÓRIO:**
- ✅ **Development:** Ambiente local
- ✅ **Staging:** Ambiente de teste
- ✅ **Production:** Ambiente de produção

### 2. CI/CD

**OBRIGATÓRIO:**
- ✅ Testes automatizados
- ✅ Build automatizado
- ✅ Deploy automatizado
- ✅ Rollback automático em caso de erro

### 3. Monitoramento

**OBRIGATÓRIO:**
- ✅ Logs de erro
- ✅ Métricas de performance
- ✅ Alertas de falha
- ✅ Health checks

## 🔍 Validação e Tratamento de Erros

### 1. Validação de Dados

**OBRIGATÓRIO:**
- ✅ Validar no frontend E backend
- ✅ Usar bibliotecas de validação (Zod, Yup)
- ✅ Mensagens de erro claras

### 2. Tratamento de Erros

**OBRIGATÓRIO:**
- ✅ Error boundaries para componentes React
- ✅ Try/catch em operações assíncronas
- ✅ Logs estruturados
- ✅ Fallbacks para falhas de API

**Exemplo:**
```typescript
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    // Enviar erro para serviço de monitoramento
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback />;
    }

    return this.props.children;
  }
}
```

## ✅ Checklist de Desenvolvimento

### Antes de Commitar
- [ ] Código formatado (Prettier)
- [ ] Linting passou (ESLint)
- [ ] Testes passando
- [ ] Tipos TypeScript corretos
- [ ] Documentação atualizada
- [ ] Variáveis de ambiente configuradas
- [ ] Sem console.logs em produção
- [ ] Sem TODOs ou FIXMEs

### Antes de Deploy
- [ ] Build de produção funcionando
- [ ] Testes de integração passando
- [ ] Performance testada
- [ ] Segurança validada
- [ ] Backup de dados
- [ ] Plano de rollback

---

**📌 Nota:** Este documento deve ser atualizado conforme o projeto evolui. Todas as regras são obrigatórias e devem ser seguidas por todos os desenvolvedores do projeto.