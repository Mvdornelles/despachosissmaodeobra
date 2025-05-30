
import React, { useState, useCallback, useRef } from 'react';
import { useAppContext } from '../contexts/AppContext';
import * as pdfjsLib from 'pdfjs-dist';
import Tesseract, { RecognizeResult } from 'tesseract.js';
import { FaUpload, FaFilePdf, FaFileImage, FaTimesCircle } from 'react-icons/fa';
import { Spinner } from './Spinner';

// Setup PDF.js worker.
// Use the explicit version from the import map to ensure consistency.
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://esm.sh/pdfjs-dist@5.2.133/build/pdf.worker.js';

// Local interface for Tesseract progress updates if not directly using an exported type
interface TesseractProgressUpdate {
  status: string;
  progress?: number;
  // Other fields from Tesseract.WorkerMessage if needed
  jobId?: string;
  workerId?: string;
  userJobId?: string;
  data?: any; 
}


export const FileUpload: React.FC = () => {
  const {
    setRawExtractedText,
    setIsLoading,
    setStatusMessage,
    clearStatusMessageAfterDelay,
    currentFile,
    setCurrentFile
  } = useAppContext();
  const [isDragging, setIsDragging] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingMessage, setProcessingMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  // To store current page info for PDF OCR progress
  const ocrPageProgressDataRef = useRef({ currentPage: 0, totalPages: 0, baseProgress: 0, pageBudget: 0 });


  const initializeTesseractWorker = async (
    loggerCallback: (m: TesseractProgressUpdate) => void
  ) => {
    // Tesseract v5+ uses ' reconhecendo texto' (lowercase) in Portuguese for progress.
    // The 'por' language data is for Portuguese.
    // OEM 1 means LSTM only, which is generally good.
    return Tesseract.createWorker('por', 1, {
      logger: loggerCallback,
      // Explicitly set workerPath and corePath to ensure Tesseract.js can load its dependencies.
      // This is crucial when using module CDNs like esm.sh for the main Tesseract.js library.
      workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/worker.min.js',
      corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@6.0.0/tesseract-core.wasm.js',
      // dataPath: 'https://tessdata.projectnaptha.com/4.0.0_fast', // Default should work, or uncomment to specify
    });
  };
  
  // Logger for single image file OCR
  const imageOcrLogger = (m: TesseractProgressUpdate) => {
    if (m.status === 'recognizing text' && typeof m.progress === 'number') {
      setProcessingProgress(Math.round(m.progress * 100));
      setProcessingMessage(`Reconhecendo texto... ${Math.round(m.progress * 100)}%`);
    } else if (m.status === 'loading tesseract core' || m.status === 'initializing api' || m.status === 'loading language traineddata' || m.status === 'initializing tesseract') {
      if (processingMessage !== `Reconhecendo texto... ${Math.round((m.progress || 0) * 100)}%` && (m.progress || 0) < 1) {
         setProcessingMessage(`Inicializando OCR: ${m.status}`);
      }
    } else if (m.status !== 'initialized api' && m.status !== 'loaded language traineddata' && (m.progress || 0) < 1) {
      // Catch-all for other statuses, but avoid overwriting the "recognizing text" progress.
      if (m.status !== 'recognizing text') {
         setProcessingMessage(m.status);
      }
    }
  };

  // Logger for PDF page-by-page OCR
  const pageAwarePdfOcrLogger = (m: TesseractProgressUpdate) => {
    const { baseProgress, pageBudget } = ocrPageProgressDataRef.current;
    if (m.status === 'recognizing text' && typeof m.progress === 'number') {
      const currentPageProgress = Math.round(m.progress * pageBudget);
      const overallProgress = Math.min(100, Math.round(baseProgress + currentPageProgress));
      setProcessingProgress(overallProgress);
       setProcessingMessage(`Analisando página ${ocrPageProgressDataRef.current.currentPage}/${ocrPageProgressDataRef.current.totalPages} (Progresso OCR: ${Math.round(m.progress * 100)}%)...`);
    } else if (m.status === 'loading tesseract core' || m.status === 'initializing api' || m.status === 'loading language traineddata' || m.status === 'initializing tesseract') {
       if (processingMessage !== `Analisando página ${ocrPageProgressDataRef.current.currentPage}/${ocrPageProgressDataRef.current.totalPages} (Progresso OCR: ${Math.round((m.progress || 0) * 100)}%)...` && (m.progress || 0) < 1) {
         setProcessingMessage(`Inicializando OCR para página ${ocrPageProgressDataRef.current.currentPage}: ${m.status}`);
       }
    } else if (m.status !== 'initialized api' && m.status !== 'loaded language traineddata' && (m.progress || 0) < 1) {
       if (m.status !== 'recognizing text') {
         setProcessingMessage(`Status OCR pág. ${ocrPageProgressDataRef.current.currentPage}: ${m.status}`);
       }
    }
  };

  const ocrImageFile = async (file: File) => {
    setProcessingMessage('Processando Imagem (OCR)...');
    setProcessingProgress(0);
    let worker: Tesseract.Worker | null = null;
    try {
      worker = await initializeTesseractWorker(imageOcrLogger);
      const result = await worker.recognize(file) as RecognizeResult; // Cast needed if TS doesn't infer it well
      await worker.terminate();
      worker = null;

      if (result.data.text.trim() === '') {
        setRawExtractedText('');
        setStatusMessage({ text: 'OCR concluído, mas nenhum texto foi detectado na imagem.', type: 'warning' });
      } else {
        setRawExtractedText(result.data.text);
        setStatusMessage({ text: 'Texto da imagem extraído com OCR com sucesso!', type: 'success' });
        clearStatusMessageAfterDelay();
      }
    } catch (error) {
      console.error("Error processing image with OCR: ", error);
      setRawExtractedText('');
      setStatusMessage({ text: `Falha ao processar imagem com OCR: ${error instanceof Error ? error.message : String(error)}`, type: 'error' });
      if (worker) await worker.terminate();
    } finally {
      setIsLoading(false);
      setProcessingMessage('');
      setProcessingProgress(0);
    }
  };
  
  const ocrPdfDocument = async (file: File) => {
    setProcessingMessage('Iniciando processamento OCR do PDF...');
    setProcessingProgress(0);
    let tesseractWorker: Tesseract.Worker | null = null;
    let fullText = '';

    try {
      const fileBuffer = await file.arrayBuffer();
      const pdfDoc = await pdfjsLib.getDocument(fileBuffer).promise;
      
      ocrPageProgressDataRef.current = {
        currentPage: 0,
        totalPages: pdfDoc.numPages,
        baseProgress: 0,
        pageBudget: 100 / pdfDoc.numPages, // Equally distribute progress budget among pages
      };

      tesseractWorker = await initializeTesseractWorker(pageAwarePdfOcrLogger);

      for (let i = 1; i <= pdfDoc.numPages; i++) {
        ocrPageProgressDataRef.current.currentPage = i;
        ocrPageProgressDataRef.current.baseProgress = ((i - 1) / pdfDoc.numPages) * 100;
        
        setProcessingMessage(`Renderizando página ${i}/${pdfDoc.numPages} do PDF...`);
        // Estimate rendering progress contribution, e.g., first 10-20% of pageBudget
        setProcessingProgress(Math.round(ocrPageProgressDataRef.current.baseProgress + (ocrPageProgressDataRef.current.pageBudget * 0.1)));


        const page = await pdfDoc.getPage(i);
        const viewport = page.getViewport({ scale: 2.0 }); // Scale for better OCR quality
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) {
          throw new Error('Não foi possível obter o contexto 2D do canvas.');
        }
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({ canvasContext: context, viewport: viewport }).promise;
        
        // Update message before OCR starts for this page
        setProcessingMessage(`Analisando página ${i}/${pdfDoc.numPages} com OCR...`);
        // OCR progress for this page will be handled by pageAwarePdfOcrLogger using the remaining budget for this page
        
        const { data: { text: pageText } } = await tesseractWorker.recognize(canvas);
        fullText += pageText + "\n"; // Add a newline between pages
        page.cleanup(); // Clean up page resources
      }

      await tesseractWorker.terminate();
      tesseractWorker = null;

      if (fullText.trim() === '') {
        setRawExtractedText('');
        setStatusMessage({ text: 'OCR do PDF concluído, mas nenhum texto foi detectado.', type: 'warning' });
      } else {
        setRawExtractedText(fullText.trim());
        setStatusMessage({ text: 'Texto do PDF extraído com OCR com sucesso!', type: 'success' });
        clearStatusMessageAfterDelay();
      }

    } catch (error) {
      console.error("Error processing PDF with OCR: ", error);
      setRawExtractedText('');
      setStatusMessage({ text: `Falha ao processar PDF com OCR: ${error instanceof Error ? error.message : String(error)}`, type: 'error' });
      if (tesseractWorker) await tesseractWorker.terminate();
    } finally {
      setIsLoading(false);
      setProcessingMessage('');
      setProcessingProgress(0);
      ocrPageProgressDataRef.current = { currentPage: 0, totalPages: 0, baseProgress: 0, pageBudget: 0 };
    }
  };


  const handleFile = (selectedFile: File | null) => {
    if (selectedFile) {
      setIsLoading(true);
      setCurrentFile(selectedFile);
      setRawExtractedText('');
      setStatusMessage({ text: `Carregando arquivo: ${selectedFile.name}`, type: 'info' });
      clearStatusMessageAfterDelay(2000);

      if (selectedFile.type === "application/pdf") {
        ocrPdfDocument(selectedFile);
      } else if (selectedFile.type.startsWith("image/")) {
        ocrImageFile(selectedFile);
      } else {
        setStatusMessage({ text: "Tipo de arquivo não suportado. Use PDF ou Imagem.", type: 'warning' });
        clearStatusMessageAfterDelay();
        setIsLoading(false);
        setCurrentFile(null);
      }
    }
  };

  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    handleFile(event.target.files ? event.target.files[0] : null);
    if (event.target) {
      event.target.value = '';
    }
  };

  const onDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const onDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      handleFile(event.dataTransfer.files[0]);
      event.dataTransfer.clearData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const removeFile = () => {
    setCurrentFile(null);
    setRawExtractedText('');
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setStatusMessage({text: 'Arquivo removido.', type: 'info'});
    clearStatusMessageAfterDelay();
  };

  return (
    <div className="space-y-4">
      <label htmlFor="file-upload" className="block text-sm font-medium text-slate-300 mb-1">
        Carregar Documento (PDF ou Imagem para OCR)
      </label>
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`flex justify-center items-center w-full px-6 py-10 border-2 ${
          isDragging ? 'border-sky-400 bg-slate-700' : 'border-slate-600 border-dashed'
        } rounded-md cursor-pointer hover:border-sky-500 transition-colors duration-200 ease-in-out`}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="Área para carregar ou arrastar arquivo"
      >
        <input
          id="file-upload"
          name="file-upload"
          type="file"
          className="sr-only"
          accept=".pdf,image/*"
          onChange={onFileChange}
          ref={fileInputRef}
        />
        <div className="text-center">
          <FaUpload className={`mx-auto h-12 w-12 ${isDragging ? 'text-sky-400' : 'text-slate-500'} mb-2`} aria-hidden="true" />
          <p className="text-sm text-slate-400">
            <span className="font-semibold text-sky-400">Clique para carregar</span> ou arraste e solte
          </p>
          <p className="text-xs text-slate-500">PDF ou Imagem (PNG, JPG, etc.)</p>
        </div>
      </div>

      {currentFile && (
        <div className="mt-3 p-3 bg-slate-700 rounded-md shadow flex items-center justify-between">
          <div className="flex items-center space-x-2 overflow-hidden">
            {currentFile.type === "application/pdf" ? (
              <FaFilePdf className="text-red-400 text-xl flex-shrink-0" aria-label="Arquivo PDF" />
            ) : (
              <FaFileImage className="text-indigo-400 text-xl flex-shrink-0" aria-label="Arquivo de Imagem" />
            )}
            <span className="text-sm text-slate-300 truncate" title={currentFile.name}>{currentFile.name}</span>
            <span className="text-xs text-slate-500 whitespace-nowrap">({(currentFile.size / 1024).toFixed(1)} KB)</span>
          </div>
          <button
            onClick={removeFile}
            className="p-1 text-slate-400 hover:text-red-400 transition-colors flex-shrink-0 ml-2"
            title="Remover arquivo"
            aria-label="Remover arquivo carregado"
          >
            <FaTimesCircle className="w-5 h-5" />
          </button>
        </div>
      )}
      
      {processingMessage && (
        <div className="mt-4 p-3 bg-slate-700 rounded-md" aria-live="polite">
          <div className="flex items-center space-x-2 mb-1">
            <Spinner size="sm"/>
            <p className="text-sm text-sky-300">{processingMessage}</p>
          </div>
          {processingProgress >= 0 && processingProgress <=100 && ( 
            <div className="w-full bg-slate-600 rounded-full h-2.5" title={`Progresso: ${processingProgress}%`}>
              <div 
                className="bg-sky-500 h-2.5 rounded-full transition-all duration-300 ease-out" 
                style={{ width: `${processingProgress}%` }}
                aria-valuenow={processingProgress}
                aria-valuemin={0}
                aria-valuemax={100}
              ></div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
