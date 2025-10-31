"use client";

import { useState, useEffect } from 'react';
import { fetchReceivedFiles, Transfer } from '@/lib/api';
import { DownloadButton } from './DownloadButton';

export function ReceivedFileList() {
  const [receivedFiles, setReceivedFiles] = useState<Transfer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadFiles() {
      setIsLoading(true);
      try {
        const files = await fetchReceivedFiles();
        setReceivedFiles(files);
      } catch (err: any) {
        setError(err.message || "Não foi possível carregar os arquivos.");
      } finally {
        setIsLoading(false);
      }
    }
    loadFiles();
  }, []); // Roda na montagem

  return (
    <div className="flex flex-col h-full bg-gray-800 p-4 rounded-lg">
      <h2 className="text-xl font-semibold mb-4">Arquivos Recebidos</h2>
      
      <div className="flex-1 overflow-y-auto">
        {isLoading && <p className="text-gray-400">Carregando...</p>}
        {error && <p className="text-red-400">{error}</p>}
        
        {!isLoading && !error && (
          <ul className="space-y-3">
            {receivedFiles.map((transfer) => (
              <li
                key={transfer.transferId}
                className="flex items-center justify-between p-3 bg-gray-700 rounded-md"
              >
                <div>
                  <span className="font-medium text-lg">De: {transfer.sourceUser}</span>
                  <p className="text-xs text-gray-400">
                    ID: {transfer.transferId.split('-')[0]}...
                  </p>
                </div>
                
                {/* O Botão de Download está aqui */}
                <DownloadButton transfer={transfer} />
              </li>
            ))}
            {receivedFiles.length === 0 && (
              <p className="text-gray-400">Nenhum arquivo recebido.</p>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}