import { buildCard } from '../../../mini-display-claude-ai-usage/src/app.mjs'
import { uploadToDevice } from '../../../mini-display-claude-ai-usage/src/device.mjs'
import { createCardJob } from '../card-job.mjs'
import { buildBtcCard } from './btc.mjs'

const UPLOAD_DIR = '/photo/'

/** Every card the panel can put on the clock, keyed by id. `file` is its name in /photo/. */
export function createCards({ uploadUrl, claudeIntervalMinutes, btcIntervalMinutes }) {
  const uploadAs = (fileName) => async (jpeg) => {
    const status = await uploadToDevice(uploadUrl, UPLOAD_DIR, jpeg, fileName)
    if (status < 200 || status >= 300) throw new Error(`Device responded ${status}`)
  }
  return {
    claude: {
      file: 'claude_usage.jpg',
      job: createCardJob({
        build: ({ mock }) => buildCard(null, { mock }),
        upload: uploadAs('claude_usage.jpg'),
        intervalMinutes: claudeIntervalMinutes
      })
    },
    btc: {
      file: 'btc_price.jpg',
      job: createCardJob({ build: buildBtcCard, upload: uploadAs('btc_price.jpg'), intervalMinutes: btcIntervalMinutes })
    }
  }
}
