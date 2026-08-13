import { consola } from 'consola'
import nodemailer from 'nodemailer'

const logger = consola.withTag('email')

const FROM_DISPLAY_NAME = 'FeedLog'
const FALLBACK_FROM_ADDRESS = 'noreply@example.com'

function parseBool(v: string | undefined): boolean | undefined {
  if (v === undefined) return undefined
  return ['1', 'true', 'yes', 'on'].includes(v.toLowerCase())
}

export default defineNitroPlugin(() => {
  const resendApiKey = process.env.RESEND_API_KEY
  const brevoApiKey = process.env.BREVO_API_KEY
  const smtpHost = process.env.SMTP_HOST
  const emailFrom = process.env.EMAIL_FROM
  const fromAddress = emailFrom || FALLBACK_FROM_ADDRESS
  const from = `${FROM_DISPLAY_NAME} <${fromAddress}>`

  // 1. Resend — register when API key is available
  if (resendApiKey) {
    registerEmailProvider({
      name: 'resend',
      send: async ({ to, subject, html, text, headers }) => {
        const response = await $fetch<{ id: string }>('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${resendApiKey}` },
          body: { from, to, subject, html, text, headers },
          timeout: 10_000,
          retry: 0,
        })
        logger.info(`Email sent via Resend to=${to} id=${response.id}`)
      },
    })
    logger.info(`Registered email provider: resend (from=${from})`)
  }

  // 2. Brevo API — register when BREVO_API_KEY is available
  if (brevoApiKey) {
    registerEmailProvider({
      name: 'brevo',
      send: async ({ to, subject, html, text, headers }) => {
        const response = await $fetch<{ messageId?: string }>('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'api-key': brevoApiKey,
            'content-type': 'application/json',
            'accept': 'application/json',
          },
          body: {
            sender: { name: FROM_DISPLAY_NAME, email: fromAddress },
            to: [{ email: to }],
            subject,
            htmlContent: html,
            textContent: text,
            headers,
          },
          timeout: 10_000,
          retry: 0,
        })
        logger.info(`Email sent via Brevo API to=${to} messageId=${response.messageId ?? 'ok'}`)
      },
    })
    logger.info(`Registered email provider: brevo (from=${from})`)
  }

  // 3. Generic SMTP Relay (Brevo SMTP, standard SMTP)
  if (smtpHost) {
    const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587
    const smtpUser = process.env.SMTP_USER
    const smtpPass = process.env.SMTP_PASS
    const smtpSecure = parseBool(process.env.SMTP_SECURE) ?? (smtpPort === 465)

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: (smtpUser || smtpPass) ? { user: smtpUser, pass: smtpPass } : undefined,
    })

    registerEmailProvider({
      name: 'smtp',
      send: async ({ to, subject, html, text, headers }) => {
        const info = await transporter.sendMail({
          from,
          to,
          subject,
          html,
          text,
          headers,
        })
        logger.info(`Email sent via SMTP (${smtpHost}:${smtpPort}) to=${to} messageId=${info.messageId}`)
      },
    })
    logger.info(`Registered email provider: smtp (host=${smtpHost}:${smtpPort}, from=${from})`)
  }

  // 4. Console — always registered as fallback for development
  registerEmailProvider({
    name: 'console',
    send: async (options) => {
      logger.info(`[DEV EMAIL] to=${options.to} subject=${options.subject}`)
      const urls = options.html.match(/href="([^"]+)"/g)?.map(m => m.slice(6, -1)) || []
      if (urls.length > 0) {
        logger.info(`[DEV EMAIL] action URL: ${urls[0]}`)
      }
    },
  })
  logger.info('Registered email provider: console')
})
