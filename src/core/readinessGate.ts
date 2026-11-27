export type ReadinessGate<T> = {
  whenReady: <R>(use: (value: T) => R) => Promise<R>;
  current: () => T | undefined;
};

export function createReadinessGate<T> (load: () => Promise<T>): ReadinessGate<T> {
  let loadedValue: T | undefined
  const loaded = load().then(value => {
    loadedValue = value
    return value
  })

  return {
    whenReady: async use => use(await loaded),
    current: () => loadedValue,
  }
}
