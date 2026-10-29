import { connect } from 'node:net'

/**
 * Multipart POST over raw TCP socket — firmware replies with duplicate
 * Content-Length header, which fetch and node:http reject. Only status line parsed.
 * dir passed raw (not URL-encoded).
 */
export function uploadToDevice(deviceUrl, uploadDir, jpeg, fileName = 'claude_usage.jpg') {
  return new Promise((resolve, reject) => {
    const url = new URL(deviceUrl)
    const boundary = `----UploadBoundary${Date.now().toString(16)}`
    const body = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\n` +
          `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n` +
          `Content-Type: image/jpeg\r\n\r\n`
      ),
      jpeg,
      Buffer.from(`\r\n--${boundary}--\r\n`)
    ])
    const head =
      `POST ${url.pathname}?dir=${uploadDir} HTTP/1.1\r\n` +
      `Host: ${url.host}\r\n` +
      `Content-Type: multipart/form-data; boundary=${boundary}\r\n` +
      `Content-Length: ${body.length}\r\n` +
      `Connection: close\r\n\r\n`

    const socket = connect({ host: url.hostname, port: Number(url.port) || 80 })
    let response = ''
    let settled = false
    const finish = (fn) => {
      if (!settled) {
        settled = true
        socket.destroy()
        fn()
      }
    }

    socket.setTimeout(10_000, () => finish(() => reject(new Error('Device upload timed out after 10 s'))))
    socket.on('error', (error) => finish(() => reject(error)))
    socket.on('connect', () => {
      socket.write(head)
      socket.write(body)
    })
    socket.on('data', (chunk) => {
      response += chunk.toString('latin1')
      const match = response.match(/^HTTP\/\d\.\d (\d{3})/)
      if (match) finish(() => resolve(Number(match[1])))
      else if (response.length > 1024) finish(() => reject(new Error('Device sent an invalid HTTP response')))
    })
    socket.on('close', () => finish(() => reject(new Error('Device closed the connection without responding'))))
  })
}
