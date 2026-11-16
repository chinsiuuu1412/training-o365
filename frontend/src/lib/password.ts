export const PASSWORD_MIN_BYTES = 12;
export const PASSWORD_MAX_BYTES = 72;
export const PASSWORD_POLICY_HINT =
  "Từ 12 đến 72 byte UTF-8 (thường tương đương 12–72 ký tự ASCII).";

const textEncoder = new TextEncoder();

export function getUtf8ByteLength(value: string): number {
  return textEncoder.encode(value).length;
}

export function validatePasswordBytes(
  password: string,
  label = "Mật khẩu",
): { valid: boolean; byteLength: number; error: string | null } {
  const byteLength = getUtf8ByteLength(password);
  if (byteLength < PASSWORD_MIN_BYTES || byteLength > PASSWORD_MAX_BYTES) {
    return {
      valid: false,
      byteLength,
      error: `${label} phải có độ dài từ ${PASSWORD_MIN_BYTES} đến ${PASSWORD_MAX_BYTES} byte UTF-8 (hiện tại: ${byteLength} byte).`,
    };
  }
  return { valid: true, byteLength, error: null };
}

export function assertValidPasswordBytes(password: string, label = "Mật khẩu"): void {
  const result = validatePasswordBytes(password, label);
  if (!result.valid && result.error) {
    throw new Error(result.error);
  }
}
