# Biomedical Core V1 — Branded V4 Demo

V4 incorpora el flujo aclarado para Control de Entrega de Materiales.

## Usuarios demo
- Sol Demo / 2468 — Super Admin
- Diego Demo / 1357 — Operador
- Jorge Demo / 9876 — Operador

## Entrega de Materiales
Todos ven:
- Nuevo registro: muestra únicamente entregas asignadas al usuario. Los datos base (remito, material, sanatorio, paciente y médico) ya vienen precargados.
- Mis entregas: ver y gestionar entregas propias, incluidas finalizadas.

Super Admin además ve:
- Gestionar entrega de otro usuario: selecciona por número de remito una entrega asignada a otra persona.
- Encontrar registro: búsqueda global por número de remito, sanatorio, material, médico o paciente; filtros por estado y usuario.

## Flujo demo
Asignado → Marcar como retirado → Completar entrega.
Al completar entrega sólo se pide:
- Recibido por
- Sector
- Foto del remito

La app conserva la diferencia entre usuario asignado y usuario que efectivamente retira/entrega.

Este prototipo aún no está conectado a Google Sheets.
