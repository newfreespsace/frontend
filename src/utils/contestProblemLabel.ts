export function getContestProblemLabel(index: number): string {
  let value = index + 1;
  let label = "";
  while (value > 0) {
    value--;
    label = String.fromCharCode(65 + (value % 26)) + label;
    value = Math.floor(value / 26);
  }
  return label;
}
