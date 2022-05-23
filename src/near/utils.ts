export const parseKind = <T extends string>(kind: object | string) => {
  if (typeof kind === 'object') {
    const [actionKind] = Object.keys(kind) as T[];
    return actionKind;
  } else {
    return kind as T;
  }
};
