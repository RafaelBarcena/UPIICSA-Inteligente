<<<<<<< HEAD
# UPIICSA Inteligente — Prototipo Final

Prototipo funcional para registro y control de una sala de cómputo.

## Estructura
- `index.html`: entrada principal del proyecto modular.
- `src/`: código separado por responsabilidad.
- `prototype_final_upiicsa_inteligente.html`: versión única y lista para abrir.
- `tests/`: pruebas unitarias básicas.
- `.github/workflows/ci.yml`: integración continua.

## Cómo abrir el prototipo
1. Abre `prototype_final_upiicsa_inteligente.html` en el navegador.
2. También puedes servir `index.html` con un servidor local si deseas usar la versión modular.

## Pruebas
```bash
npm test
```

## Enfoque de arquitectura
- **MVC ligero**: el controlador maneja eventos, los servicios concentran lógica y el HTML actúa como vista.
- **SOLID**: responsabilidades separadas por archivo.
- **DRY/KISS**: funciones reutilizables y lógica simple.

## Funciones incluidas
- Simulación de escaneo de credencial.
- Registro manual.
- Selección de equipo con control de ocupación.
- Registro de salidas.
- Historial filtrable.
- Exportación CSV.
- Persistencia local con `localStorage`.

## Notas de entrega
- El prototipo final listo para abrir está en `prototype_final_upiicsa_inteligente.html`.
- El proyecto modular está en `index.html` y `src/`.

## Historial de commits
- feat: modular educational prototype

