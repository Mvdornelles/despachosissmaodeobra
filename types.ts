export type StatusType = 'success' | 'error' | 'info' | 'warning' | null;

export interface StatusMessage {
  text: string;
  type: StatusType;
}

export interface ExtractedData {
  [key: string]: string | null; // Allows for dynamic keys and keeps compatibility with existing structure

  // Fields for the new template
  HabiteseNumero?: string | null;
  NomeContribuinte?: string | null; 
  EnderecoImovel?: string | null;
  AreaTotalConstruida?: string | null;
  TipoObra?: string | null;
  UsoImovel?: string | null;
  NumeroAlvaraConstrucao?: string | null;
  ValorAvaliacaoMaoObraISSQN?: string | null; 
  ValorRecolherISSQN?: string | null; 
  LocalidadeDespacho?: string | null; 
  // DataDespacho will be the current date, not typically extracted
  
  // PercentualISSQN is now fixed at 3% and not part of extracted data.
  // NomeFiscalAuditor is now selected via dropdown and not part of extracted data.

  // Old fields - can be kept for potential future use or if other templates exist
  // but are not primary for the new template.
  NomeCompletoRequerente?: string | null;
  CPFCNPJRequerente?: string | null;
  InscricaoImobiliaria?: string | null;
  ValorTotalAvaliacao?: string | null;
  DataEmissaoHabitese?: string | null;
  ValorNotasParciais?: string | null;
  // Explicitly removing these as they are now handled differently
  // PercentualISSQN?: string | null;
  // NomeFiscalAuditor?: string | null; 
}

export interface UserCredentials {
  email: string;
  password: string;
}

// Add other shared types here