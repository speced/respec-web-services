google.charts.load("current", { packages: ["line", "corechart"] });
google.charts.setOnLoadCallback(main);

const form = document.getElementById("size-form");
const columnMap = { time: 0, sha: 1, size: 2, xferSize: 3 };

async function main() {
  const entries = await fetchData();
  const dataTable = getDataTable(entries);
  window.addEventListener("resize", () => drawChart(dataTable));
  form.addEventListener("change", () => drawChart(dataTable));
  drawChart(dataTable);
}

async function fetchData() {
  const text = await fetch("/respec/size").then(res => res.text());
  const lines = text.trimEnd().split("\n");
  return lines.map(entry =>
    JSON.parse(entry, (k, v) => (k === "time" ? new Date(v * 1000) : v)),
  );
}

function getDataTable(entries) {
  const table = new google.visualization.DataTable();
  table.addColumn("datetime", "Time");
  table.addColumn("string", "Commit SHA");
  table.addColumn("number", "Size (bytes)");
  table.addColumn("number", "Size (bytes)");

  const idxMap = Object.entries(columnMap).sort((a, b) => a[1] - b[1]);
  const toRow = entry => idxMap.map(a => entry[a[0]]);
  table.addRows(entries.map(toRow));

  return table;
}

/** @param {google.visualization.DataTable} data */
function drawChart(data) {
  const { checked: showTransferredSize } = form.xferSize;
  const months = parseInt(form.duration.value, 10);

  let viewWindow;
  if (months) {
    const date = new Date();
    date.setMonth(date.getMonth() - months);
    viewWindow = { min: date };
  }

  const title = showTransferredSize ? "Size (br/gzip, bytes)" : "Size (bytes)";
  /** @type {google.visualization.LineChartOptions} */
  const drawOptions = {
    theme: "maximized",
    legend: "none",
    tooltip: { trigger: "selection" },
    vAxis: { title, format: "short" },
    hAxis: { viewWindow },
    explorer: {
      keepInBounds: true,
      axis: "horizontal",
      actions: ["dragToZoom", "rightClickToReset"],
      maxZoomIn: 0.1,
    },
  };

  const elem = document.getElementById("size-chart");
  const chart = new google.visualization.LineChart(elem);
  chart.setAction({
    id: "view_commit",
    text: "View commit ↗️",
    action() {
      const { row } = chart.getSelection().slice(-1)[0];
      const sha = data.getValue(row, 1);
      window.open(`https://github.com/speced/respec/commit/${sha}`);
    },
  });

  const view = new google.visualization.DataView(data);
  const key = showTransferredSize ? "xferSize" : "size";
  view.setColumns([columnMap.time, columnMap[key]]);
  chart.draw(view, drawOptions);
}
