// Smoke test — does the script work and does the system handle
// minimal load? PHASE 5 §9.2: run this FIRST before every other type.
import { userJourney, defaultThresholds } from './lib/common.js'

// k6 only runs setup() when the entry script exports it.
export { setup } from './lib/common.js'

export const options = {
  vus: 2,
  duration: '30s',
  thresholds: defaultThresholds,
}

export default userJourney
