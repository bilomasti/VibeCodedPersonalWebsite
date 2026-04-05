import { config } from 'dotenv'
import { execSync } from 'child_process'
import { Client } from 'ssh2'
import fs from 'fs'
import path from 'path'

config()

const host = process.env.SSH_HOST
const user = process.env.SSH_USER
const port = parseInt(process.env.SSH_PORT) || 22
const remotePath = process.env.SSH_REMOTE_PATH || '~/public_html'
const keyPath = fs.existsSync(`${process.env.USERPROFILE}/.ssh/id_ed25519`)
  ? `${process.env.USERPROFILE}/.ssh/id_ed25519`
  : `${process.env.USERPROFILE}/.ssh/id_rsa`
const privateKey = fs.readFileSync(keyPath)

// Build first
console.log('Building...')
execSync('npm run build', { stdio: 'inherit' })

// Upload via SSH/SCP
async function getHomeDir() {
  return new Promise((resolve, reject) => {
    const conn = new Client()
    conn.on('ready', () => {
      conn.exec('echo $HOME', (_err, stream) => {
        let out = ''
        stream.on('data', d => out += d)
        stream.on('close', () => { conn.end(); resolve(out.trim()) })
      })
    }).connect({ host, port, username: user, privateKey })
    conn.on('error', reject)
  })
}

async function uploadDir(localDir, remoteDir) {
  return new Promise((resolve, reject) => {
    const conn = new Client()
    conn.on('ready', () => {
      conn.sftp((err, sftp) => {
        if (err) return reject(err)

        const files = getAllFiles(localDir)
        let pending = files.length
        if (pending === 0) { conn.end(); return resolve() }

        // Ensure all remote dirs exist first, then upload
        const dirs = [...new Set(files.map(f => {
          const rel = path.relative(localDir, path.dirname(f))
          return rel ? `${remoteDir}/${rel.replace(/\\/g, '/')}` : remoteDir
        }))]
        const mkdirCmd = `mkdir -p ${dirs.join(' ')} && echo ok`

        conn.exec(mkdirCmd, (_err, stream) => {
          stream.on('close', () => {
            // Upload files after all dirs are created
            files.forEach(file => {
              const rel = path.relative(localDir, file).replace(/\\/g, '/')
              const remoteFile = `${remoteDir}/${rel}`
              sftp.fastPut(file, remoteFile, err => {
                if (err) console.error(`Failed: ${rel}`, err.message)
                else process.stdout.write('.')
                if (--pending === 0) { console.log('\n'); conn.end(); resolve() }
              })
            })
          })
          stream.resume()
        })
      })
    }).connect({ host, port, username: user, privateKey })
    conn.on('error', reject)
  })
}

function getAllFiles(dir) {
  const files = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) files.push(...getAllFiles(full))
    else files.push(full)
  }
  return files
}

console.log(`Deploying to ${user}@${host}:${remotePath}...`)
getHomeDir()
  .then(home => uploadDir('./dist', remotePath.replace('~', home)))
  .then(() => console.log('Deploy complete.'))
  .catch(err => { console.error('Deploy failed:', err); process.exit(1) })
