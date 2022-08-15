export const formatBlockHeight = (blockHeight: number) => {
  return String(blockHeight).padStart(12, '0');
};

export const matchAccounts = (
  string: string | undefined | null,
  accounts: string[],
) => {
  if (!string) {
    return false;
  }
  return accounts.some(
    (account) => string === account || string.includes(`.${account}`),
  );
};

export const jsonMatchAccounts = (
  object: unknown,
  accounts: string[],
): boolean => {
  if (!object) {
    return false;
  } else if (typeof object === 'object') {
    return (
      Object.keys(object as object).some((key) =>
        matchAccounts(key, accounts),
      ) ||
      Object.values(object as object).some((value) =>
        jsonMatchAccounts(value, accounts),
      )
    );
  } else if (Array.isArray(object)) {
    return object.some((value) => matchAccounts(value, accounts));
  } else {
    return matchAccounts(String(object), accounts);
  }
};

export const wait = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));
