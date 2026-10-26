// Bindings shared by the worker's helper modules. Kept free of Cloudflare-only
// types (Queue, MessageBatch) so helpers and their tests type-check under the
// repo's tsconfig; worker.ts extends this with the queue binding.
export interface BaseEnv {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  GEMINI_API_KEY: string;
  COACHING_WORKER_SECRET: string;
  /** TypeSafe Jev. Optional: scoring is skipped (with a log line) when unset. */
  TYPESAFE_API_KEY?: string;
}

// Structural stand-ins for Cloudflare's Queue types. The repo does not install
// @cloudflare/workers-types, and these are the only members the worker uses.
export interface QueueLike<T> {
  sendBatch(messages: Array<{ body: T }>): Promise<void>;
}

export interface QueueMessageLike<T> {
  body: T;
  attempts: number;
  ack(): void;
  retry(options?: { delaySeconds?: number }): void;
}

export interface MessageBatchLike<T> {
  messages: QueueMessageLike<T>[];
}
