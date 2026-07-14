import fs from 'node:fs'

const [input, versionCodeText, versionName] = process.argv.slice(2)
if (!input || !versionCodeText || !versionName) {
  throw new Error('usage: node patch-android-version.mjs AndroidManifest.xml VERSION_CODE VERSION_NAME')
}

const versionCode = Number(versionCodeText)
const data = fs.readFileSync(input)

const XML_STRING_POOL = 0x0001
const XML_START_ELEMENT = 0x0102

let poolOffset = 8
if (data.readUInt16LE(poolOffset) !== XML_STRING_POOL) {
  throw new Error('Android binary XML string pool not found')
}

const poolSize = data.readUInt32LE(poolOffset + 4)
const stringCount = data.readUInt32LE(poolOffset + 8)
const flags = data.readUInt32LE(poolOffset + 16)
const stringsStart = data.readUInt32LE(poolOffset + 20)
const utf8 = (flags & 0x100) !== 0
const offsetsStart = poolOffset + data.readUInt16LE(poolOffset + 2)

function readLength8(offset) {
  const first = data[offset]
  return (first & 0x80) === 0
    ? { length: first, bytes: 1 }
    : { length: ((first & 0x7f) << 8) | data[offset + 1], bytes: 2 }
}

function readLength16(offset) {
  const first = data.readUInt16LE(offset)
  return (first & 0x8000) === 0
    ? { length: first, bytes: 2 }
    : { length: ((first & 0x7fff) << 16) | data.readUInt16LE(offset + 2), bytes: 4 }
}

function stringInfo(index) {
  if (index < 0 || index >= stringCount) throw new Error(`invalid string index ${index}`)
  let offset = poolOffset + stringsStart + data.readUInt32LE(offsetsStart + index * 4)

  if (utf8) {
    const utf16Length = readLength8(offset)
    offset += utf16Length.bytes
    const byteLength = readLength8(offset)
    offset += byteLength.bytes
    return {
      text: data.toString('utf8', offset, offset + byteLength.length),
      offset,
      byteLength: byteLength.length,
      encoding: 'utf8',
    }
  }

  const length = readLength16(offset)
  offset += length.bytes
  return {
    text: data.toString('utf16le', offset, offset + length.length * 2),
    offset,
    byteLength: length.length * 2,
    encoding: 'utf16le',
  }
}

const strings = Array.from({ length: stringCount }, (_, index) => stringInfo(index).text)

function replaceString(index, replacement) {
  const info = stringInfo(index)
  const encoded = Buffer.from(replacement, info.encoding)
  if (encoded.length !== info.byteLength) {
    throw new Error(`replacement length must remain ${info.byteLength} bytes`)
  }
  encoded.copy(data, info.offset)
}

let foundCode = false
let foundName = false
let offset = poolOffset + poolSize

while (offset + 8 <= data.length) {
  const type = data.readUInt16LE(offset)
  const size = data.readUInt32LE(offset + 4)
  if (size < 8 || offset + size > data.length) throw new Error('invalid Android binary XML chunk')

  if (type === XML_START_ELEMENT) {
    const extOffset = offset + 16
    const attributeStart = data.readUInt16LE(extOffset + 8)
    const attributeSize = data.readUInt16LE(extOffset + 10)
    const attributeCount = data.readUInt16LE(extOffset + 12)
    const attributesOffset = extOffset + attributeStart

    for (let index = 0; index < attributeCount; index += 1) {
      const attributeOffset = attributesOffset + index * attributeSize
      const nameIndex = data.readUInt32LE(attributeOffset + 4)
      const attributeName = strings[nameIndex]

      if (attributeName === 'versionCode') {
        data.writeUInt32LE(versionCode, attributeOffset + 16)
        foundCode = true
      }

      if (attributeName === 'versionName') {
        const rawValueIndex = data.readUInt32LE(attributeOffset + 8)
        const typedValueIndex = data.readUInt32LE(attributeOffset + 16)
        replaceString(rawValueIndex, versionName)
        if (typedValueIndex !== rawValueIndex) replaceString(typedValueIndex, versionName)
        foundName = true
      }
    }
  }

  offset += size
}

if (!foundCode || !foundName) throw new Error('versionCode/versionName attributes not found')
fs.writeFileSync(input, data)
