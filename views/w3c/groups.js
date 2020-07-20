const { css, html } = require("ucontent");

const style = css`
  h1,
  p {
    text-align: center;
  }

  .tables {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(80ch, 1fr));
    gap: 0.5em;
    align-items: start;
    overflow: auto;
  }

  table tr {
    background: #eee;
  }

  table tr:nth-child(2n) {
    background: #fafafa;
  }

  table thead tr {
    background: aliceblue;
  }

  table td,
  table th {
    padding: 0.5rem;
    text-align: left;
  }

  table th {
    white-space: nowrap;
  }

  caption {
    text-align: left;
    padding: 0.5em;
  }
  caption {
    background: #005a9c;
    color: #fff;
  }
`;

const PR_URL =
  "https://github.com/marcoscaceres/respec.org/blob/gh-pages/routes/w3c/groups.json";

module.exports = ({ groups }) => html`
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>W3C Working Groups supported by ReSpec</title>
      <style>
        ${style}
      </style>
    </head>
    <body>
      <h1>W3C Working Groups and Community Groups supported by ReSpec</h1>
      <p>
        List of possible values for
        <a href="/docs/#group"><code>respecConfig.group</code></a>.
        Send a Pull Request to <a href=${PR_URL}>add missing groups.</a>
      </p>
      <div class="tables">
        ${renderTable(
          groups.filter(({ type }) => type === "wg"),
          "Working Groups",
        )}
        ${renderTable(
          groups.filter(({ type }) => type === "cg"),
          "Community Groups",
        )}
      </div>
    </body>
  </html>
`;

function renderTable(groups, caption) {
  return html`
    <table>
      <caption>
        ${caption}
      </caption>
      <thead>
        <tr>
          <th><code>group</code></th>
          <th>Group ID</th>
          <th>Group Name</th>
        </tr>
      </thead>
      <tbody>
        ${groups.map(renderGroup)}
      </tbody>
    </table>
  `;
}

function renderGroup({ shortname, id, URI, name }) {
  return html`
    <tr>
      <td><code>${shortname}</code></td>
      <td>${id}</td>
      <td>${URI && name ? html`<a href="${URI}">${name}</a>` : ""}</td>
    </tr>
  `;
}
