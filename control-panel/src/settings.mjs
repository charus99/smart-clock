/**
 * Panel setting name -> clock /api/set key + value encoder.
 * Names follow /config; several differ on the write side (brightness -> lcd_brightness,
 * hour12 -> time12_24, sync -> timesync), taken from the clock's own javascript.js.
 * Ranges mirror the clock's own UI controls.
 */
const flag = (value) => {
  if (typeof value !== 'boolean') throw new RangeError('expected true or false')
  return value ? '1' : '0'
}

const integer = (min, max) => (value) => {
  const n = Number(value)
  if (!Number.isInteger(n) || n < min || n > max) throw new RangeError(`expected an integer ${min}-${max}`)
  return String(n)
}

const number = (min, max) => (value) => {
  const n = Number(value)
  if (!Number.isFinite(n) || n < min || n > max) throw new RangeError(`expected a number ${min}-${max}`)
  return String(n)
}

export const SETTINGS = Object.freeze({
  celsius: { deviceKey: 'celsius', encode: flag },
  hour12: { deviceKey: 'time12_24', encode: flag },
  mile: { deviceKey: 'mile', encode: flag },
  sync: { deviceKey: 'timesync', encode: flag },
  zone: { deviceKey: 'zone', encode: number(-12, 14) }, // hours from UTC, may be fractional (e.g. 5.5)
  timeformat: { deviceKey: 'timeformat', encode: integer(0, 2) },
  gifnum: { deviceKey: 'gifnum', encode: integer(1, 5) },
  brightness: { deviceKey: 'lcd_brightness', encode: integer(2, 99) },
  nightmode: { deviceKey: 'nightmode', encode: flag },
  starttime: { deviceKey: 'starttime', encode: integer(18, 23) },
  stoptime: { deviceKey: 'stoptime', encode: integer(5, 12) },
  nightbrightness: { deviceKey: 'nightbrightness', encode: integer(2, 99) },
  color1: { deviceKey: 'color1', encode: integer(0, 0xffff) }, // RGB565
  color2: { deviceKey: 'color2', encode: integer(0, 0xffff) },
  color3: { deviceKey: 'color3', encode: integer(0, 0xffff) }
})

export const THEME_INTERVALS = Object.freeze([0, 5, 10, 15, 30, 60, 300, 1800])
export const PHOTO_INTERVALS = Object.freeze([5, 10, 15, 30, 60, 180, 300])
