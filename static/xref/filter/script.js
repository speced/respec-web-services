const form = document.querySelector('form');
const textarea = form.querySelector('textarea');
const output = form.querySelector('output');
const inputs = [...form.querySelectorAll('input')];

const worker = new Worker('./worker.js');

async function main() {
  improveTextarea();
  form.addEventListener('change', search);
  form.addEventListener('blur', search);
}
main().catch(console.error);

function improveTextarea() {
  textarea.addEventListener('keydown', ev => {
    if (ev.key === 'Enter' && (ev.metaKey || ev.ctrlKey)) {
      ev.preventDefault();
      return search();
    }
  });
}

async function search() {
  const fields = inputs.filter(inp => inp.checked).map(inp => inp.name);
  const query = textarea.value.trim();
  try {
    output.textContent = await filter(query, fields);
    textarea.setCustomValidity('');
  } catch (msg) {
    output.textContent = msg;
    textarea.setCustomValidity(msg);
  }
}

function filter(query, fields) {
  worker.postMessage({ query, fields });
  return new Promise((resolve, reject) => {
    worker.addEventListener(
      'message',
      ({ data }) => (data.result ? resolve(data.result) : reject(data.message)),
      { once: true },
    );
  });
}
