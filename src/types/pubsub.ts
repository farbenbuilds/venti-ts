export type EventMap = {
  readonly [event: string]: readonly unknown[]
}

export type Handler<Args extends readonly unknown[]> = (...args: Args) => void

export type Registry<E extends EventMap> = {
  [K in keyof E]?: readonly Handler<E[K]>[]
}
