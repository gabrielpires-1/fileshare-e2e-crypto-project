"use client";

import { useState, useRef } from 'react';
import { User, getUploadUrl, uploadFileToS3, createTransfer } from '@/lib/api';
import { loadKeysFromLocalStorage, encryptFile } from '@/lib/crypto';

// Propriedades: O "Bob" (destinatário)
type TransferButtonProps = {
  recipient: User;
};

type Status = 'idle' | 'encrypting' | 'uploading' | 'sending' | 'success' | 'error';

export function TransferButton({ recipient }: TransferButtonProps) {
  // Estado de loading e status (local para cada botão)
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');
  
  // Referência para o input de arquivo oculto
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Função principal de transferência, chamada pelo input
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return; // Sai se o usuário cancelou

    setStatus('idle');
    setMessage('');

    // 1. Carregar chaves de Alice (usuário logado)
    const aliceKeys = loadKeysFromLocalStorage();
    if (!aliceKeys) {
      setStatus('error');
      setMessage("Erro: Chaves de Alice não encontradas. Faça login.");
      return;
    }
    
    // 2. Obter chave pública de Bob (destinatário)
    const bobEncryptPublicKey = recipient.publicKey;

    try {
      // --- INÍCIO DO FLUXO (Exatamente como você pediu) ---
      setStatus('encrypting');
      setMessage('Criptografando...');
      const { encryptedFileBlob, skb_b64 } = await encryptFile(
        file,
        bobEncryptPublicKey
      );

      // --- UPLOAD S3 ---
      setStatus('uploading');
      setMessage('Solicitando URL...');
      const { uploadUrl, linkToEncFile } = await getUploadUrl();
      
      setMessage('Fazendo upload...');
      await uploadFileToS3(uploadUrl, encryptedFileBlob);

      // --- FINALIZAR (API GO) ---
      setStatus('sending');
      setMessage('Registrando...');
      await createTransfer({
        destUser: recipient.username,
        linkToEncFile: linkToEncFile,
        skb: skb_b64,
        sig: 'removed', // 'sig' removido no novo fluxo
      });

      // --- SUCESSO ---
      setStatus('success');
      setMessage('Enviado com sucesso!');
      
      // Reseta o status após 3 segundos
      setTimeout(() => setStatus('idle'), 3000);

    } catch (err: any) {
      console.error(err);
      setStatus('error');
      setMessage(`Erro: ${err.message}`);
    }
  };

  // 3. Função do botão: Clica no input oculto
  const handleClick = () => {
    // Reseta o status se for um novo clique
    if (status === 'error' || status === 'success') {
      setStatus('idle');
      setMessage('');
    }
    fileInputRef.current?.click();
  };

  // Define a cor e o texto do botão com base no status
  const isLoading = status === 'encrypting' || status === 'uploading' || status === 'sending';
  let buttonClass = "bg-blue-600 hover:bg-blue-700";
  let buttonText = "Transferir Arquivo";

  if (isLoading) {
    buttonClass = "bg-gray-500 cursor-not-allowed";
    buttonText = message; // Mostra o progresso
  } else if (status === 'success') {
    buttonClass = "bg-green-600";
    buttonText = "Sucesso!";
  } else if (status === 'error') {
    buttonClass = "bg-red-600";
    buttonText = "Tentar Novamente";
  }

  return (
    <div className="flex flex-col items-end">
      {/* O Botão principal que o usuário vê */}
      <button
        onClick={handleClick}
        disabled={isLoading}
        className={`px-3 py-2 text-sm font-semibold text-white rounded-md transition-colors ${buttonClass}`}
      >
        {buttonText}
      </button>

      {/* O input de arquivo real, que fica oculto */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        className="hidden"
        // Reseta o input para permitir o re-upload do mesmo arquivo
        onClick={(e) => (e.currentTarget.value = '')}
      />
      
      {/* Mensagem de erro (se houver) */}
      {status === 'error' && <p className="text-xs text-red-400 mt-1">{message}</p>}
    </div>
  );
}