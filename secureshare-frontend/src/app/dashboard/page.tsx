"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getToken } from '@/lib/crypto';
import { UserList } from './UserList';
import { ReceivedFileList } from './ReceivedFileList';

export default function DashboardPage() {
  const router = useRouter();

  // "Auth Guard"
  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace('/login');
    }
  }, [router]);

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-gray-900 text-white p-4 gap-4">
      
      {/* Coluna da Esquerda (Enviar) */}
      <aside className="w-full md:w-1/2 lg:w-1/3">
        <UserList />
      </aside>

      {/* Coluna da Direita (Receber) */}
      <main className="w-full md:w-1/2 lg:w-2/3">
        <ReceivedFileList />
      </main>
    </div>
  );
}