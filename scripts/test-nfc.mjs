import { XMLParser } from 'fast-xml-parser'
import fs from 'fs'

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', parseAttributeValue: true })
const xml = fs.readFileSync('C:/Users/louri/Downloads/NFC01 052026/26260511594485000105650010000314931119438063.xml', 'utf8')
const result = parser.parse(xml)

console.log('Root keys:', Object.keys(result))
const root = result.nfeProc
console.log('nfeProc:', root ? 'FOUND' : 'NOT FOUND')
if (root) {
  const nfe = root.NFe
  const infNFe = nfe?.infNFe
  if (infNFe) {
    const ide = infNFe.ide
    const total = infNFe.total
    console.log('nNF:', ide?.nNF)
    console.log('dhEmi:', ide?.dhEmi)
    console.log('@_Id:', infNFe['@_Id'])
    console.log('vNFTot:', total?.vNFTot)
    console.log('vNF (ICMSTot):', total?.ICMSTot?.vNF)
    console.log('valor_total resolved:', total?.vNFTot || total?.ICMSTot?.vNF)
    console.log('tpNF (tipo):', ide?.tpNF)
    console.log('mod:', ide?.mod)
  } else {
    console.log('infNFe NOT FOUND. NFe keys:', nfe ? Object.keys(nfe) : 'NFe not found')
  }
}
