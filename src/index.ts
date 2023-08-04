import { Context, Schema, Logger } from 'koishi'
import { createWriteStream } from 'fs'
import { existsSync, promises as fs } from 'fs'
import { mkdir } from 'fs/promises'
import AdmZip from 'adm-zip'
import axios from 'axios'
import env from 'env-paths'
import { resolve } from 'path'
import { spawn, SpawnOptions } from 'child_process'
import { extract } from 'tar'

export const name = 'qsign'
export const logger = new Logger(name)
export interface Config {
  version: string
}

export const Config: Schema<Config> = Schema.object({
  version: Schema.string().description('版本选择').default('v1.1.1-dev'),
})

export async function apply(ctx:Context, config: Config) {
  const basename = `go-cqhttp${process.platform === 'win32' ? '.exe' : ''}`
  const binary = resolve(env('gocqhttp').data, config.version, basename)
  if (!existsSync(binary)) {
    const platform = getPlatform(process.platform)
    const arch = getArch(process.arch)
    await downloadRelease(platform, arch, config.version)
  }
  logger.info('环境准备就绪！')

}

export function getArch(arch: string = process.arch) {
  switch (arch) {
    case 'ia32': return '386'
    case 'x64': return 'amd64'
    case 'arm64': return 'arm64'
    case 'arm': return 'arm'
  }
  throw new Error(`Unsupported architecture: ${arch}`)
}

export function getPlatform(platform: string = process.platform) {
  switch (platform) {
    case 'darwin': return 'darwin'
    case 'linux': return 'linux'
    case 'win32': return 'windows'
  }
  throw new Error(`Unsupported platform: ${platform}`)
}

export function getEnvPath(version: string) {
  const basename = `go-cqhttp_${getPlatform()}_${getArch()}${process.platform === 'win32' ? '.exe' : ''}`
  return resolve(env('gocqhttp').data, version, basename)
}

export async function downloadRelease(platform: string, arch: string, version: string) {
  // https://gitee.com/initencunter/go-cqhttp-dev/releases/download/v1.1.1-dev/go-cqhttp-windows-amd64.zip
  const filename = `go-cqhttp-${platform}-${arch}.${(getPlatform() === "windows" ? "zip" : "tar.gz")}`
  const url = `https://gitee.com/initencunter/go-cqhttp-dev/releases/download/${version}/${filename}`

  logger.info(`正在安装 go-cqhttp ${url}`)
  const [{ data: stream }] = await Promise.all([
    axios.get<NodeJS.ReadableStream>(url, { responseType: 'stream' }),
  ])
  return new Promise<void>(async (resolved, reject) => {
    stream.on('end', resolved)
    stream.on('error', reject)
    const gocqpath = resolve(env('gocqhttp').data)
    logger.info(gocqpath)
    // windows
    if (filename.endsWith('.zip')) {
      const gocqpath2 = resolve(gocqpath,version)
      await mkdir(gocqpath2, { recursive: true }),
      stream.pipe(createWriteStream(resolve(gocqpath2,'go-cqhttp.zip'))).on("finish",()=>{
        const adm = new AdmZip(resolve(gocqpath2,'go-cqhttp.zip'))
        adm.extractAllTo(gocqpath2,true)
      }).on("error",(err)=>{
        reject(err)
      })    
    } else {
      stream.pipe(extract({ gocqpath , newer: true }, ['go-cqhttp']))
      const cmd = `chmod x+ ${resolve(gocqpath,'go-cqhttp')}`
      logger.info(cmd)
      spawn(cmd)
    }

  })
}


export function gocq(options: gocq.Options = {}, version: string) {
  const basename = `go-cqhttp${process.platform === 'win32' ? '.exe' : ''}`
  const binary = resolve(env('gocqhttp').data, version, basename)
  const backup = resolve(__dirname, '../bin', basename)
  const args: string[] = []
  logger.info(binary)
  if (options.faststart) args.push('-faststart')
  return spawn(binary, args, {
    env: {
      FORCE_TTY: '1',
      ...process.env,
      ...options.env,
    },
    ...options,
  })
}

namespace gocq {
  export interface Options extends SpawnOptions {
    faststart?: boolean
  }
}