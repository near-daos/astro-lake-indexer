export const bigInt = {
  to: (value: bigint) => value.toString(),
  from: (value: string) => BigInt(value),
};
