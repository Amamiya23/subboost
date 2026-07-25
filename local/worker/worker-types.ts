export interface D1Database {
  prepare(query: string): unknown;
  batch<T = unknown>(statements: unknown[]): Promise<T[]>;
  exec(query: string): Promise<unknown>;
  dump(): Promise<ArrayBuffer>;
}

export interface WorkersFetcher {
  fetch(request: Request): Promise<Response>;
}

export interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

export interface ScheduledController {
  readonly scheduledTime: number;
  readonly cron: string;
  noRetry(): void;
}

export interface ExportedHandler<Env = unknown> {
  fetch?(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> | Response;
  scheduled?(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> | void;
}
