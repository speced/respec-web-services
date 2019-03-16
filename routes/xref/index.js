const xrefResponseBody = require("respec-xref-route");
const { readFileSync, watch } = require("fs");
const path = require("path");

const dataFile = path.join(process.cwd(), "xref-data.json");
let xrefData = JSON.parse(readFileSync(dataFile, "utf8"));

module.exports.route = function route(req, res) {
  const body = xrefResponseBody(req.body, xrefData);
  res.json(body);
};

// reload xref data if xref-data.json is modified
watch(dataFile, debounce(reloadFile, 1000));

function reloadFile(eventType) {
  if (eventType === "change") {
    console.log("xref-data.json modified. reloading...");
    xrefData = JSON.parse(readFileSync(dataFile, "utf8"));
  }
}

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn(...args);
      timer = null;
    }, delay);
  };
}
