import { NextRequest, NextResponse } from 'next/server';
import { getPineconeIndex } from '@/lib/pinecone';
import { createEmbedding } from '@/lib/embeddings';
import { writeFile, readFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

// PDF parsing
async function parsePDF(filePath: string): Promise<string> {
  try {
    const buffer = await readFile(filePath);
    
    // Try to use pdf-parse if available
    let pdfParse: any;
    try {
      pdfParse = require('pdf-parse');
    } catch {
      // If pdf-parse is not installed, try dynamic import
      try {
        const pdfModule: any = await import('pdf-parse');
        pdfParse = pdfModule.default || pdfModule;
      } catch {
        throw new Error('PDF parsing requires pdf-parse package. Please install it: npm install pdf-parse');
      }
    }
    
    const data = await pdfParse(buffer);
    return data.text || '';
  } catch (error: any) {
    if (error.message && error.message.includes('pdf-parse')) {
      throw error;
    }
    throw new Error(`Failed to parse PDF: ${error.message || 'Unknown error'}`);
  }
}

// CSV parsing
async function parseCSV(filePath: string): Promise<string> {
  try {
    const content = await readFile(filePath, 'utf-8');
    // Convert CSV to readable text format
    const lines = content.split('\n');
    const headers = lines[0]?.split(',') || [];
    const rows = lines.slice(1).filter(line => line.trim());
    
    let text = `CSV Document with ${headers.length} columns and ${rows.length} rows.\n\n`;
    text += `Headers: ${headers.join(', ')}\n\n`;
    text += `Data:\n${rows.join('\n')}`;
    
    return text;
  } catch (error: any) {
    throw new Error(`Failed to parse CSV: ${error.message}`);
  }
}

// Split text into chunks for embedding
function chunkText(text: string, chunkSize: number = 1000, overlap: number = 200): string[] {
  const chunks: string[] = [];
  let start = 0;
  
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    start = end - overlap;
  }
  
  return chunks;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const fileName = formData.get('fileName') as string || file.name;
    const fileType = formData.get('fileType') as string || file.type;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    const isValidType = fileType === 'application/pdf' || 
                       fileType === 'text/csv' || 
                       fileName.endsWith('.pdf') || 
                       fileName.endsWith('.csv');
    
    if (!isValidType) {
      return NextResponse.json(
        { error: 'Invalid file type. Only PDF and CSV files are supported.' },
        { status: 400 }
      );
    }

    // Save file to temporary location
    const tempDir = tmpdir();
    const tempFilePath = join(tempDir, `upload_${Date.now()}_${fileName}`);
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await writeFile(tempFilePath, buffer);

    try {
      // Parse file based on type
      let text: string;
      if (fileName.endsWith('.pdf') || fileType === 'application/pdf') {
        text = await parsePDF(tempFilePath);
      } else {
        text = await parseCSV(tempFilePath);
      }

      if (!text || text.trim().length === 0) {
        throw new Error('File appears to be empty or could not be parsed');
      }

      // Split text into chunks
      const chunks = chunkText(text);
      console.log(`[AI Library] Parsed ${fileName}: ${chunks.length} chunks`);

      // Create embeddings and store in Pinecone
      const index = await getPineconeIndex();
      const vectors = [];

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const embedding = await createEmbedding(chunk);
        
        vectors.push({
          id: `${fileName}_${Date.now()}_${i}`,
          values: embedding,
          metadata: {
            text: chunk,
            fileName: fileName,
            fileType: fileType,
            chunkIndex: i,
            totalChunks: chunks.length,
            document_type: 'user_uploaded_document',
            uploadedAt: new Date().toISOString(),
          },
        });
      }

      // Upsert to Pinecone in batches
      const batchSize = 100;
      for (let i = 0; i < vectors.length; i += batchSize) {
        const batch = vectors.slice(i, i + batchSize);
        await index.upsert(batch);
      }

      console.log(`[AI Library] Successfully uploaded ${fileName} with ${vectors.length} chunks to Pinecone`);

      return NextResponse.json({
        success: true,
        fileName,
        chunks: chunks.length,
        message: `Successfully processed and uploaded ${fileName}`,
      });
    } finally {
      // Clean up temporary file
      try {
        await unlink(tempFilePath);
      } catch (error) {
        console.error('Failed to delete temp file:', error);
      }
    }
  } catch (error: any) {
    console.error('[AI Library] Upload error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process file' },
      { status: 500 }
    );
  }
}

