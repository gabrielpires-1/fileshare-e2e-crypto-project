"use client";

import { useState, useEffect, useMemo } from 'react';
import { fetchUsers, User } from '@/lib/api';
import { TransferButton } from './TransferButton'; // <-- 1. Importe o novo botão

// Não precisamos mais de props
export function UserList() {
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ... (useEffect e filteredUsers não mudam) ...
  useEffect(() => {
    async function loadUsers() {
      setIsLoading(true);
      try {
        const users = await fetchUsers();
        setAllUsers(users);
      } catch (err: any) {
        setError(err.message || "Não foi possível carregar os usuários.");
      } finally {
        setIsLoading(false);
      }
    }
    loadUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    if (!searchTerm) return allUsers;
    return allUsers.filter(user =>
      user.username.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [allUsers, searchTerm]);

  return (
    <div className="flex flex-col h-full bg-gray-800 p-4 rounded-lg">
      <h2 className="text-xl font-semibold mb-4">Enviar para:</h2>
      <input
        type="text"
        placeholder="Buscar usuário..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="w-full px-3 py-2 mb-4 text-gray-900 bg-gray-200 border rounded-md"
      />
      
      {/* Lista de Usuários */}
      <div className="flex-1">
        {isLoading && <p className="text-gray-400">Carregando usuários...</p>}
        {error && <p className="text-red-400">{error}</p>}
        
        {!isLoading && !error && (
          <ul className="space-y-3">
            {filteredUsers.map((user) => (
              <li
                key={user.username}
                // 2. O item da lista agora é um container
                className="flex items-center justify-between p-3 bg-gray-700 rounded-md"
              >
                <span className="font-medium text-lg">{user.username}</span>
                
                {/* 3. O botão de transferência está AQUI */}
                <TransferButton recipient={user} />
              </li>
            ))}
            {filteredUsers.length === 0 && (
              <p className="text-gray-400">Nenhum usuário encontrado.</p>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}