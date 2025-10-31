"use client";

import { useState } from 'react';
import { Transfer, getDownloadUrl, fetchFileFromS3 } from '@/lib/api';
import { loadKeysFromLocalStorage, decryptFile } from '@/lib/crypto';

type DownloadButtonProps = {
  transfer: Transfer;
};

type Status = 'idle' | 'fetching' | 'decrypting' | 'success' | 'error';

// Função auxiliar para forçar o download no navegador
function triggerBrowserDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename; // O nome do arquivo salvo
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function DownloadButton({ transfer }: DownloadButtonProps) {
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('Baixar');

  const handleDownload = async () => {
    setStatus('fetching');
    setMessage('Buscando URL...');

    try {
      // 1. Carregar a chave privada de Bob (usuário logado)
      const bobKeys = loadKeysFromLocalStorage();
      if (!bobKeys) {
        throw new Error("Suas chaves não foram encontradas. Faça login.");
      }

      // 2. Obter a URL de download do S3 (via API Go)
      const downloadUrl = await getDownloadUrl(transfer.linkToEncFile);

      // 3. Baixar o arquivo criptografado do S3
      setMessage('Baixando...');
      const encryptedFileBlob = await fetchFileFromS3(downloadUrl);

      // 4. Descriptografar o arquivo
      setStatus('decrypting');
      setMessage('Descriptografando...');
      const decryptedFileBlob = await decryptFile(
        encryptedFileBlob,
        transfer.skb,
        bobKeys.privateKey // A chave privada de criptografia de Bob
      );

      // 5. Forçar o download no navegador
      // (Não sabemos o nome original, então usamos o ID)
      triggerBrowserDownload(decryptedFileBlob, `transfer_${transfer.transferId.split('-')[0]}.dat`);

      setStatus('success');
      setMessage('Baixado!');
      setTimeout(() => setStatus('idle'), 3000);

    } catch (err: any) {
      console.error(err);
      setStatus('error');
      setMessage('Erro!');
      setTimeout(() => setStatus('idle'), 3000);
    }
  };

  const isLoading = status === 'fetching' || status === 'decrypting';
  let buttonClass = "bg-green-600 hover:bg-green-700";

  if (isLoading) {
    buttonClass = "bg-gray-500 cursor-not-allowed";
  } else if (status === 'success') {
    buttonClass = "bg-blue-600";
  } else if (status === 'error') {
    buttonClass = "bg-red-600";
  }

  return (
    <button
      onClick={handleDownload}
      disabled={isLoading}
      className={`px-3 py-2 text-sm font-semibold text-white rounded-md transition-colors ${buttonClass}`}
    >
      {isLoading ? message : (status === 'idle' ? 'Baixar' : message)}
    </button>
  );
}