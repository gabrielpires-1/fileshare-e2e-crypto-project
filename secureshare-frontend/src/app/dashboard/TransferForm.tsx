// src/app/dashboard/TransferForm.tsx
"use client";

import { useState } from 'react';
import { User, getUploadUrl, uploadFileToS3, createTransfer } from '@/lib/api';
// Importa a função de cripto simplificada
import { encryptFile } from '@/lib/crypto'; 

type TransferFormProps = {
  recipient: User; // O "Bob"
};

type Status = 'idle' | 'encrypting' | 'uploading' | 'sending' | 'success' | 'error';

export function TransferForm({ recipient }: TransferFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  // ... (handleFileChange não muda) ...

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!file) {
      setStatusMessage('Por favor, selecione um arquivo.');
      return;
    }

    // 1. Carregar chave pública de Bob (destinatário)
    const bobEncryptPublicKey = recipient.publicKey;
    // NÃO precisamos mais carregar a chave privada de Alice

    try {
      // --- INÍCIO DO PROCESSO DE CRIPTOGRAFIA (SIMPLIFICADO) ---
      setStatus('encrypting');
      setStatusMessage('Passo 1/4: Criptografando arquivo...');
      const { encryptedFileBlob, skb_b64 } = await encryptFile(
        file,
        bobEncryptPublicKey
      );

      // --- UPLOAD S3 ---
      setStatus('uploading');
      setStatusMessage('Passo 2/4: Solicitando URL de upload...');
      const { uploadUrl, linkToEncFile } = await getUploadUrl();
      
      setStatusMessage('Passo 3/4: Fazendo upload para o S3...');
      await uploadFileToS3(uploadUrl, encryptedFileBlob);

      // --- FINALIZAR TRANSFERÊNCIA (API GO) ---
      setStatus('sending');
      setStatusMessage('Passo 4/4: Registrando transferência...');
      await createTransfer({
        destUser: recipient.username,
        linkToEncFile: linkToEncFile,
        skb: skb_b64,
        sig: 'removed', // 'sig' removido no novo fluxo
      });

      // --- SUCESSO ---
      setStatus('success');
      setStatusMessage(`Arquivo enviado com sucesso para ${recipient.username}!`);
      setFile(null);
      // ... (limpa o input)

    } catch (err: any) {
      console.error(err);
      setStatus('error');
      setStatusMessage(`Erro: ${err.message}`);
    }
  };

  const isLoading = status === 'encrypting' || status === 'uploading' || status === 'sending';

  // --- O JSX (Formulário) não muda ---
  // (Copie o mesmo JSX do TransferForm da resposta anterior)
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">
        Enviar Arquivo para: <span className="text-blue-400">{recipient.username}</span>
      </h1>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* ... (cole o JSX do formulário aqui) ... */}
      </form>
    </div>
  );
}