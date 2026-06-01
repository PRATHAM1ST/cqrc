import path from 'path';

// ── Text chunking ─────────────────────────────────────────────────────────────

export function chunkText(
  text: string,
  chunkWords = 400,
  overlapWords = 60
): string[] {
  // Clean up excessive whitespace
  const cleaned = text.replace(/\s+/g, ' ').trim();
  const words = cleaned.split(' ');

  if (words.length === 0) return [];

  const chunks: string[] = [];
  let i = 0;

  while (i < words.length) {
    const slice = words.slice(i, i + chunkWords).join(' ');
    if (slice.trim().length > 30) {
      chunks.push(slice.trim());
    }
    i += chunkWords - overlapWords;
  }

  return chunks;
}

// ── Parsers ───────────────────────────────────────────────────────────────────

export async function parsePDF(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const PDFParser = require('pdf2json');
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser(null, true);
    
    pdfParser.on('pdfParser_dataError', (errData: any) => reject(new Error(errData.parserError?.message || 'PDF parsing failed')));
    pdfParser.on('pdfParser_dataReady', () => {
      try {
        const text = pdfParser.getRawTextContent();
        resolve(text);
      } catch (err) {
        reject(err);
      }
    });

    pdfParser.parseBuffer(buffer);
  });
}

export async function parseDOCX(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mammoth = require('mammoth');
  const result = await mammoth.extractRawText({ buffer });
  return result.value ?? '';
}

export async function parseXLSX(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const XLSX = require('xlsx');
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  let text = '';
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const csv: string = XLSX.utils.sheet_to_csv(sheet);
    text += `=== Sheet: ${sheetName} ===\n${csv}\n\n`;
  }
  return text;
}

export async function parseTextFile(buffer: Buffer): Promise<string> {
  return buffer.toString('utf-8');
}

// ── Main dispatcher ───────────────────────────────────────────────────────────

export async function parseFile(
  buffer: Buffer,
  fileName: string
): Promise<string> {
  const ext = path.extname(fileName).toLowerCase().replace('.', '');

  switch (ext) {
    case 'pdf':
      return parsePDF(buffer);
    case 'doc':
    case 'docx':
      return parseDOCX(buffer);
    case 'xlsx':
    case 'xls':
      return parseXLSX(buffer);
    case 'csv':
    case 'txt':
    case 'md':
      return parseTextFile(buffer);
    default:
      throw new Error(`Unsupported file type: .${ext}`);
  }
}

export const SUPPORTED_EXTENSIONS = ['pdf', 'doc', 'docx', 'xlsx', 'xls', 'csv', 'txt', 'md'];
export const SUPPORTED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'text/plain',
  'text/markdown',
];
