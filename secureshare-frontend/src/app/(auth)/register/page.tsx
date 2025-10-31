// Define que este é um Componente de Cliente (necessário para usar state e hooks)
"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { generateRsaKeys, saveKeysToLocalStorage } from '@/lib/crypto';

export default function RegisterPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    // Validação simples (KISS)
    if (!username || !password) {
      setError('Usuário e senha são obrigatórios.');
      setIsLoading(false);
      return;
    }

    try {
      // 1. Gerar chaves de criptografia
      console.log('Gerando chaves...');
      const { publicKey, privateKey } = await generateRsaKeys();

      // 2. Salvar ambas no Local Storage
      saveKeysToLocalStorage(publicKey, privateKey);

      // 3. Enviar dados para a API Go
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const res = await fetch(`${apiUrl}/users/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          password,
          publicKey, // Envia a chave pública gerada
        }),
      });

      if (!res.ok) {
        // Tenta ler a mensagem de erro da API Go
        const errorData = await res.json();
        throw new Error(errorData.error.message || 'Falha ao registrar.');
      }

      // 4. Sucesso! Redirecionar para o login
      console.log('Usuário registrado com sucesso!');
      router.push('/login');

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Um erro inesperado ocorreu.');
      // Limpa as chaves em caso de falha no registro da API
      localStorage.removeItem('publicKey');
      localStorage.removeItem('privateKey');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
      <div className="w-full max-w-md p-8 space-y-6 bg-gray-800 rounded-lg shadow-lg">
        <h1 className="text-2xl font-bold text-center">Criar Conta</h1>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label 
              htmlFor="username" 
              className="block text-sm font-medium text-gray-300"
            >
              Usuário (ou email)
            </label>
            <input
              id="username"
              name="username"
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 mt-1 text-gray-900 bg-gray-200 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            />
          </div>

          <div>
            <label 
              htmlFor="password" 
              className="block text-sm font-medium text-gray-300"
            >
              Senha
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 mt-1 text-gray-900 bg-gray-200 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            />
          </div>

          {error && (
            <p className="text-sm text-center text-red-400">{error}</p>
          )}

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full px-4 py-2 font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Registrando...' : 'Registrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}