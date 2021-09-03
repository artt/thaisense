const express = require('express')
const bodyParser = require("body-parser");
const cors = require('cors')
const fetch = require("node-fetch");
const misc = require('./misc')

require("dotenv").config()

const wordcut = require("wordcut");
const { next } = require('cheerio/lib/api/traversing');

wordcut.init();

// typesense nodes
let typesenseNodes = misc.getNodes(process.env.GATSBY_TYPESENSE_HOST, process.env.GATSBY_TYPESENSE_PORT, process.env.GATSBY_TYPESENSE_PATH)
if (!process.env.GATSBY_TYPESENSE_HOST && !process.env.GATSBY_TYPESENSE_PORT && !process.env.GATSBY_TYPESENSE_PATH) {
	typesenseNodes[0].port = "8108"
}
const key = process.env.GATSBY_TYPESENSE_SEARCH_KEY || process.env.npm_config_key || "xyz"

const thaisenseNodeNum = process.env.GATSBY_THAISENSE_NODE_NUM || process.env.npm_config_thaisense_node_num || "0"
const targetNode = typesenseNodes[thaisenseNodeNum]

let thaisenseNodes = misc.getNodes(process.env.GATSBY_THAISENSE_HOST, process.env.GATSBY_THAISENSE_PORT, process.env.GATSBY_THAISENSE_PATH)
const thaisenseNode = thaisenseNodes[thaisenseNodeNum]

const port = process.env.PORT || thaisenseNode.port
const thaisensePath = thaisenseNode.path


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
  res.send('Thaisense can hear you!\n')
})

app.get(`${thaisensePath === "/" ? "" : thaisensePath}/health`, (req, res) => {
	fetch(`${targetNode.protocol}://${targetNode.host}:${targetNode.port}${targetNode.path === "/" ? "" : targetNode.path}/health`).then(typesenseRes => {
		return typesenseRes.json()
	}).then(x => {
		console.log(`Typesense Healthcheck: ${x.ok ? "OK" : "Not OK"}`)
		res.send(`Typesense Healthcheck: ${x.ok ? "OK" : "Not OK"}\n`)
	}).catch(err => {
		console.error(err.code, err.message)
		res.status(503).send("ERROR: Could not perform healthcheck\n")
		return
	})
})

// TODO: split this into 2 searches, one with segmentation for "_x" fields,
// another without segmentation for regular fields.

// TODO: implement sorting ourselves...

app.post(`${thaisensePath === "/" ? "" : thaisensePath}/multi_search`, (req, res) => {
	// console.log("reqest > ", req.body);
	req.body.searches[0].q = req.body.searches[0].q + " " + wordcut.cut(req.body.searches[0].q, " ")
	// there's a bug with typesense? year<=x returns everything
	req.body.searches[0].filter_by = req.body.searches[0].filter_by.replace(/((?: |^)year:<)=/gm, '$1')
	// console.log("reqest > ", req.body);
	console.log(`query: ${req.body.searches[0].q}`);
	fetch(`${targetNode.protocol}://${targetNode.host}:${targetNode.port}${targetNode.path === "/" ? "" : targetNode.path}/multi_search?x-typesense-api-key=${key}`, {
	  method: 'post',
	  headers: {
	    'Accept': 'application/json, text/plain, */*',
	    'Content-Type': 'application/json',
	  },
	  body: JSON.stringify(req.body)
	}).then(newres => {
		console.log(`Return status: ${newres.status}`)
		return newres.json()
	}).then(newres => {
		// console.log("return > ", newres)
		// console.log("return > ", newres.results[0].hits)
		newres.results.map(result => {
			// if (result.code === 400) {
			// 	res.statusMessage = result.error
			// 	res.status(400).end()
			// 	return
			// }
			result.hits.map(hit => processHit(hit))
		})
		res.send(newres)
	}).catch(err => {
		console.error(err.code, err.message)
		res.status(503).send("ERROR: Problem connecting to server")
		return
	})
})

app.listen(port, () => {
  console.log(`Thaisense listening at ${thaisenseNode.protocol}://${thaisenseNode.host}:${port}${thaisenseNode.path}`)
	console.log(`Relaying requests to ${targetNode.protocol}://${targetNode.host}:${targetNode.port}${targetNode.path === "/" ? "" : targetNode.path}`)
  console.log(`Read-only key: ${key}`)

	fetch(`${targetNode.protocol}://${targetNode.host}:${targetNode.port}${targetNode.path === "/" ? "" : targetNode.path}/health`).then(res => res.json()).then(res => console.log(`Typesense Healthcheck: ${res.ok ? "OK" : "Not OK"}`)).catch(err => console.error(err.code, err.message))
})