import type { PrototypeState } from '../model'
import type { Store } from '../store'

export type SectionContext = {
  store: Store<PrototypeState>;
  refresh: (notice?: string) => void;
}
