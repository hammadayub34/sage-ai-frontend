/**
 * Pinecone client setup and utilities
 */
import { Pinecone } from '@pinecone-database/pinecone';

let pineconeClient: Pinecone | null = null;

export function getPineconeClient(): Pinecone {
  if (!pineconeClient) {
    const apiKey = process.env.PINECONE_API_KEY;
    if (!apiKey) {
      throw new Error('PINECONE_API_KEY environment variable is not set');
    }
    pineconeClient = new Pinecone({
      apiKey: apiKey,
    });
  }
  return pineconeClient;
}

export async function getPineconeIndex(indexName?: string) {
  const client = getPineconeClient();
  const index = indexName || process.env.PINECONE_INDEX_NAME || 'alarm-manual';
  return client.index(index);
}

