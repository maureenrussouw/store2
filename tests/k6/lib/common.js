// Shared user journey + helpers for all k6 tests. Editing this single
// file changes the behaviour of every test type: the per-test files
// only differ in their stages (load shape).

import http from 'k6/http'
import { check, sleep } from 'k6'

export const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080'

// SLO thresholds. Adjust these to match your contractual targets.
// They're the gate that turns k6 into a CI regression check.
export const defaultThresholds = {
  http_req_duration: ['p(95)<500', 'p(99)<1000'],
  http_req_failed:   ['rate<0.01'],
  checks:            ['rate>0.99'],
}

// Stress / spike / breakpoint tests intentionally cross thresholds.
// They use looser numbers so the test still finishes (exit code 0)
// when the system is pushed to its real limits.
export const aggressiveThresholds = {
  http_req_duration: ['p(95)<2000'],
  http_req_failed:   ['rate<0.10'],
}

// setup() runs once before the load and hands every virtual user one bearer
// token. A bearer beats the cookie flow here: k6 gives each VU its own cookie
// jar, and the sign-in cookies plus CSRF add a round trip per VU that you did
// not mean to measure.
//
// LOADTEST_EMAIL / LOADTEST_PASSWORD sign in as an account you already have,
// which is how you load-test a route that needs a role: a resource endpoint
// from "grit generate resource" wants ADMIN or its own permission. Without
// them a throwaway USER is registered.
export function setup() {
  const json = { headers: { 'Content-Type': 'application/json' } }
  const existing = Boolean(__ENV.LOADTEST_EMAIL && __ENV.LOADTEST_PASSWORD)
  const email = __ENV.LOADTEST_EMAIL || 'loadtest+' + Date.now() + '@loadtest.local'
  const password = __ENV.LOADTEST_PASSWORD || 'Password123!'

  if (!existing) {
    http.post(BASE_URL + '/api/auth/register', JSON.stringify({
      first_name: 'Load', last_name: 'Test', email: email, password: password,
    }), json)
  }

  const res = http.post(BASE_URL + '/api/auth/login',
    JSON.stringify({ email: email, password: password }), json)
  const token = res.json('data.tokens.access_token')
  if (!token) {
    throw new Error('setup: no access token, login returned ' + res.status +
      '. Is the API running on ' + BASE_URL + ', and has grit migrate been run?')
  }
  return { token: token }
}

// userJourney is one virtual user's loop. Realistic load needs varied
// flows + think time: synthetic hammering finds fake bottlenecks.
export function userJourney(data) {
  // 1. Health check, unauthenticated. The cheapest liveness path, and the
  //    one that tells you the API is still answering under load.
  const health = http.get(BASE_URL + '/api/health')
  check(health, {
    'health: status 200': (r) => r.status === 200,
  })

  // 2. An authenticated read. This is the first request that costs
  //    anything: the auth middleware runs and a row is read.
  const auth = { headers: { Authorization: 'Bearer ' + data.token } }
  const profile = http.get(BASE_URL + '/api/profile', auth)
  check(profile, {
    'profile: status 200': (r) => r.status === 200,
  })

  // 3. Your own resource, named rather than hardcoded:
  //
  //      k6 run -e RESOURCE=products tests/k6/smoke.js
  //
  //    This is the request worth load-testing. The two above are nearly
  //    free, and a journey made of free requests reports a system that is
  //    faster than it is. A hardcoded name would be worse: this file
  //    shipped reading /api/blogs, so every test failed on every project
  //    that had no Blog, and checked for a non-empty body, which an error
  //    response has.
  if (__ENV.RESOURCE) {
    const list = http.get(
      BASE_URL + '/api/' + __ENV.RESOURCE + '?page=1&page_size=20', auth)
    check(list, {
      'resource: status 200': (r) => r.status === 200,
      'resource: returned a data array': (r) => Array.isArray(r.json('data')),
    })
  }

  // Real users pause between actions. Without this, you measure how
  // fast k6 can fire requests, not how the system handles users.
  sleep(1 + Math.random() * 2) // 1 to 3s think time
}
