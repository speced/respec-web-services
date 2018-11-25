const port = parseInt(process.env.PORT, 10) || 3000;
const app = require("express")();

app.post("/xref", ...require("./routes/xref/"));
app.post("/xref/update", ...require("./routes/xref/update"));

app.listen(port, () => console.log(`Listening on port ${port}!`));
