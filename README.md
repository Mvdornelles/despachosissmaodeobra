# Gerador de Despachos Inteligente

Uma aplicação web moderna para geração automática de despachos utilizando Inteligência Artificial.

## 🚀 Tecnologias

- **Frontend**: React 19 + TypeScript + Vite
- **Banco de Dados**: Supabase
- **IA**: Google Gemini AI
- **Processamento de PDF**: PDF.js
- **OCR**: Tesseract.js
- **Deploy**: Netlify

## 📋 Funcionalidades

- ✅ Upload e processamento de documentos PDF
- ✅ Extração de texto via OCR
- ✅ Geração automática de despachos com IA
- ✅ Interface moderna e responsiva
- ✅ Autenticação de usuários
- ✅ Armazenamento seguro de dados

## 🛠️ Configuração do Ambiente

### Pré-requisitos

- Node.js 18+ 
- npm ou yarn
- Conta no Supabase
- Chave de API do Google Gemini

### Instalação

1. Clone o repositório:
```bash
git clone https://github.com/SEU_USUARIO/gerador-de-despachos-inteligente.git
cd gerador-de-despachos-inteligente
```

2. Instale as dependências:
```bash
npm install
```

3. Configure as variáveis de ambiente:
```bash
cp .env.example .env.local
```

Edite o arquivo `.env.local` com suas credenciais:
```env
VITE_SUPABASE_URL=sua_url_do_supabase
VITE_SUPABASE_ANON_KEY=sua_chave_anonima_do_supabase
VITE_GEMINI_API_KEY=sua_chave_da_api_gemini
```

4. Inicie o servidor de desenvolvimento:
```bash
npm run dev
```

## 🔧 Scripts Disponíveis

- `npm run dev` - Inicia o servidor de desenvolvimento
- `npm run build` - Gera a build de produção
- `npm run preview` - Visualiza a build de produção localmente

## 🌐 Deploy

### Netlify

Este projeto está configurado para deploy automático no Netlify:

1. Conecte seu repositório GitHub ao Netlify
2. Configure as variáveis de ambiente no painel do Netlify
3. O deploy será automático a cada push na branch `main`

### Variáveis de Ambiente no Netlify

Configure as seguintes variáveis no painel do Netlify:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_GEMINI_API_KEY`

## 📁 Estrutura do Projeto

```
├── components/          # Componentes React reutilizáveis
├── contexts/           # Contextos React
├── docs/              # Documentação
├── pages/             # Páginas da aplicação
├── public/            # Arquivos estáticos
├── services/          # Serviços e APIs
├── src/
│   ├── config/        # Configurações
│   ├── hooks/         # Hooks customizados
│   ├── utils/         # Utilitários
│   └── validators/    # Schemas de validação
├── types.ts           # Tipos TypeScript
├── netlify.toml       # Configuração do Netlify
└── vite.config.ts     # Configuração do Vite
```

## 🔒 Segurança

- Todas as chaves de API são armazenadas como variáveis de ambiente
- Autenticação implementada via Supabase
- Headers de segurança configurados no Netlify

## 🤝 Contribuição

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

## 📞 Suporte

Se você encontrar algum problema ou tiver dúvidas, abra uma [issue](https://github.com/SEU_USUARIO/gerador-de-despachos-inteligente/issues) no GitHub.

---

⭐ Se este projeto te ajudou, considere dar uma estrela no GitHub!
