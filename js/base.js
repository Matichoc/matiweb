async function loadComponent(id, path, vars = {}) {
  try {
    const response = await fetch(path);
    if (!response.ok) throw new Error('Error cargando ' + path);
    let html = await response.text();
    for (const [key, value] of Object.entries(vars)) {
      html = html.split(`{{${key}}}`).join(value);
    }
    const target = document.getElementById(id);
    if (target) target.innerHTML = html;
  } catch (error) {
    console.error(error);
  }
}
