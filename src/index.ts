import { Context, Schema, Logger } from 'koishi'
import { createWriteStream } from 'fs'
import { copyFileSync, existsSync, mkdirSync, promises as fs } from 'fs'
import { mkdir, rm, writeFile } from 'fs/promises'
import { join } from 'path'
import AdmZip from 'adm-zip'
import axios from 'axios'
import env from 'env-paths'
import { dirname, resolve } from 'path'
import { spawn, SpawnOptions } from 'child_process'
import { version } from 'os'
import { log } from 'console'

export const name = 'qsign'
export const logger = new Logger(name)
export interface Config {
  version: string
}

export const Config: Schema<Config> = Schema.object({
  version: Schema.string().description('版本选择').description('v31'),
})

export async function apply(ctx: Context, config: Config) {
  const basename = `go-cqhttp_${getPlatform()}_${getArch()}${process.platform === 'win32' ? '.exe' : ''}`
  const binary = resolve(env('gocqhttp').data, config.version, basename)
  const cwd = join(__dirname, '../temp')
  
  if(!existsSync(binary)){
    const platform = getPlatform(process.platform)
    const arch = getArch(process.arch)
    await downloadRelease(cwd, platform, arch, config.version)
    rm(cwd,{recursive:true})
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

export function getEnvPath(version:string){
  const basename = `go-cqhttp_${getPlatform()}_${getArch()}${process.platform === 'win32' ? '.exe' : ''}`
  return resolve(env('gocqhttp').data, version, basename)
}

export async function downloadRelease(cwd: string, platform: string, arch: string, version: string) {
  // https://gitee.com/initencunter/go-cqhttp-dev/releases/download/v31/darwin_arm64.zip
  const filename = `${platform}_${arch}.zip`
  const url = `https://gitee.com/initencunter/go-cqhttp-dev/releases/download/${version}/${filename}`

  logger.info(`正在安装 go-cqhttp ${url}`)
  const [{ data: stream }] = await Promise.all([
    axios.get<NodeJS.ReadableStream>(url, { responseType: 'stream' }),
    mkdir(cwd, { recursive: true }),
  ])
  return new Promise<void>((resolved, reject) => {
    stream.on('end', resolve)
    stream.on('error', reject)
    stream.pipe(createWriteStream(resolve(cwd, `${version}.zip`))).on('finish', () => {
      const gocqpath = resolve(env('gocqhttp').data)
      const adm = new AdmZip(resolve(cwd, `${version}.zip`));
      adm.extractAllTo(resolve(gocqpath, version), true);
      //const backup = resolve(__dirname, '../bin', 'go-cqhttp' + (process.platform === 'win32' ? '.exe' : ''))
      //copyFileSync(gocqpath,backup)
      resolved();
    })
      .on('error', (error) => {
        reject(error);
      });
  })
}


export function gocq(options: gocq.Options = {},version:string) {
  const basename = `go-cqhttp_${getPlatform()}_${getArch()}${process.platform === 'win32' ? '.exe' : ''}`
  const binary = resolve(env('gocqhttp').data, version, basename)
  const backup = resolve(__dirname, '../bin', basename)
  const args: string[] = []
  if (!existsSync(resolve(join(__dirname, '../temp'),`${version}.zip`))) {
    logger.info('警告！备份文件丢失！')
  }
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

function getFileSize(filePath:string) {
  return new Promise((resolve, reject) => {
    fs.stat(filePath).then((stat)=>{
      resolve(stat.size)
    }).catch((e)=>{
      reject(e)
    })
  });
}