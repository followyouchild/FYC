import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState
} from '@whiskeysockets/baileys'
import pino from 'pino'
import { AUTH_DIR } from './config.js'

const logger = pino({ level: process.env.LOG_LEVEL || 'silent' })

// Opens a WhatsApp Web session for config.phoneNumber and resolves once it is ready.
// On first run (no saved session) it prints a pairing code to enter on the phone.
// Reconnects automatically on transient disconnects.
export function connect (config, { keepAlive = false } = {}) {
  let resolveFirst, rejectFirst
  const firstOpen = new Promise((resolve, reject) => { resolveFirst = resolve; rejectFirst = reject })
  let current = null
  let stopped = false

  async function start () {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR)
    const { version } = await fetchLatestBaileysVersion()
    const sock = makeWASocket({
      version,
      auth: state,
      logger,
      browser: Browsers.ubuntu('Chrome'),
      markOnlineOnConnect: false,
      syncFullHistory: false
    })
    current = sock
    sock.ev.on('creds.update', saveCreds)

    if (!sock.authState.creds.registered) {
      // Give the socket a moment to finish its handshake before asking for a code.
      setTimeout(async () => {
        try {
          const code = await sock.requestPairingCode(config.phoneNumber)
          console.log('\n================ LINK YOUR WHATSAPP ================')
          console.log(`Pairing code for +${config.phoneNumber}:  ${code.match(/.{1,4}/g).join('-')}`)
          console.log('On the phone: WhatsApp > Settings > Linked devices > Link a device')
          console.log('> "Link with phone number instead" > enter the code above.')
          console.log('====================================================\n')
        } catch (err) {
          console.error('Could not request pairing code:', err.message)
        }
      }, 3000)
    }

    sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
      if (connection === 'open') {
        console.log(`[${new Date().toISOString()}] Connected to WhatsApp as +${config.phoneNumber}`)
        resolveFirst(sock)
      } else if (connection === 'close') {
        const status = lastDisconnect?.error?.output?.statusCode
        if (status === DisconnectReason.loggedOut) {
          const err = new Error('WhatsApp session was logged out. Delete the auth/ folder and run "npm run login" again.')
          console.error(err.message)
          rejectFirst(err)
          if (keepAlive) process.exit(1)
          return
        }
        if (stopped) return
        // restartRequired (after pairing) and network drops land here: reconnect.
        console.log(`Connection closed (code ${status ?? 'unknown'}), reconnecting in 5s...`)
        setTimeout(() => start().catch(rejectFirst), 5000)
      }
    })
  }

  start().catch(rejectFirst)

  return {
    ready: firstOpen,
    get sock () { return current },
    async close () {
      stopped = true
      // Let pending writes (creds, acks) flush before closing.
      await new Promise(resolve => setTimeout(resolve, 2000))
      current?.end(undefined)
    }
  }
}

export async function resolveGroupJid (sock, group) {
  if (group.endsWith('@g.us')) return group
  const groups = Object.values(await sock.groupFetchAllParticipating())
  const matches = groups.filter(g => g.subject?.trim().toLowerCase() === group.trim().toLowerCase())
  if (matches.length === 1) return matches[0].id
  if (matches.length > 1) {
    throw new Error(`Several groups are named "${group}". Put one of these ids in config.group instead: ${matches.map(g => g.id).join(', ')}`)
  }
  throw new Error(`No group named "${group}" found for this number. Run "npm run groups" to see the exact names.`)
}

export async function sendToGroup (sock, group, text) {
  const jid = await resolveGroupJid(sock, group)
  await sock.sendMessage(jid, { text })
  console.log(`[${new Date().toISOString()}] Sent to ${jid}: ${text.replace(/\s+/g, ' ').slice(0, 80)}`)
}
