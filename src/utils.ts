export const replaceAll = (str: string, find: string[], replace: string[]): string => {
  if (find.length !== replace.length) {
    throw Error('find and replace arrays must be of equal length');
  }
  if (find.length === 0) return str;
  const replaced = str.replaceAll(find[0]!, replace[0]!);
  return replaceAll(replaced, find.slice(1), replace.slice(1));
};

export const format = (str: string) => str.toLowerCase().trim().replace(/\s/g, '');
