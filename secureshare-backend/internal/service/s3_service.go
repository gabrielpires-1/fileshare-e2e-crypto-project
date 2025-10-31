// internal/service/s3_service.go
package service

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

// S3Service encapsula o cliente S3
type S3Service struct {
	s3Client      *s3.Client
	presignClient *s3.PresignClient
	bucketName    string
}

// NewS3Service cria um novo serviço S3
func NewS3Service(s3Client *s3.Client, bucketName string) *S3Service {
	return &S3Service{
		s3Client: s3Client,
		// O PresignClient é o que realmente cria as URLs
		presignClient: s3.NewPresignClient(s3Client),
		bucketName:    bucketName,
	}
}

// GeneratePresignedPutURL gera uma URL para o cliente fazer upload (PUT)
func (s *S3Service) GeneratePresignedPutURL(ctx context.Context, objectKey string, lifetime time.Duration) (string, error) {
	if objectKey == "" {
		return "", fmt.Errorf("objectKey não pode ser vazio")
	}

	// Cria a requisição para a operação PutObject
	request, err := s.presignClient.PresignPutObject(ctx, &s3.PutObjectInput{
		Bucket: aws.String(s.bucketName),
		Key:    aws.String(objectKey),
	}, s3.WithPresignExpires(lifetime)) // Define o tempo de expiração

	if err != nil {
		log.Printf("Erro ao gerar Presigned PUT URL para %s: %v", objectKey, err)
		return "", fmt.Errorf("falha ao gerar URL de upload")
	}

	return request.URL, nil
}

func (s *S3Service) GeneratePresignedGetURL(ctx context.Context, objectKey string, lifetime time.Duration) (string, error) {
	if objectKey == "" {
		return "", fmt.Errorf("objectKey não pode ser vazio")
	}

	// Cria a requisição para a operação GetObject
	request, err := s.presignClient.PresignGetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(s.bucketName),
		Key:    aws.String(objectKey),
	}, s3.WithPresignExpires(lifetime))

	if err != nil {
		log.Printf("Erro ao gerar Presigned GET URL para %s: %v", objectKey, err)
		return "", fmt.Errorf("falha ao gerar URL de download")
	}

	return request.URL, nil
}
