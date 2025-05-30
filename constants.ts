

export const GEMINI_TEXT_MODEL = 'gemini-2.5-flash-preview-04-17';

export const FISCAL_AUDITORS = [
  "VICTOR MATHEUS VIRGILI DORNELLES",
  "DHANIEL HOWES LOPES"
];

export const FIXED_DESPACHO_TEMPLATE = `
AO SETOR DE CADASTRO IMOBILIÁRIO

Habite-se nº [HabiteseNumero]

A contribuinte [NomeContribuinte] não apresentou nota fiscal de prestação de serviços referentes à mão de obra aplicada no imóvel sito à [EnderecoImovel].

Por conseguinte, tendo em vista o Laudo Técnico do Setor de Arquitetura e Engenharia, foi verificado que a edificação possui área total de [AreaTotalConstruida] m², sendo uma obra de [TipoObra] destinada a uso [UsoImovel]. A edificação está regularizada conforme o Alvará de Construção nº [NumeroAlvaraConstrucao].

A avaliação do custo da mão de obra para fins de ISSQN é de R$ [ValorAvaliacaoMaoObraISSQN]. O valor a ser recolhido aos cofres públicos é de R$ [ValorRecolherISSQN], correspondente a [PercentualISSQN]% do valor estimado pela engenharia para a área total da obra.

Diante do exposto, cumpra-se os procedimentos de praxe.

[LocalidadeDespacho], [DataDespacho].

[NomeFiscalAuditor]
Fiscal Auditor
`;

export const PROMPT_ANALISE = `Você é um assistente especializado em extrair informações de documentos oficiais, laudos técnicos e despachos fiscais.
Analise o seguinte texto extraído de um documento e identifique os seguintes campos. Se as informações estiverem em uma tabela, procure os valores nas colunas apropriadas (por exemplo, procure 'Tipo de Obra' na coluna 'Tipo de Obra', e 'Destinação' na coluna 'Destinação').

- HabiteseNumero: Número do Habite-se (ex: "19/2025", "34/2025").
- NomeContribuinte: Nome completo do contribuinte/requerente.
- EnderecoImovel: Endereço completo do imóvel. Combine rua, número, bairro, cidade e estado em uma única string, preservando espaços e vírgulas conforme o original. Ex: "RUA DAVID FLAIN, 784, BAIRRO CHACARA, ITAQUI - RS".
- AreaTotalConstruida: Área total construída (em m², ex: "261,46", "40,26").
- TipoObra: Identifique o tipo de construção ou natureza da obra (ex: "Alvenaria", "Madeira", "Metálica", "Reforma", "Ampliação", "Regularização"). Este valor é frequentemente encontrado na coluna 'Tipo de Obra' em tabelas de dados da obra. Para o documento fornecido, o valor correto é "Alvenaria".
- UsoImovel: Identifique a finalidade ou destinação do imóvel (ex: "Residencial", "Comercial", "Misto", "Industrial", "Residencial unifamiliar"). Este valor é frequentemente encontrado na coluna 'Destinação' em tabelas de dados da obra. Para o documento fornecido, o valor correto é "Residencial unifamiliar".
- NumeroAlvaraConstrucao: Número do Alvará de Construção (ex: "17/2025", "21/24").
- ValorAvaliacaoMaoObraISSQN: Valor da avaliação do custo da mão de obra para fins de ISSQN (em Reais, ex: "77.030,00", "20.130,00").
- LocalidadeDespacho: Localidade de emissão do despacho (ex: "Itaqui/RS", "ITAQUI - RS").

Retorne os dados EXCLUSIVAMENTE em formato JSON, com as chaves exatamente como listadas acima.
Se um campo não for encontrado ou não for aplicável, use o valor null para esse campo.
Não inclua nenhuma explicação ou texto adicional fora do JSON.

Texto para análise:
---
{TEXTO_EXTRAIDO}
---
`;

export const PROMPT_GERACAO = `Você é um assistente especializado em preencher modelos de despachos e declarações fiscais.
Sua tarefa é gerar um documento completo e formal com base nas informações fornecidas e no modelo fornecido.

Modelo Fixo (use como base estrutural e para os placeholders):
--------------------------------------------------
${FIXED_DESPACHO_TEMPLATE}
--------------------------------------------------

Dados Estruturados Fornecidos (em formato JSON, contendo valores extraídos, calculados e complementados como NomeFiscalAuditor, PercentualISSQN e ValorRecolherISSQN):
{DADOS_ESTRUTURADOS_JSON}

Informações Adicionais Fornecidas pelo Usuário (pode ser vazio):
{INFO_ADICIONAL}

Data Atual para o Despacho:
{DATA_ATUAL}

Instruções Detalhadas para Geração:
1. Preencha todos os placeholders no modelo (ex: [HabiteseNumero], [NomeContribuinte], [PercentualISSQN], [NomeFiscalAuditor], [ValorRecolherISSQN] etc.) com os valores correspondentes dos "Dados Estruturados Fornecidos".
   - O campo 'PercentualISSQN' nos "Dados Estruturados Fornecidos" já estará definido como "3".
   - O campo 'NomeFiscalAuditor' nos "Dados Estruturados Fornecidos" já conterá o nome do fiscal selecionado.
   - O campo 'ValorRecolherISSQN' nos "Dados Estruturados Fornecidos" será o valor calculado (3% do ValorAvaliacaoMaoObraISSQN).
   - Se um valor (diferente dos acima) for null, ausente ou explicitamente indicado como não aplicável nos dados estruturados, mantenha o placeholder no formato "[NomeDoPlaceholder - Não Informado]" ou omita a linha/frase se fizer sentido contextual (avalie caso a caso para manter a legibilidade). Para este exercício, prefira "[NomeDoPlaceholder - Não Informado]".
   - Para o placeholder [DataDespacho], utilize o valor fornecido em "Data Atual para o Despacho".
2. Se "Informações Adicionais Fornecidas pelo Usuário" ({INFO_ADICIONAL}) NÃO estiver vazio:
   - Acrescente uma seção ao final do despacho, antes da assinatura do fiscal, com o título "Observações Adicionais:" seguida do conteúdo de {INFO_ADICIONAL}.
   - Se {INFO_ADICIONAL} estiver vazio, não adicione esta seção.
3. Garanta que todos os valores monetários e numéricos sejam formatados de maneira clara (ex: R$ 77.030,00; 261,46 m²; 3%).

Retorne APENAS o texto completo do despacho gerado. Não inclua nenhuma explicação, introdução ou formatação markdown como \`\`\` ao redor do texto do despacho.
O despacho deve estar pronto para ser copiado e colado.
`;

// ValorRecolherISSQN is removed as it's now calculated, not directly extracted or edited in form.
export const EXTRACTED_DATA_KEYS: (keyof import('./types').ExtractedData)[] = [
  'HabiteseNumero',
  'NomeContribuinte',
  'EnderecoImovel',
  'AreaTotalConstruida',
  'TipoObra',
  'UsoImovel',
  'NumeroAlvaraConstrucao',
  'ValorAvaliacaoMaoObraISSQN',
  // 'ValorRecolherISSQN', // Removed - will be calculated
  'LocalidadeDespacho',
];

export const EXTRACTED_DATA_LABELS: Record<keyof import('./types').ExtractedData, string> = {
  HabiteseNumero: "Número do Habite-se",
  NomeContribuinte: "Nome do Contribuinte",
  EnderecoImovel: "Endereço do Imóvel",
  AreaTotalConstruida: "Área Total Construída (m²)",
  TipoObra: "Tipo da Obra",
  UsoImovel: "Uso do Imóvel",
  NumeroAlvaraConstrucao: "Número do Alvará de Construção",
  ValorAvaliacaoMaoObraISSQN: "Valor Avaliação Mão de Obra (R$)",
  ValorRecolherISSQN: "Valor ISSQN a Recolher (R$) (Calculado)", // Label updated to reflect calculation
  LocalidadeDespacho: "Localidade do Despacho",
  // Deprecated/removed fields
  NomeFiscalAuditor: "Nome do Fiscal Auditor (Selecionado via Dropdown)",
  PercentualISSQN: "Percentual ISSQN (%) (Fixo em 3%)",
  NomeCompletoRequerente: "Nome Completo do Requerente (Antigo)",
  CPFCNPJRequerente: "CPF/CNPJ do Requerente (Antigo)",
  InscricaoImobiliaria: "Inscrição Imobiliária (Antigo)",
  ValorTotalAvaliacao: "Valor Total da Avaliação (R$) (Antigo)",
  DataEmissaoHabitese: "Data de Emissão do Habite-se (Antigo)",
  ValorNotasParciais: "Valor das Notas Fiscais Parciais (R$) (Antigo)",
};
