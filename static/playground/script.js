const form = document.querySelector("form");
const [respecConfig, body] = document.querySelectorAll("textarea");
const output = document.querySelector("output");
const respecScript = "https://www.w3.org/Tools/respec/respec-w3c";

form.addEventListener("change", update);
update();

async function update() {
  const html = getHTML(respecConfig.value, body.value);
  const iframe = document.createElement("iframe");
  iframe.srcdoc = html;
  output.innerHTML = "";
  output.append(iframe);
}

function getHTML(respecConfig, body) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="${respecScript}" class="remove"></script>
  <script class="remove">${respecConfig}</script>
</head>
<body>
${body}
</body>
</html>
`;
}
