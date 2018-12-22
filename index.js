const port = parseInt(process.env.PORT, 10) || 3000;
const app = require("express")();
const bodyParser = require("body-parser");
const cors = require("cors");

// for preflight request
app.options("/xref", cors({ methods: ["POST"] }));
app.post("/xref", bodyParser.json(), cors(), require("./routes/xref/").route);

app.listen(port, () => console.log(`Listening on port ${port}!`));
