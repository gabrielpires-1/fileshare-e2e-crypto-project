"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { generateAllKeys } from '@/lib/crypto';
import { PrivateKeyModal } from './PrivateKeyModal'; // <-- 1. Importe o Modal

// Tipo para armazenar as chaves privadas geradas
type GeneratedPrivateKeys = {
  encrypt: string;
  sign: string;
};

export default function RegisterPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // --- 2. Estados para controlar o Modal ---
  const [showModal, setShowModal] = useState(false);
  const [generatedKeys, setGeneratedKeys] = useState<GeneratedPrivateKeys | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    if (!username || !password) {
      setError('Usuário e senha são obrigatórios.');
      setIsLoading(false);
      return;
    }

    try {
      // 1. Gerar AMBOS os pares de chaves
      console.log('Gerando chaves de criptografia e assinatura...');
      const { encryptKeys, signKeys } = await generateAllKeys();

      // 3. Enviar dados para a API Go
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const res = await fetch(`${apiUrl}/users/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          password,
          publicKey: encryptKeys.publicKey,
          publicKeySign: signKeys.publicKey,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error.message || 'Falha ao registrar.');
      }

      // 4. Sucesso!
      console.log('Usuário registrado com sucesso!');
      
      // --- 3. EM VEZ DE REDIRECIONAR, ABRA O MODAL ---
      // Salva as chaves privadas no estado para passar ao modal
      setGeneratedKeys({
        encrypt: encryptKeys.privateKey,
        sign: signKeys.privateKey
      });
      setShowModal(true); // Abre o modal
      // REMOVEMOS o alert() e o router.push() daqui

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Um erro inesperado ocorreu.');
      localStorage.clear();
    } finally {
      setIsLoading(false);
    }
  };

  // --- 4. Função para fechar o modal e redirecionar ---
  const handleModalClose = () => {
    setShowModal(false);
    // Redireciona para o login SÓ DEPOIS que o usuário fechar o modal
    router.push('/login');
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
      <div className="w-full max-w-md p-8 space-y-6 bg-gray-800 rounded-lg shadow-lg">
        <h1 className="text-2xl font-bold text-center">Criar Conta (v2)</h1>
        
        {/* O formulário não muda */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* ... (inputs de username e password) ... */}
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-300">
              Usuário (ou email)
            </label>
            <input
              id="username" name="username" type="text" required
              value={username} onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 mt-1 text-gray-900 bg-gray-200 border rounded-md"
              disabled={isLoading}
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-300">
              Senha
            </label>
            <input
              id="password" name="password" type="password" required
              value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 mt-1 text-gray-900 bg-gray-200 border rounded-md"
              disabled={isLoading}
            />
          </div>
          {error && <p className="text-sm text-center text-red-400">{error}</p>}
          <div>
            <button
              type="submit" disabled={isLoading}
              className="w-full px-4 py-2 font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? 'Gerando chaves e registrando...' : 'Registrar'}
            </button>
          </div>
        </form>
      </div>

      {/* --- 5. Renderiza o Modal condicionalmente --- */}
      {showModal && generatedKeys && (
        <PrivateKeyModal
          isOpen={showModal}
          onClose={handleModalClose}
          encryptPrivateKey={generatedKeys.encrypt}
          signPrivateKey={generatedKeys.sign}
        />
      )}
    </div>
  );
}