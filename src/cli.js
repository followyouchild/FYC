import cron from 'node-cron'
import { buildMessage, loadConfig } from './config.js'
import { connect, sendToGroup } from './whatsapp.js'

const command = process.argv[2]
const config = loadConfig()

async function withConnection (fn) {
  const conn = connect(config)
  const sock = await conn.ready
  try {
    await fn(sock)
  } finally {
    await conn.close()
  }
}

async function sendWithRetry (conn, text, attempts = 5) {
  for (let i = 1; i <= attempts; i++) {
    try {
      await conn.ready
      await sendToGroup(conn.sock, config.group, text)
      return
    } catch (err) {
      console.error(`Send attempt ${i}/${attempts} failed: ${err.message}`)
      if (i < attempts) await new Promise(resolve => setTimeout(resolve, 60_000))
    }
  }
  console.error('Giving up on today\'s message.')
}

switch (command) {
  case 'login':
    await withConnection(async () => {
      console.log('Linked successfully. Session saved in auth/. Next: "npm run groups".')
    })
    break

  case 'groups':
    await withConnection(async sock => {
      const groups = Object.values(await sock.groupFetchAllParticipating())
        .sort((a, b) => a.subject.localeCompare(b.subject))
      console.log(`\n${groups.length} groups:\n`)
      for (const g of groups) console.log(`${g.id}\t${g.subject}`)
      console.log('\nCopy the name (or the id) of the target group into config.json "group".')
    })
    break

  case 'preview':
    console.log(buildMessage(config))
    break

  case 'send':
    await withConnection(sock => sendToGroup(sock, config.group, buildMessage(config)))
    break

  case 'start': {
    const conn = connect(config, { keepAlive: true })
    await conn.ready
    cron.schedule(config.schedule, () => sendWithRetry(conn, buildMessage(config)), { timezone: config.timezone })
    console.log(`Scheduled "${config.schedule}" (${config.timezone}) for group "${config.group}". Leave this running.`)
    break
  }

  default:
    console.log('Usage: npm run <login|groups|preview|send|start>')
    process.exit(1)
}

if (command !== 'start') process.exit(0)
