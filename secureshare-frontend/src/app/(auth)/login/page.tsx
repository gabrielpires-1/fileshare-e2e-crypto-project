"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  saveToken, 
  saveKeysToLocalStorage,
  readTextFromFile,
  verifyKeys
} from '@/lib/crypto';
import { fetchUserPublicKeysWithToken, UserPublicKeys } from '@/lib/api';

// Define os 3 estados do formulário
type LoginStep = 'credentials' | 'keys' | 'verifying';

export default function LoginPage() {
  // Estado do Formulário 1
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  // Estado do Formulário 2
  const [encryptKeyFile, setEncryptKeyFile] = useState<File | null>(null);
  const [signKeyFile, setSignKeyFile] = useState<File | null>(null);

  // Estado de UI
  const [step, setStep] = useState<LoginStep>('credentials');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Estado Temporário (entre etapas)
  const [tempJwt, setTempJwt] = useState<string | null>(null);
  const [apiPublicKeys, setApiPublicKeys] = useState<UserPublicKeys | null>(null);

  const router = useRouter();

  /**
   * ETAPA 1: Envia usuário/senha para obter o JWT e as chaves públicas.
   */
  const handleSubmitCredentials = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // 1. Chamar a API Go para fazer login (obter JWT)
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const res = await fetch(`${apiUrl}/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error.message || 'Falha no login.');
      }
      
      const jwt = data.token;
      
      // 2. Chamar a API Go para buscar as chaves públicas (usando o JWT)
      const publicKeys = await fetchUserPublicKeysWithToken(username, jwt);

      // 3. Salvar dados temporariamente e avançar a etapa
      setTempJwt(jwt);
      setApiPublicKeys(publicKeys);
      setStep('keys'); // Avança para a etapa de upload de chaves

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Um erro inesperado ocorreu.');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * ETAPA 2: Verifica os arquivos .pem e finaliza o login.
   */
  const handleKeyVerification = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!encryptKeyFile || !signKeyFile || !tempJwt || !apiPublicKeys) {
      setError("Ambos os arquivos de chave são necessários.");
      return;
    }

    setStep('verifying'); // Mostra "Verificando..."
    setError(null);

    try {
      // 1. Ler os arquivos .pem como texto
      const encryptPrivateKeyPem = await readTextFromFile(encryptKeyFile);
      const signPrivateKeyPem = await readTextFromFile(signKeyFile);

      // 2. Verificar se as chaves privadas correspondem às públicas da API
      const isValid = await verifyKeys(
        encryptPrivateKeyPem,
        signPrivateKeyPem,
        apiPublicKeys
      );

      if (!isValid) {
        throw new Error("As chaves privadas não correspondem às chaves públicas registradas.");
      }
      
      // 3. SUCESSO! Salvar tudo no Local Storage
      saveToken(tempJwt);
      saveKeysToLocalStorage(
        apiPublicKeys.publicKey,     // Chave Pública de Cripto (da API)
        encryptPrivateKeyPem,        // Chave Privada de Cripto (do arquivo)
        apiPublicKeys.publicKeySign, // Chave Pública de Assinatura (da API)
        signPrivateKeyPem            // Chave Privada de Assinatura (do arquivo)
      );

      // 4. Redirecionar para o dashboard
      console.log('Chaves verificadas! Login completo.');
      router.push('/dashboard');

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Um erro inesperado ocorreu.');
      setStep('keys'); // Volta para a etapa de upload em caso de erro
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
      <div className="w-full max-w-md p-8 space-y-6 bg-gray-800 rounded-lg shadow-lg">
        
        {/* ETAPA 1: Formulário de Credenciais */}
        {step === 'credentials' && (
          <>
            <h1 className="text-2xl font-bold text-center">Login (Etapa 1/2)</h1>
            <form onSubmit={handleSubmitCredentials} className="space-y-6">
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-300">
                  Usuário
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
                  {isLoading ? 'Autenticando...' : 'Próximo'}
                </button>
              </div>
            </form>
          </>
        )}

        {/* ETAPA 2: Formulário de Upload de Chaves */}
        {step === 'keys' && (
          <>
            <h1 className="text-2xl font-bold text-center">Login (Etapa 2/2)</h1>
            <p className="text-sm text-center text-gray-300">
              Autenticado! Agora, carregue suas chaves privadas para descriptografar sua conta.
            </p>
            <form onSubmit={handleKeyVerification} className="space-y-6">
              <div>
                <label htmlFor="encryptKey" className="block text-sm font-medium text-gray-300">
                  Chave Privada de Criptografia (RSA)
                </label>
                <input
                  id="encryptKey" name="encryptKey" type="file" required
                  accept=".pem"
                  onChange={(e) => setEncryptKeyFile(e.target.files ? e.target.files[0] : null)}
                  className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-gray-700 file:text-white"
                />
              </div>
              <div>
                <label htmlFor="signKey" className="block text-sm font-medium text-gray-300">
                  Chave Privada de Assinatura (ECDSA)
                </label>
                <input
                  id="signKey" name="signKey" type="file" required
                  accept=".pem"
                  onChange={(e) => setSignKeyFile(e.target.files ? e.target.files[0] : null)}
                  className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-gray-700 file:text-white"
                />
              </div>
              {error && <p className="text-sm text-center text-red-400">{error}</p>}
              <div>
                <button
                  type="submit" disabled={!encryptKeyFile || !signKeyFile}
                  className="w-full px-4 py-2 font-semibold text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50"
                >
                  Verificar e Entrar
                </button>
              </div>
            </form>
          </>
        )}

        {/* ETAPA 3: Estado de Verificação */}
        {step === 'verifying' && (
          <div className="text-center">
            <h1 className="text-2xl font-bold text-blue-400">Verificando Chaves...</h1>
            <p className="text-gray-300 mt-4">Estamos validando seus arquivos .pem contra os registros...</p>
          </div>
        )}

      </div>
    </div>
  );
}