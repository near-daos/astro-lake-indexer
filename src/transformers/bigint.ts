export const int = {
  to: (value: number) => String(value),
  from: (value: string) => parseInt(value),
}

export const bigInt = {
  to: (value: bigint) => value.toString(),
  from: (value: string) => BigInt(value),
};
