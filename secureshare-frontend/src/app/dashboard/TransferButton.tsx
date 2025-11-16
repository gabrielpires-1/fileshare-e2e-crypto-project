// src/app/dashboard/TransferButton.tsx
"use client";

import { useState, useRef } from 'react';
import { User, getUploadUrl, uploadFileToS3, createTransfer } from '@/lib/api';
import { loadKeysFromLocalStorage, encryptFile } from '@/lib/crypto';

type TransferButtonProps = {
  recipient: User;
};

type Status = 'idle' | 'encrypting' | 'uploading' | 'sending' | 'success' | 'error';

export function TransferButton({ recipient }: TransferButtonProps) {
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatus('idle');
    setMessage('');

    // 1. Carregar chaves de Alice (usuário logado) do Local Storage
    const aliceKeys = loadKeysFromLocalStorage();
    if (!aliceKeys) {
      setStatus('error');
      setMessage("Erro: Chaves de Alice não encontradas. Faça login.");
      return;
    }
    
    // 2. Obter chaves públicas de Bob (destinatário)
    const bobEncryptPublicKey = recipient.publicKey;

    try {
      // --- INÍCIO DO FLUXO (6 Passos) ---
      setStatus('encrypting');
      setMessage('Criptografando e assinando...');
      const { encryptedFileBlob, skb_b64, sig_b64 } = await encryptFile(
        file,
        bobEncryptPublicKey,            // Chave de criptografia de Bob
        aliceKeys.signKeys.privateKey // Chave de assinatura de Alice
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
        sig: sig_b64, // <-- Envia a assinatura
      });

      // --- SUCESSO ---
      setStatus('success');
      setMessage('Enviado com sucesso!');
      setTimeout(() => setStatus('idle'), 3000);

    } catch (err: any) {
      console.error(err);
      setStatus('error');
      setMessage(`Erro: ${err.message}`);
    }
  };

  const handleClick = () => {
    if (status === 'error' || status === 'success') setStatus('idle');
    fileInputRef.current?.click();
  };

  // ... (O JSX do botão e do input oculto não muda) ...
  const isLoading = status === 'encrypting' || status === 'uploading' || status === 'sending';
  let buttonClass = "bg-blue-600 hover:bg-blue-700";
  let buttonText = "Transferir Arquivo";

  if (isLoading) {
    buttonClass = "bg-gray-500 cursor-not-allowed";
    buttonText = message;
  } else if (status === 'success') {
    buttonClass = "bg-green-600";
    buttonText = "Sucesso!";
  } else if (status === 'error') {
    buttonClass = "bg-red-600";
    buttonText = "Tentar Novamente";
  }

  return (
    <div className="flex flex-col items-end">
      <button
        onClick={handleClick} disabled={isLoading}
        className={`px-3 py-2 text-sm font-semibold text-white rounded-md transition-colors ${buttonClass}`}
      >
        {buttonText}
      </button>
      <input
        type="file" ref={fileInputRef} onChange={handleFileSelect}
        className="hidden" onClick={(e) => (e.currentTarget.value = '')}
      />
      {status === 'error' && <p className="text-xs text-red-400 mt-1">{message}</p>}
    </div>
  );
}