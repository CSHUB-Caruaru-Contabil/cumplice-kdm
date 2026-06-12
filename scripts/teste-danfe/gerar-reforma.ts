import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { parseNFeXML } from '../../src/lib/parsers/nfe'
import { gerarPdfNFe } from '../../src/lib/parsers/nfe-pdf'

const __dirname = dirname(fileURLToPath(import.meta.url))

async function main() {
  const xml = readFileSync(join(__dirname, 'sample-nfce-reforma.xml'), 'utf-8')
  const parsed = await parseNFeXML(xml)
  console.log(JSON.stringify(parsed, null, 2))

  const blob = await gerarPdfNFe([parsed])
  const buf = Buffer.from(await blob.arrayBuffer())
  writeFileSync(join(__dirname, 'output-reforma.pdf'), buf)
  console.log('PDF gerado:', join(__dirname, 'output-reforma.pdf'), buf.length, 'bytes')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
