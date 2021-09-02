const express = require('express')
const bodyParser = require("body-parser");
const cors = require('cors')
const fetch = require("node-fetch");
const misc = require('./misc')

require("dotenv").config()

const wordcut = require("wordcut");

wordcut.init();

// typesense nodes
const typesenseNodes = misc.getNodes(process.env.GATSBY_TYPESENSE_HOST, process.env.GATSBY_TYPESENSE_PORT, process.env.GATSBY_TYPESENSE_PATH)
const key = process.env.GATSBY_TYPESENSE_SEARCH_KEY || process.env.npm_config_key || "xyz"

// for this process only
const port = process.env.PORT || process.env.GATSBY_THAISENSE_PORT || process.env.npm_config_port || "3000"
const thaisensePath = process.env.GATSBY_THAISENSE_PATH || process.env.npm_config_thaisense_path || "/"
const thaisenseNodeNum = process.argv[2] || process.env.GATSBY_THAISENSE_NODE_NUM || process.env.npm_config_thaisense_node_num || "0"

// const typesenseHost = process.env.GATSBY_TYPESENSE_HOST || process.env.npm_config_typesensehost || process.env.npm_config_host || "localhost"
// const typesensePort = process.env.GATSBY_TYPESENSE_PORT || process.env.npm_config_typesenseport || 8108
// const typesensePath = process.env.GATSBY_TYPESENSE_PATH || process.env.npm_config_typesensepath || "/"
// const typesenseProtocol = typesensePort === "443" ? "https" : "http"

function removeSpaces(str) {
	if (str)
		return str.replace(/[ ](.+?)/gm, '$1')
	else
		return str
}

function processHit(hit) {
	for (const [key, value] of Object.entries(hit.document)) {
	  if (key[0] === "_") {
	  	if (typeof value === 'string') {
		  	hit.document[key] = removeSpaces(hit.document[key])
	  	}
	  	else { // array of string
	  		hit.document[key] = hit.document[key].map(item => removeSpaces(item))
	  	}
	  }
	}
	hit.highlights = hit.highlights.map(highlight => {
		if (highlight.field[0] === "_") {
			if ("snippets" in highlight) {
				highlight.snippets = highlight.snippets.map(snippet => removeSpaces(snippet))
				highlight.values = highlight.values.map(value => removeSpaces(value))
			}
			else if ("snippet" in highlight) {
				highlight.snippet = removeSpaces(highlight.snippet)
				highlight.value = removeSpaces(highlight.value)	
			}
		}
		return highlight
	})
	return {_highlightResult: hit._highlightResult, _snippetResult: hit._snippetResult}
}

const app = express()

const corsOptions = {
	origin: "*",
	optionsSuccessStatus: 200,
}
app.use(cors(corsOptions))
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json({ type: '*/*'}));

app.get(`${thaisensePath === "/" ? "" : thaisensePath}/`, (req, res) => {
	console.log("Received a request.")
  res.send('I can hear you!\n')
})

// TODO: split this into 2 searches, one with segmentation for "_x" fields,
// another without segmentation for regular fields.

// TODO: implement sorting ourselves...

app.post(`${thaisensePath === "/" ? "" : thaisensePath}/multi_search`, (req, res) => {
	// console.log("reqest > ", req.body);
	req.body.searches[0].q = req.body.searches[0].q + " " + wordcut.cut(req.body.searches[0].q, " ")
	// there's a bug with typesense? year<=x returns everything
	req.body.searches[0].filter_by = req.body.searches[0].filter_by.replace(/((?: |^)year:<)=/gm, '$1')
	console.log("reqest > ", req.body);
	const targetNode = typesenseNodes[thaisenseNodeNum]
	fetch(`${targetNode.protocol}://${targetNode.host}:${targetNode.port}${targetNode.path === "/" ? "" : targetNode.path}/multi_search?x-typesense-api-key=${key}`, {
	  method: 'post',
	  headers: {
	    'Accept': 'application/json, text/plain, */*',
	    'Content-Type': 'application/json',
	  },
	  body: JSON.stringify(req.body)
	  // 	}).then(res => res.json())
	  // .then(res => console.log(res));
	}).then(newres => newres.json())
		.then(newres => {
			console.log("return > ", newres)
			// console.log("return > ", newres.results[0].hits)
			newres.results.map(result => {
				if (result.code === 400) {
					res.statusMessage = result.error
					res.status(400).end()
					return
				}
				result.hits.map(hit => processHit(hit))
			})
			res.send(newres)
		})
		// .then(newres => res.send(newres))
})

app.listen(port, () => {
  console.log(`Thaisense listening at ${port}`)
	const targetNode = typesenseNodes[thaisenseNodeNum]
	console.log(`Relaying requests to ${targetNode.protocol}://${targetNode.host}:${targetNode.port}${targetNode.path === "/" ? "" : targetNode.path}`)
  console.log(`Read-only key: ${key}`)
})