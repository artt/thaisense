const xx = require("../../thaisense-config.js")
console.log(xx)

console.log("Hello!")

const utils = require("./utils")
const fs = require("fs").promises

async function main() {
  const dirEnts = await fs.readdir('.', { withFileTypes: true })
  console.log(dirEnts)  
}

(async () => {
  await main();
})().catch(e => {
  // Deal with the fact the chain failed
});

// rootDir = rootDir || publicDir
// const htmlFiles = await utils.getHTMLFilesRecursively(rootDir, rootDir, exclude)