# 🔒 Sistema de Compartilhamento de Arquivos E2E

Este documento descreve a arquitetura de Criptografia Ponta a Ponta (End-to-End Encryption - E2E) para o projeto SecureShare, desenvolvido com Go (Backend) e React/TypeScript (Frontend).

## 1. Visão Geral do Fluxo Criptográfico

O sistema utiliza **Criptografia Híbrida** e **Assinatura Digital** para garantir Confidencialidade, Autenticidade e Integridade.

| Ativo | Tecnologia | Propósito |
| :--- | :--- | :--- |
| **Arquivos Grandes** | Criptografia Simétrica (ex: AES-256) | Rapidez e eficiência. |
| **Chave Simétrica** | Criptografia Assimétrica (ex: RSA ou ECC) | Garantir que só o destinatário possa decifrar a chave. |
| **Autenticidade/Não-Repúdio** | Assinatura Digital | Provar que o remetente é quem diz ser e que o conteúdo não foi alterado. |

O servidor atua como um repositório **Zero-Knowledge**, armazenando apenas dados criptografados e chaves públicas.

---

## 2. Fluxo Completo do Sistema (Alice Envia para Bob)

### A. Preparação (Criação de Conta)

1.  **Client (Alice/Bob):** Gera um par de chaves **Assimétricas** (`Chave Privada`/`Chave Pública`).
2.  **Client (Usuário):** Salva a **Chave Privada** em um local seguro (backup) e a mantém na sessão (Local Storage).
3.  **Client $\to$ Server:** Envia a **Chave Pública** para ser armazenada no Servidor Go.

### B. Envio de Arquivo (Lado de Alice - React)

| Passo | Ação no Client (Alice) | Saída |
| :--- | :--- | :--- |
| **1. Criptografar Conteúdo** | Gera uma **Chave Simétrica** ($\text{SK}$). Criptografa o arquivo grande com $\text{SK}$. | $\text{Arquivo\_Cifrado}$ |
| **2. Encapsular a Chave** | Obtém a **Chave Pública de Bob** (do Servidor). Criptografa a $\text{SK}$ com a Chave Pública de Bob. | $\text{SK}_{B}$ (Chave Encapsulada) |
| **3. Assinar** | Cria um *hash* do ($\text{Arquivo\_Cifrado} + \text{SK}_{B}$). Assina esse *hash* com a **Chave Privada de Alice**. | $\text{Assinatura}_{A}$ |
| **4. Enviar** | Envia ($\text{Arquivo\_Cifrado}$, $\text{SK}_{B}$, $\text{Assinatura}_{A}$) e metadados (Destinatário: Bob) para o Servidor Go. | Dados prontos para o *upload* no Servidor Go. |

### C. Armazenamento (Lado do Servidor - Go)

| Passo | Ação no Servidor (Go) | Justificativa |
| :--- | :--- | :--- |
| **1. Receber Dados** | Recebe a $\text{SK}_{B}$, $\text{Assinatura}_{A}$ e o $\text{Arquivo\_Cifrado}$. | Não tenta decifrar nada. |
| **2. Armazenar Arquivo** | Faz o *upload* do $\text{Arquivo\_Cifrado}$ para o armazenamento (S3/Firebase) e obtém o `fileLink`. | Armazena apenas o dado cifrado. |
| **3. Salvar Metadados** | Armazena no banco de dados: $\text{(fileLink, SK}_{B}, \text{Assinatura}_{A}, \text{sourceUser: Alice, destUser: Bob)}$. | O servidor é Zero-Knowledge. |

### D. Download/Decriptografia (Lado de Bob - React)

| Passo | Ação no Client (Bob) | Resultado |
| :--- | :--- | :--- |
| **1. Recuperar Dados** | Bob solicita o download. O Servidor Go envia $\text{fileLink}$, $\text{SK}_{B}$ e $\text{Assinatura}_{A}$. | Bob tem os dados cifrados e a chave cifrada. |
| **2. Verificar Assinatura** | Usa a **Chave Pública de Alice** (do Servidor) para verificar a $\text{Assinatura}_{A}$ contra o *hash* dos dados recebidos. | **Valida:** Autenticidade de Alice e Integridade do arquivo. |
| **3. Decifrar Chave** | Descriptografa a $\text{SK}_{B}$ usando a **Chave Privada de Bob** (do Local Storage). | Obtém a $\text{SK}$ (Chave Simétrica). |
| **4. Buscar Conteúdo** | Faz o *fetch* (direto ou via Go) do $\text{Arquivo\_Cifrado}$ a partir do `fileLink`. | Obtém o conteúdo binário cifrado. |
| **5. Descriptografar Arquivo** | Usa a $\text{SK}$ (passo 3) para descriptografar o $\text{Arquivo\_Cifrado}$ (passo 4). | Obtém o **Arquivo em Texto Plano**. |
| **6. Forçar Download** | Converte os dados em um `Blob` e inicia o download do arquivo original no navegador. | Bob tem acesso ao arquivo. |

---

## 3. Detalhamento do Módulo Go (Backend)

O backend em Go deve funcionar como um **Key and Metadata Manager** (Gerenciador de Chaves e Metadados):

1.  **API de Chaves Públicas:** Recebe e armazena chaves públicas de usuários, servindo-as mediante autenticação (ex: para Alice obter a chave pública de Bob).
2.  **API de Upload:** Recebe $\text{SK}_{B}$ e $\text{Assinatura}_{A}$, orquestra o upload do $\text{Arquivo\_Cifrado}$ para o serviço de armazenamento (S3/Firebase) e armazena o link/metadados no banco de dados.
3.  **API de Download:** Autentica o usuário (Bob) e fornece os três componentes essenciais para o cliente iniciar o processo de descriptografia:
    * `fileLink` (link para o $\text{Arquivo\_Cifrado}$)
    * $\text{SK}_{B}$ (a Chave Encapsulada)
    * $\text{Assinatura}_{A}$ (a Assinatura Digital)

---

## 4. Detalhamento do Módulo React (Client)

O frontend em React/TypeScript é o **Coração da Segurança**, onde todos os processos criptográficos acontecem:

1.  **Gerador de Chaves:** Componente para gerar o par de chaves e solicitar o backup da chave privada.
2.  **Gerenciamento de Chaves de Sessão:** Código para armazenar a Chave Privada (cifrada com a senha do usuário) no Local Storage e removê-la no logout.
3.  **Módulo Criptográfico (Upload):** Função que implementa as etapas de Criptografia Híbrida (AES + Assinatura) antes de chamar a API de upload do Go.
4.  **Módulo Criptográfico (Download):** Função que lida com o *fetch* do arquivo cifrado, a verificação da assinatura, o desencapsulamento da chave e a descriptografia do arquivo para apresentar o resultado ao usuário.