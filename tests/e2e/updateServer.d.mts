/** Types for tests/e2e/updateServer.mjs. */
export interface UpdateServer {
  url: string;
  serve(version: string): void;
  stop(): Promise<void>;
}
export function startUpdateServer(versions: string[]): Promise<UpdateServer>;
