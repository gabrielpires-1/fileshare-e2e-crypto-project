"use client";

import { useEffect } from 'react';

type PrivateKeyModalProps = {
  isOpen: boolean;
  onClose: () => void;
  encryptPrivateKey: string;
  signPrivateKey: string;
};

// NOVO: Função auxiliar para não repetir a lógica de download
const triggerDownload = (content: string, filename: string) => {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export function PrivateKeyModal({ 
  isOpen, 
  onClose, 
  encryptPrivateKey, 
  signPrivateKey 
}: PrivateKeyModalProps) {

  // Efeito para travar o scroll (não muda)
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'auto';
    return () => { document.body.style.overflow = 'auto' };
  }, [isOpen]);

  // NOVO: Handler para baixar a chave de criptografia
  const handleDownloadEncryptKey = () => {
    triggerDownload(encryptPrivateKey, 'secureshare_encrypt_private_key.pem');
  };

  // NOVO: Handler para baixar a chave de assinatura
  const handleDownloadSignKey = () => {
    triggerDownload(signPrivateKey, 'secureshare_sign_private_key.pem');
  };

  if (!isOpen) return null;

  return (
    // Fundo (overlay)
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75"
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
    >
      {/* Container do Modal */}
      <div className="relative w-full max-w-lg p-6 bg-gray-800 rounded-lg shadow-xl">
        
        {/* Botão de Fechar (Topo Direito) */}
        <button 
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-white"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>

        <h2 id="modal-title" className="text-2xl font-bold text-white mb-4">
          ⚠️ Salve suas Chaves Privadas!
        </h2>
        
        <p className="text-gray-300 mb-4">
          Sua conta foi criada. Para sua segurança, suas chaves privadas **não** são salvas em nosso servidor.
        </p>
        <p className="text-gray-300 mb-6">
          Você **deve** baixar suas **duas** chaves agora. Guarde estes arquivos em um local seguro.
        </p>

        {/* A Advertência */}
        <div className="p-4 bg-red-900 border border-red-700 rounded-md mb-6">
          <p className="font-semibold text-red-100">Advertência Importante</p>
          <p className="text-red-200 text-sm">
            Se você perder estes arquivos ou deslogar sem salvá-los, você **perderá permanentemente** o acesso à sua conta e a todos os seus arquivos. Não há como recuperar chaves perdidas.
          </p>
        </div>
        
        {/* NOVO: Div com os dois botões de download */}
        <div className="flex flex-col space-y-3">
          <button
            onClick={handleDownloadEncryptKey}
            className="w-full px-4 py-3 font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
          >
            Baixar Chave de Criptografia (RSA)
          </button>
          
          <button
            onClick={handleDownloadSignKey}
            className="w-full px-4 py-3 font-semibold text-white bg-green-600 rounded-md hover:bg-green-700 transition-colors"
          >
            Baixar Chave de Assinatura (ECDSA)
          </button>
        </div>

      </div>
    </div>
  );
}