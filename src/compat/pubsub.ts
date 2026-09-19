import type { EventMap, Handler, Registry } from "../types/pubsub"

export function createRegistry<E extends EventMap>(): Registry<E> {
  return {}
}

export function listenerCount<E extends EventMap, K extends keyof E>(
  registry: Registry<E>,
  event: K,
): number {
  return registry[event]?.length ?? 0
}

export function subscribe<E extends EventMap, K extends keyof E>(
  registry: Registry<E>,
  event: K,
  handler: Handler<E[K]>,
): Registry<E> {
  const bucket = registry[event] ?? []
  return { ...registry, [event]: [...bucket, handler] }
}

export function unsubscribe<E extends EventMap, K extends keyof E>(
  registry: Registry<E>,
  event: K,
  handler: Handler<E[K]>,
): Registry<E> {
  const bucket = registry[event]
  if (bucket === undefined) return registry
  const index = bucket.lastIndexOf(handler)
  if (index === -1) return registry
  return { ...registry, [event]: bucket.toSpliced(index, 1) }
}

export function dispatch<E extends EventMap, K extends keyof E>(
  registry: Registry<E>,
  event: K,
  ...args: E[K]
): number {
  const bucket = registry[event]
  if (bucket === undefined) return 0
  for (let index = 0; index < bucket.length; index += 1) {
    bucket[index](...args)
  }
  return bucket.length
}
