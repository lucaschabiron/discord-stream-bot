declare module "node:sqlite" {
  type RunResult = {
    changes: number;
    lastInsertRowid: number | bigint;
  };

  interface PreparedStatement<T = any> {
    run(...parameters: unknown[]): RunResult;
    all(...parameters: unknown[]): T[];
  }

  export class DatabaseSync {
    constructor(filename: string);
    exec(source: string): void;
    prepare<T = any>(source: string): PreparedStatement<T>;
  }
}
