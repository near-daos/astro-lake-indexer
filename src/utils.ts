export const sleep = async (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const formatBlockHeight = (blockHeight: number) => {
  return String(blockHeight).padStart(12, '0');
}
