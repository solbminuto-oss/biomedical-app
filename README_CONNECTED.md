# Biomedical V7 — CONNECTED

Esta build ya contiene la URL /exec del Biomedical API.

## Importante
- Activación online: valida contra el Core de Biomedical.
- Sincronización: descarga entregas desde el spreadsheet operativo.
- Retirado, Entregado y Nota actualizan el backend.
- Foto de remito: se sube a Drive mediante Apps Script y se guarda la URL.
- Offline: mantiene copia local y cola cambios simples para sincronizar al volver la conexión.

Antes de producción hay que probar el circuito completo con registros de prueba reales en el Sheet.
