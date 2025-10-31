// src/lib/api.ts
import { getToken } from './crypto';

// Tipo de Usuário (simplificado)
export type User = {
  username: string;
  publicKey: string;
};

/**
 * Retorna a URL base da API
 */
function getApiUrl(): string {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    throw new Error("Variável de ambiente NEXT_PUBLIC_API_URL não definida.");
  }
  return apiUrl;
}

/**
 * Retorna os headers de autenticação
 */
function getAuthHeaders(isUpload: boolean = false): HeadersInit {
  const token = getToken();
  if (!token) {
    throw new Error("Token de autenticação não encontrado.");
  }

  // Para uploads de arquivos (PUT) para o S3, não queremos 'Content-Type: json'
  if (isUpload) {
    return {
      'Authorization': `Bearer ${token}`,
    };
  }
  
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
}

/**
 * Busca a lista de todos os usuários
 */
export async function fetchUsers(): Promise<User[]> {
  try {
    const res = await fetch(`${getApiUrl()}/users`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    if (res.status === 401) { throw new Error("Sessão inválida."); }
    if (!res.ok) { throw new Error("Falha ao buscar usuários."); }

    const users: User[] = await res.json();
    return users;

  } catch (err) {
    console.error("Erro em fetchUsers:", err);
    throw err;
  }
}

/**
 * ESTA É A FUNÇÃO QUE FALTAVA
 * Pede a URL de Upload ao backend Go
 */
export async function getUploadUrl(): Promise<{ uploadUrl: string, linkToEncFile: string }> {
  const res = await fetch(`${getApiUrl()}/transfers/upload-url`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  
  if (!res.ok) {
    throw new Error("Falha ao obter URL de upload.");
  }
  return await res.json();
}

/**
 * Faz o upload do arquivo criptografado (Blob) para o S3
 */
export async function uploadFileToS3(uploadUrl: string, fileBlob: Blob) {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    body: fileBlob,
    // Headers de autenticação não são necessários aqui,
    // pois a URL pré-assinada já contém a autorização.
    // No entanto, o backend Go pode precisar de headers CORS.
    // Vamos manter simples por enquanto.
  });

  if (!res.ok) {
    throw new Error("Falha no upload para o S3.");
  }
}

// NOVO: Tipo para os Metadados de Transferência (como vem do GO)
export type Transfer = {
  transferId: string;
  sourceUser: string;
  destUser: string;
  linkToEncFile: string; // Esta é a "fileKey"
  skb: string;
  sig: string; // Ainda está aqui, mas vamos ignorá-la
  createdAt: string;
};

// NOVO: Buscar arquivos recebidos (chama o GET /transfers)
export async function fetchReceivedFiles(): Promise<Transfer[]> {
  const res = await fetch(`${getApiUrl()}/transfers`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    throw new Error("Falha ao buscar arquivos recebidos.");
  }
  return await res.json();
}

// NOVO: Obter a URL de download do S3 (chama o novo endpoint Go)
export async function getDownloadUrl(fileKey: string): Promise<string> {
  const res = await fetch(
    `${getApiUrl()}/transfers/download-url?fileKey=${encodeURIComponent(fileKey)}`,
    {
      method: 'GET',
      headers: getAuthHeaders(),
    }
  );
  if (!res.ok) {
    throw new Error("Falha ao obter URL de download.");
  }
  const data = await res.json();
  return data.downloadUrl;
}

// NOVO: Baixar o arquivo (Blob) do S3
export async function fetchFileFromS3(downloadUrl: string): Promise<Blob> {
  const res = await fetch(downloadUrl, { method: 'GET' });
  if (!res.ok) {
    throw new Error("Falha ao baixar o arquivo do S3.");
  }
  return await res.blob();
}

// Tipo de Metadados (simplificado)
export type TransferMetadata = {
  destUser: string;
  linkToEncFile: string;
  skb: string; // Base64
  sig: string; // Base64 (removido no novo fluxo)
};

/**
 * Finalizar Transferência (simplificado)
 */
export async function createTransfer(metadata: TransferMetadata) {
  const res = await fetch(`${getApiUrl()}/transfers`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(metadata), // Envia sem o 'sig'
  });

  if (!res.ok) {
    throw new Error("Falha ao criar a transferência no backend.");
  }
  return await res.json();
}