export class UnsupportedError extends Error {
  readonly code = 2;
  constructor(message: string) {
    super(message);
    this.name = "UnsupportedError";
  }
}
