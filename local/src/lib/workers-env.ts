export type WorkersEnv = {
  DB?: unknown;
  [key: string]: unknown;
};

let capturedEnv: WorkersEnv | null = null;

export function setWorkersEnv(env: unknown): void {
  capturedEnv = (env ?? null) as WorkersEnv | null;
}

export function getWorkersEnv(): WorkersEnv | null {
  return capturedEnv;
}
