const { GenerateDataKeyCommand, KMSClient } = require("@aws-sdk/client-kms");
const { PutObjectCommand, S3Client } = require("@aws-sdk/client-s3");

const kmsClient = new KMSClient({});
const s3Client = new S3Client({});

exports.handler = async function handler() {
  const bucketName = process.env.BUCKET_NAME;
  const backupPrefix = process.env.BACKUP_PREFIX || "rotations/";
  const kmsKeyArn = process.env.KMS_KEY_ARN;

  if (!bucketName) {
    throw new Error("BUCKET_NAME must be set");
  }

  if (!kmsKeyArn) {
    throw new Error("KMS_KEY_ARN must be set");
  }

  const generatedAt = new Date().toISOString();
  const timestamp = generatedAt.replace(/[:.]/g, "-");
  const objectKey = `${backupPrefix}data-key-${timestamp}.bin`;

  const dataKey = await kmsClient.send(
    new GenerateDataKeyCommand({
      KeyId: kmsKeyArn,
      KeySpec: "AES_256"
    })
  );

  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
      Body: dataKey.CiphertextBlob,
      ContentType: "application/octet-stream",
      Metadata: {
        generatedAt
      }
    })
  );

  console.log(`Rotation artifact uploaded to s3://${bucketName}/${objectKey}`);

  return {
    status: "ok",
    key: objectKey,
    generatedAt
  };
};
