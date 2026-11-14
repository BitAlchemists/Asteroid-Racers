/** Vite's `?raw` imports: the file's text. */
declare module "*.css?raw" {
  const text: string;
  export default text;
}
