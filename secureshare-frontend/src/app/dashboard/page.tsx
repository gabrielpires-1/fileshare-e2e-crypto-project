// src/app/dashboard/page.tsx
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
// Importe 'getToken' e a nova 'clearAuthData'
import { getToken, clearAuthData } from '@/lib/crypto';
import { UserList } from './UserList';
import { ReceivedFileList } from './ReceivedFileList';

export default function DashboardPage() {
  const router = useRouter();

  // "Auth Guard" (Proteção de Rota)
  useEffect(() => {
    const token = getToken();
    if (!token) {
      // Se não há token, redireciona para o login
      router.replace('/login');
    }
  }, [router]);

  // 2. Criar a função de Logout
  const handleLogout = () => {
    // Limpa TODOS os dados do localStorage (token + 4 chaves)
    clearAuthData();
    // Redireciona para o login
    // Usamos 'replace' para que o usuário não possa "voltar" para o dashboard
    router.replace('/login');
  };

  return (
    // Mudei para flex-col para adicionar o header
    <div className="flex flex-col min-h-screen bg-gray-900 text-white p-4 gap-4">
      
      {/* --- 3. HEADER ADICIONADO --- */}
      <header className="flex justify-between items-center pb-4 border-b border-gray-700">
        <h1 className="text-3xl font-bold">
          SecureShare Dashboard
        </h1>
        <button
          onClick={handleLogout}
          className="px-4 py-2 font-semibold text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors"
        >
          Logout (Sair)
        </button>
      </header>
      
      {/* Layout de 2 colunas (agora dentro de um flex-1) */}
      <div className="flex flex-col md:flex-row flex-1 gap-4">
        {/* Coluna da Esquerda (Enviar) */}
        <aside className="w-full md:w-1/2 lg:w-1/3">
          <UserList />
        </aside>

        {/* Coluna da Direita (Receber) */}
        <main className="w-full md:w-1/2 lg:w-2/3">
          <ReceivedFileList />
        </main>
      </div>
    </div>
  );
}