import sharp from 'sharp'
import { buildCardModel } from './card-model.mjs'
import { cardSvg } from './card.mjs'
import { theme } from './theme.mjs'

/** usage + now -> JPEG buffer. */
export function renderCard(usage, now) {
  const svg = cardSvg(buildCardModel(usage, now))
  return sharp(Buffer.from(svg)).jpeg({ quality: theme.jpegQuality }).toBuffer()
}
