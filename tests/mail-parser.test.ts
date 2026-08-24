import { describe, expect, it } from 'vitest'
import { simpleParser } from 'mailparser'

describe('mail parser dependency override', () => {
  it('parses multipart messages with HTML and attachments', async () => {
    const source = [
      'From: Alice <alice@example.com>',
      'To: Me <me@example.com>',
      'Subject: =?UTF-8?B?5rWL6K+V6YKu5Lu2?=',
      'MIME-Version: 1.0',
      'Content-Type: multipart/mixed; boundary="omnimail-test"',
      '',
      '--omnimail-test',
      'Content-Type: text/html; charset=utf-8',
      '',
      '<p>Hello <strong>OmniMail</strong></p>',
      '--omnimail-test',
      'Content-Type: text/plain; name="notes.txt"',
      'Content-Disposition: attachment; filename="notes.txt"',
      'Content-Transfer-Encoding: base64',
      '',
      'bm90ZXM=',
      '--omnimail-test--'
    ].join('\r\n')

    const parsed = await simpleParser(source)
    expect(parsed.subject).toBe('测试邮件')
    expect(parsed.html).toContain('<strong>OmniMail</strong>')
    expect(parsed.attachments).toHaveLength(1)
    expect(parsed.attachments[0]?.content.toString()).toBe('notes')
  })
})
