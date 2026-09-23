/**
 * Dígito verificador GS1 (módulo 10) para EAN-13 e EAN-8: da direita para a
 * esquerda, sem contar o verificador, os dígitos alternam peso 3 e 1.
 * Descarta leituras erradas da câmera (design D2 da T-07).
 */
export function isValidGtin(code: string): boolean {
  if (!/^(\d{8}|\d{13})$/.test(code)) return false
  const digits = code.split('').map(Number)
  const check = digits.pop() as number
  const sum = digits.reverse().reduce((acc, digit, i) => acc + digit * (i % 2 === 0 ? 3 : 1), 0)
  return (10 - (sum % 10)) % 10 === check
}
