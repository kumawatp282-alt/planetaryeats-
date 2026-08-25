// EUR formatting — German convention (comma decimal, symbol after amount).
export function formatPrice(amount: number): string {
  return `${amount.toFixed(2).replace('.', ',')} €`;
}
