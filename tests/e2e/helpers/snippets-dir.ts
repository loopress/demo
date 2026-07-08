import {readdirSync} from 'node:fs'
import {join} from 'node:path'

export const SNIPPETS_DIR = join(process.cwd(), 'snippets')

// `lps snippet pull` names files `<id>-<slugified-name>.<ext>`; matching by id prefix avoids
// each test having to reimplement the CLI's slugify logic just to find its own output.
export function findPulledFiles(id: number): string[] {
  return readdirSync(SNIPPETS_DIR)
    .filter((name) => name.startsWith(`${id}-`))
    .map((name) => join(SNIPPETS_DIR, name))
}
