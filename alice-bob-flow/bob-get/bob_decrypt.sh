#!/bin/bash
#
# bob_decrypt.sh
# Simula o fluxo criptográfico do lado do cliente (Bob) para o SecureShare.
#

# --- Configuração ---
set -e # Sai imediatamente se um comando falhar

# --- DADOS RECEBIDOS DA API ---
# (Bob deve preencher estas variáveis com os dados da API)

SKB_B64="hLprW62cmXROyR/nh+JUVR2N4HWu26lZPGWXE/gW7hgoyeEAhHCIw2p4yOzoJBxYiEJRNviw1UFxpTpjxV2a6ERj0l8W/IbM3P1u1Q69V6NyIcJo/3CXlf1g7H5Hx6UTvRmq9smpEmX0bGP9Mca91iMrWyTwVo2XLTD8ezLAWAeCeqQJhCRrzTyacFmNMGDLbVTltFrdZ+hzirjLcyVk9hE8a0p14mBtTEnhca9/lGdQOBGNgacUnSdjY6ukesKoJBZrGzJLIbLLbaHZ3ZUbal1X0aMeFU5iyNFe/O2EUXNpGUJgV4KzWEbKGwXVbgPT1dyT84WHPkzdQFYhtviBIw=="

SIG_B64="ODBFqGwHuUIzAObc2NlmOwGgQ3CYUSuwzFWmFnZDS4xWUn3M503jFg+Par2zVuM1pcnhXiipA763tUGeiCbKQn85Go8FGMw8t7tu9o1LFXmVCron10/MgiKo7EaKwZ/H/k1Ko//evR8+IMIdg+b59fErw049oxHGYrGEftrcDe9lYV7wC/yajl9G4OoeXycPZO945qY+AqT/8f9Lpr4woztTKKO+JE2OXiRdYynGIUVu3MIKa3MUlCiJgp5ACRB29ZfmhTQi20htdItv/Zfzh/yyrTffAv1GTAeHoJryZye2rc9QZyqe50krJh5t1n1ePdTbr5IeGCBYZW64ynLA+g=="

# --- Arquivos que Bob precisa ---
BOB_PRIV_KEY="bob_private.pem"   # A chave privada secreta de Bob
ALICE_PUB_KEY="alice_public.pem" # A chave pública de Alice (para verificar a assinatura)
FILE_ENC="file.enc"            # O arquivo que foi "baixado" do linkToEncFile

# --- Nomes de arquivos de saída ---
FILE_DECRYPTED="file_DECRYPTED.txt"

# --- Nomes de arquivos intermediários ---
SKB_B64_TXT="skb.base64.txt"
SIG_B64_TXT="sig.base64.txt"
SKB_BIN="skb.bin"
SIG_BIN="sig.bin"
SK_BIN="sk.bin"
DATA_TO_VERIFY="data_to_verify.bin"

# --- Verificações ---
echo "Verificando arquivos de entrada..."
if [ ! -f "$BOB_PRIV_KEY" ]; then
    echo "Erro: Chave privada de Bob '$BOB_PRIV_KEY' não encontrada."
    exit 1
fi
if [ ! -f "$ALICE_PUB_KEY" ]; then
    echo "Erro: Chave pública de Alice '$ALICE_PUB_KEY' não encontrada."
    exit 1
fi
if [ ! -f "$FILE_ENC" ]; then
    echo "Erro: Arquivo criptografado '$FILE_ENC' não encontrado."
    echo "       (Este deve ser o arquivo gerado pelo script da Alice)"
    exit 1
fi

if [ "$SKB_B64" == "COLE_O_SKB_DA_API_AQUI" ] || [ "$SIG_B64" == "COLE_A_SIGNATURE_DA_API_AQUI" ]; then
    echo "---------------------------------------------------------"
    echo "AVISO: Edite este script (bob_decrypt.sh) e preencha"
    echo "       as variáveis SKB_B64 e SIG_B64 com os dados"
    echo "       recebidos da sua API antes de executar."
    echo "---------------------------------------------------------"
    exit 1
fi

echo "Arquivos OK."
echo "---"

# --- Fluxo Criptográfico ---

echo "Passo 1: Salvando metadados da API..."
echo "$SKB_B64" > $SKB_B64_TXT
echo "$SIG_B64" > $SIG_B64_TXT

echo "Passo 2: Decodificando metadados para binário..."
openssl base64 -d -in $SKB_B64_TXT -out $SKB_BIN
openssl base64 -d -in $SIG_B64_TXT -out $SIG_BIN

echo "Passo 3: Decapsulando Chave Simétrica (SK) com Chave de Bob..."
openssl pkeyutl -decrypt -inkey $BOB_PRIV_KEY -in $SKB_BIN -out $SK_BIN -pkeyopt rsa_padding_mode:oaep

echo "Passo 4: Verificando Assinatura (Segurança)..."
# Recria os dados que Alice assinou
cat $FILE_ENC $SKB_BIN > $DATA_TO_VERIFY
# Verifica! (O script falhará aqui se a verificação falhar, por causa do 'set -e')
openssl dgst -sha256 -verify $ALICE_PUB_KEY -signature $SIG_BIN $DATA_TO_VERIFY
echo "-> Assinatura 'Verified OK'."

echo "Passo 5: Descriptografando arquivo final com SK..."
openssl enc -d -aes-256-cbc -in $FILE_ENC -out $FILE_DECRYPTED -pass file:$SK_BIN

echo "---"

# --- Limpeza ---
echo "Limpando arquivos intermediários..."
rm $SKB_B64_TXT $SIG_B64_TXT $SKB_BIN $SIG_BIN $SK_BIN $DATA_TO_VERIFY

echo "✅ Sucesso! Arquivo descriptografado e verificado."
echo ""
echo "Conteúdo de $FILE_DECRYPTED:"
cat $FILE_DECRYPTED