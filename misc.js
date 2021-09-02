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