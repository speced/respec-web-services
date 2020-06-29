const { css, html } = require("ucontent");

const style = css`
  h1 {
    text-align: center;
  }

  table {
    margin: auto;
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

  caption {
    text-align: left;
    padding: 0.5em;
  }
  caption,
  caption a {
    background: #005a9c;
    color: #fff;
  }
`;

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
      <h1>W3C Working Groups supported by ReSpec</h1>
      <table>
        <caption>
          List of possible values for
          <a href="https://github.com/w3c/respec/wiki/group">
            <code>respecConfig.group</code>
          </a>
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
    </body>
  </html>
`;

function renderGroup({ shortname, id, URI, name }) {
  return html`
    <tr>
      <td><code>${shortname}</code></td>
      <td>${id}</td>
      <td>${URI && name ? html`<a href="${URI}">${name}</a>` : ""}</td>
    </tr>
  `;
}
