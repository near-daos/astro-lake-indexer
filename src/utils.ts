export const formatBlockHeight = (blockHeight: number) => {
  return String(blockHeight).padStart(12, '0');
};

export const matchAccount = (account: string, match: string) => {
  return account === match || account.includes(`.${match}`);
};

export const matchAccounts = (account: string, matches: string[]) => {
  return matches.some((match) => matchAccount(account, match));
};
