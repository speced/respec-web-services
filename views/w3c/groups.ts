import { css, html } from "ucontent";
import { GroupMeta, Groups, GroupsByType } from "../../routes/w3c/group.js";

const style = css`
  h1,
  p {
    text-align: center;
  }

  table {
    width: 100%;
    max-width: 120ch;
    margin: 1em auto;
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

export default ({ groups }: { groups: GroupsByType }) => html`
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
      </p>
      <section class="tables">
        ${renderTable(groups.wg, "Working Groups")}
        ${renderTable(groups.bg, "Business Groups")}
        ${renderTable(groups.ig, "Interest Groups")}
        ${renderTable(groups.misc, "Miscellaneous Groups")}
        ${renderTable(groups.cg, "Community Groups")}
      </section>
    </body>
  </html>
`;

function renderTable(groups: Groups, caption: string) {
  return html`
    <table>
      <caption>
        ${caption}
      </caption>
      <thead>
        <tr>
          <th><code>group</code></th>
          <th>Group Name</th>
        </tr>
      </thead>
      <tbody>
        ${Object.entries(groups).map(renderGroup)}
      </tbody>
    </table>
  `;
}

function renderGroup([shortname, { id, URI, name }]: [string, GroupMeta]) {
  return html`
    <tr>
      <td><code>${shortname}</code></td>
      <td>${URI && name ? html`<a href="${URI}">${name}</a>` : ""}</td>
    </tr>
  `;
}
