import { createRequire } from 'node:module'

// sharp is installed once, in the mini-display package; reuse that copy instead of a second install.
const require = createRequire(new URL('../../../mini-display-claude-ai-usage/package.json', import.meta.url))
const sharpModule = require('sharp')
const sharp = sharpModule.default ?? sharpModule

export const svgToJpeg = (svg) => sharp(Buffer.from(svg)).jpeg({ quality: 95 }).toBuffer()
