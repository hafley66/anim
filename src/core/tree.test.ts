import { describe, expect, it } from 'vitest'
import { buildTree, explorerRows, toForest } from './tree'
import { pathOfFor } from './panels'

describe('buildTree (fs panel)', () => {
  const rows = [
    { id: 'a', panel: 'fs', locator: 'src/core/model.ts:1' },
    { id: 'b', panel: 'fs', locator: 'src/core/views.ts:5' },
    { id: 'c', panel: 'fs', locator: 'README.md' },
  ]
  it('groups by prefix, collapses lone chains, counts leaves', () => {
    const root = buildTree(rows, pathOfFor('fs'))
    expect(root.count).toBe(3)
    // src/core collapses into one branch row holding both files
    const branch = [...root.children.values()].find(c => c.seg === 'src/core')
    expect(branch).toBeDefined()
    expect(branch!.count).toBe(2)
  })
  it('toForest attaches share/offset per sibling group', () => {
    const forest = toForest(buildTree(rows, pathOfFor('fs')))
    const shares = forest.map(n => n.share)
    expect(shares.reduce((a, b) => a + b, 0)).toBeCloseTo(1)
    expect(forest[0].offset).toBe(0)
  })
})

describe('explorerRows', () => {
  it('interpolates dirs, sorts, marks depth', () => {
    const rows = explorerRows([
      { path: 'src/core/model.ts', mark: '+' },
      { path: 'src/app.css', mark: '' },
    ])
    expect(rows.map(r => r.key)).toEqual(['src', 'src/app.css', 'src/core', 'src/core/model.ts'])
    expect(rows[0].isDir).toBe(true)
    expect(rows[3]).toMatchObject({ name: 'model.ts', depth: 2, mark: '+' })
  })
  it('trailing slash marks an explicit dir', () => {
    const rows = explorerRows([{ path: 'dist/', mark: '' }])
    expect(rows[0]).toMatchObject({ key: 'dist', isDir: true })
  })
})
