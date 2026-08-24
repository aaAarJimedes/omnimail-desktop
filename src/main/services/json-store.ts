import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'

export class JsonStore<T> {
  private writeQueue: Promise<void> = Promise.resolve()

  constructor(
    private readonly filename: string,
    private readonly fallback: () => T
  ) {}

  async read(): Promise<T> {
    try {
      return JSON.parse(await readFile(this.filename, 'utf8')) as T
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return this.fallback()
      throw new Error(`无法读取本地数据：${(error as Error).message}`)
    }
  }

  async write(value: T): Promise<void> {
    this.writeQueue = this.writeQueue.catch(() => undefined).then(async () => {
      await mkdir(path.dirname(this.filename), { recursive: true })
      const tempFile = `${this.filename}.${process.pid}.tmp`
      await writeFile(tempFile, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
      await rename(tempFile, this.filename)
    })
    return this.writeQueue
  }

  async update(mutator: (value: T) => T | Promise<T>): Promise<T> {
    const updated = await mutator(await this.read())
    await this.write(updated)
    return updated
  }
}
