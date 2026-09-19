import { expect, test } from 'vitest'
import { loadAddon } from '../src/binding/load'

test('loads the native addon', () => {
  expect(typeof loadAddon().engineVersion).toBe('function')
})

test('reports the pinned uWebZockets release', () => {
  expect(loadAddon().engineVersion()).toBe('1.1.0')
})
