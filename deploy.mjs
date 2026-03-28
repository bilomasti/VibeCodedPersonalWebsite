import FtpDeploy from 'ftp-deploy'
import { config } from 'dotenv'

config()

const ftpDeploy = new FtpDeploy()

const cfg = {
  user: process.env.FTP_USER,
  password: process.env.FTP_PASSWORD,
  host: process.env.FTP_HOST,
  port: 21,
  localRoot: './dist',
  remoteRoot: process.env.FTP_REMOTE_PATH || '/public_html',
  include: ['*', '**/*'],
  deleteRemote: false,
  forcePasv: true,
}

console.log(`Deploying to ${cfg.host}${cfg.remoteRoot}...`)

ftpDeploy
  .deploy(cfg)
  .then(() => console.log('Deploy complete.'))
  .catch(err => {
    console.error('Deploy failed:', err)
    process.exit(1)
  })
