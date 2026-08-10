export function formatPhoneDisplay(value: string): string {
  const digits = value.replace(/\D/g, "").slice(-10);
  if (digits.length < 10) return value;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}
