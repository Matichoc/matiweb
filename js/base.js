async function loadComponent(id, path) {
  try {
    const response = await fetch(path);
    if (!response.ok) throw new Error('Error cargando ' + path);
    const html = await response.text();
    document.getElementById(id).innerHTML = html;

    // Añadir enlace "Volver al inicio" solo en el footer
    if (id === 'footer') {
      const volverInicio = document.createElement('p');
      volverInicio.style.marginTop = '10px';
      volverInicio.innerHTML = '<a href="index.html" style="color: #FFC800; text-decoration: none;">Volver al inicio</a>';
      document.getElementById(id).appendChild(volverInicio);
    }
  } catch (error) {
    console.error(error);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadComponent('header', 'components/header.html');
  loadComponent('banner', 'components/banner.html');
  loadComponent('historia', 'components/historia.html');
  loadComponent('productos', 'components/productos.html');
  loadComponent('tienda', 'components/tienda.html');
  loadComponent('footer', 'components/footer.html');
});