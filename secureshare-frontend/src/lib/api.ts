// src/lib/api.ts
import { getToken } from './crypto';

// --- TIPOS ---

// Usuário (com as 2 chaves públicas)
export type User = {
  username: string;
  publicKey: string;     // Criptografia (RSA)
  publicKeySign: string; // Assinatura (ECDSA)
};

// Transferência (como vem do backend Go)
export type Transfer = {
  transferId: string;
  sourceUser: string;
  destUser: string;
  linkToEncFile: string;
  skb: string;
  sig: string;
  createdAt: string;
};

// Metadados para criar uma nova transferência
export type TransferMetadata = {
  destUser: string;
  linkToEncFile: string;
  skb: string;
  sig: string;
};

export type UserPublicKeys = {
  username: string;
  publicKey: string;
  publicKeySign: string;
};

// --- FUNÇÕES AUXILIARES ---
function getApiUrl(): string {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) throw new Error("NEXT_PUBLIC_API_URL não definida.");
  return apiUrl;
}

function getAuthHeaders(): HeadersInit {
  const token = getToken();
  if (!token) throw new Error("Token de autenticação não encontrado.");
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
}

// --- CHAMADAS DE API ---

export async function fetchUsers(): Promise<User[]> {
  const res = await fetch(`${getApiUrl()}/users`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error("Falha ao buscar usuários.");
  return await res.json();
}

export async function getUploadUrl(): Promise<{ uploadUrl: string, linkToEncFile: string }> {
  const res = await fetch(`${getApiUrl()}/transfers/upload-url`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Falha ao obter URL de upload.");
  return await res.json();
}

export async function uploadFileToS3(uploadUrl: string, fileBlob: Blob) {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    body: fileBlob,
  });
  if (!res.ok) {
    const errorText = await res.text();
    console.error("Erro do S3:", errorText);
    throw new Error("Falha no upload para o S3.");
  }
}

export async function createTransfer(metadata: TransferMetadata) {
  const res = await fetch(`${getApiUrl()}/transfers`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(metadata),
  });
  if (!res.ok) throw new Error("Falha ao criar a transferência no backend.");
  return await res.json();
}

export async function fetchReceivedFiles(): Promise<Transfer[]> {
  const res = await fetch(`${getApiUrl()}/transfers`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error("Falha ao buscar arquivos recebidos.");
  return await res.json();
}

// NOVA FUNÇÃO: Busca as chaves públicas de um usuário específico
export async function fetchUserPublicKeys(username: string): Promise<UserPublicKeys> {
  const res = await fetch(`${getApiUrl()}/users/${username}/key`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    throw new Error(`Falha ao buscar chaves para ${username}.`);
  }
  return await res.json();
}
export async function getDownloadUrl(fileKey: string): Promise<string> {
  const res = await fetch(`${getApiUrl()}/transfers/download-url?fileKey=${encodeURIComponent(fileKey)}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Falha ao obter URL de download.");
  const data = await res.json();
  return data.downloadUrl;
}

export async function fetchFileFromS3(downloadUrl: string): Promise<Blob> {
  const res = await fetch(downloadUrl);
  if (!res.ok) throw new Error("Falha ao baixar o arquivo do S3.");
  return await res.blob();
}

export async function fetchUserPublicKeysWithToken(
  username: string, 
  token: string
): Promise<UserPublicKeys> {
  const res = await fetch(`${getApiUrl()}/users/${username}/key`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`, // <-- Usa o token temporário
    },
  });
  if (!res.ok) {
    throw new Error(`Falha ao buscar chaves para ${username}.`);
  }
  return await res.json();
}