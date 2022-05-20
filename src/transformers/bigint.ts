export const bigInt = {
  to: (value: BigInt) => value.toString(),
  from: (value: string) => BigInt(value),
};
