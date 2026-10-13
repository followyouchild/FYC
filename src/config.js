import fs from 'node:fs'
import path from 'node:path'
import cron from 'node-cron'

export const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
export const AUTH_DIR = path.join(ROOT, 'auth')
const CONFIG_PATH = process.env.CONFIG_PATH || path.join(ROOT, 'config.json')

export function loadConfig () {
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error(`Missing ${CONFIG_PATH}. Copy config.example.json to config.json and edit it.`)
  }
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'))
  config.phoneNumber = String(config.phoneNumber || '').replace(/\D/g, '')
  config.timezone ||= 'Asia/Kolkata'
  if (!config.phoneNumber) throw new Error('config.phoneNumber is required (country code + number, digits only)')
  if (!cron.validate(config.schedule || '')) throw new Error(`config.schedule is not a valid cron expression: ${config.schedule}`)
  if (!Array.isArray(config.messages) || config.messages.length === 0) throw new Error('config.messages must be a non-empty array')
  return config
}

// Picks one message per day, cycling through config.messages, and fills in placeholders.
export function buildMessage (config, now = new Date()) {
  const fmt = (opts) => new Intl.DateTimeFormat('en-IN', { timeZone: config.timezone, ...opts }).format(now)
  const ymd = fmt({ year: 'numeric', month: '2-digit', day: '2-digit' }).split('/').reverse().join('-')
  const dayNumber = Math.floor(Date.parse(`${ymd}T00:00:00Z`) / 86_400_000)
  const template = config.messages[dayNumber % config.messages.length]
  const values = {
    date: fmt({ day: 'numeric', month: 'long', year: 'numeric' }),
    weekday: fmt({ weekday: 'long' }),
    day: fmt({ day: 'numeric' }),
    month: fmt({ month: 'long' }),
    year: fmt({ year: 'numeric' })
  }
  return template.replace(/\{(\w+)\}/g, (match, key) => values[key] ?? match)
}
