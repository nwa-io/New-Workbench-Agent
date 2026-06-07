export const $ = <T extends Element>(id: string): T =>
  document.getElementById(id) as unknown as T;
