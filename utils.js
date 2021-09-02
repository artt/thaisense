// from gatsby-plugin-typesense

const fs = require("fs").promises
const path = require("path")

exports.getHTMLFilesRecursively = async (dir, rootDir, exclude) => {
  const dirEnts = await fs.readdir(dir, { withFileTypes: true })
  const files = await Promise.all(
    dirEnts.map(dirEnt => {
      const fullPath = path.resolve(dir, dirEnt.name)
      if (dirEnt.isDirectory()) {
        return module.exports.getHTMLFilesRecursively(fullPath, rootDir, exclude)
      } else if (path.extname(fullPath) === ".html") {
        // check against exlclude
        if (exclude && exclude.test(fullPath.substr(rootDir.length))) {
          return null
        }
        return fullPath
      } else {
        return null
      }
    })
  )
  return files.flat().filter(e => e)
}

exports.isObjectEmpty = object => {
  return Object.keys(object).length === 0 && object.constructor === Object
}

exports.generateNewCollectionName = collectionSchema => {
  return `${collectionSchema.name}_${Date.now()}`
}

exports.getNodes = (envHosts, envPorts, envPaths) => {
  const rawHosts = envHosts || "localhost"
  const rawPorts = envPorts || "3000"
  const rawPaths = envPaths || ""
  // assume that all three have the same length, based on hosts

  const tHosts = rawHosts.split(',').map(x => x.trim())
  const tPorts = rawPorts.split(',').map(x => x.trim())
  const tPaths = rawPaths.split(',').map(x => x.trim())

  return tHosts.map((host, i) => ({
    host: host,
    port: tPorts[i] || (tHosts[i] === tHosts[i-1] ? (parseInt(tPorts[0]) + i).toString() : tPorts[0]),
    protocol: (tPorts[i] || tPorts[0]) === "443" ? "https" : "http",
    path: tPaths[i] || tPaths[0],
  }))
}