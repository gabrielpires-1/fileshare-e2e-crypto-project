#!/bin/bash
set -e

# Needed files:
FILE_IN="file.txt"
BOB_PUB_KEY="bob_public.pem"
ALICE_PRIV_KEY="alice_private.pem"

# Output files:
SKB_OUT_B64="skb.base64.txt"
SIG_OUT_B64="sig.base64.txt"
SK_BIN="sk.bin"
FILE_ENC="file.enc"
SKB_BIN="skb.bin"
DATA_TO_SIGN="data_to_sign.bin"
SIG_BIN="sig.bin"

echo "Verificando arquivos de entrada..."
if [ ! -f "$FILE_IN" ]; then echo "Erro: '$FILE_IN' não encontrado."; exit 1; fi
if [ ! -f "$BOB_PUB_KEY" ]; then echo "Erro: '$BOB_PUB_KEY' não encontrado."; exit 1; fi
if [ ! -f "$ALICE_PRIV_KEY" ]; then echo "Erro: '$ALICE_PRIV_KEY' não encontrado."; exit 1; fi
echo "Arquivos OK."
echo "---"

echo "Passo 1: Gerando Chave Simétrica (SK)..."
openssl rand -out $SK_BIN 32

echo "Passo 2: Criptografando '$FILE_IN' -> '$FILE_ENC'..."
openssl enc -aes-256-cbc -in $FILE_IN -out $FILE_ENC -pass file:$SK_BIN

echo "Passo 3: Encapsulando SK com Chave de Bob -> '$SKB_BIN'..."
openssl pkeyutl -encrypt -pubin -inkey $BOB_PUB_KEY -in $SK_BIN -out $SKB_BIN -pkeyopt rsa_padding_mode:oaep

echo "Passo 4: Concatenando (File.enc + SKB) para assinatura..."
cat $FILE_ENC $SKB_BIN > $DATA_TO_SIGN

echo "Passo 5: Assinando dados com Chave de Alice -> '$SIG_BIN'..."
openssl dgst -sha256 -sign $ALICE_PRIV_KEY -out $SIG_BIN $DATA_TO_SIGN

echo "Passo 6: Convertendo SKB e Sig para Base64..."
B64_OPTS="-A"
if [[ "$(uname)" == "Darwin" ]]; then B64_OPTS="-b 0"; fi
openssl base64 -in $SKB_BIN $B64_OPTS > $SKB_OUT_B64
openssl base64 -in $SIG_BIN $B64_OPTS > $SIG_OUT_B64

echo "---"
echo "Limpando arquivos intermediários..."
# VAI MANTER O file.enc!
rm $SK_BIN $SKB_BIN $DATA_TO_SIGN $SIG_BIN 

echo "✅ Sucesso! (Alice)"
echo "Arquivo criptografado '$FILE_ENC' foi gerado."
echo "Copie o conteúdo abaixo para sua API:"
echo ""
echo "SKB (conteúdo de $SKB_OUT_B64):"
cat $SKB_OUT_B64
echo ""
echo "Sig (conteúdo de $SIG_OUT_B64):"
cat $SIG_OUT_B64