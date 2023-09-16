import { Context, Schema, Logger } from 'koishi'
import { createWriteStream, unlinkSync } from 'fs'
import { existsSync, promises as fs } from 'fs'
import { mkdir } from 'fs/promises'
import AdmZip from 'adm-zip'
import axios from 'axios'
import env from 'env-paths'
import { resolve } from 'path'
import { spawn, SpawnOptions } from 'child_process'
import { extract } from 'tar'
import zlib from 'zlib'

export const name = 'gocqhttp-dev'
export const logger = new Logger(name)
export interface Config {
  source: string
  version: string
}

export const Config: Schema<Config> = Schema.object({
  version: Schema.union([
    Schema.const('v1.1.1-dev-f16d72f' as string).description("v1.1.1-dev-f16d72f,发行日期2023-08-31"),
    Schema.const('v1.1.1-dev-d85d697' as string).description("v1.1.1-dev-d85d697, 发行日期2023-08-29"),
  ]).default('v1.1.1-dev-f16d72f').description('版本选择'),
  source: Schema.string().default("https://gitee.com/initencunter/go-cqhttp-dev/releases/download").description("下载源")
})

export const usage = `
# koishi-plugin-qsign

[![npm](https://img.shields.io/npm/v/koishi-plugin-qsign?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-qsign)


启用即可自动安装 [go-cqhttp-dev](https://github.com/rhwong/go-cqhttp-dev)

专属启动器 koishi-plugin-gocqhttp-dev

由于 go-cqhttp-dev 的 [releases](https://github.com/rhwong/go-cqhttp-dev/releases/tag/v1.1.1-dev) 中不存在 darwin, 目前只支持 windows 和 linux 平台

本插件抄自[node-gocqhttp](https://github.com/koishijs/node-gocqhttp)

部署 SignServer [点我](https://github.com/fuqiuluo/unidbg-fetch-qsign/wiki)

## 问题反馈
* QQ群：399899914<br>
* 小伙伴如果遇到问题或者有新的想法，欢迎到[这里](https://github.com/initialencounter/koishi-plugin-qsign/issues)反馈哦~
`

export async function apply(ctx: Context, config: Config) {
  const basename = `go-cqhttp${process.platform === 'win32' ? '.exe' : ''}`
  const binary = resolve(env('gocqhttp').data, config.version, basename)
  if (!existsSync(binary)) {
    const platform = getPlatform(process.platform)
    const arch = getArch(process.arch)
    await downloadRelease(platform, arch, config.version, config.source)
    if (platform !== "windows") {
      fs.chmod(binary, '755').then(stat => {
        logger.info(stat)
      }).catch(e => {
        logger.error(e)
      })
    }
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
    case 'android': return 'linux'
  }
  throw new Error(`Unsupported platform: ${platform}`)
}

export function getEnvPath(version: string) {
  const basename = `go-cqhttp_${getPlatform()}_${getArch()}${process.platform === 'win32' ? '.exe' : ''}`
  return resolve(env('gocqhttp').data, version, basename)
}

export async function downloadRelease(platform: string, arch: string, version: string, source: string) {
  const filename = `go-cqhttp-${platform}-${arch}.${(getPlatform() === "windows" ? "zip" : "tar.gz")}`

  const url = `${source}/${version}/${filename}`

  logger.info(`正在安装 go-cqhttp ${url}`)

  const gocqpath = resolve(env('gocqhttp').data)
  const gocqpath2 = resolve(gocqpath, version)
  logger.info(gocqpath)

  const [{ data: stream }] = await Promise.all([
    axios.get<NodeJS.ReadableStream>(url, { responseType: 'stream' }),
    await mkdir(gocqpath2, { recursive: true }),
  ])
  return new Promise<void>(async (resolved, reject) => {
    stream.on('end', resolved)
    stream.on('error', reject)

    // windows
    if (filename.endsWith('.zip')) {
      stream.pipe(createWriteStream(resolve(gocqpath2, 'go-cqhttp.zip'))).on("finish", () => {
        const adm = new AdmZip(resolve(gocqpath2, 'go-cqhttp.zip'))
        adm.extractAllTo(gocqpath2, true)
      }).on("error", (err) => {
        reject(err)
      }).on("finish",()=>{
        unlinkSync('go-cqhttp.zip')
      })
    } else {
      stream.pipe(zlib.createGunzip())
        .pipe(extract({ cwd: gocqpath2 }))
    }

  })
}


export function gocq(options: gocq.Options = {}, version: string) {
  const basename = `go-cqhttp${process.platform === 'win32' ? '.exe' : ''}`
  const binary = resolve(env('gocqhttp').data, version, basename)
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