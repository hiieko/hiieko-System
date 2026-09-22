export interface OcrField {
  value: string | number | null;
  confidence: number;
}

export interface OcrRecognition {
  text: string;
  confidence: number | null;
  box: number[][] | null;
}

export interface OcrExtractionResult {
  documentType: 'BON_FISCAL' | 'FACTURA' | 'AVIZ' | 'OTHER';
  merchantName?: string;
  merchantCui?: string;
  invoiceSeries?: string;
  documentNumber?: string;
  documentDate?: string;
  dueDate?: string;
  currency?: string;
  subtotal?: number;
  vat?: number;
  total?: number;
  paymentMethod?: string;
  rawText: string;
  provider: string;
  confidence: number;
  fields: Record<string, OcrField>;
  lowConfidenceFields: string[];
  reviewRequired: boolean;
  validationErrors: string[];
  documentHash?: string;
  recognition?: OcrRecognition[];
}

export interface OcrProviderConfig {
  url: string;
  token?: string;
  timeout?: number;
}

export abstract class IOcrProvider {
  abstract extractDocument(
    fileBuffer: Buffer,
    mimeType: string,
    correlationId?: string,
  ): Promise<OcrExtractionResult>;

  abstract checkHealth(): Promise<{ status: string; provider: string; model?: string }>;
}
