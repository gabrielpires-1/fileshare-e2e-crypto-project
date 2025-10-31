// Define que este é um Componente de Cliente
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { loadKeysFromLocalStorage, saveToken } from '@/lib/crypto';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Flag para verificar se as chaves de criptografia existem
  const [keysExist, setKeysExist] = useState(false); 
  
  const router = useRouter();

  // Efeito para verificar as chaves no Local Storage quando a página carrega
  useEffect(() => {
    const keys = loadKeysFromLocalStorage();
    if (keys) {
      setKeysExist(true);
    } else {
      setError("Chaves de criptografia não encontradas. Por favor, registre-se primeiro.");
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    // Validação
    if (!username || !password) {
      setError('Usuário e senha são obrigatórios.');
      setIsLoading(false);
      return;
    }

    if (!keysExist) {
      setError('Chaves não encontradas. Impossível fazer login. Tente se registrar.');
      setIsLoading(false);
      return;
    }

    try {
      // 1. Chamar a API Go para fazer login
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const res = await fetch(`${apiUrl}/users/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        // Captura o erro da API Go (ex: "credenciais inválidas")
        throw new Error(data.error.message || 'Falha no login.');
      }

      // 2. Salvar o token JWT no Local Storage
      saveToken(data.token);

      // 3. Sucesso! Redirecionar para o dashboard
      console.log('Login bem-sucedido!');
      router.push('/dashboard'); // Próxima página que vamos criar

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Um erro inesperado ocorreu.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
      <div className="w-full max-w-md p-8 space-y-6 bg-gray-800 rounded-lg shadow-lg">
        <h1 className="text-2xl font-bold text-center">Login</h1>
        
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
              disabled={isLoading || !keysExist} // Desabilita se estiver carregando OU se as chaves não existirem
              className="w-full px-4 py-2 font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Entrando...' : 'Entrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}