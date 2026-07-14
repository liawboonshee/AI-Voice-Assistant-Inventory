import fs from 'node:fs'

const [input, output] = process.argv.slice(2)
if (!input || !output) throw new Error('usage: node zip-align.mjs INPUT.apk OUTPUT.apk')

const source = fs.readFileSync(input)
const EOCD = 0x06054b50
const CENTRAL = 0x02014b50
const LOCAL = 0x04034b50

let eocdOffset = -1
const minimumEocdOffset = Math.max(0, source.length - 0xffff - 22)
for (let offset = source.length - 22; offset >= minimumEocdOffset; offset -= 1) {
  if (source.readUInt32LE(offset) === EOCD) {
    eocdOffset = offset
    break
  }
}
if (eocdOffset < 0) throw new Error('ZIP end record not found')

const entryCount = source.readUInt16LE(eocdOffset + 10)
const centralOffset = source.readUInt32LE(eocdOffset + 16)
const entries = []
let cursor = centralOffset

for (let index = 0; index < entryCount; index += 1) {
  if (source.readUInt32LE(cursor) !== CENTRAL) throw new Error('invalid central directory')
  const nameLength = source.readUInt16LE(cursor + 28)
  const extraLength = source.readUInt16LE(cursor + 30)
  const commentLength = source.readUInt16LE(cursor + 32)
  const length = 46 + nameLength + extraLength + commentLength
  entries.push({
    centralRecord: Buffer.from(source.subarray(cursor, cursor + length)),
    oldLocalOffset: source.readUInt32LE(cursor + 42),
    newLocalOffset: 0,
  })
  cursor += length
}

const byLocalOffset = [...entries].sort((left, right) => left.oldLocalOffset - right.oldLocalOffset)
const localParts = []
let outputOffset = 0

for (let index = 0; index < byLocalOffset.length; index += 1) {
  const entry = byLocalOffset[index]
  const oldOffset = entry.oldLocalOffset
  const oldEnd = index + 1 < byLocalOffset.length ? byLocalOffset[index + 1].oldLocalOffset : centralOffset
  if (source.readUInt32LE(oldOffset) !== LOCAL) throw new Error('invalid local file header')

  const method = source.readUInt16LE(oldOffset + 8)
  const nameLength = source.readUInt16LE(oldOffset + 26)
  const extraLength = source.readUInt16LE(oldOffset + 28)
  const dataOffset = oldOffset + 30 + nameLength + extraLength
  const headerAndName = Buffer.from(source.subarray(oldOffset, oldOffset + 30 + nameLength))
  // Android's packager may leave raw alignment bytes in the local extra area.
  // Rebuild that area from scratch; central-directory metadata remains intact.
  const oldExtra = Buffer.alloc(0)

  let alignmentExtra = Buffer.alloc(0)
  if (method === 0) {
    const baseDataOffset = outputOffset + headerAndName.length + oldExtra.length
    const paddingLength = (4 - (baseDataOffset % 4)) % 4
    alignmentExtra = Buffer.alloc(paddingLength)
  }

  headerAndName.writeUInt16LE(alignmentExtra.length, 28)
  const remainder = Buffer.from(source.subarray(dataOffset, oldEnd))
  entry.newLocalOffset = outputOffset
  localParts.push(headerAndName, oldExtra, alignmentExtra, remainder)
  outputOffset += headerAndName.length + oldExtra.length + alignmentExtra.length + remainder.length
}

const centralParts = []
for (const entry of entries) {
  entry.centralRecord.writeUInt32LE(entry.newLocalOffset, 42)
  centralParts.push(entry.centralRecord)
}

const centralDirectory = Buffer.concat(centralParts)
const eocd = Buffer.from(source.subarray(eocdOffset))
eocd.writeUInt32LE(centralDirectory.length, 12)
eocd.writeUInt32LE(outputOffset, 16)

fs.writeFileSync(output, Buffer.concat([...localParts, centralDirectory, eocd]))
