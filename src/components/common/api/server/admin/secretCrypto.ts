import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const IV_LENGTH = 12;

function getMasterKey() {
  const encoded = process.env.API_SECRET_MASTER_KEY?.trim();

  if (!encoded) {
    throw new Error("API_SECRET_MASTER_KEY 환경 변수가 설정되지 않았습니다.");
  }

  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32) {
    throw new Error("API_SECRET_MASTER_KEY는 32-byte base64 형식이어야 합니다.");
  }

  return key;
}

export function encryptSecret(plainText: string) {
  const key = getMasterKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    encryptedValue: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
  };
}

export function decryptSecret(params: {
  encryptedValue: string;
  iv: string;
  authTag: string;
}) {
  const key = getMasterKey();
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(params.iv, "base64")
  );

  decipher.setAuthTag(Buffer.from(params.authTag, "base64"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(params.encryptedValue, "base64")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

export function maskSecret(value: string) {
  const trimmed = value.trim();
  if (trimmed.length <= 8) {
    return `${trimmed.slice(0, 2)}***${trimmed.slice(-2)}`;
  }

  return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
}
